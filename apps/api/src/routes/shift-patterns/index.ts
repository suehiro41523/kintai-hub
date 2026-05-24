import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  createShiftPattern,
  listShiftPatterns,
  updateShiftPattern,
} from '../../db/queries/shifts.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number().int().nonnegative(),
})

const UpdateSchema = CreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const shiftPatternsRouter = new Hono<AppEnv>()

  .get('/', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const patterns = await listShiftPatterns(tenantId)
    return c.json({ patterns })
  })

  .post('/', verifySession, injectTenantContext, zValidator('json', CreateSchema), async (c) => {
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')
    const pattern = await createShiftPattern({ tenantId, ...data })
    logger.info({ tenantId, patternId: pattern.id }, 'shift_pattern_created')
    return c.json({ pattern }, 201)
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
      const pattern = await updateShiftPattern(tenantId, id, data)
      if (!pattern) {
        return c.json({ error: 'シフトパターンが見つかりません', code: 'NOT_FOUND' }, 404)
      }
      logger.info({ tenantId, patternId: id }, 'shift_pattern_updated')
      return c.json({ pattern })
    },
  )
