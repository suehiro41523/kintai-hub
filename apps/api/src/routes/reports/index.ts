import { Hono } from 'hono'
import { getMonthlyReport } from '../../db/queries/reports.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

export const reportsRouter = new Hono<AppEnv>().get(
  '/monthly',
  verifySession,
  injectTenantContext,
  async (c) => {
    const tenantId = c.get('tenantId')
    const yearStr = c.req.query('year')
    const monthStr = c.req.query('month')

    if (!yearStr || !monthStr) {
      return c.json({ error: 'year と month は必須です', code: 'VALIDATION_ERROR' }, 400)
    }
    const year = Number(yearStr)
    const month = Number(monthStr)
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      return c.json({ error: 'year/month の値が不正です', code: 'VALIDATION_ERROR' }, 400)
    }

    const report = await getMonthlyReport(tenantId, year, month)
    return c.json({ report })
  },
)
