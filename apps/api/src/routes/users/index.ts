import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  createUser,
  deactivateUser,
  findUser,
  listUsers,
  updateUser,
} from '../../db/queries/users.js'
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
})

const UpdateSchema = CreateSchema.partial()

export const usersRouter = new Hono<AppEnv>()

  .get('/', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const userList = await listUsers(tenantId)
    return c.json({ users: userList })
  })

  .post('/', verifySession, injectTenantContext, zValidator('json', CreateSchema), async (c) => {
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')
    const user = await createUser({ tenantId, ...data })
    logger.info({ tenantId, userId: user.id, email: user.email }, 'user_created')
    return c.json({ user }, 201)
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
