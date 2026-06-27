'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/apiClient'

const ME_KEY = ['auth', 'me']

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.auth.me().then((r) => r.user),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useSignIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.auth.signIn(email, password),
    onSuccess: (data) => {
      qc.clear()
      qc.setQueryData(ME_KEY, data.user)
    },
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: api.auth.signOut,
    onSuccess: () => {
      qc.removeQueries({ queryKey: ME_KEY })
      router.push('/login')
    },
  })
}
