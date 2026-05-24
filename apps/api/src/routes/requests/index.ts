import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  approveRequest,
  cancelRequest,
  createRequest,
  listMyRequests,
  listPendingRequests,
  rejectRequest,
} from '../../db/queries/requests.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const REQUEST_TYPES = ['leave', 'overtime', 'correction'] as const

const CreateSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  reason: z.string().max(1000).nullable().optional(),
})

const ApproveSchema = z.object({
  comment: z.string().max(1000).nullable().optional(),
})

export const requestsRouter = new Hono<AppEnv>()

  .get('/my', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const list = await listMyRequests(tenantId, userId)
    return c.json({ requests: list })
  })

  .get('/pending', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const list = await listPendingRequests(tenantId)
    return c.json({ requests: list })
  })

  .post('/', verifySession, injectTenantContext, zValidator('json', CreateSchema), async (c) => {
    const data = c.req.valid('json')
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const req = await createRequest({ tenantId, userId, ...data })
    logger.info(
      { tenantId, userId, requestId: req.id, requestType: req.requestType },
      'request_created',
    )
    return c.json({ request: req }, 201)
  })

  .post(
    '/:id/approve',
    verifySession,
    injectTenantContext,
    zValidator('json', ApproveSchema),
    async (c) => {
      const id = c.req.param('id')
      const { comment } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const approverId = c.get('userId')
      const result = await approveRequest(tenantId, id, approverId, comment)
      if (result === 'not_found') {
        return c.json({ error: '申請が見つかりません', code: 'NOT_FOUND' }, 404)
      }
      if (result === 'not_pending') {
        return c.json({ error: 'この申請は承認待ち状態ではありません', code: 'NOT_PENDING' }, 409)
      }
      logger.info({ tenantId, approverId, requestId: id }, 'request_approved')
      return c.json({ request: result })
    },
  )

  .post(
    '/:id/reject',
    verifySession,
    injectTenantContext,
    zValidator('json', ApproveSchema),
    async (c) => {
      const id = c.req.param('id')
      const { comment } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const approverId = c.get('userId')
      const result = await rejectRequest(tenantId, id, approverId, comment)
      if (result === 'not_found') {
        return c.json({ error: '申請が見つかりません', code: 'NOT_FOUND' }, 404)
      }
      if (result === 'not_pending') {
        return c.json({ error: 'この申請は承認待ち状態ではありません', code: 'NOT_PENDING' }, 409)
      }
      logger.info({ tenantId, approverId, requestId: id }, 'request_rejected')
      return c.json({ request: result })
    },
  )

  .delete('/:id', verifySession, injectTenantContext, async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const result = await cancelRequest(tenantId, id, userId)
    if (result === 'not_found') {
      return c.json({ error: '申請が見つかりません', code: 'NOT_FOUND' }, 404)
    }
    if (result === 'not_pending') {
      return c.json({ error: 'この申請は取り消しできません', code: 'NOT_PENDING' }, 409)
    }
    logger.info({ tenantId, userId, requestId: id }, 'request_cancelled')
    return c.json({ success: true })
  })
