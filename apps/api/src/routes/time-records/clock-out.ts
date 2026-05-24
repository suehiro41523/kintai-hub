import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  calcDaySummary,
  deriveActiveSession,
  insertTimeRecord,
  listTodayRecords,
} from '../../db/queries/time-records.js'
import { listWorkTypes } from '../../db/queries/work-types.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const ClockOutSchema = z.object({
  workTypeId: z.string().uuid(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
})

export const clockOutRoute = new Hono<AppEnv>().post(
  '/',
  verifySession,
  injectTenantContext,
  zValidator('json', ClockOutSchema),
  async (c) => {
    const { workTypeId, locationLat, locationLng } = c.req.valid('json')
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const [todayRecords, wtList] = await Promise.all([
      listTodayRecords(userId, tenantId),
      listWorkTypes(tenantId),
    ])

    const activeSession = deriveActiveSession(todayRecords)
    if (!activeSession) {
      logger.warn({ tenantId, userId }, 'clock_out: not clocked in')
      return c.json({ error: '出勤打刻がありません', code: 'NOT_CLOCKED_IN' }, 400)
    }
    if (activeSession.workTypeId !== workTypeId) {
      logger.warn(
        { tenantId, userId, workTypeId, activeWorkTypeId: activeSession.workTypeId },
        'clock_out: work type mismatch',
      )
      return c.json({ error: '現在のワークタイプと一致しません', code: 'VALIDATION_ERROR' }, 400)
    }

    const record = await insertTimeRecord({
      userId,
      tenantId,
      workTypeId,
      recordType: 'clock_out',
      clockedAt: new Date(),
      deviceType: 'web',
      locationLat: locationLat ?? null,
      locationLng: locationLng ?? null,
      isModified: false,
    })

    const dailySummary = calcDaySummary([...todayRecords, record], wtList)

    logger.info(
      { tenantId, userId, workTypeId, recordId: record.id, totalMin: dailySummary.totalMin },
      'clock_out',
    )
    return c.json({ record, dailySummary }, 201)
  },
)
