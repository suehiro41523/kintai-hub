import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  createWorkType,
  deactivateWorkType,
  listWorkTypes,
  reorderWorkTypes,
  updateWorkType,
} from '../../db/queries/work-types.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  billingType: z.enum(['fixed', 'hourly', 'range', 'project']),
  isBillable: z.boolean(),
  sortOrder: z.number().int().min(0),
})

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  billingType: z.enum(['fixed', 'hourly', 'range', 'project']).optional(),
  isBillable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const ReorderSchema = z.object({
  orders: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) })).min(1),
})

export const workTypesRouter = new Hono<AppEnv>()

  .get('/', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const workTypes = await listWorkTypes(tenantId)
    return c.json({ workTypes })
  })

  .post('/', verifySession, injectTenantContext, zValidator('json', CreateSchema), async (c) => {
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')
    const workType = await createWorkType({ tenantId, ...data })
    logger.info({ tenantId, workTypeId: workType.id, name: workType.name }, 'work_type_created')
    return c.json({ workType }, 201)
  })

  // /reorder を /:id より前に登録して競合を防ぐ
  .patch(
    '/reorder',
    verifySession,
    injectTenantContext,
    zValidator('json', ReorderSchema),
    async (c) => {
      const { orders } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      await reorderWorkTypes(tenantId, orders)
      logger.info({ tenantId, count: orders.length }, 'work_types_reordered')
      return c.json({ success: true })
    },
  )

  .patch(
    '/:id',
    verifySession,
    injectTenantContext,
    zValidator('json', UpdateSchema),
    async (c) => {
      const id = c.req.param('id')
      const data = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const workType = await updateWorkType(tenantId, id, data)
      if (!workType) {
        return c.json({ error: 'ワークタイプが見つかりません', code: 'NOT_FOUND' }, 404)
      }
      logger.info({ tenantId, workTypeId: id }, 'work_type_updated')
      return c.json({ workType })
    },
  )

  .delete('/:id', verifySession, injectTenantContext, async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')
    const ok = await deactivateWorkType(tenantId, id)
    if (!ok) {
      return c.json({ error: 'ワークタイプが見つかりません', code: 'NOT_FOUND' }, 404)
    }
    logger.info({ tenantId, workTypeId: id }, 'work_type_deactivated')
    return c.json({ success: true })
  })
