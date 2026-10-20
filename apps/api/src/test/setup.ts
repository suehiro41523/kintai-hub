import { vi } from 'vitest'

// Supabase Authには接続せず、アクセストークンの文字列をそのままSupabase側のユーザーID(sub)として扱う。
// テストでは core.users.auth_user_id と同じ値を Bearer トークンに指定すれば、そのユーザーとして認証される
vi.mock('../lib/supabase.js', () => ({
  supabaseAuth: {},
  supabaseAdmin: {},
  verifyAccessToken: async (token: string) => ({ sub: token }),
}))
