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
    this.timeoutMs = config?.timeoutMs || (process.env.API_GATEWAY_TIMEOUT_MS ? parseInt(process.env.API_GATEWAY_TIMEOUT_MS, 10) : 8000)
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
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
      if (json.data !== undefined) {
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

  public delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, options)
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
    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const res = await this.post<{ data: T[]; count: number }>('/api/v1/clinical/query', { sql, params })
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

    getDrugDispenseStatus: () => {
      return this.get<{
        paid: Array<Record<string, unknown>>
        printed: Array<Record<string, unknown>>
        updatedAt: string
      }>('/api/v1/clinical/drugs/status')
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

    createPeriod: (period: { type?: string; datein: string; notesalary: string }) => {
      return this.post<{ insertId: number }>('/api/v1/salary/periods', period)
    },

    deletePeriod: (id: string | number) => {
      return this.delete<{ deletedId: string }>(`/api/v1/salary/periods/${id}`)
    },

    uploadBatch: (targetTable: 'salary' | 'ot', rows: Record<string, unknown>[]) => {
      return this.post<{ insertedCount: number }>('/api/v1/salary/upload-batch', { targetTable, rows })
    },

    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const res = await this.post<{ data: T[]; count: number }>('/api/v1/salary/query', { sql, params })
      return Array.isArray(res) ? res : res.data || []
    },

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
    getMembers: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/members')
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
    getNews: (params?: { category?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (params?.category) q.set('category', params.category)
      if (params?.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/news${qs}`)
    },

    getNewsById: (id: string | number) => {
      return this.get<Record<string, unknown>>(`/api/v1/app/news/${id}`)
    },

    createNews: (news: {
      title: string
      slug: string
      category: string
      youtubeLink?: string | null
      startDate: string
      endDate: string
    }) => {
      return this.post<{ insertId: number }>('/api/v1/app/news', news)
    },

    updateNews: (
      id: string | number,
      news: Partial<{
        title: string
        category: string
        youtubeLink: string | null
        startDate: string
        endDate: string
      }>
    ) => {
      return this.put<{ message: string }>(`/api/v1/app/news/${id}`, news)
    },

    deleteNews: (id: string | number) => {
      return this.delete<{ message: string }>(`/api/v1/app/news/${id}`)
    },

    // ── Hero Slides ──
    getSlides: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/slides')
    },

    createSlide: (slide: {
      title?: string
      imagePath: string
      linkUrl?: string
      displayOrder?: number
      duration?: number
      startDate: string
      endDate: string
    }) => {
      return this.post<{ insertId: number }>('/api/v1/app/slides', slide)
    },

    deleteSlide: (id: string | number) => {
      return this.delete<{ message: string }>(`/api/v1/app/slides/${id}`)
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

    // ── Contact Messages & Registrations ──
    getContactMessages: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/contact-messages')
    },

    sendContactMessage: (msg: { name: string; email: string; message: string; phone?: string }) => {
      return this.post<{ messageId: number }>('/api/v1/app/contact-messages', msg)
    },

    getRegistrations: () => {
      return this.get<Array<Record<string, unknown>>>('/api/v1/app/registrations')
    }
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
