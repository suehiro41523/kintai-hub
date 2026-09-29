import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { findUserByEmail, findUserById } from '../../db/queries/users.js'
import { tenants, users } from '../../db/schema/core.js'
import { logger } from '../../lib/logger.js'
import { passwordSchema } from '../../lib/password.js'
import { supabaseAdmin, supabaseAuth } from '../../lib/supabase.js'
import { formatValidationError } from '../../lib/validation.js'
import { verifySession } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import type { AppEnv } from '../../types.js'

const SignUpSchema = z.object({
  company_name: z.string().min(1).max(255),
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: passwordSchema,
  plan: z.literal('free'),
})

// サインイン・サインアウト・パスワードリセット・MFA等はフロントエンドがSupabaseクライアントSDKで
// 直接Supabase Authを呼び出す(apps/apiを経由しない)。ここに残るのはテナント作成を伴う
// サインアップと、tenantId/roleを返すmeのみ(詳細はAUTH-DESIGN.md)。
export const authRouter = new Hono<AppEnv>()

  .post('/sign-up', rateLimit, zValidator('json', SignUpSchema, formatValidationError), async (c) => {
    const data = c.req.valid('json')

    const existing = await findUserByEmail(data.email)
    if (existing) {
      return c.json(
        { error: 'このメールアドレスは既に登録されています', code: 'CONFLICT' },
        409,
      )
    }

    // Supabase Auth側にユーザーを作成する。admin.createUserではなくsignUpを使うことで、
    // 確認メール送信(Supabase Email Templates + カスタムSMTP)まで任せる
    const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (signUpError || !signUpData.user) {
      logger.error({ err: signUpError, email: data.email }, 'sign_up_supabase_create_user_failed')
      return c.json(
        { error: '登録に失敗しました。時間をおいて再度お試しください', code: 'INTERNAL_ERROR' },
        500,
      )
    }

    // 既に登録済み(未確認含む)のメールアドレスの場合、Supabaseはエラーを返さず
    // identitiesが空のuserを返すことがあるため、その場合は重複として扱う
    if (signUpData.user.identities && signUpData.user.identities.length === 0) {
      return c.json(
        { error: 'このメールアドレスは既に登録されています', code: 'CONFLICT' },
        409,
      )
    }

    const authUserId = signUpData.user.id
    const tenantId = randomUUID()
    const userId = randomUUID()
    const now = new Date()

    try {
      // core.tenants + core.users をひとつのトランザクションで作成
      await db.transaction(async (tx) => {
        await tx.insert(tenants).values({
          id: tenantId,
          name: data.company_name,
          plan: data.plan,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })

        // role は常に 'admin' 固定。リクエストに role 相当のパラメータがあってもスキーマに存在しないため無視される
        await tx.insert(users).values({
          id: userId,
          tenantId,
          authUserId,
          name: data.name,
          email: data.email,
          role: 'admin',
          employmentType: 'full_time',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
      })
    } catch (err) {
      // 補償処理: core.tenants/core.usersの作成に失敗したらSupabase側のユーザーも削除する
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch((delErr) => {
        logger.error({ err: delErr, authUserId }, 'sign_up_compensation_delete_failed')
      })
      logger.error({ err, email: data.email }, 'sign_up_transaction_failed')
      return c.json(
        { error: '登録に失敗しました。時間をおいて再度お試しください', code: 'INTERNAL_ERROR' },
        500,
      )
    }

    logger.info({ tenantId, userId, email: data.email }, 'tenant_signed_up')

    return c.json(
      {
        user: {
          id: userId,
          tenantId,
          name: data.name,
          email: data.email,
          role: 'admin' as const,
        },
        tenant: {
          id: tenantId,
          name: data.company_name,
          plan: data.plan,
          status: 'active',
          maxUsers: null,
        },
      },
      201,
    )
  })

  .get('/me', verifySession, async (c) => {
    const coreUser = await findUserById(c.get('userId'))
    if (!coreUser || !coreUser.isActive) {
      return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
    }

    return c.json({
      user: {
        id: coreUser.id,
        tenantId: coreUser.tenantId,
        name: coreUser.name,
        email: coreUser.email,
        role: coreUser.role,
      },
    })
  })
