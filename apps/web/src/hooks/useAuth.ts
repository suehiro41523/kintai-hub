'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/apiClient'
import { supabase } from '@/lib/supabaseClient'

const ME_KEY = ['auth', 'me']

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        throw new Error('UNAUTHENTICATED')
      }
      return api.auth.me().then((r) => r.user)
    },
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useSignIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.clear()
      // core.users側のtenantId/roleはSupabaseセッションとは別管理のため、成功後に取得し直す
      qc.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

export function useSignUp() {
  return useMutation({
    mutationFn: (data: {
      company_name: string
      name: string
      email: string
      password: string
      plan: 'free'
    }) => api.auth.signUp(data),
    // サインアップ時点ではSupabase側の確認メール待ちでセッションは発行されない（AUTH-DESIGN.md参照）。
    // ログイン状態にはしない
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ME_KEY })
      router.push('/login')
    },
  })
}
