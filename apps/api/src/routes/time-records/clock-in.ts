import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  deriveActiveSession,
  insertTimeRecord,
  listTodayRecords,
} from '../../db/queries/time-records.js'
import { findWorkType } from '../../db/queries/work-types.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const ClockInSchema = z.object({
  workTypeId: z.string().uuid(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  deviceType: z.string().optional(),
})

export const clockInRoute = new Hono<AppEnv>().post(
  '/',
  verifySession,
  injectTenantContext,
  zValidator('json', ClockInSchema),
  async (c) => {
    const { workTypeId, locationLat, locationLng, deviceType } = c.req.valid('json')
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const workType = await findWorkType(tenantId, workTypeId)
    if (!workType) {
      logger.warn({ tenantId, userId, workTypeId }, 'clock_in: work type not found')
      return c.json({ error: '指定されたワークタイプが存在しません', code: 'NOT_FOUND' }, 404)
    }

    const todayRecords = await listTodayRecords(userId, tenantId)
    const activeSession = deriveActiveSession(todayRecords)
    if (activeSession) {
      logger.warn(
        { tenantId, userId, activeWorkTypeId: activeSession.workTypeId },
        'clock_in: already clocked in',
      )
      return c.json({ error: '既に出勤中です', code: 'ALREADY_CLOCKED_IN' }, 400)
    }

    const record = await insertTimeRecord({
      userId,
      tenantId,
      workTypeId,
      recordType: 'clock_in',
      clockedAt: new Date(),
      deviceType: deviceType ?? 'web',
      locationLat: locationLat ?? null,
      locationLng: locationLng ?? null,
      isModified: false,
    })

    logger.info(
      { tenantId, userId, workTypeId, workTypeName: workType.name, recordId: record.id },
      'clock_in',
    )
    return c.json({ record }, 201)
  },
)
