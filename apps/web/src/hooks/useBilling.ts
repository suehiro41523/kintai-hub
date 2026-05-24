import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

export function useBillingContracts() {
  return useQuery({
    queryKey: ['billing', 'contracts'],
    queryFn: () => api.billing.listContracts().then((r) => r.contracts),
    staleTime: 30_000,
  })
}

export function useBillingSummaries(year: number, month: number) {
  return useQuery({
    queryKey: ['billing', 'summaries', year, month],
    queryFn: () => api.billing.listSummaries(year, month).then((r) => r.summaries),
    staleTime: 30_000,
  })
}

export function useCreateBillingContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.billing.createContract,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'contracts'] }),
  })
}

export function useUpdateBillingContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Parameters<typeof api.billing.updateContract>[1]
    }) => api.billing.updateContract(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'contracts'] }),
  })
}

export function useDeleteBillingContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.billing.deleteContract,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'contracts'] }),
  })
}

export function useCalculateBillingSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      contractId,
      year,
      month,
    }: {
      contractId: string
      year: number
      month: number
    }) => api.billing.calculate(contractId, year, month),
    onSuccess: (_data, { year, month }) =>
      qc.invalidateQueries({ queryKey: ['billing', 'summaries', year, month] }),
  })
}

export function useConfirmBillingSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ summaryId }: { summaryId: string; year: number; month: number }) =>
      api.billing.confirm(summaryId),
    onSuccess: (_data, { year, month }) =>
      qc.invalidateQueries({ queryKey: ['billing', 'summaries', year, month] }),
  })
}
