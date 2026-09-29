import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  deactivateUser,
  findUser,
  listUsers,
  updateUser,
} from '../../db/queries/users.js'
import { users } from '../../db/schema/core.js'
import { logger } from '../../lib/logger.js'
import { supabaseAdmin } from '../../lib/supabase.js'
import { injectTenantContext, requireRole, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const ROLES = ['admin', 'manager', 'employee'] as const
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract'] as const

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(ROLES),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  monthlySalary: z.number().nonnegative().nullable().optional(),
})

const UpdateSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    role: z.enum(ROLES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    hourlyRate: z.number().nonnegative().nullable(),
    monthlySalary: z.number().nonnegative().nullable(),
  })
  .partial()

export const usersRouter = new Hono<AppEnv>()

  .get('/', verifySession, injectTenantContext, requireRole('admin'), async (c) => {
    const tenantId = c.get('tenantId')
    const userList = await listUsers(tenantId)
    return c.json({ users: userList })
  })

  .post('/', verifySession, injectTenantContext, requireRole('admin'), zValidator('json', CreateSchema), async (c) => {
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')

    // Supabase Auth側にユーザーを作成し招待メールを送信する(本人が招待リンクから自分でパスワードを設定する)
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email)
    if (error || !invited.user) {
      logger.error({ err: error, email: data.email }, 'user_invite_failed')
      return c.json(
        { error: '招待に失敗しました。時間をおいて再度お試しください', code: 'INTERNAL_ERROR' },
        500,
      )
    }

    const userId = randomUUID()
    const now = new Date()

    let coreUser: typeof users.$inferSelect
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          id: userId,
          tenantId,
          authUserId: invited.user.id,
          name: data.name,
          email: data.email,
          role: data.role,
          employmentType: data.employmentType,
          hourlyRate: data.hourlyRate?.toString() ?? null,
          monthlySalary: data.monthlySalary?.toString() ?? null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      coreUser = inserted
    } catch (err) {
      // 補償処理: core.usersの作成に失敗したらSupabase側の招待ユーザーも削除する
      await supabaseAdmin.auth.admin.deleteUser(invited.user.id).catch((delErr) => {
        logger.error({ err: delErr, authUserId: invited.user.id }, 'user_invite_compensation_delete_failed')
      })
      logger.error({ err, email: data.email }, 'user_create_failed')
      return c.json(
        { error: '登録に失敗しました。時間をおいて再度お試しください', code: 'INTERNAL_ERROR' },
        500,
      )
    }

    logger.info({ tenantId, userId, email: data.email }, 'user_created')
    return c.json(
      {
        user: {
          ...coreUser,
          hourlyRate: coreUser.hourlyRate !== null ? Number(coreUser.hourlyRate) : null,
          monthlySalary: coreUser.monthlySalary !== null ? Number(coreUser.monthlySalary) : null,
        },
      },
      201,
    )
  })

  .patch(
    '/:id',
    verifySession,
    injectTenantContext,
    requireRole('admin'),
    zValidator('json', UpdateSchema),
    async (c) => {
      const id = c.req.param('id')
      const data = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const user = await updateUser(tenantId, id, data)
      if (!user) {
        return c.json({ error: '従業員が見つかりません', code: 'NOT_FOUND' }, 404)
      }
      logger.info({ tenantId, userId: id }, 'user_updated')
      return c.json({ user })
    },
  )

  .delete('/:id', verifySession, injectTenantContext, requireRole('admin'), async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')

    const target = await findUser(tenantId, id)
    if (!target) {
      return c.json({ error: '従業員が見つかりません', code: 'NOT_FOUND' }, 404)
    }

    const ok = await deactivateUser(tenantId, id)
    if (!ok) {
      return c.json({ error: '従業員が見つかりません', code: 'NOT_FOUND' }, 404)
    }
    logger.info({ tenantId, userId: id }, 'user_deactivated')
    return c.json({ success: true })
  })
