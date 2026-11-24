import type { ClinicalHttpClient } from './clinicalGatewayNamespace'

/**
 * ApiGatewayClient.request() unwraps `json.data` when `pagination` and `slideDuration` are absent.
 * Wrap the unwrapped payload back into `{ success: true, data }` so callers receive the envelope
 * promised by this namespace's TypeScript return types.
 */
function asGatewayEnvelope<T>(res: T | { success: boolean; data: T }): { success: boolean; data: T } {
  if (
    res !== null &&
    typeof res === 'object' &&
    !Array.isArray(res) &&
    'success' in res &&
    'data' in res
  ) {
    return res as { success: boolean; data: T }
  }
  return { success: true, data: res as T }
}

export function createRcmV2Namespace(client: ClinicalHttpClient) {
  return {
    getAnClinicalDetails: async (an: string) => {
      type AnDetailsPayload = {
        header: {
          an: string
          hn: string
          cid: string
          ptname: string
          sex: string
          age: number
          admdate: string
          dchdate: string
          pttypename: string
          ward: string
        }
        diagnoses: Array<{
          icd10: string
          icdName: string
          diagtype: string
          diagtypeName: string
          doctorName: string
        }>
        procedures: Array<{
          icd9: string
          icd9Name: string
          opdate: string
          doctorName: string
        }>
        orders: Array<{
          icode: string
          itemName: string
          strength: string | null
          units: string | null
          qty: number
          unitprice: number
          sumPrice: number
          paidstName: string
          incomeName: string
          isDrug: boolean
        }>
      } | null
      const res = await client.get<{ success: boolean; data: AnDetailsPayload } | AnDetailsPayload>(
        `/api/v1/clinical/rcm/an-details/${encodeURIComponent(an)}`,
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<AnDetailsPayload>(res)
    },

    getAvailableAdpCodes: async () => {
      type AdpCodeRows = Array<{ code: string; title: string; mappedCount: number }>
      const res = await client.get<{ success: boolean; data: AdpCodeRows } | AdpCodeRows>(
        '/api/v1/clinical/rcm/funds-v2/adp-search/available-codes',
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<AdpCodeRows>(res)
    },

    checkMultiAdpMapping: (adpCodes: string[]) => {
      return client.post<{
        success: boolean
        adpCodes: string[]
        isMapped: boolean
        mappedCount: number
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>('/api/v1/clinical/rcm/funds-v2/adp-search/check-mapping', { adpCodes }, { timeoutMs: 15000 })
    },

    getFamilyPlanning91AdpMapping: (format: 'NEW_ECLAIM' | 'KRUNGTHAI' = 'NEW_ECLAIM') => {
      return client.get<{
        success: boolean
        format: string
        isMapped: boolean
        mappedCount: number
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>(`/api/v1/clinical/rcm/funds-v2/family-planning-91/adp-mapping?format=${encodeURIComponent(format)}`, {
        timeoutMs: 15000,
      })
    },

    // ── Seamless Import V2 ──
    lookupSeamlessBudget: async (payNo: string) => {
      type BudgetPayload = { paydate: string | null; accountcode: string | null } | null
      const res = await client.post<{ success: boolean; data: BudgetPayload } | BudgetPayload>(
        '/api/v1/clinical/rcm/seamless-v2/lookup-budget',
        { payNo },
        { timeoutMs: 15000 }
      )
      return asGatewayEnvelope<BudgetPayload>(res)
    },

    resolveSeamlessHospCode: (hospName: string) => {
      return client.post<{ success: boolean; hospcode: string }>(
        '/api/v1/clinical/rcm/seamless-v2/resolve-hospcode',
        { hospName },
        { timeoutMs: 15000 }
      )
    },

    enrichSeamlessImport: async (payload: {
      napNumbers?: string[]
      cids?: string[]
      hnsMissing?: string[]
      ovstLookup?: { hns: string[]; minDate: string; maxDate: string } | null
      iptLookup?: { hns: string[]; minDate: string; maxDate: string } | null
    }) => {
      type EnrichPayload = {
        napRows: Array<{ nap_number: string; cid: string }>
        cidRows: Array<{ cid: string; hn: string; ptname: string }>
        hnRows: Array<{ hn: string; cid: string; ptname: string }>
        ovstRows: Array<{ vn: string; hn: string; vstdate: string }>
        iptRows: Array<{ an: string; hn: string; regdate: string }>
      }
      const res = await client.post<{ success: boolean; data: EnrichPayload } | EnrichPayload>(
        '/api/v1/clinical/rcm/seamless-v2/enrich-import',
        payload,
        { timeoutMs: 60000 }
      )
      return asGatewayEnvelope<EnrichPayload>(res)
    },

    preflightSeamlessCheck: async (payload: { fileName: string; ids: string[] }) => {
      type PreflightPayload = { existingFileRowCount: number; existingIds: string[] }
      const res = await client.post<{ success: boolean; data: PreflightPayload } | PreflightPayload>(
        '/api/v1/clinical/rcm/seamless-v2/preflight-check',
        payload,
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<PreflightPayload>(res)
    },

    getSeamlessStats: async (myHospCode?: string) => {
      const qs = myHospCode ? `?myHospCode=${encodeURIComponent(myHospCode)}` : ''
      const res = await client.get<{ success: boolean; data: any } | any>(
        `/api/v1/clinical/rcm/seamless-v2/stats${qs}`,
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<any>(res)
    },

    getSeamlessLedger: async (params?: {
      search?: string
      fundFilter?: string
      hospFilter?: string
      payStatus?: string
      fileName?: string
      sortBy?: string
      sortOrder?: string
      page?: number
      pageSize?: number
      exportAll?: boolean
      myHospCode?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.fundFilter) q.set('fundFilter', params.fundFilter)
      if (params?.hospFilter) q.set('hospFilter', params.hospFilter)
      if (params?.payStatus) q.set('payStatus', params.payStatus)
      if (params?.fileName) q.set('fileName', params.fileName)
      if (params?.sortBy) q.set('sortBy', params.sortBy)
      if (params?.sortOrder) q.set('sortOrder', params.sortOrder)
      if (params?.page) q.set('page', String(params.page))
      if (params?.pageSize) q.set('pageSize', String(params.pageSize))
      if (params?.exportAll) q.set('exportAll', 'true')
      if (params?.myHospCode) q.set('myHospCode', params.myHospCode)
      const qs = q.toString() ? `?${q.toString()}` : ''
      type LedgerPayload = {
        itemRows: Array<Record<string, unknown>>
        totalCount: number
        totalPages: number
        page: number
        pageSize: number
        availableFunds: string[]
        myHospCode: string
      }
      const res = await client.get<{ success: boolean; data: LedgerPayload } | LedgerPayload>(
        `/api/v1/clinical/rcm/seamless-v2/ledger${qs}`,
        { timeoutMs: 60000 }
      )
      return asGatewayEnvelope<LedgerPayload>(res)
    },

    getSeamlessFiles: async (myHospCode?: string) => {
      const qs = myHospCode ? `?myHospCode=${encodeURIComponent(myHospCode)}` : ''
      type FilesPayload = Array<Record<string, unknown>>
      const res = await client.get<{ success: boolean; data: FilesPayload } | FilesPayload>(
        `/api/v1/clinical/rcm/seamless-v2/files${qs}`,
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<FilesPayload>(res)
    },

    getSeamlessDenyCodes: async () => {
      type DenyCodesPayload = Array<{ Code?: string; code?: string; Name?: string; name?: string }>
      const res = await client.get<{ success: boolean; data: DenyCodesPayload } | DenyCodesPayload>(
        '/api/v1/clinical/rcm/seamless-v2/deny-codes',
        { timeoutMs: 15000 }
      )
      return asGatewayEnvelope<DenyCodesPayload>(res)
    },

    // ── T1DM Import V2 ──
    getT1dmRawRegistries: async () => {
      type T1dmRawPayload = {
        clinicalRows: Array<Record<string, unknown>>
        mirrorRows: Array<Record<string, unknown>>
      }
      const res = await client.get<{ success: boolean; data: T1dmRawPayload } | T1dmRawPayload>(
        '/api/v1/clinical/rcm/t1dm-v2/raw-registries',
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<T1dmRawPayload>(res)
    },

    enrichT1dmImport: async (payload: { cids: string[]; hospCodes: string[]; fileName: string }) => {
      type T1dmEnrichPayload = {
        patients: Array<{ cid: string; hn: string; ptname: string }>
        hospNames: Array<{ hospcode: string; name: string }>
        existingFileRowCount: number
      }
      const res = await client.post<{ success: boolean; data: T1dmEnrichPayload } | T1dmEnrichPayload>(
        '/api/v1/clinical/rcm/t1dm-v2/enrich-import',
        payload,
        { timeoutMs: 30000 }
      )
      return asGatewayEnvelope<T1dmEnrichPayload>(res)
    },

    persistT1dmMirror: (rows: Array<Record<string, unknown>>) => {
      return client.post<{ success: boolean; savedCount: number }>(
        '/api/v1/clinical/rcm/t1dm-v2/persist-mirror',
        { rows },
        { timeoutMs: 60000 }
      )
    },

    deleteT1dmMirror: (payload: {
      mode: 'other_hospitals' | 'by_file' | 'all'
      fileName?: string
      myHospCode?: string
    }) => {
      return client.delete<{ success: boolean; deletedCount: number }>(
        '/api/v1/clinical/rcm/t1dm-v2/delete-mirror',
        payload,
        { timeoutMs: 30000 }
      )
    },
  }
}
