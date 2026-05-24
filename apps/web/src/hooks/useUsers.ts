import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

const USERS_KEY = ['users']

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: USERS_KEY })
}

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => api.users.list().then((r) => r.users),
    staleTime: 30_000,
  })
}

export function useCreateUser() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.users.create,
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.users.update>[1] }) =>
      api.users.update(id, data),
    onSuccess: invalidate,
  })
}

export function useDeactivateUser() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.users.deactivate,
    onSuccess: invalidate,
  })
}
