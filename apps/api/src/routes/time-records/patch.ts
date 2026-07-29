import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { patchTimeRecord } from '../../db/queries/time-records.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, requireRole, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const PatchSchema = z
  .object({
    clockedAt: z.string().datetime().optional(),
    workTypeId: z.string().uuid().optional(),
  })
  .refine((d) => d.clockedAt !== undefined || d.workTypeId !== undefined, {
    message: 'clockedAt または workTypeId のいずれかは必須です',
  })

export const patchRoute = new Hono<AppEnv>().patch(
  '/:id',
  verifySession,
  injectTenantContext,
  requireRole('manager', 'admin'),
  zValidator('json', PatchSchema),
  async (c) => {
    const id = c.req.param('id')
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')
    const modifiedBy = c.get('userId')

    const record = await patchTimeRecord(
      tenantId,
      id,
      {
        clockedAt: data.clockedAt ? new Date(data.clockedAt) : undefined,
        workTypeId: data.workTypeId,
      },
      modifiedBy,
    )

    if (!record) {
      return c.json({ error: '打刻記録が見つかりません', code: 'NOT_FOUND' }, 404)
    }

    logger.info({ tenantId, recordId: id, modifiedBy }, 'time_record_patched')
    return c.json({ record })
  },
)
