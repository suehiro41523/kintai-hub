import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { listTeamRecords } from '../../db/queries/time-records.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, requireRole, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const TeamQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().uuid().optional(),
})

export const teamRoute = new Hono<AppEnv>().get(
  '/',
  verifySession,
  injectTenantContext,
  requireRole('manager', 'admin'),
  zValidator('query', TeamQuerySchema),
  async (c) => {
    const { from, to, userId } = c.req.valid('query')
    const tenantId = c.get('tenantId')

    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T23:59:59.999Z`)

    const records = await listTeamRecords(tenantId, fromDate, toDate, userId)
    logger.info({ tenantId, from, to, userId, count: records.length }, 'list_team_records')
    return c.json({ records, total: records.length })
  },
)
