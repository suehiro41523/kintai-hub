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

const BreakEndSchema = z.object({ workTypeId: z.string().uuid() })

export const breakEndRoute = new Hono<AppEnv>().post(
  '/',
  verifySession,
  injectTenantContext,
  zValidator('json', BreakEndSchema),
  async (c) => {
    const { workTypeId } = c.req.valid('json')
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const todayRecords = await listTodayRecords(userId, tenantId)
    const activeSession = deriveActiveSession(todayRecords)

    if (!activeSession) {
      logger.warn({ tenantId, userId }, 'break_end: not clocked in')
      return c.json({ error: '出勤打刻がありません', code: 'NOT_CLOCKED_IN' }, 400)
    }
    if (!activeSession.isOnBreak) {
      logger.warn({ tenantId, userId }, 'break_end: not on break')
      return c.json({ error: '休憩中ではありません', code: 'NOT_ON_BREAK' }, 400)
    }

    const record = await insertTimeRecord({
      userId,
      tenantId,
      workTypeId,
      recordType: 'break_end',
      clockedAt: new Date(),
      deviceType: 'web',
      locationLat: null,
      locationLng: null,
      isModified: false,
    })

    logger.info({ tenantId, userId, workTypeId, recordId: record.id }, 'break_end')
    return c.json({ record }, 201)
  },
)
