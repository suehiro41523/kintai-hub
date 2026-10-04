import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import type { PaidPlan } from '@/lib/apiClient'

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription.get().then((r) => r.subscription),
    staleTime: 30_000,
  })
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: ({ plan, seats }: { plan: PaidPlan; seats: number }) =>
      api.subscription.checkout(plan, seats),
  })
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => api.subscription.portal(),
  })
}

export function useUpdateSeats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (seats: number) => api.subscription.updateSeats(seats),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  })
}
