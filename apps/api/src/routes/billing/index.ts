import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  calculateBillingSummary,
  confirmBillingSummary,
  createBillingContract,
  deleteBillingContract,
  findBillingContract,
  listBillingContracts,
  listBillingSummaries,
  updateBillingContract,
} from '../../db/queries/billing.js'
import { logger } from '../../lib/logger.js'
import { injectTenantContext, verifySession } from '../../middleware/auth.js'
import type { AppEnv } from '../../types.js'

const ContractCreateSchema = z.object({
  workTypeId: z.string().uuid(),
  clientName: z.string().min(1).max(100),
  billingType: z.enum(['fixed', 'hourly', 'range', 'project']),
  minHours: z.number().positive().nullable().optional(),
  maxHours: z.number().positive().nullable().optional(),
  baseAmount: z.number().nonnegative().nullable().optional(),
  overRate: z.number().nonnegative().nullable().optional(),
  underRate: z.number().nonnegative().nullable().optional(),
  contractStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

const ContractUpdateSchema = ContractCreateSchema.partial()

const CalculateSchema = z.object({
  contractId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
})

export const billingRouter = new Hono<AppEnv>()

  // ─── 契約 ───────────────────────────────────────────────────────────────────

  .get('/contracts', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const contracts = await listBillingContracts(tenantId)
    return c.json({ contracts })
  })

  .post(
    '/contracts',
    verifySession,
    injectTenantContext,
    zValidator('json', ContractCreateSchema),
    async (c) => {
      const data = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const contract = await createBillingContract({ tenantId, ...data })
      logger.info({ tenantId, contractId: contract.id }, 'billing_contract_created')
      return c.json({ contract }, 201)
    },
  )

  .get('/contracts/:id', verifySession, injectTenantContext, async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')
    const contract = await findBillingContract(tenantId, id)
    if (!contract) {
      return c.json({ error: '契約が見つかりません', code: 'NOT_FOUND' }, 404)
    }
    return c.json({ contract })
  })

  .patch(
    '/contracts/:id',
    verifySession,
    injectTenantContext,
    zValidator('json', ContractUpdateSchema),
    async (c) => {
      const id = c.req.param('id')
      const data = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const contract = await updateBillingContract(tenantId, id, data)
      if (!contract) {
        return c.json({ error: '契約が見つかりません', code: 'NOT_FOUND' }, 404)
      }
      logger.info({ tenantId, contractId: id }, 'billing_contract_updated')
      return c.json({ contract })
    },
  )

  .delete('/contracts/:id', verifySession, injectTenantContext, async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')
    const result = await deleteBillingContract(tenantId, id)
    if (result === 'not_found') {
      return c.json({ error: '契約が見つかりません', code: 'NOT_FOUND' }, 404)
    }
    if (result === 'has_summaries') {
      return c.json(
        { error: '精算済みサマリーが存在するため削除できません', code: 'HAS_SUMMARIES' },
        409,
      )
    }
    logger.info({ tenantId, contractId: id }, 'billing_contract_deleted')
    return c.json({ success: true })
  })

  // ─── サマリー ────────────────────────────────────────────────────────────────

  .get('/summaries', verifySession, injectTenantContext, async (c) => {
    const tenantId = c.get('tenantId')
    const yearStr = c.req.query('year')
    const monthStr = c.req.query('month')
    if (!yearStr || !monthStr) {
      return c.json({ error: 'year と month は必須です', code: 'VALIDATION_ERROR' }, 400)
    }
    const year = Number(yearStr)
    const month = Number(monthStr)
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return c.json({ error: 'year/month の値が不正です', code: 'VALIDATION_ERROR' }, 400)
    }
    const summaries = await listBillingSummaries(tenantId, year, month)
    return c.json({ summaries })
  })

  .post(
    '/summaries/calculate',
    verifySession,
    injectTenantContext,
    zValidator('json', CalculateSchema),
    async (c) => {
      const { contractId, year, month } = c.req.valid('json')
      const tenantId = c.get('tenantId')
      const result = await calculateBillingSummary(tenantId, contractId, year, month)
      if (result === 'contract_not_found') {
        return c.json({ error: '契約が見つかりません', code: 'NOT_FOUND' }, 404)
      }
      if (result === 'already_confirmed') {
        return c.json({ error: 'すでに確定済みです', code: 'ALREADY_CONFIRMED' }, 409)
      }
      logger.info({ tenantId, contractId, year, month }, 'billing_summary_calculated')
      return c.json({ summary: result })
    },
  )

  .post('/summaries/:id/confirm', verifySession, injectTenantContext, async (c) => {
    const id = c.req.param('id')
    const tenantId = c.get('tenantId')
    const result = await confirmBillingSummary(id)
    if (result === 'not_found') {
      return c.json({ error: 'サマリーが見つかりません', code: 'NOT_FOUND' }, 404)
    }
    if (result === 'already_confirmed') {
      return c.json({ error: 'すでに確定済みです', code: 'ALREADY_CONFIRMED' }, 409)
    }
    logger.info({ tenantId, summaryId: id }, 'billing_summary_confirmed')
    return c.json({ summary: result })
  })
