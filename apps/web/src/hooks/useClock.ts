import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

const TODAY_KEY = ['time-records', 'today'] as const
const WORK_TYPES_KEY = ['work-types'] as const

export function useWorkTypes() {
  return useQuery({
    queryKey: WORK_TYPES_KEY,
    queryFn: () => api.workTypes.list(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTodayRecords() {
  return useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => api.timeRecords.today(),
    // 稼働中は30秒ごとにリフェッチして経過時間の精度を保つ
    refetchInterval: 30_000,
  })
}

function useInvalidateToday() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: TODAY_KEY })
}

export function useClockIn() {
  const invalidate = useInvalidateToday()
  return useMutation({
    mutationFn: (workTypeId: string) => api.timeRecords.clockIn(workTypeId),
    onSuccess: invalidate,
  })
}

export function useClockOut() {
  const invalidate = useInvalidateToday()
  return useMutation({
    mutationFn: (workTypeId: string) => api.timeRecords.clockOut(workTypeId),
    onSuccess: invalidate,
  })
}

export function useBreakStart() {
  const invalidate = useInvalidateToday()
  return useMutation({
    mutationFn: (workTypeId: string) => api.timeRecords.breakStart(workTypeId),
    onSuccess: invalidate,
  })
}

export function useBreakEnd() {
  const invalidate = useInvalidateToday()
  return useMutation({
    mutationFn: (workTypeId: string) => api.timeRecords.breakEnd(workTypeId),
    onSuccess: invalidate,
  })
}

export function useSwitchType() {
  const invalidate = useInvalidateToday()
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api.timeRecords.switchType(from, to),
    onSuccess: invalidate,
  })
}
