import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

const MY_KEY = ['requests', 'my']
const PENDING_KEY = ['requests', 'pending']

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: MY_KEY })
    qc.invalidateQueries({ queryKey: PENDING_KEY })
  }
}

export function useMyRequests() {
  return useQuery({
    queryKey: MY_KEY,
    queryFn: () => api.requests.listMy().then((r) => r.requests),
    staleTime: 30_000,
  })
}

export function usePendingRequests() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => api.requests.listPending().then((r) => r.requests),
    staleTime: 30_000,
  })
}

export function useCreateRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.requests.create,
    onSuccess: invalidate,
  })
}

export function useApproveRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string | null }) =>
      api.requests.approve(id, comment),
    onSuccess: invalidate,
  })
}

export function useRejectRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string | null }) =>
      api.requests.reject(id, comment),
    onSuccess: invalidate,
  })
}

export function useCancelRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.requests.cancel,
    onSuccess: invalidate,
  })
}
