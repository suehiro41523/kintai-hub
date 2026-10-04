import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL が設定されていません')
if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません')

// セッションはCookieではなくSDK管理下（localStorage）に保持し、apps/apiへのリクエストには
// Authorization: Bearer で明示的に付与する（AUTH-DESIGN.md参照）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
