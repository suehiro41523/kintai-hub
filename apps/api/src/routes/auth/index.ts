import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { z } from 'zod'
import type { AppEnv } from '../../types.js'

const COOKIE_NAME = 'kintai_session'
const STUB_USER_ID = '00000000-0000-0000-0000-000000000002'
const STUB_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24h

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function getSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-secret'
}

export const authRouter = new Hono<AppEnv>()

  .post('/sign-in', zValidator('json', SignInSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const testEmail = process.env.TEST_EMAIL ?? 'admin@example.com'
    const testPassword = process.env.TEST_PASSWORD ?? 'password'

    if (email !== testEmail || password !== testPassword) {
      return c.json(
        { error: 'メールアドレスまたはパスワードが正しくありません', code: 'INVALID_CREDENTIALS' },
        401,
      )
    }

    const token = await sign(
      {
        sub: STUB_USER_ID,
        tenantId: STUB_TENANT_ID,
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE,
      },
      getSecret(),
    )

    setCookie(c, COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })

    return c.json({
      user: {
        id: STUB_USER_ID,
        tenantId: STUB_TENANT_ID,
        name: '管理者',
        email: testEmail,
        role: 'admin',
      },
    })
  })

  .post('/sign-out', (c) => {
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.json({ success: true })
  })

  .get('/me', async (c) => {
    const token = getCookie(c, COOKIE_NAME)
    if (!token) {
      return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
    }

    try {
      const payload = await verify(token, getSecret(), 'HS256')
      return c.json({
        user: {
          id: payload.sub,
          tenantId: payload.tenantId,
          role: payload.role,
          name: '管理者',
          email: process.env.TEST_EMAIL ?? 'admin@example.com',
        },
      })
    } catch {
      return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401)
    }
  })
