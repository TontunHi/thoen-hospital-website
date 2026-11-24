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

    // ── Phase 2C: RCM Dashboard (OPD/IPD/Palliative/VN) & REP Funds ──
    getRcmSssDentalRaw: (params: {
      startDate: string
      endDate: string
      doctorFilter?: string
      fetchVisits?: boolean
    }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.doctorFilter) q.set('doctorFilter', params.doctorFilter)
      if (params.fetchVisits) q.set('fetchVisits', 'true')
      return client.get<{
        summaryRows: Array<Record<string, unknown>>
        visitRows?: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/dashboard/sss-dental?${q.toString()}`, { timeoutMs: 60000 })
    },

    getRcmOpdDoctorSummaryRaw: (params: { startDate: string; endDate: string; eclaimsParam?: string }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.eclaimsParam) q.set('eclaimsParam', params.eclaimsParam)
      return client.get<{
        allPttypeRows: Array<{ code: string; name: string }>
        rows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/dashboard/opd-doctor-summary?${q.toString()}`, { timeoutMs: 60000 })
    },

    getRcmOpdDetailedRaw: (params: { startDate: string; endDate: string; pttype?: string; isAll?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.pttype) q.set('pttype', params.pttype)
      if (params.isAll) q.set('isAll', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/dashboard/opd-detailed?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmOpdDepartmentSummaryRaw: (params: { startDate: string; endDate: string }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/dashboard/opd-department-summary?${q.toString()}`,
        { timeoutMs: 60000 }
      )
    },

    getRcmIpdReportRaw: (params: { startDate: string; endDate: string; pttype?: string }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.pttype) q.set('pttype', params.pttype)
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/dashboard/ipd-report?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmIpdDepartmentAdjrwRaw: (params: { startDate: string; endDate: string }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/dashboard/ipd-department-adjrw?${q.toString()}`,
        { timeoutMs: 60000 }
      )
    },

    getRcmIpdDoctorChartSummaryRaw: (params: { startDate: string; endDate: string }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      return client.get<{
        docRows: Array<Record<string, unknown>>
        grandRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/dashboard/ipd-doctor-chart-summary?${q.toString()}`, { timeoutMs: 60000 })
    },

    getRcmPalliativeCareRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/dashboard/palliative-care?${q.toString()}`,
        { timeoutMs: 120000 }
      )
    },

    getRcmPalliativeCarePc1Raw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/dashboard/palliative-care-pc1?${q.toString()}`,
        { timeoutMs: 120000 }
      )
    },

    getRcmVnClinicalDetailsRaw: (vn: string) =>
      client.get<{
        headerRows: Array<Record<string, unknown>>
        screenRows: Array<Record<string, unknown>>
        diagRows: Array<Record<string, unknown>>
        orderRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/dashboard/vn-details/${encodeURIComponent(vn)}`, { timeoutMs: 60000 }),

    // ── Phase 2D: RCM Extra Funds (T1DM, TTM, Thalassemia Fund, Thalassemia Pregnancy, Viral Hepatitis) ──
    getRcmExtraT1dmRecipientsRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/extra/t1dm-recipients?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmExtraTtmTopic3Raw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/extra/ttm-topic3?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmExtraTtmTopic11Raw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/extra/ttm-topic11?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmExtraTtmVnHerbs: (vn: string) =>
      client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/extra/ttm-vn-herbs/${encodeURIComponent(vn)}`,
        { timeoutMs: 30000 }
      ),

    getRcmExtraThalassemiaFundOpdRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/extra/thalassemia-fund/opd?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmExtraThalassemiaFundIpdRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/clinical/rcm/extra/thalassemia-fund/ipd?${q.toString()}`,
        { timeoutMs: 90000 }
      )
    },

    getRcmExtraThalassemiaAnDetailsRaw: (an: string) =>
      client.get<{
        headerRows: Array<Record<string, unknown>>
        diagRows: Array<Record<string, unknown>>
        oprtRows: Array<Record<string, unknown>>
        orderRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/extra/thalassemia-fund/an-details/${encodeURIComponent(an)}`, { timeoutMs: 60000 }),

    getRcmExtraThalassemiaPregnancyAdpMapping: (refresh?: boolean) => {
      const qs = refresh ? '?refresh=true' : ''
      return client.get<{
        isMapped: boolean
        mappedCount: number
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>(`/api/v1/clinical/rcm/extra/thalassemia-pregnancy/adp-mapping${qs}`, { timeoutMs: 30000 })
    },

    getRcmExtraThalassemiaPregnancyReportRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<{
        adpMapping: {
          isMapped: boolean
          mappedCount: number
          items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
        }
        rawRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/extra/thalassemia-pregnancy/report?${q.toString()}`, { timeoutMs: 90000 })
    },

    getRcmExtraViralHepatitisAdpMapping: (refresh?: boolean) => {
      const qs = refresh ? '?refresh=true' : ''
      return client.get<{
        isMapped: boolean
        mappedCount: number
        items: Array<{
          icode: string
          name: string
          strength: string | null
          nhso_adp_code: string
          source: 's_drugitems' | 'nondrugitems'
        }>
      }>(`/api/v1/clinical/rcm/extra/viral-hepatitis/adp-mapping${qs}`, { timeoutMs: 30000 })
    },

    getRcmExtraViralHepatitisReportRaw: (params: { startDate: string; endDate: string; refresh?: boolean }) => {
      const q = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
      if (params.refresh) q.set('refresh', 'true')
      return client.get<{
        adpMapping: {
          isMapped: boolean
          mappedCount: number
          items: Array<{
            icode: string
            name: string
            strength: string | null
            nhso_adp_code: string
            source: 's_drugitems' | 'nondrugitems'
          }>
        }
        rawRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/rcm/extra/viral-hepatitis/report?${q.toString()}`, { timeoutMs: 90000 })
    },
  }
}
