import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

const WORK_TYPES_KEY = ['work-types']

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: WORK_TYPES_KEY })
}

export function useCreateWorkType() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.workTypes.create,
    onSuccess: invalidate,
  })
}

export function useUpdateWorkType() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.workTypes.update>[1] }) =>
      api.workTypes.update(id, data),
    onSuccess: invalidate,
  })
}

export function useDeactivateWorkType() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.workTypes.deactivate,
    onSuccess: invalidate,
  })
}

export function useReorderWorkTypes() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.workTypes.reorder,
    onSuccess: invalidate,
  })
}
