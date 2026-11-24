import type { ClinicalHttpClient } from './clinicalGatewayNamespace'

export function createClinicalV2GatewayNamespace(client: ClinicalHttpClient) {
  return {
    // ── Phase 2A: RCM Cervical Cancer Screening (CCS) ──
    lookupCcsPersonsByCids: (cids: string[]) =>
      client.post<Array<Record<string, unknown>>>('/api/v1/clinical/rcm/ccs/lookup-persons', { cids }, { timeoutMs: 60000 }),

    getCcsTargetPopulationRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<{
        personRows: Array<Record<string, unknown>>
        visitRows: Array<Record<string, unknown>>
        seamlessRows: Array<Record<string, unknown>>
        hpvRepRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/ccs/target-population?${q.toString()}`, { timeoutMs: 90000 })
    },

    getCcsScreenedRecipientsRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/ccs/screened-recipients?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getCcsAdpMapping: (code: '1B004N' | '1B004P' | '1B004_0N' | '1B005') =>
      client.get<{
        isMapped: boolean
        mappedCount: number
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>(`/api/v1/clinical/rcm/ccs/adp-mapping/${encodeURIComponent(code)}`, { timeoutMs: 30000 }),

    getCcsServiceRaw: (
      code: '1B004N' | '1B004P' | '1B004_0N' | '1B005',
      params: { startDate: string; endDate: string; refresh?: boolean }
    ) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<{
        adpMapping: {
          isMapped: boolean
          mappedCount: number
          items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
        }
        rawRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/ccs/service/${encodeURIComponent(code)}?${q.toString()}`, { timeoutMs: 90000 })
    },

    // ── Phase 2B: RCM Family Planning V2 (9.2 IUD & 9.3.2 Women >= 20) ──
    getFpIudAdpMapping: () =>
      client.get<{
        isMapped: boolean
        mappedCount: number
        adpCodes: string[]
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>('/api/v1/clinical/rcm/fp/iud-adp-mapping', { timeoutMs: 30000 }),

    getFpIudRaw: (params: {
      startDate: string
      endDate: string
      patientType: 'OPD' | 'IPD'
      refresh?: boolean
    }) => {
      const q = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        patientType: params.patientType,
      })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<{
        adpMapping: {
          isMapped: boolean
          mappedCount: number
          adpCodes: string[]
          items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
        }
        rawRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/fp/iud?${q.toString()}`, { timeoutMs: 90000 })
    },

    getFp932AdpMapping: (format: 'NEW_ECLAIM' | 'KRUNGTHAI' = 'NEW_ECLAIM') =>
      client.get<{
        isMapped: boolean
        mappedCount: number
        adpCodes: string[]
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>(`/api/v1/clinical/rcm/fp/932-adp-mapping?format=${encodeURIComponent(format)}`, { timeoutMs: 30000 }),

    getFp932Raw: (params: {
      startDate: string
      endDate: string
      format: 'NEW_ECLAIM' | 'KRUNGTHAI'
      refresh?: boolean
    }) => {
      const q = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        format: params.format,
      })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<{
        adpMapping: {
          isMapped: boolean
          mappedCount: number
          adpCodes: string[]
          items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
        }
        rawRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/fp/932?${q.toString()}`, { timeoutMs: 90000 })
    },
  }
}
