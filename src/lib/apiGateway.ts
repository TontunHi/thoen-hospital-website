/**
 * Thoen Hospital Centralized API Gateway Client SDK
 * 
 * Provides unified, type-safe, and fail-closed access to the Thoen Hospital Unified API Gateway.
 * Supports HOSxP Clinical Services, Salary Database, Members CRUD & Permissions,
 * Website CMS, and Universal Parameterized Data Access.
 * 
 * Strictly follows the Fail-Closed Security Policy:
 * If the Gateway is unreachable, a GatewayUnavailableError is thrown immediately.
 * Never silently fallback to direct database sockets.
 */

export class GatewayError extends Error {
  public readonly status?: number
  public readonly code?: string
  public readonly details?: unknown

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message)
    this.name = 'GatewayError'
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayUnavailableError extends GatewayError {
  constructor(message = 'Thoen Hospital API Gateway is currently unreachable. Fail-closed: refusing unauthenticated direct database access.', details?: unknown) {
    super(message, { status: 503, code: 'GATEWAY_UNAVAILABLE', details })
    this.name = 'GatewayUnavailableError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayAuthError extends GatewayError {
  constructor(message = 'Unauthorized or forbidden access to API Gateway.', status = 401, details?: unknown) {
    super(message, { status, code: 'GATEWAY_AUTH_ERROR', details })
    this.name = 'GatewayAuthError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayNotFoundError extends GatewayError {
  constructor(message = 'Requested resource not found on API Gateway.', details?: unknown) {
    super(message, { status: 404, code: 'GATEWAY_NOT_FOUND', details })
    this.name = 'GatewayNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export interface ApiGatewayConfig {
  baseUrl?: string
  apiKey?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
}

export interface GatewayApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  count?: number
  status?: string
  [key: string]: unknown
}

export interface HealthResponse {
  status: 'UP' | 'DOWN'
  service: string
  databases: {
    hosxp: { host: string; database: string; connected: boolean; latencyMs: number }
    salary: { host: string; database: string; connected: boolean; latencyMs: number }
    website: { host: string; database: string; connected: boolean; latencyMs: number }
  }
  uptime: number
}

export class ApiGatewayClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetchFn: typeof fetch

  constructor(config?: ApiGatewayConfig) {
    this.baseUrl = (config?.baseUrl || process.env.API_GATEWAY_URL || 'http://192.168.1.208:8443').replace(/\/+$/, '')
    this.apiKey = config?.apiKey || process.env.API_GATEWAY_KEY || 'thoen_gw_sec_7a8b9c2d1e0f3456'
    this.timeoutMs = config?.timeoutMs || (process.env.API_GATEWAY_TIMEOUT_MS ? parseInt(process.env.API_GATEWAY_TIMEOUT_MS, 10) : 30000)
    this.fetchFn = config?.fetchFn || fetch
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Core request dispatcher with timeout, automatic x-api-key header, and fail-closed error handling.
   */
  public async request<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const url = `${this.baseUrl}${cleanPath}`
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'x-api-key': this.apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {})
    }

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal || controller.signal
      })

      clearTimeout(timeoutId)

      let json: GatewayApiResponse<T>
      try {
        json = await response.json()
      } catch (parseErr) {
        if (!response.ok) {
          throw new GatewayError(`API Gateway HTTP ${response.status}: ${response.statusText}`, {
            status: response.status,
            details: parseErr
          })
        }
        throw new GatewayError('Failed to parse response JSON from API Gateway.', {
          status: response.status,
          details: parseErr
        })
      }

      if (!response.ok) {
        const errorMsg = json.error || `API Gateway error (${response.status})`
        if (response.status === 401 || response.status === 403) {
          throw new GatewayAuthError(errorMsg, response.status, json)
        }
        if (response.status === 404) {
          throw new GatewayNotFoundError(errorMsg, json)
        }
        if (response.status === 503) {
          throw new GatewayUnavailableError(errorMsg, json)
        }
        throw new GatewayError(errorMsg, { status: response.status, details: json })
      }

      if (json.success === false) {
        throw new GatewayError(json.error || 'Operation failed on API Gateway', { details: json })
      }

      // Return unwrapped data if response follows standard { success: true, data: ... }
      // but preserve full envelope if response has pagination metadata or custom envelope fields like slideDuration
      if (
        json.data !== undefined &&
        json.pagination === undefined &&
        json.slideDuration === undefined
      ) {
        return json.data as T
      }

      return json as unknown as T
    } catch (err: unknown) {
      clearTimeout(timeoutId)

      if (err instanceof GatewayError) {
        throw err
      }

      const isAbort = (err as Error)?.name === 'AbortError'
      const errorMsg = isAbort
        ? `Gateway request to ${path} timed out after ${timeoutMs}ms.`
        : `Connection to API Gateway failed: ${(err as Error)?.message || 'Network error'}`

      throw new GatewayUnavailableError(errorMsg, err)
    }
  }

  public get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options)
  }

  public post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body, options)
  }

  public put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PUT', body, options)
  }

  public patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PATCH', body, options)
  }

  public delete<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', body, options)
  }

  public async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health')
  }

  // ================================================================
  // Domain Namespace: Clinical Services (HOSxP)
  // ================================================================
  public readonly clinical = {
    /**
     * Executes a read-only SELECT query against the HOSxP MySQL database.
     */
    query: async <T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
      options?: RequestOptions
    ): Promise<T[]> => {
      const res = await this.post<{ data: T[]; count: number }>('/api/v1/clinical/query', { sql, params }, options)
      return Array.isArray(res) ? res : res.data || []
    },

    getErStatus: (mode?: 'tv' | 'summary') => {
      const query = mode === 'tv' ? '?mode=tv' : ''
      return this.get<{
        levels: Array<{ er_emergency_level_id: number; er_emergency_level_name: string; total: number }>
        activePatients: Array<Record<string, unknown>>
        timestamp: string
      }>(`/api/v1/clinical/er/status${query}`)
    },

    getIpdOccupancy: () => {
      return this.get<Array<{ ward: string; ward_name: string; shortname: string; admitted_patients: number }>>(
        '/api/v1/clinical/ipd/occupancy'
      )
    },

    getIpdWardRoster: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/clinical/ipd/ward-roster')
    },

    getAppointments: (params?: { date?: string; hn?: string; cid?: string }) => {
      const q = new URLSearchParams()
      if (params?.date) q.set('date', params.date)
      if (params?.hn) q.set('hn', params.hn)
      if (params?.cid) q.set('cid', params.cid)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/clinical/appointments${qs}`)
    },

    getAppointmentMismatches: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/clinical/appointments/mismatches')
    },

    getAppointmentsByCid: (cid: string) => {
      return this.get<Array<{
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
      return this.get<Array<{
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
      return this.get<any>(`/api/v1/clinical/records/visit-details?${q.toString()}`)
    },

    getLabTracker: (params?: { date?: string; vn?: string; hn?: string }) => {
      const q = new URLSearchParams()
      if (params?.date) q.set('date', params.date)
      if (params?.vn) q.set('vn', params.vn)
      if (params?.hn) q.set('hn', params.hn)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/clinical/lab/tracker${qs}`)
    },

    getLabDetail: (hn: string) => {
      return this.get<{
        hn: string
        reported: Array<Record<string, unknown>>
        pending: Array<Record<string, unknown>>
      }>(`/api/v1/clinical/lab/detail/${encodeURIComponent(hn)}`)
    },

    getLabDetailByHn: (hn: string) => {
      return this.clinical.getLabDetail(hn)
    },

    getDrugDispenseStatus: () => {
      return this.get<{
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
      return this.get<{
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
      return this.get<Array<Record<string, unknown>>>(`/api/v1/clinical/drugs/loratadine?age=${encodeURIComponent(age)}`)
    },

    getRcmOpdSummary: (startDate?: string, endDate?: string) => {
      const q = new URLSearchParams()
      if (startDate) q.set('startDate', startDate)
      if (endDate) q.set('endDate', endDate)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/clinical/rcm/opd-dept-summary${qs}`)
    },

    getRcmIpdSummary: (startDate?: string, endDate?: string) => {
      const q = new URLSearchParams()
      if (startDate) q.set('startDate', startDate)
      if (endDate) q.set('endDate', endDate)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/clinical/rcm/ipd-dept-adjrw${qs}`)
    },

    verifyScreeningVisits: (cids: string[]) => {
      return this.post<Array<{
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
      return this.get<{
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
      return this.get<{
        items: Array<any>
        totalCount: number
        totalPages: number
        page: number
        pageSize: number
        dateType?: 'bill_date' | 'admdate'
      }>(`/api/v1/clinical/rcm/invoice-details${qs}`)
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
      return this.get<any>(`/api/v1/clinical/rcm/palliative-care${qs}`)
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
      return this.get<T[]>(`/api/v1/clinical/mok/list?${q.toString()}`)
    },

    getMokSummary: (params?: {
      catchment?: 'in_catchment' | 'out_catchment'
      hospcode?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.catchment) q.set('catchment', params.catchment)
      if (params?.hospcode) q.set('hospcode', params.hospcode)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Record<string, number>>(`/api/v1/clinical/mok/summary${qs}`)
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
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<any>(`/api/v1/clinical/rcm/funds/${encodeURIComponent(fundKey)}${qs}`)

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

    getAdpMapping: (adpCode: string) => {
      return this.get<{
        success: boolean
        adpCode: string
        isMapped: boolean
        mappedCount: number
        items: Array<{ icode: string; name: string; strength: string | null; nhso_adp_code: string }>
      }>(`/api/v1/clinical/rcm/funds/adp-mapping/${encodeURIComponent(adpCode.trim())}`)
    },

    // ── RCM Rep Statement & Fund Group Named APIs ──
    getRepFundsYears: async () => {
      const res = await this.get<any>('/api/v1/clinical/rcm/rep-funds/years')
      const data: string[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      return { success: true, data }
    },

    getRepFundsSummary: async (params?: {
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
      const res = await this.get<any>(`/api/v1/clinical/rcm/rep-funds/summary${qs}`)
      const data = res?.data || res || {}
      return { success: true, data }
    },

    getRepFundsCases: async (params?: {
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
      const res = await this.get<any>(`/api/v1/clinical/rcm/rep-funds/cases${qs}`)
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
      return this.get<{
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
      return this.post<{
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
      return this.delete<{
        success: boolean
        deletedCount: number
        message?: string
      }>('/api/v1/clinical/rcm/t1dm/registries', payload)
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
      const res = await this.get<any>(`/api/v1/clinical/rcm/rep-funds/lookup${qs}`)
      const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      return { success: true, data }
    }
  }



  // ================================================================
  // Domain Namespace: Salary Services
  // ================================================================
  public readonly salary = {
    verifyLogin: (username: string, password: string) => {
      return this.post<{
        user: { username: string; name: string; status: string }
      }>('/api/v1/salary/verify-login', { username, password })
    },

    getRecords: (username: string) => {
      return this.get<{
        salary: Array<Record<string, unknown>>
        ot: Array<Record<string, unknown>>
      }>(`/api/v1/salary/records/${encodeURIComponent(username)}`)
    },

    getPeriods: () => {
      return this.get<Array<{ id: number; type: string; datein: string; notesalary: string | null }>>(
        '/api/v1/salary/periods'
      )
    },

    getCalendar: () => {
      return this.get<Array<{ id: number; type: string; datein: string; notesalary: string | null }>>(
        '/api/v1/salary/calendar'
      )
    },

    createPeriod: (period: { type?: string; datein: string; notesalary: string }) => {
      return this.post<{ insertId: number }>('/api/v1/salary/periods', period)
    },

    updatePeriod: (id: string | number, period: { type?: string; datein: string; notesalary?: string | null }) => {
      return this.put<{ success: boolean; affectedRows: number }>(`/api/v1/salary/periods/${id}`, period)
    },

    deletePeriod: (id: string | number) => {
      return this.delete<{ deletedId: string }>(`/api/v1/salary/periods/${id}`)
    },

    getUsers: () => {
      return this.get<Array<{ user_name: string; user_pass: string }>>('/api/v1/salary/users')
    },

    uploadBatch: (targetTable: 'salary' | 'ot', rows: Record<string, unknown>[]) => {
      return this.post<{ insertedCount: number }>('/api/v1/salary/upload-batch', { targetTable, rows })
    },

    getLatestBatchSummary: (type: 'salary' | 'ot') => {
      return this.get<{ summary: { tableName: 'salary' | 'ot'; date: string; count: number } | null }>(
        `/api/v1/salary/batch/summary/${type}`
      )
    },

    deleteLatestBatch: (type: 'salary' | 'ot', confirmedDate: string) => {
      return this.delete<{ deletedCount: number; deletedDate: string; tableName: 'salary' | 'ot' }>(
        `/api/v1/salary/batch/latest/${type}`,
        { confirmedDate }
      )
    },

    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const res = await this.post<{ data: T[]; count: number }>('/api/v1/salary/query', { sql, params })
      return Array.isArray(res) ? res : res.data || []
    },

    /**
     * @deprecated Disabled on Gateway (HTTP 410 Gone). Use named salary methods instead (uploadBatch, deleteLatestBatch, etc.).
     */
    execute: (sql: string, params: unknown[] = []) => {
      return this.post<{ affectedRows: number; insertId: number | null }>('/api/v1/salary/execute', { sql, params })
    }
  }

  // ================================================================
  // Domain Namespace: Website Core Application (CMS, Members, Tasks)
  // ================================================================
  public readonly app = {
    /**
     * Executes a read-only SELECT query against the Website MySQL database.
     */
    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const res = await this.post<{ data: T[]; count: number }>('/api/v1/app/query', { sql, params })
      return Array.isArray(res) ? res : res.data || []
    },

    /**
     * Executes an INSERT, UPDATE, or DELETE parameterized query against the Website database.
     */
    execute: (sql: string, params: unknown[] = []) => {
      return this.post<{ affectedRows: number; insertId: number | null }>('/api/v1/app/execute', { sql, params })
    },

    /**
     * Executes an array of statements atomically inside a single interactive transaction.
     */
    transaction: (statements: Array<{ sql: string; params?: unknown[] }>) => {
      return this.post<{ count: number; results: Array<{ affectedRows: number; insertId: number | null }> }>(
        '/api/v1/app/transaction',
        { statements }
      )
    },

    // ── Members CRUD & Permissions ──
    getMembers: (params?: { search?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/members${qs}`)
    },

    getMemberById: (id: string | number) => {
      return this.get<Record<string, unknown>>(`/api/v1/app/members/${id}`)
    },

    createMember: (member: {
      username: string
      email: string
      name?: string | null
      department?: string | null
      position?: string | null
      role?: string
      salary_user?: string | null
    }) => {
      return this.post<{ insertId: number }>('/api/v1/app/members', member)
    },

    updateMember: (
      id: string | number,
      member: Partial<{
        username: string
        email: string
        name: string | null
        department: string | null
        position: string | null
        role: string
        salary_user: string | null
      }>
    ) => {
      return this.put<{ message: string }>(`/api/v1/app/members/${id}`, member)
    },

    deleteMember: (id: string | number) => {
      return this.delete<{ message: string }>(`/api/v1/app/members/${id}`)
    },

    getMemberPermissions: (id: string | number) => {
      return this.get<{ memberId: string; permissions: Array<{ permission_key: string; created_at: string; created_by: string }> }>(
        `/api/v1/app/members/${id}/permissions`
      )
    },

    grantMemberPermission: (id: string | number, permissionKey: string, createdBy?: string) => {
      return this.post<{ message: string }>(`/api/v1/app/members/${id}/permissions`, { permissionKey, createdBy })
    },

    revokeMemberPermission: (id: string | number, permissionKey: string) => {
      return this.delete<{ message: string }>(`/api/v1/app/members/${id}/permissions/${encodeURIComponent(permissionKey)}`)
    },

    getMemberAuthContext: (username: string, email: string) => {
      return this.post<{
        member: {
          id: number
          username: string
          email: string
          name: string | null
          department: string | null
          position: string | null
          salary_user: string | null
          role: string
          signature_path: string | null
          profile_path: string | null
        } | null
        permissions: string[]
        settings: Record<string, string>
        isTelegramLinked: boolean
      }>('/api/v1/app/members/auth-context', { username, email })
    },

    checkPositionPermission: (username: string, permissionKeys: string[]) => {
      return this.post<{ allowed: boolean }>('/api/v1/app/members/check-position-permission', {
        username,
        permissionKeys
      })
    },

    // ── Security Audit Log ──
    logAudit: (entry: {
      actionType: string
      targetTable?: string
      actionDetails?: string
      username?: string
      email?: string
      ipAddress?: string
      userAgent?: string
    }) => {
      return this.post<{ logId: number }>('/api/v1/audit/log', entry)
    },

    // ── News CMS ──
    getNews: (params?: { page?: number; limit?: number; category?: string; all?: boolean; search?: string }) => {
      const q = new URLSearchParams()
      if (params?.page) q.set('page', String(params.page))
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.category) q.set('category', params.category)
      if (params?.all !== undefined) q.set('all', String(params.all))
      if (params?.search) q.set('search', params.search)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<{
        success: boolean
        count: number
        total: number
        pagination: {
          page: number
          limit: number
          total: number
          totalPages: number
        }
        data: Array<Record<string, any>>
      }>(`/api/v1/app/news${qs}`)
    },

    getNewsById: (id: string | number) => {
      const strId = String(id)
      const encoded = encodeURIComponent(strId)
      return this.get<{
        success: boolean
        data: Record<string, any>
      }>(`/api/v1/app/news/${encoded}?slug=${encoded}`)
    },

    incrementNewsView: (id: string | number) => {
      const strId = String(id)
      const encoded = encodeURIComponent(strId)
      return this.post<{ success: boolean; message?: string }>(`/api/v1/app/news/${encoded}/view?slug=${encoded}`, {})
    },

    createNews: (news: {
      title: string
      slug: string
      category: string
      youtubeLink?: string | null
      startDate: string
      endDate: string
      attachments?: Array<{
        filePath: string
        fileType?: string
        originalName?: string
      }>
    }) => {
      return this.post<{
        success: boolean
        insertId: number
        data?: Record<string, any>
      }>('/api/v1/app/news', news)
    },

    updateNews: (
      id: string | number,
      news: Partial<{
        title: string
        category: string
        youtubeLink: string | null
        startDate: string
        endDate: string
        attachments: Array<{
          filePath: string
          fileType?: string
          originalName?: string
        }>
      }>
    ) => {
      return this.put<{ success: boolean; message: string; data?: Record<string, any> }>(`/api/v1/app/news/${id}`, news)
    },

    getPublishedNews: (limit = 20) => {
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/news/published?limit=${limit}`)
    },

    getSitemapNews: () => {
      return this.get<Array<{ id: number; slug: string; updatedAt: string }>>('/api/v1/app/news/sitemap')
    },

    deleteNews: (id: string | number) => {
      return this.delete<{ success: boolean; message: string }>(`/api/v1/app/news/${id}`)
    },

    // ── Hero Slides ──
    getSlides: async (all = false) => {
      const qs = all ? '?all=true' : ''
      const res = await this.get<any>(`/api/v1/app/slides${qs}`)
      const slides = Array.isArray(res)
        ? res
        : (Array.isArray(res?.slides) ? res.slides : (Array.isArray(res?.data) ? res.data : []))
      const slideDuration = (!Array.isArray(res) && typeof res?.slideDuration === 'number')
        ? res.slideDuration
        : 6
      return {
        success: true,
        count: slides.length,
        slides,
        data: slides,
        slideDuration,
      }
    },

    getActiveSlides: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/slides/active')
    },

    createSlide: (slide: {
      title?: string | null
      imagePath: string
      linkUrl?: string | null
      displayOrder?: number
      duration?: number
      startDate: string | null
      endDate: string | null
    }) => {
      return this.post<{
        success: boolean
        insertId: number
        slide: Record<string, any>
      }>('/api/v1/app/slides', slide)
    },

    updateSlide: (
      id: string | number,
      slide: {
        title?: string | null
        imagePath: string
        linkUrl?: string | null
        displayOrder?: number
        duration?: number
        startDate: string | null
        endDate: string | null
      }
    ) => {
      return this.put<{
        success: boolean
        slide: Record<string, any>
        previousImagePath?: string
      }>(`/api/v1/app/slides/${id}`, slide)
    },

    deleteSlide: (id: string | number) => {
      return this.delete<{
        success: boolean
        message: string
        slide: Record<string, any>
      }>(`/api/v1/app/slides/${id}`)
    },

    updateSlideDuration: (slideDuration: number) => {
      return this.patch<{
        success: boolean
        slideDuration: number
      }>('/api/v1/app/slides/duration', { slideDuration })
    },

    // ── Hospital Locations ──
    getLocations: (params?: {
      search?: string
      buildingId?: string | number
      status?: 'active' | 'inactive' | 'all'
      page?: number
      limit?: number
      detailed?: boolean
    }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.buildingId) q.set('buildingId', String(params.buildingId))
      if (params?.status) q.set('status', params.status)
      if (params?.page) q.set('page', String(params.page))
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.detailed !== undefined) q.set('detailed', String(params.detailed))
      const qs = q.toString() ? `?${q.toString()}` : ''

      return this.get<any>(`/api/v1/app/locations${qs}`)
    },

    createLocation: (location: {
      room_name: string
      floor_id?: number
      floor_name: string
      building_id?: number
      building_name: string
      is_active?: boolean | number
    }) => {
      return this.post<{
        success: boolean
        message: string
        data: Record<string, any>
      }>('/api/v1/app/locations', location)
    },

    updateLocation: (
      id: string | number,
      location: {
        is_active?: boolean | number
        room_name?: string
        floor_id?: number
        floor_name?: string
        building_id?: number
        building_name?: string
      }
    ) => {
      return this.put<{
        success: boolean
        message: string
        data?: Record<string, any>
      }>(`/api/v1/app/locations/${id}`, location)
    },

    deleteLocation: (id: string | number) => {
      return this.delete<{
        success: boolean
        message: string
        location?: Record<string, any>
      }>(`/api/v1/app/locations/${id}`)
    },

    // ── Assets, Events, Tasks ──
    getAssets: (params?: { search?: string; category?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.category) q.set('category', params.category)
      if (params?.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/assets${qs}`)
    },

    getEvents: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/events')
    },

    getTasks: (params?: { type?: string; status?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (params?.type) q.set('type', params.type)
      if (params?.status) q.set('status', params.status)
      if (params?.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/tasks${qs}`)
    },

    getInboxTasks: (params: {
      tab?: string
      memberId?: number
      username?: string
      type?: string
      status?: string
      search?: string
      limit?: number
    }) => {
      const q = new URLSearchParams()
      if (params.tab) q.set('tab', params.tab)
      if (params.memberId) q.set('memberId', String(params.memberId))
      if (params.username) q.set('username', params.username)
      if (params.type) q.set('type', params.type)
      if (params.status) q.set('status', params.status)
      if (params.search) q.set('search', params.search)
      if (params.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<{
        success: boolean
        data: {
          tasks: Array<any>
          inboxCount: number
          departmentCount: number
          canViewAll: boolean
          userDepartment: string
          stats: {
            pendingCount: number
            departmentCount: number
            allPendingCount: number
            approvedCount: number
            myRequestsCount: number
          }
        }
      }>(`/api/v1/app/tasks/inbox${qs}`)
    },

    createTask: (data: {
      task: {
        id?: string
        taskNo: string
        taskType: string
        title: string
        description?: string
        urgency?: string
        requesterId: number
        requesterName: string
        requesterDept?: string | null
        initialAssignee?: number | null
        initialRole?: string | null
        customPayload?: any
      }
      steps?: Array<{
        stepNo?: number
        stepName: string
        assigneeType?: string
        assignedToId?: number | null
        assignedRole?: string | null
      }>
      repairDetail?: {
        repairType?: string
        itemCategory?: string
        equipmentNumber?: string | null
        equipmentName?: string | null
        nonEquipmentItem?: string | null
        locationId?: number | null
        locationFullName?: string
        symptomDetail?: string
        assignedTechnicianId?: number | null
        assignedTechnicianName?: string | null
        photos?: string[]
      } | null
      auditLog?: {
        action?: string
        performedBy?: number
        performerName?: string
        details?: any
      } | null
    }) => {
      return this.post<{
        success: boolean
        message: string
        data: {
          taskId: string
          taskNo: string
        }
      }>('/api/v1/app/tasks/create', data)
    },

    generateTaskNo: (ymPrefix: string) => {
      return this.post<{ success: boolean; count: number; taskNo: string }>('/api/v1/app/tasks/generate-no', {
        ymPrefix
      })
    },

    getTaskFullDetails: (id: string | number) => {
      return this.get<{
        success: boolean
        data: {
          task: Record<string, any>
          steps: Array<Record<string, any>>
          repairDetail: Record<string, any> | null
          auditLogs: Array<Record<string, any>>
        }
      }>(`/api/v1/app/tasks/${encodeURIComponent(String(id))}/full-details`)
    },

    executeWorkflowAction: (data: {
      taskId: string
      action: string
      comment?: string
      nextAssigneeId?: number | null
      partialEdits?: Record<string, any>
      holdReason?: string
      holdDetails?: string
      targetStepNo?: number | null
      signaturePath?: string | null
      signatureHash?: string | null
      actor: {
        id: number
        username: string
        name?: string | null
        position?: string | null
        role?: string | null
      }
    }) => {
      return this.post<{
        success: boolean
        message: string
        isFinalStep: boolean
        nextStep: Record<string, any> | null
      }>('/api/v1/app/tasks/workflow-action', data)
    },

    executeRepairAction: (data: {
      taskId: string
      action: string
      performer: {
        id: number
        username: string
        name?: string | null
        position?: string | null
        role?: string | null
      }
      payload?: Record<string, any>
    }) => {
      return this.post<{
        success: boolean
        message: string
      }>('/api/v1/app/tasks/repair-action', data)
    },

    updateTaskByManager: (
      id: string | number,
      data: {
        performer: { id: number; username: string; name?: string | null }
        taskUpdates?: Record<string, any>
        repairUpdates?: Record<string, any>
        diffDetails?: Record<string, any>
      }
    ) => {
      return this.put<{ success: boolean; message: string }>(
        `/api/v1/app/tasks/${encodeURIComponent(String(id))}/manager-edit`,
        data
      )
    },

    // ── Member Registrations ──
    getRegistrations: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/registrations')
    },

    // ── Palliative Care Registry ──
    getPalliativeRegistries: (params?: {
      search?: string
      registrationStatus?: string
      claimStatus?: string
      claimResult?: string
      page?: number
      limit?: number
    }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.registrationStatus) q.set('registrationStatus', params.registrationStatus)
      if (params?.claimStatus) q.set('claimStatus', params.claimStatus)
      if (params?.claimResult) q.set('claimResult', params.claimResult)
      if (params?.page) q.set('page', String(params.page))
      if (params?.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<{
        items: Array<any>
        total: number
        page: number
        limit: number
        totalPages: number
        stats: {
          total: number
          registered: number
          pendingRegistration: number
          claimed: number
          paid: number
          deny: number
        }
      }>(`/api/v1/app/palliative-care/registries${qs}`)
    },

    getPalliativeRegistryById: (id: string | number) => {
      return this.get<Record<string, unknown>>(`/api/v1/app/palliative-care/registries/${id}`)
    },

    getPalliativeRegistryByHn: (hn: string) => {
      return this.get<{ exists: boolean; data: { id: number; hn: string; patientName: string } | null }>(
        `/api/v1/app/palliative-care/registries/by-hn/${encodeURIComponent(hn.trim())}`
      )
    },

    importKpiBatch: (topicId: number, rows: Array<Record<string, unknown>>) => {
      return this.post<{ insertedCount: number }>('/api/v1/app/kpi/import-batch', { topicId, rows })
    },

    createPalliativeRegistry: (record: Record<string, unknown>) => {
      return this.post<{ insertId: number }>('/api/v1/app/palliative-care/registries', record)
    },

    updatePalliativeRegistry: (id: string | number, updates: Record<string, unknown>) => {
      return this.put<{ affectedRows: number }>(`/api/v1/app/palliative-care/registries/${id}`, updates)
    },

    deletePalliativeRegistry: (id: string | number) => {
      return this.delete<{ message: string }>(`/api/v1/app/palliative-care/registries/${id}`)
    },

    // ── LTC (Long-Term Care) Registry ──
    getLtcHns: () => {
      return this.get<{ success: boolean; count: number; data: string[] }>('/api/v1/app/ltc/hns')
    },

    getLtcRegistries: (params?: {
      search?: string
      areaZone?: string
      page?: number
      limit?: number
      exportAll?: boolean
    }) => {
      const q = new URLSearchParams()
      if (params?.search) q.set('search', params.search)
      if (params?.areaZone) q.set('areaZone', params.areaZone)
      if (params?.page) q.set('page', String(params.page))
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.exportAll) q.set('exportAll', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<{
        success: boolean
        items: Array<any>
        total: number
        page: number
        limit: number
        totalPages: number
        availableAreaZones: string[]
        stats: {
          total: number
          avgAdl: number
          zoneCounts: Record<string, number>
        }
      }>(`/api/v1/app/ltc/registries${qs}`)
    },

    getLtcRegistryById: (id: string | number) => {
      return this.get<{ success: boolean; data: any }>(`/api/v1/app/ltc/registries/${id}`)
    },

    getLtcRegistryByHn: (hn: string) => {
      return this.get<{ success: boolean; exists: boolean; data: any | null }>(
        `/api/v1/app/ltc/registries/by-hn/${encodeURIComponent(hn.trim())}`
      )
    },

    createLtcRegistry: (record: Record<string, unknown>) => {
      return this.post<{ success: boolean; insertId: number }>('/api/v1/app/ltc/registries', record)
    },

    updateLtcRegistry: (id: string | number, updates: Record<string, unknown>) => {
      return this.put<{ success: boolean; affectedRows: number }>(`/api/v1/app/ltc/registries/${id}`, updates)
    },

    deleteLtcRegistry: (id: string | number) => {
      return this.delete<{ success: boolean; message: string }>(`/api/v1/app/ltc/registries/${id}`)
    },

    // ── ITA Blogs ──
    getItaBlogs: async (options?: { authorId?: string | number; admin?: boolean | string; search?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (options?.authorId !== undefined) q.set('authorId', String(options.authorId))
      if (options?.admin !== undefined) q.set('admin', String(options.admin))
      if (options?.search) q.set('search', options.search)
      if (options?.limit !== undefined) q.set('limit', String(options.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<{ success?: boolean; data?: any[] } | any[]>(`/api/v1/app/ita/blogs${qs}`)
      if (Array.isArray(res)) return res
      return (res as any)?.data || []
    },

    getItaBlogById: async (idOrSlug: string | number) => {
      const target = String(idOrSlug).trim()
      const isNumeric = /^\d+$/.test(target)
      const path = isNumeric
        ? `/api/v1/app/ita/blogs/${encodeURIComponent(target)}`
        : `/api/v1/app/ita/blogs/by-slug?slug=${encodeURIComponent(target)}`
      const res = await this.get<{ success?: boolean; data?: any } | any>(path)
      if (res && typeof res === 'object' && 'data' in res) return res.data
      return res
    },

    createItaBlog: (data: {
      title: string
      slug?: string
      content: string
      authorId?: number | null
      authorName?: string
      authorPosition?: string
    }) => {
      return this.post<{ success: boolean; id: number }>('/api/v1/app/ita/blogs', data)
    },

    updateItaBlog: (
      id: string | number,
      data: {
        title?: string
        slug?: string
        content?: string
      }
    ) => {
      return this.put<{ success: boolean; affectedRows: number }>(`/api/v1/app/ita/blogs/${id}`, data)
    },

    deleteItaBlog: (id: string | number) => {
      return this.delete<{ success: boolean; message: string; authorId?: number }>(`/api/v1/app/ita/blogs/${id}`)
    },

    // ── RDU (Rational Drug Use) ──
    getRduTree: async (options?: { includeInactive?: boolean }) => {
      const q = new URLSearchParams()
      if (options?.includeInactive) q.set('includeInactive', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<{ success?: boolean; folders?: any[] }>(`/api/v1/app/rdu/tree${qs}`)
      return res?.folders || []
    },

    createRduFolder: (data: { folder_name: string }) => {
      return this.post<{ success: boolean; folderId: number; folderName: string; displayOrder: number }>(
        '/api/v1/app/rdu/folders',
        data
      )
    },

    updateRduFolder: (
      id: string | number,
      data: {
        action?: string
        folder_name?: string
        orders?: Array<{ id: number; display_order: number }>
      }
    ) => {
      return this.put<{ success: boolean; message: string; oldFolderName?: string; newFolderName?: string }>(
        `/api/v1/app/rdu/folders/${id}`,
        data
      )
    },

    deleteRduFolder: (id: string | number) => {
      return this.delete<{ success: boolean; message: string; folderName: string }>(`/api/v1/app/rdu/folders/${id}`)
    },

    getRduFileById: async (id: string | number) => {
      const res = await this.get<any>(`/api/v1/app/rdu/files/${id}`)
      if (res && typeof res === 'object') {
        if ('data' in res && res.data) return res.data
        if ('file_name' in res || 'id' in res) return res
      }
      return null
    },

    createRduFile: (data: {
      folder_id: number
      display_name: string
      file_name: string
      file_path?: string
      file_size?: number | null
    }) => {
      return this.post<{ success: boolean; file: any }>('/api/v1/app/rdu/files', data)
    },

    updateRduFile: (
      id: string | number,
      data: {
        action?: string
        display_name?: string
        orders?: Array<{ id: number; display_order: number }>
      }
    ) => {
      return this.put<{ success: boolean; message: string }>(`/api/v1/app/rdu/files/${id}`, data)
    },

    deleteRduFile: (id: string | number) => {
      return this.delete<{ success: boolean; message: string; file: any }>(`/api/v1/app/rdu/files/${id}`)
    },

    // ── Outgoing Documents ──
    getOutgoingDocuments: async (options?: { activeOnly?: boolean; order?: 'service' | 'manager' }) => {
      const q = new URLSearchParams()
      if (options?.activeOnly) q.set('activeOnly', 'true')
      if (options?.order) q.set('order', options.order)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<{ success?: boolean; documents?: any[] }>(`/api/v1/app/outgoing-documents${qs}`)
      return res?.documents || []
    },

    getOutgoingDocumentById: async (id: string | number) => {
      const res = await this.get<any>(`/api/v1/app/outgoing-documents/${id}`)
      if (res && typeof res === 'object') {
        if ('document' in res && res.document) return res.document
        if ('data' in res && res.data) return res.data
        if ('id' in res) return res
      }
      return null
    },

    createOutgoingDocument: (data: {
      year: string
      label: string
      note?: string
      url: string
      status?: string
      displayOrder?: number
      isActive?: boolean
      createdBy?: string
      updatedBy?: string
    }) => {
      return this.post<{ success: boolean; document: any; message: string }>('/api/v1/app/outgoing-documents', data)
    },

    updateOutgoingDocument: (
      id: string | number,
      data: {
        year?: string
        label?: string
        note?: string
        url?: string
        status?: string
        displayOrder?: number
        isActive?: boolean
        updatedBy?: string
      }
    ) => {
      return this.put<{ success: boolean; document: any; message: string }>(`/api/v1/app/outgoing-documents/${id}`, data)
    },

    deleteOutgoingDocument: (id: string | number) => {
      return this.delete<{ success: boolean; message: string; document: any }>(`/api/v1/app/outgoing-documents/${id}`)
    }
  }

  // ================================================================
  // Domain Namespace: GTW (Gotowin) Office Integration
  // ================================================================
  public readonly gtw = {
    /**
     * Fetch raw articles from GTW database via Centralized API Gateway.
     */
    getArticles: async <T = Record<string, unknown>>(options?: { limit?: number; offset?: number; since?: string }): Promise<T[]> => {
      const q = new URLSearchParams()
      if (options?.limit) q.set('limit', String(options.limit))
      if (options?.offset) q.set('offset', String(options.offset))
      if (options?.since) q.set('since', options.since)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<{ data?: T[] } | T[]>(`/api/v1/gtw/articles${qs}`)
      if (Array.isArray(res)) return res
      return (res as { data?: T[] })?.data || []
    }
  }

  // ================================================================
  // Domain Namespace: Tasks & Workflow
  // ================================================================
  public get tasks() {
    return this.app
  }
}

/**
 * Singleton instance of ApiGatewayClient configured from environment variables.
 */
export const apiGateway = new ApiGatewayClient()

/**
 * Factory function for creating custom instances (e.g. for testing with custom fetchFn or baseUrl).
 */
export function createApiGatewayClient(config?: ApiGatewayConfig): ApiGatewayClient {
  return new ApiGatewayClient(config)
}

export default apiGateway
