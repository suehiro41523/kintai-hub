import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  deriveActiveSession,
  listTodayRecords,
  switchWorkType,
} from '../../db/queries/time-records.js'
import { findWorkType } from '../../db/queries/work-types.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const SwitchTypeSchema = z.object({
  fromWorkTypeId: z.string().uuid(),
  toWorkTypeId: z.string().uuid(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
})

export const switchTypeRoute = new Hono<AppEnv>().post(
  '/',
  verifySession,
  injectTenantContext,
  zValidator('json', SwitchTypeSchema),
  async (c) => {
    const { fromWorkTypeId, toWorkTypeId, locationLat, locationLng } = c.req.valid('json')
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const todayRecords = await listTodayRecords(userId, tenantId)
    const activeSession = deriveActiveSession(todayRecords)

    if (!activeSession) {
      logger.warn({ tenantId, userId }, 'switch_type: not clocked in')
      return c.json({ error: '出勤打刻がありません', code: 'NOT_CLOCKED_IN' }, 400)
    }
    if (activeSession.workTypeId !== fromWorkTypeId) {
      logger.warn(
        { tenantId, userId, fromWorkTypeId, activeWorkTypeId: activeSession.workTypeId },
        'switch_type: work type mismatch',
      )
      return c.json({ error: '現在のワークタイプと一致しません', code: 'VALIDATION_ERROR' }, 400)
    }

    const toWorkType = await findWorkType(tenantId, toWorkTypeId)
    if (!toWorkType) {
      logger.warn(
        { tenantId, userId, toWorkTypeId },
        'switch_type: destination work type not found',
      )
      return c.json({ error: '切替先のワークタイプが存在しません', code: 'NOT_FOUND' }, 404)
    }

    const { clockOutRecord, clockInRecord } = await switchWorkType({
      userId,
      tenantId,
      fromWorkTypeId,
      toWorkTypeId,
      locationLat: locationLat ?? null,
      locationLng: locationLng ?? null,
    })

    logger.info(
      { tenantId, userId, fromWorkTypeId, toWorkTypeId, toWorkTypeName: toWorkType.name },
      'switch_type',
    )
    return c.json({ clockOutRecord, clockInRecord }, 201)
  },
)
