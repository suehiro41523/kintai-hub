import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { hashPassword } from 'better-auth/crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  deactivateUser,
  findUser,
  listUsers,
  updateUser,
} from '../../db/queries/users.js'
import { authAccount, authUser } from '../../db/schema/auth.js'
import { users } from '../../db/schema/core.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
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
  initialPassword: z.string().min(8),
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

  .get('/', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const userList = await listUsers(tenantId)
    return c.json({ users: userList })
  })

  .post('/', verifySession, injectTenantContext, zValidator('json', CreateSchema), async (c) => {
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')

    const userId = randomUUID()
    const now = new Date()
    const hashedPwd = await hashPassword(data.initialPassword)

    // auth.user + auth.account + core.users をひとつのトランザクションで作成
    const [coreUser] = await db.transaction(async (tx) => {
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

      return tx
        .insert(users)
        .values({
          id: userId,
          tenantId,
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
    })

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

  .delete('/:id', verifySession, injectTenantContext, async (c) => {
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
