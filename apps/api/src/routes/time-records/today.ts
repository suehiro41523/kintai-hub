import { Hono } from 'hono'
import {
  calcDaySummary,
  deriveActiveSession,
  listTodayRecords,
} from '../../db/queries/time-records.js'
import { listWorkTypes } from '../../db/queries/work-types.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

export const todayRoute = new Hono<AppEnv>().get(
  '/',
  verifySession,
  injectTenantContext,
  async (c) => {
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const [records, wtList] = await Promise.all([
      listTodayRecords(userId, tenantId),
      listWorkTypes(tenantId),
    ])

    const activeSession = deriveActiveSession(records)
    const summary = calcDaySummary(records, wtList)

    return c.json({ records, summary, activeSession })
  },
)
