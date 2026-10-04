import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) throw new Error('SUPABASE_URL が設定されていません')
if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY が設定されていません')
if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません')

// サインアップ（supabase.auth.signUp）等、通常クライアント相当の操作をサーバー側から行うためのクライアント。
// 確認メール送信はSupabase側のEmail Templates + カスタムSMTP(Resend)設定に任せる。
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// service_role key を使う管理クライアント。ユーザー作成・招待・削除などAdmin API専用。
// フロントエンドには絶対に公開しない。
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 2025-10-1以降に作成されたSupabaseプロジェクトはデフォルトでES256(非対称鍵)署名になり、
// 固定のHS256共有シークレットでは検証できない。プロジェクトのJWKSエンドポイントから公開鍵を
// 取得して検証することで、HS256/ES256いずれのプロジェクトでも動作する
// (jose が token の kid/alg ヘッダーから鍵を自動選択する)
const jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))

export type SupabaseAccessTokenPayload = {
  sub: string
  email?: string
}

// Supabase Authが発行したアクセストークンを検証する。
// PostgRESTを経由しない直接DB接続構成のため、Supabase側のRLS連携(auth.uid())は使わず、
// ここで検証したsubからcore.usersを引いてapp.tenant_idへ手動で注入する(AUTH-DESIGN.md参照)。
export async function verifyAccessToken(token: string): Promise<SupabaseAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwks)
    if (typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    }
  } catch {
    return null
  }
}
