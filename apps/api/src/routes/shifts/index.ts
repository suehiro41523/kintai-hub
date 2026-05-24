import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { deleteShift, listMyShifts, listTeamShifts, upsertShifts } from '../../db/queries/shifts.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const BulkUpsertSchema = z.object({
  shifts: z
    .array(
      z.object({
        userId: z.string().uuid(),
        shiftDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        workTypeId: z.string().uuid().nullable().optional(),
        shiftPatternId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
})

export const shiftsRouter = new Hono<AppEnv>()

  .get('/', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const { from, to } = c.req.query()
    if (!from || !to) {
      return c.json({ error: 'from と to は必須です', code: 'BAD_REQUEST' }, 400)
    }
    const list = await listMyShifts(tenantId, userId, from, to)
    return c.json({ shifts: list })
  })

  .get('/team', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const { from, to, userId } = c.req.query()
    if (!from || !to) {
      return c.json({ error: 'from と to は必須です', code: 'BAD_REQUEST' }, 400)
    }
    const list = await listTeamShifts(tenantId, from, to, userId)
    return c.json({ shifts: list })
  })

  .post(
    '/bulk',
    verifySession,
    injectTenantContext,
    zValidator('json', BulkUpsertSchema),
    async (c) => {
      const { shifts } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const createdBy = c.get('userId')
      const result = await upsertShifts(tenantId, createdBy, shifts)
      logger.info(
        { tenantId, created: result.created.length, updated: result.updated.length },
        'shifts_bulk_upserted',
      )
      return c.json(result)
    },
  )

  .delete('/:id', verifySession, injectTenantContext, async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')
    const ok = await deleteShift(tenantId, id)
    if (!ok) {
      return c.json({ error: 'シフトが見つかりません', code: 'NOT_FOUND' }, 404)
    }
    logger.info({ tenantId, shiftId: id }, 'shift_deleted')
    return c.json({ success: true })
  })
