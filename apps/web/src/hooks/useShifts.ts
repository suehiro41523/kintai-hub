import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

const PATTERNS_KEY = ['shift-patterns']

function useInvalidateShifts(year: number, month: number) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['shifts', 'my', year, month] })
    qc.invalidateQueries({ queryKey: ['shifts', 'team', year, month] })
  }
}

export function useShiftPatterns() {
  return useQuery({
    queryKey: PATTERNS_KEY,
    queryFn: () => api.shiftPatterns.list().then((r) => r.patterns),
    staleTime: 60_000,
  })
}

export function useCreateShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.shiftPatterns.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: PATTERNS_KEY }),
  })
}

export function useUpdateShiftPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Parameters<typeof api.shiftPatterns.update>[1]
    }) => api.shiftPatterns.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PATTERNS_KEY }),
  })
}

export function useMyShifts(year: number, month: number) {
  const { from, to } = monthRange(year, month)
  return useQuery({
    queryKey: ['shifts', 'my', year, month],
    queryFn: () => api.shifts.listMy(from, to).then((r) => r.shifts),
    staleTime: 30_000,
  })
}

export function useTeamShifts(year: number, month: number) {
  const { from, to } = monthRange(year, month)
  return useQuery({
    queryKey: ['shifts', 'team', year, month],
    queryFn: () => api.shifts.listTeam(from, to).then((r) => r.shifts),
    staleTime: 30_000,
  })
}

export function useBulkUpsertShifts(year: number, month: number) {
  const invalidate = useInvalidateShifts(year, month)
  return useMutation({
    mutationFn: api.shifts.bulkUpsert,
    onSuccess: invalidate,
  })
}

export function useDeleteShift(year: number, month: number) {
  const invalidate = useInvalidateShifts(year, month)
  return useMutation({
    mutationFn: api.shifts.delete,
    onSuccess: invalidate,
  })
}
