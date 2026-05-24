import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

export function useMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'monthly', year, month],
    queryFn: () => api.reports.monthly(year, month).then((r) => r.report),
    staleTime: 60_000,
  })
}
