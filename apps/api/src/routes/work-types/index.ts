import { Hono } from 'hono'
import { listWorkTypes } from '../../db/queries/work-types.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

export const workTypesRouter = new Hono<AppEnv>().get(
  '/',
  verifySession,
  injectTenantContext,
  async (c) => {
    const tenantId = c.get('tenantId')
    const workTypes = await listWorkTypes(tenantId)
    return c.json({ workTypes })
  },
)
