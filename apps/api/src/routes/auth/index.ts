import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { hashPassword } from 'better-auth/crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { findUserByEmail, findUserById } from '../../db/queries/users.js'
import { authAccount, authUser } from '../../db/schema/auth.js'
import { tenants, users } from '../../db/schema/core.js'
import { auth } from '../../lib/auth.js'
import { logger } from '../../lib/logger.js'
import { passwordSchema } from '../../lib/password.js'
import { formatValidationError } from '../../lib/validation.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import type { AppEnv } from '../../types.js'

const SignUpSchema = z.object({
  company_name: z.string().min(1).max(255),
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: passwordSchema,
  plan: z.literal('free'),
})

// Better Auth のネイティブエンドポイントに対するラッパー。
// フロントエンドの既存 API 呼び出しとの互換性を保ちつつ、core.users のデータを返す。
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

    const tenantId = randomUUID()
    const userId = randomUUID()
    const now = new Date()
    const hashedPwd = await hashPassword(data.password)

    // core.tenants + auth.user + auth.account + core.users をひとつのトランザクションで作成
    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: data.company_name,
        plan: data.plan,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })

      await tx.insert(authUser).values({
        id: userId,
        name: data.name,
        email: data.email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })

      await tx.insert(authAccount).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPwd,
        createdAt: now,
        updatedAt: now,
      })

      // role は常に 'admin' 固定。リクエストに role 相当のパラメータがあってもスキーマに存在しないため無視される
      await tx.insert(users).values({
        id: userId,
        tenantId,
        name: data.name,
        email: data.email,
        role: 'admin',
        employmentType: 'full_time',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    })

    // /sign-in と同じ方式で Better Auth にセッション Cookie を発行させる
    const baResponse = await auth.api.signInEmail({
      body: { email: data.email, password: data.password },
      headers: c.req.raw.headers,
      asResponse: true,
    })

    for (const [key, value] of baResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        c.header('set-cookie', value, { append: true })
      }
    }

    // 確認メール送信。送信に失敗してもサインアップ自体は成功として扱う（再送信ボタンで復旧可能なため）
    try {
      await auth.api.sendVerificationEmail({
        body: {
          email: data.email,
          callbackURL: `${(process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/verify-email`,
        },
        headers: c.req.raw.headers,
      })
    } catch (err) {
      logger.error({ err, email: data.email }, 'sign_up_verification_email_failed')
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
          emailVerified: false,
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

  .post('/sign-in', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>()

    if (!body.email || !body.password) {
      return c.json(
        { error: 'メールアドレスとパスワードを入力してください', code: 'INVALID_REQUEST' },
        400,
      )
    }

    // Better Auth でパスワード検証 + セッション Cookie を発行する
    const baResponse = await auth.api.signInEmail({
      body: { email: body.email, password: body.password },
      headers: c.req.raw.headers,
      asResponse: true,
    })

    if (!baResponse.ok) {
      return c.json(
        {
          error: 'メールアドレスまたはパスワードが正しくありません',
          code: 'INVALID_CREDENTIALS',
        },
        401,
      )
    }

    const baData = (await baResponse.json()) as { user: { id: string; emailVerified: boolean } }
    const coreUser = await findUserById(baData.user.id)

    if (!coreUser || !coreUser.isActive) {
      return c.json({ error: 'アカウントが無効です', code: 'ACCOUNT_INACTIVE' }, 401)
    }

    // Better Auth が発行した Set-Cookie をそのままフロントに転送する
    for (const [key, value] of baResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        c.header('set-cookie', value, { append: true })
      }
    }

    return c.json({
      user: {
        id: coreUser.id,
        tenantId: coreUser.tenantId,
        name: coreUser.name,
        email: coreUser.email,
        role: coreUser.role,
        emailVerified: baData.user.emailVerified,
      },
    })
  })

  .post('/sign-out', async (c) => {
    const baResponse = await auth.api.signOut({
      headers: c.req.raw.headers,
      asResponse: true,
    })

    // Better Auth が発行したクッキー削除ヘッダーを転送する
    for (const [key, value] of baResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        c.header('set-cookie', value, { append: true })
      }
    }

    return c.json({ success: true })
  })

  .get('/me', async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session?.user) {
      return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
    }

    const coreUser = await findUserById(session.user.id)
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
        emailVerified: session.user.emailVerified,
      },
    })
  })
