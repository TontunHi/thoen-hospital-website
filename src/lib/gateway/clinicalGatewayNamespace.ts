import type { RequestOptions } from './gatewayTypes'
import { createRcmV2Namespace } from './rcmV2GatewayNamespace'
import { createClinicalV2GatewayNamespace } from './clinicalV2GatewayNamespace'

export interface ClinicalHttpClient {
  get: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
}

export function createClinicalNamespace(client: ClinicalHttpClient) {
  const ns = {
    ...createClinicalV2GatewayNamespace(client),
    /**
     * Executes a read-only SELECT query against the HOSxP MySQL database.
     */
    query: async <T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
      options?: RequestOptions
    ): Promise<T[]> => {
      const res = await client.post<{ data: T[]; count: number }>('/api/v1/clinical/query', { sql, params }, options)
      return Array.isArray(res) ? res : res.data || []
    },

    getErStatus: (mode?: 'tv' | 'summary') => {
      const query = mode === 'tv' ? '?mode=tv' : ''
      return client.get<{
        levels: Array<{ er_emergency_level_id: number; er_emergency_level_name: string; total: number }>
        activePatients: Array<Record<string, unknown>>
        timestamp: string
      }>(`/api/v1/clinical/er/status${query}`)
    },

    getErLiveDashboard: () => {
      return client.get<{
        activePatients: Array<Record<string, unknown>>
        errorStatusList: { total: number; list: Array<Record<string, unknown>> }
        summary: {
          totalActive: number
          critical: number
          emergency: number
          urgency: number
          semiUrgency: number
          nonUrgency: number
        }
        stats: {
          ptTypes: Array<Record<string, unknown>>
          emergencyLevels: Array<Record<string, unknown>>
          dischargeTypes: Array<Record<string, unknown>>
        }
      }>('/api/v1/clinical/er/live-dashboard')
    },

    getIpdBedStatusRaw: () => {
      return client.get<Record<string, any>>('/api/v1/clinical/ipd/bed-status-raw')
    },

    getIpdOrStatus: () => {
      return client.get<{
        waitingList: Array<Record<string, unknown>>
        inProgressList: Array<Record<string, unknown>>
        recoveryList: Array<Record<string, unknown>>
      }>('/api/v1/clinical/ipd/or-status')
    },

    getLabTrackerReport: (doctorCode?: string | null) => {
      const qs = doctorCode && doctorCode !== 'all' ? `?doctorCode=${encodeURIComponent(doctorCode)}` : ''
      return client.get<{
        pendingRows: Array<Record<string, unknown>>
        reportedRows: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/lab/tracker-report${qs}`)
    },

    getLabTrackerDoctors: () => {
      return client.get<{
        doctors: Array<Record<string, unknown>>
        others: Array<Record<string, unknown>>
        totalCount: number
      }>('/api/v1/clinical/lab/tracker-doctors')
    },

    getIpdOccupancy: () => {
      return client.get<Array<{ ward: string; ward_name: string; shortname: string; admitted_patients: number }>>(
        '/api/v1/clinical/ipd/occupancy'
      )
    },

    getIpdWardRoster: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/clinical/ipd/ward-roster')
    },

    getAppointments: (params?: { date?: string; hn?: string; cid?: string }) => {
      const q = new URLSearchParams()
      if (params?.date) q.set('date', params.date)
      if (params?.hn) q.set('hn', params.hn)
      if (params?.cid) q.set('cid', params.cid)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, unknown>>>(`/api/v1/clinical/appointments${qs}`)
    },

    getAppointmentMismatches: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/clinical/appointments/mismatches')
    },

    getAppointmentsByCid: (cid: string) => {
      return client.get<Array<{
        hn: string
        ptname: string
        appoint_date: string
        appoint_time: string
        clinic_name: string
        doctor_name: string
        appoint_note: string
        app_no: string | null
      }>>(`/api/v1/clinical/appointments/by-cid/${encodeURIComponent(cid)}`)
    },

    searchPatientVisits: (query: string) => {
      return client.get<Array<{
        hn: string
        cid: string
        ptname: string
        vn: string
        an: string | null
        dateText: string
        department: string
        cc: string
        statusName: string
        opdDrugsCount: number
        opdLabsCount: number
        ipdDrugsCount: number
        ipdLabsCount: number
      }>>(`/api/v1/clinical/records/visits?query=${encodeURIComponent(query)}`)
    },

    getVisitClinicalDetails: (params: { vn?: string | null; an?: string | null }) => {
      const q = new URLSearchParams()
      if (params.vn) q.set('vn', params.vn)
      if (params.an) q.set('an', params.an)
      return client.get<any>(`/api/v1/clinical/records/visit-details?${q.toString()}`)
    },

    getLabTracker: (params?: { date?: string; vn?: string; hn?: string }) => {
      const q = new URLSearchParams()
      if (params?.date) q.set('date', params.date)
      if (params?.vn) q.set('vn', params.vn)
      if (params?.hn) q.set('hn', params.hn)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, unknown>>>(`/api/v1/clinical/lab/tracker${qs}`)
    },

    getLabDetail: (hn: string) => {
      return client.get<{
        hn: string
        reported: Array<Record<string, unknown>>
        pending: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/lab/detail/${encodeURIComponent(hn)}`)
    },

    getLabDetailByHn: (hn: string) => {
      return ns.getLabDetail(hn)
    },

    getDrugDispenseStatus: () => {
      return client.get<{
        paid: Array<Record<string, unknown>>
        printed: Array<Record<string, unknown>>
        updatedAt: string
      }>('/api/v1/clinical/drugs/status')
    },

    getTbCxrTracker: (params?: {
      status?: 'all' | 'done' | 'missing'
      startDate?: string
      hospcode?: string
      search?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.hospcode) q.set('hospcode', params.hospcode)
      if (params?.search) q.set('search', params.search)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{
        success: boolean
        count: number
        summary: {
          total: number
          doneCount: number
          missingCount: number
          coveragePercentage: number
          statusBreakdown: Record<string, number>
        }
        data: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/tb/cxr-tracker${qs}`)
    },

    getLoratadineMonitor: (age = 'adult') => {
      return client.get<Array<Record<string, unknown>>>(`/api/v1/clinical/drugs/loratadine?age=${encodeURIComponent(age)}`)
    },

    getRcmOpdSummary: (startDate?: string, endDate?: string) => {
      const q = new URLSearchParams()
      if (startDate) q.set('startDate', startDate)
      if (endDate) q.set('endDate', endDate)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, unknown>>>(`/api/v1/clinical/rcm/opd-dept-summary${qs}`)
    },

    getRcmIpdSummary: (startDate?: string, endDate?: string) => {
      const q = new URLSearchParams()
      if (startDate) q.set('startDate', startDate)
      if (endDate) q.set('endDate', endDate)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, unknown>>>(`/api/v1/clinical/rcm/ipd-dept-adjrw${qs}`)
    },

    verifyScreeningVisits: (cids: string[]) => {
      return client.post<Array<{
        cid: string
        hn?: string
        vn?: string
        hasPatientRecord: boolean
        hasVisitToday: boolean
        status: 'NO_RECORD' | 'WAITING' | 'VISIT_OPENED'
      }>>('/api/v1/clinical/screening/verify-visits', { cids })
    },

    getRcmInvoiceSummary: (params?: { department?: 'OP' | 'IP'; startDate?: string; endDate?: string; dateType?: 'bill_date' | 'admdate' }) => {
      const q = new URLSearchParams()
      if (params?.department) q.set('department', params.department)
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.endDate) q.set('endDate', params.endDate)
      if (params?.dateType) q.set('dateType', params.dateType)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{
        department: 'OP' | 'IP'
        ds1: string
        ds2: string
        dateType?: 'bill_date' | 'admdate'
        items: Array<{
          code: string
          name: string
          visit: number
          receipt: number
          compensated: number
          down: number
          up: number
          debit: number
        }>
        grandTotal: {
          visit: number
          receipt: number
          compensated: number
          down: number
          up: number
          debit: number
        }
      }>(`/api/v1/clinical/rcm/invoice-summary${qs}`)
    },

    getRcmInvoiceDetails: (params?: {
      department?: 'OP' | 'IP'
      startDate?: string
      endDate?: string
      pttype?: string
      search?: string
      page?: number
      pageSize?: number
      exportAll?: boolean
      dateType?: 'bill_date' | 'admdate'
    }) => {
      const q = new URLSearchParams()
      if (params?.department) q.set('department', params.department)
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.endDate) q.set('endDate', params.endDate)
      if (params?.pttype) q.set('pttype', params.pttype)
      if (params?.search) q.set('search', params.search)
      if (params?.page) q.set('page', String(params.page))
      if (params?.pageSize) q.set('pageSize', String(params.pageSize))
      if (params?.exportAll) q.set('exportAll', 'true')
      if (params?.dateType) q.set('dateType', params.dateType)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{
        items: Array<any>
        totalCount: number
        totalPages: number
        page: number
        pageSize: number
        dateType?: 'bill_date' | 'admdate'
        filteredSummary?: {
          totalVisits: number
          compensated: number
          fund_money: number
          income_hosxp: number
          rcpt_money: number
          debit_hosxp: number
          hc: number
          ae: number
          inst: number
          op: number
          ip: number
          drug: number
          dmis: number
          down: number
          up: number
          net_diff: number
        }
      }>(`/api/v1/clinical/rcm/invoice-details${qs}`)
    },

    getRcmOpdDebtRegistry: (params?: {
      ds1?: string
      ds2?: string
      includeAdmitted?: boolean
      cardFilter?: string
      eclaimFilter?: string
      accountFilter?: string
      pttypeFilter?: string
      vstdateFilter?: string
      search?: string
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      page?: number
      pageSize?: number
      exportAll?: boolean
      refresh?: boolean
    }) => {
      const q = new URLSearchParams()
      if (params?.ds1) q.set('ds1', params.ds1)
      if (params?.ds2) q.set('ds2', params.ds2)
      if (params?.includeAdmitted !== undefined) q.set('includeAdmitted', String(params.includeAdmitted))
      if (params?.cardFilter) q.set('cardFilter', params.cardFilter)
      if (params?.eclaimFilter) q.set('eclaimFilter', params.eclaimFilter)
      if (params?.accountFilter) q.set('accountFilter', params.accountFilter)
      if (params?.pttypeFilter) q.set('pttypeFilter', params.pttypeFilter)
      if (params?.vstdateFilter) q.set('vstdateFilter', params.vstdateFilter)
      if (params?.search) q.set('search', params.search)
      if (params?.sortBy) q.set('sortBy', params.sortBy)
      if (params?.sortOrder) q.set('sortOrder', params.sortOrder)
      if (params?.page) q.set('page', String(params.page))
      if (params?.pageSize) q.set('pageSize', String(params.pageSize))
      if (params?.exportAll) q.set('exportAll', 'true')
      if (params?.refresh) q.set('refresh', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{
        success?: boolean
        data?: any
        ds1?: string
      }>(`/api/v1/clinical/rcm/opd-debt-registry${qs}`, { timeoutMs: 90000 })
    },

    getRcmPalliativeReport: (params?: {
      startDate?: string
      endDate?: string
      ucOnly?: boolean
      filterType?: 'ALL' | 'Chronic' | 'Opioid' | 'Death'
      search?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.startDate) q.set('startDate', params.startDate)
      if (params?.endDate) q.set('endDate', params.endDate)
      if (params?.ucOnly) q.set('ucOnly', 'true')
      if (params?.filterType) q.set('filterType', params.filterType)
      if (params?.search) q.set('search', params.search)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<any>(`/api/v1/clinical/rcm/palliative-care${qs}`)
    },

    enrichPalliativeHns: (hns: string[]) => {
      return client.post<{
        clinicMembers: Array<{ hn: string; regdate: string }>
        anRows: Array<{ hn: string; an: string }>
        repeclaimRows: Array<{ hn: string; admdate: string; rep: string; compensated: number }>
        repdataRows: Array<{
          hn: string
          admdate: string
          rep: string
          compensated: number
          errorcode?: string | null
          remark?: string | null
        }>
      }>('/api/v1/clinical/palliative-care/enrich-hns', { hns })
    },

    getMokList: <T = Record<string, unknown>>(params: {
      category: string
      catchment?: 'in_catchment' | 'out_catchment'
      hospcode?: string
    }) => {
      const q = new URLSearchParams()
      q.set('category', params.category)
      if (params.catchment) q.set('catchment', params.catchment)
      if (params.hospcode) q.set('hospcode', params.hospcode)
      return client.get<T[]>(`/api/v1/clinical/mok/list?${q.toString()}`)
    },

    getMokSummary: (params?: {
      catchment?: 'in_catchment' | 'out_catchment'
      hospcode?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.catchment) q.set('catchment', params.catchment)
      if (params?.hospcode) q.set('hospcode', params.hospcode)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Record<string, number>>(`/api/v1/clinical/mok/summary${qs}`)
    },

    // ── RCM Clinical Specific Funds ──
    getRcmFundData: async <T = Record<string, unknown>>(
      fundKey: string,
      params?: {
        startDate?: string
        endDate?: string
        ds1?: string
        ds2?: string
        adpCode?: string
        patientType?: 'OPD' | 'IPD'
        serviceType?: string
        [key: string]: unknown
      }
    ) => {
      const q = new URLSearchParams()
      const s = params?.startDate || params?.ds1
      const e = params?.endDate || params?.ds2
      if (s) q.set('startDate', s as string)
      if (e) q.set('endDate', e as string)
      if (params?.adpCode) q.set('adpCode', params.adpCode as string)
      if (params?.patientType) q.set('patientType', params.patientType as string)
      if (params?.serviceType) q.set('serviceType', params.serviceType as string)
      if (params?.expectedDx) q.set('expectedDx', params.expectedDx as string)
      if (params?.format) q.set('format', params.format as string)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const DEDICATED_V2_FUNDS = new Set([
        'cancer',
        'walkin',
        'clopidogrel',
        'health-screening',
        'hepatitis-c',
        'postpartum',
        'drug-post',
        'iron-supplements',
        'anc-30011',
        'anc-23',
        'amed-homeward',
        'rehabilitation',
        'imc',
        'instrument',
        'streptokinase',
        'adp-search',
        'family-planning-91',
        'family-planning-93',
      ])
      const basePath = DEDICATED_V2_FUNDS.has(fundKey)
        ? '/api/v1/clinical/rcm/funds-v2'
        : '/api/v1/clinical/rcm/funds'
      const res = await client.get<any>(`${basePath}/${encodeURIComponent(fundKey)}${qs}`, {
        timeoutMs: 90000,
      })

      const rawRows: T[] = Array.isArray(res?.rawRows)
        ? res.rawRows
        : Array.isArray(res?.data?.rawRows)
        ? res.data.rawRows
        : Array.isArray(res)
        ? res
        : []

      return {
        success: true,
        fundKey,
        data: {
          rawRows,
          adpMapping: res?.adpMapping || res?.data?.adpMapping
        },
        rawRows
      }
    },

    getAdpMapping: (
      adpCode: string,
      options?: { includeNonDrug?: boolean; includeDrugItems?: boolean; refresh?: boolean }
    ) => {
      const q = new URLSearchParams()
      if (options?.includeNonDrug) q.set('includeNonDrug', 'true')
      if (options?.includeDrugItems) q.set('includeDrugItems', 'true')
      if (options?.refresh) q.set('refresh', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      const trimmed = adpCode.trim()
      const path =
        trimmed === 'REHAB'
          ? `/api/v1/clinical/rcm/funds-v2/rehab-adp-mapping${qs}`
          : trimmed === 'STEMI'
          ? `/api/v1/clinical/rcm/funds-v2/stemi-adp-mapping${qs}`
          : trimmed === 'INSTRUMENT_TYPE_2'
          ? `/api/v1/clinical/rcm/funds-v2/instrument-adp-mapping${qs}`
          : Boolean(options?.includeDrugItems) || trimmed === '37999771001' || trimmed === '3799977101'
          ? `/api/v1/clinical/rcm/funds-v2/adp-mapping/${encodeURIComponent(trimmed)}${qs}`
          : options?.includeNonDrug || options?.refresh
          ? `/api/v1/clinical/rcm/funds/adp-mapping-v2/${encodeURIComponent(trimmed)}${qs}`
          : `/api/v1/clinical/rcm/funds/adp-mapping/${encodeURIComponent(trimmed)}`
      return client.get<{
        success: boolean
        adpCode: string
        isMapped: boolean
        mappedCount: number
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>(path)
    },

    enrichSeamlessVisits: (payload: { vns?: string[]; ans?: string[] }, options?: RequestOptions) => {
      return client.post<{
        vnRows: Array<Record<string, unknown>>
        anRows: Array<Record<string, unknown>>
      }>('/api/v1/clinical/rcm/seamless/enrich-visits', payload, { timeoutMs: 30000, ...options })
    },

    // ── RCM Rep Statement & Fund Group Named APIs ──
    getRepFundsYears: async (source?: string) => {
      const qs = source ? `?source=${encodeURIComponent(source)}` : ''
      const res = await client.get<any>(`/api/v1/clinical/rcm/rep-funds/years${qs}`)
      const data: string[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      return { success: true, data }
    },

    getRepFundsSummary: async (params?: {
      source?: string
      fiscalYear?: string
      ds1?: string
      ds2?: string
      department?: string
      fund?: string
      subFund?: string
      status?: string
      errorCode?: string
      search?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.source) q.set('source', params.source)
      if (params?.fiscalYear) q.set('fiscalYear', params.fiscalYear)
      if (params?.ds1) q.set('ds1', params.ds1)
      if (params?.ds2) q.set('ds2', params.ds2)
      if (params?.department) q.set('department', params.department)
      if (params?.fund) q.set('fund', params.fund)
      if (params?.subFund) q.set('subFund', params.subFund)
      if (params?.status) q.set('status', params.status)
      if (params?.errorCode) q.set('errorCode', params.errorCode)
      if (params?.search) q.set('search', params.search)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await client.get<any>(`/api/v1/clinical/rcm/rep-funds/summary${qs}`)
      const data = res?.data || res || {}
      return { success: true, data }
    },

    getRepFundsCases: async (params?: {
      source?: string
      rep?: string
      fund?: string
      subFund?: string
      department?: string
      fiscalYear?: string
      ds1?: string
      ds2?: string
      hn?: string
      status?: string
      errorCode?: string
      search?: string
      limit?: number
      offset?: number
    }) => {
      const q = new URLSearchParams()
      if (params?.source) q.set('source', params.source)
      if (params?.rep) q.set('rep', params.rep)
      if (params?.fund) q.set('fund', params.fund)
      if (params?.subFund) q.set('subFund', params.subFund)
      if (params?.department) q.set('department', params.department)
      if (params?.fiscalYear) q.set('fiscalYear', params.fiscalYear)
      if (params?.ds1) q.set('ds1', params.ds1)
      if (params?.ds2) q.set('ds2', params.ds2)
      if (params?.hn) q.set('hn', params.hn)
      if (params?.status) q.set('status', params.status)
      if (params?.errorCode) q.set('errorCode', params.errorCode)
      if (params?.search) q.set('search', params.search)
      if (params?.limit !== undefined) q.set('limit', String(params.limit))
      if (params?.offset !== undefined) q.set('offset', String(params.offset))
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await client.get<any>(`/api/v1/clinical/rcm/rep-funds/cases${qs}`)
      const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      return { success: true, data }
    },

    // ── T1DM/GDM/PDM Registry Import & Management ──
    getT1dmRegistries: (params?: {
      search?: string
      typeFilter?: string
      hospFilter?: string
      fileName?: string
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      page?: number
      pageSize?: number
      exportAll?: boolean
    }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.typeFilter) q.set('typeFilter', params.typeFilter)
      if (params?.hospFilter) q.set('hospFilter', params.hospFilter)
      if (params?.fileName) q.set('fileName', params.fileName)
      if (params?.sortBy) q.set('sortBy', params.sortBy)
      if (params?.sortOrder) q.set('sortOrder', params.sortOrder)
      if (params?.page) q.set('page', String(params.page))
      if (params?.pageSize) q.set('pageSize', String(params.pageSize))
      if (params?.exportAll) q.set('exportAll', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{
        success: boolean
        items: Array<any>
        totalCount: number
        totalPages: number
        page: number
        pageSize: number
        summary: any
        importedFiles: Array<any>
      }>(`/api/v1/clinical/rcm/t1dm/registries${qs}`)
    },

    importT1dmRegistries: (rows: Array<Record<string, unknown>>) => {
      return client.post<{
        success: boolean
        insertedCount: number
        updatedCount: number
      }>('/api/v1/clinical/rcm/t1dm/import', { rows })
    },

    deleteT1dmRegistries: (payload: {
      mode: 'other_hospitals' | 'by_file' | 'all'
      fileName?: string
      myHospCode?: string
    }) => {
      return client.delete<{
        success: boolean
        deletedCount: number
        message?: string
      }>('/api/v1/clinical/rcm/t1dm/registries', payload)
    },

    // ── Seamless Claim Rep Import ──
    importSeamlessRecords: (
      rows: Array<Record<string, unknown>>,
      duplicateMode: 'update' | 'skip' = 'update',
      extras?: {
        denyCodes?: Array<{ code: string; name: string }>
        summaryUpdate?: {
          rep: string
          payNo: string
          payDate: string | null
          yymmPay: string | null
          yearBudgetPay: string | null
          period: string | null
          codeAccount: string | null
        } | null
      }
    ) => {
      return client.post<{
        success: boolean
        totalSubmitted: number
        insertedCount: number
        updatedCount: number
        skippedCount: number
        duplicateCount: number
      }>(
        '/api/v1/clinical/rcm/seamless/import',
        {
          rows,
          duplicateMode,
          ...(extras?.denyCodes ? { denyCodes: extras.denyCodes } : {}),
          ...(extras?.summaryUpdate ? { summaryUpdate: extras.summaryUpdate } : {}),
        },
        { timeoutMs: 120000 }
      )
    },

    deleteSeamlessRecords: (payload: {
      mode: 'by_file' | 'by_files' | 'other_hospitals' | 'all'
      fileName?: string
      fileNames?: string[]
      myHospCode?: string
    }) => {
      return client.delete<{
        success: boolean
        deletedCount: number
        message?: string
      }>('/api/v1/clinical/rcm/seamless/records', payload, { timeoutMs: 60000 })
    },

    syncSeamlessPayment: (payload?: {
      rep?: string
      payNo?: string
      payDate?: string | null
      codeAccount?: string | null
      force?: boolean
    }) => {
      return client.post<{
        success: boolean
        updatedPaymentCount: number
        backfilledDateCount: number
      }>('/api/v1/clinical/rcm/seamless/sync-payment', payload || {}, { timeoutMs: 60000 })
    },

    lookupPatientClaims: async (params: {
      hn?: string
      ptName?: string
      serviceDate?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.hn) q.set('hn', params.hn)
      if (params?.ptName) q.set('ptName', params.ptName)
      if (params?.serviceDate) q.set('serviceDate', params.serviceDate)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await client.get<any>(`/api/v1/clinical/rcm/rep-funds/lookup${qs}`)
      const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      return { success: true, data }
    },

    getRcmFundsRepReconcile: (
      params?: {
        ds1?: string
        ds2?: string
        funds?: string
        focusFundId?: string
        sources?: string
        repPrefixes?: string
        department?: string
        status?: string
        includePendingRep?: boolean
        search?: string
        sortBy?: string
        sortOrder?: string
        page?: number
        pageSize?: number
        exportAll?: boolean
        refresh?: boolean
      },
      options?: RequestOptions
    ) => {
      const q = new URLSearchParams()
      if (params?.ds1) q.set('ds1', params.ds1)
      if (params?.ds2) q.set('ds2', params.ds2)
      if (params?.funds) q.set('funds', params.funds)
      if (params?.focusFundId) q.set('focusFundId', params.focusFundId)
      if (params?.sources) q.set('sources', params.sources)
      if (params?.repPrefixes) q.set('repPrefixes', params.repPrefixes)
      if (params?.department) q.set('department', params.department)
      if (params?.status) q.set('status', params.status)
      if (params?.includePendingRep) q.set('includePendingRep', 'true')
      if (params?.search) q.set('search', params.search)
      if (params?.sortBy) q.set('sortBy', params.sortBy)
      if (params?.sortOrder) q.set('sortOrder', params.sortOrder)
      if (params?.page) q.set('page', String(params.page))
      if (params?.pageSize) q.set('pageSize', String(params.pageSize))
      if (params?.exportAll) q.set('exportAll', 'true')
      if (params?.refresh) q.set('refresh', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<any>(`/api/v1/clinical/rcm/funds-rep-reconcile${qs}`, {
        timeoutMs: 90000,
        ...options,
      })
    },

    getRcmFundsRepReconcileVnDetails: (vn: string, options?: RequestOptions) => {
      return client.get<any>(
        `/api/v1/clinical/rcm/funds-rep-reconcile/vn-details?vn=${encodeURIComponent(vn)}`,
        { timeoutMs: 30000, ...options }
      )
    },

    ...createRcmV2Namespace(client),
  }
  return ns
}
