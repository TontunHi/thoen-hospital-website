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

import {
  GatewayError,
  GatewayUnavailableError,
  GatewayTimeoutError,
  GatewayAuthError,
  GatewayNotFoundError,
  type ApiGatewayConfig,
  type RequestOptions,
  type GatewayApiResponse,
  type HealthResponse,
} from './gateway/gatewayTypes'
import { createClinicalNamespace } from './gateway/clinicalGatewayNamespace'

export {
  GatewayError,
  GatewayUnavailableError,
  GatewayTimeoutError,
  GatewayAuthError,
  GatewayNotFoundError,
  type ApiGatewayConfig,
  type RequestOptions,
  type GatewayApiResponse,
  type HealthResponse,
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
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

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
        if (response.status === 504) {
          throw new GatewayTimeoutError(errorMsg, json)
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
      if (timedOut || (isAbort && !options?.signal?.aborted)) {
        throw new GatewayTimeoutError(`Gateway request to ${path} timed out after ${timeoutMs}ms.`, err)
      }
      if (isAbort) {
        throw new GatewayUnavailableError(`Gateway request to ${path} was aborted.`, err)
      }

      const cause = (err as Error & { cause?: { code?: string; message?: string } })?.cause
      const causeDetail = cause?.code || cause?.message ? ` (${[cause.code, cause.message].filter(Boolean).join(': ')})` : ''
      const errorMsg = `Connection to API Gateway failed: ${(err as Error)?.message || 'Network error'}${causeDetail}`

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
  public readonly clinical = createClinicalNamespace({
    get: (path, options) => this.get(path, options),
    post: (path, body, options) => this.post(path, body, options),
    delete: (path, body, options) => this.delete(path, body, options),
  })



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
    query: async <T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
      options?: RequestOptions
    ): Promise<T[]> => {
      const res = await this.post<{ data: T[]; count: number }>('/api/v1/app/query', { sql, params }, options)
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
    transaction: (statements: Array<{ sql: string; params?: unknown[] }>, options?: RequestOptions) => {
      return this.post<{ count: number; results: Array<{ affectedRows: number; insertId: number | null }> }>(
        '/api/v1/app/transaction',
        { statements },
        options
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

    // ── Photo News Albums ──
    getAlbums: (params?: {
      all?: boolean
      page?: number
      limit?: number
      year?: number
      month?: number
      search?: string
    }) => {
      const qs = new URLSearchParams()
      if (params?.all) qs.set('all', 'true')
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.year) qs.set('year', String(params.year))
      if (params?.month) qs.set('month', String(params.month))
      if (params?.search) qs.set('search', params.search)
      const q = qs.toString()
      return this.get<{
        success: boolean
        albums: Array<Record<string, any>>
        availableMonths?: Array<{ year: number; month: number; count: number }>
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/v1/app/albums${q ? `?${q}` : ''}`)
    },

    getAlbumById: (idOrSlug: string | number) => {
      return this.get<{ success: boolean; data: Record<string, any> }>(
        `/api/v1/app/albums/${encodeURIComponent(String(idOrSlug))}`
      )
    },

    createAlbum: (album: {
      title: string
      slug: string
      description?: string | null
      eventDate: string
      coverImageUrl?: string | null
      status?: 'PUBLISHED' | 'DRAFT'
      isPinned?: boolean
      createdBy?: string | null
      images: Array<{
        imageUrl: string
        caption?: string | null
        displayOrder?: number
      }>
    }) => {
      return this.post<{
        success: boolean
        insertId: number
        data?: Record<string, any>
      }>('/api/v1/app/albums', album)
    },

    updateAlbum: (
      id: string | number,
      album: Partial<{
        title: string
        description: string | null
        eventDate: string
        coverImageUrl: string | null
        status: 'PUBLISHED' | 'DRAFT'
        isPinned: boolean
        images: Array<{
          imageUrl: string
          caption?: string | null
          displayOrder?: number
        }>
      }>
    ) => {
      return this.put<{
        success: boolean
        message: string
        previousImageUrls?: string[]
        data?: Record<string, any>
      }>(`/api/v1/app/albums/${id}`, album)
    },

    deleteAlbum: (id: string | number) => {
      return this.delete<{
        success: boolean
        message: string
        deletedImageUrls?: string[]
      }>(`/api/v1/app/albums/${id}`)
    },

    incrementAlbumView: (idOrSlug: string | number) => {
      return this.post<{ success: boolean }>(
        `/api/v1/app/albums/${encodeURIComponent(String(idOrSlug))}/view`,
        {}
      )
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

    getInboxTasks: async (params: {
      tab?: string
      memberId?: number
      username?: string
      type?: string
      status?: string
      search?: string
      limit?: number
    }): Promise<{
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
    }> => {
      const q = new URLSearchParams()
      if (params.tab) q.set('tab', params.tab)
      if (params.memberId) q.set('memberId', String(params.memberId))
      if (params.username) q.set('username', params.username)
      if (params.type) q.set('type', params.type)
      if (params.status) q.set('status', params.status)
      if (params.search) q.set('search', params.search)
      if (params.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<any>(`/api/v1/app/tasks/inbox${qs}`)
      if (res && typeof res === 'object') {
        const payload = 'data' in res && res.data && typeof res.data === 'object' ? res.data : res
        if (payload && Array.isArray(payload.tasks)) {
          return {
            success: res.success !== false,
            data: payload,
          }
        }
      }
      return res
    },

    createTask: async (data: {
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
    }): Promise<{
      success: boolean
      message: string
      data: {
        taskId: string
        taskNo: string
      }
    }> => {
      const res = await this.post<any>('/api/v1/app/tasks/create', data)
      if (res && typeof res === 'object') {
        if ('data' in res && res.data && typeof res.data === 'object') {
          return {
            success: res.success !== false,
            message: res.message || '',
            data: res.data,
          }
        }
        if ('taskId' in res || 'taskNo' in res) {
          return {
            success: res.success !== false,
            message: res.message || '',
            data: {
              taskId: res.taskId,
              taskNo: res.taskNo,
            },
          }
        }
      }
      return res
    },

    generateTaskNo: async (ymPrefix: string): Promise<{ success: boolean; count: number; taskNo: string }> => {
      const res = await this.post<any>('/api/v1/app/tasks/generate-no', {
        ymPrefix
      })
      if (res && typeof res === 'object') {
        const inner = 'data' in res && res.data && typeof res.data === 'object' ? res.data : res
        if (inner && 'taskNo' in inner) {
          return {
            success: res.success !== false,
            count: Number(inner.count ?? 0),
            taskNo: inner.taskNo,
          }
        }
      }
      return res
    },

    getTaskFullDetails: async (id: string | number): Promise<{
      success: boolean
      data: {
        task: Record<string, any>
        steps: Array<Record<string, any>>
        repairDetail: Record<string, any> | null
        auditLogs: Array<Record<string, any>>
      }
    }> => {
      const res = await this.get<any>(`/api/v1/app/tasks/${encodeURIComponent(String(id))}/full-details`)
      if (res && typeof res === 'object') {
        const payload = 'data' in res && res.data && typeof res.data === 'object' ? res.data : res
        if (payload && 'task' in payload) {
          return {
            success: res.success !== false,
            data: payload,
          }
        }
      }
      return res
    },

    executeWorkflowAction: async (data: {
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
    }): Promise<{
      success: boolean
      message: string
      isFinalStep: boolean
      nextStep: Record<string, any> | null
    }> => {
      const res = await this.post<any>('/api/v1/app/tasks/workflow-action', data)
      if (res && typeof res === 'object') {
        if (res.success === false) return res
        const inner = 'data' in res && res.data && typeof res.data === 'object' ? res.data : res
        if (
          res.success === true ||
          inner?.isFinalStep !== undefined ||
          (inner && 'nextStep' in inner) ||
          typeof inner?.message === 'string'
        ) {
          return {
            success: true,
            message: inner?.message || res.message || '',
            isFinalStep: Boolean(inner?.isFinalStep),
            nextStep: inner?.nextStep ?? null,
          }
        }
      }
      return res
    },

    executeRepairAction: async (data: {
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
    }): Promise<{
      success: boolean
      message: string
    }> => {
      const res = await this.post<any>('/api/v1/app/tasks/repair-action', data)
      if (res && typeof res === 'object') {
        if (res.success === false) return res
        const inner = 'data' in res && res.data && typeof res.data === 'object' ? res.data : res
        if (res.success === true || typeof inner?.message === 'string') {
          return {
            success: true,
            message: inner?.message || res.message || '',
          }
        }
      }
      return res
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
    },

    // ── Online Media Library ──
    getOnlineMediaCategories: (options?: { includeInactive?: boolean; isAuthenticated?: boolean }) => {
      const q = new URLSearchParams()
      if (options?.includeInactive) q.set('includeInactive', 'true')
      if (options?.isAuthenticated) q.set('isAuthenticated', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/online-media/categories${qs}`)
    },

    saveOnlineMediaCategory: (data: {
      id?: number
      name: string
      slug?: string
      visibility: string
      displayOrder: number
      isActive: boolean
    }) => {
      return this.post<Record<string, unknown>>('/api/v1/app/online-media/categories', data)
    },

    deleteOnlineMediaCategory: (id: number) => {
      return this.delete<{ name: string }>(`/api/v1/app/online-media/categories/${id}`)
    },

    getOnlineMediaItems: (filters?: {
      visibility?: string
      categoryId?: number
      mediaType?: string
      search?: string
      includeUnpublished?: boolean
      isAuthenticated?: boolean
    }) => {
      const q = new URLSearchParams()
      if (filters?.visibility) q.set('visibility', filters.visibility)
      if (filters?.categoryId) q.set('categoryId', String(filters.categoryId))
      if (filters?.mediaType) q.set('mediaType', filters.mediaType)
      if (filters?.search) q.set('search', filters.search)
      if (filters?.includeUnpublished) q.set('includeUnpublished', 'true')
      if (filters?.isAuthenticated) q.set('isAuthenticated', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/online-media/items${qs}`)
    },

    getOnlineMediaItemBySlugOrId: (
      slugOrId: string | number,
      options?: { isAuthenticated?: boolean; includeUnpublished?: boolean }
    ) => {
      const q = new URLSearchParams()
      if (options?.isAuthenticated) q.set('isAuthenticated', 'true')
      if (options?.includeUnpublished) q.set('includeUnpublished', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return this.get<{ item: Record<string, unknown> | null; requiresAuth: boolean }>(
        `/api/v1/app/online-media/items/${encodeURIComponent(String(slugOrId))}${qs}`
      )
    },

    getOnlineMediaItemForManage: (id: number) => {
      return this.get<Record<string, unknown>>(`/api/v1/app/online-media/items/${id}/manage`)
    },

    getOnlineMediaStreamTarget: (id: number, attachmentId?: number | null) => {
      const qs = attachmentId ? `?attachmentId=${attachmentId}` : ''
      return this.get<{
        item: Record<string, unknown>
        attachment: Record<string, unknown> | null
      }>(`/api/v1/app/online-media/items/${id}/stream-target${qs}`)
    },

    createOnlineMediaItem: (payload: Record<string, unknown>) => {
      return this.post<Record<string, unknown>>('/api/v1/app/online-media/items', payload)
    },

    updateOnlineMediaItem: (id: number, payload: Record<string, unknown>) => {
      return this.put<Record<string, unknown>>(`/api/v1/app/online-media/items/${id}`, payload)
    },

    deleteOnlineMediaItem: (id: number) => {
      return this.delete<{ success: boolean }>(`/api/v1/app/online-media/items/${id}`)
    },

    recordOnlineMediaView: (
      id: number,
      viewer?: { memberId: number; memberName: string; memberDepartment?: string | null } | null
    ) => {
      return this.post<{ success: boolean }>(`/api/v1/app/online-media/items/${id}/view`, { viewer })
    },

    getOnlineMediaViewers: (id: number) => {
      return this.get<Array<Record<string, unknown>>>(`/api/v1/app/online-media/items/${id}/viewers`)
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
