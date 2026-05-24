import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { listRecords } from '../../db/queries/time-records.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const ListQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const listRoute = new Hono<AppEnv>().get(
  '/',
  verifySession,
  injectTenantContext,
  zValidator('query', ListQuerySchema),
  async (c) => {
    const { from, to } = c.req.valid('query')
    const userId = c.get('userId')
    const tenantId = c.get('tenantId')

    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T23:59:59.999Z`)

    const records = await listRecords(userId, tenantId, fromDate, toDate)
    logger.info({ tenantId, userId, from, to, count: records.length }, 'list_records')
    return c.json({ records, total: records.length })
  },
)
