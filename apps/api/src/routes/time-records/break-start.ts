import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  deriveActiveSession,
  insertTimeRecord,
  listTodayRecords,
} from '../../db/queries/time-records.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const BreakStartSchema = z.object({ workTypeId: z.string().uuid() })

export const breakStartRoute = new Hono<AppEnv>().post(
  '/',
  verifySession,
  injectTenantContext,
  zValidator('json', BreakStartSchema),
  async (c) => {
    const { workTypeId } = c.req.valid('json')
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const todayRecords = await listTodayRecords(userId, tenantId)
    const activeSession = deriveActiveSession(todayRecords)

    if (!activeSession) {
      logger.warn({ tenantId, userId }, 'break_start: not clocked in')
      return c.json({ error: '出勤打刻がありません', code: 'NOT_CLOCKED_IN' }, 400)
    }
    if (activeSession.isOnBreak) {
      logger.warn({ tenantId, userId }, 'break_start: already on break')
      return c.json({ error: '既に休憩中です', code: 'ALREADY_ON_BREAK' }, 400)
    }

    const record = await insertTimeRecord({
      userId,
      tenantId,
      workTypeId,
      recordType: 'break_start',
      clockedAt: new Date(),
      deviceType: 'web',
      locationLat: null,
      locationLng: null,
      isModified: false,
    })

    logger.info({ tenantId, userId, workTypeId, recordId: record.id }, 'break_start')
    return c.json({ record }, 201)
  },
)
