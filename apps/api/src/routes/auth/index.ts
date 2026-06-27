import { Hono } from 'hono'
import { findUserById } from '../../db/queries/users.js'
import { auth } from '../../lib/auth.js'
import type { AppEnv } from '../../types.js'

// Better Auth のネイティブエンドポイントに対するラッパー。
// フロントエンドの既存 API 呼び出しとの互換性を保ちつつ、core.users のデータを返す。
export const authRouter = new Hono<AppEnv>()

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

    const baData = (await baResponse.json()) as { user: { id: string } }
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
      },
    })
  })
