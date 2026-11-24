import type { RequestOptions } from './gatewayTypes'

export interface AppHttpClient {
  get: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
}

export function createAppNamespace(client: AppHttpClient) {
  return {
    /**
     * Executes a read-only SELECT query against the Website MySQL database.
     */
    query: async <T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
      options?: RequestOptions
    ): Promise<T[]> => {
      const res = await client.post<{ data: T[]; count: number }>('/api/v1/app/query', { sql, params }, options)
      return Array.isArray(res) ? res : res.data || []
    },

    /**
     * Executes an INSERT, UPDATE, or DELETE parameterized query against the Website database.
     */
    execute: (sql: string, params: unknown[] = []) => {
      return client.post<{ affectedRows: number; insertId: number | null }>('/api/v1/app/execute', { sql, params })
    },

    /**
     * Executes an array of statements atomically inside a single interactive transaction.
     */
    transaction: (statements: Array<{ sql: string; params?: unknown[] }>, options?: RequestOptions) => {
      return client.post<{ count: number; results: Array<{ affectedRows: number; insertId: number | null }> }>(
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
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/members${qs}`)
    },

    getMemberById: (id: string | number) => {
      return client.get<Record<string, unknown>>(`/api/v1/app/members/${id}`)
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
      return client.post<{ insertId: number }>('/api/v1/app/members', member)
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
      return client.put<{ message: string }>(`/api/v1/app/members/${id}`, member)
    },

    deleteMember: (id: string | number) => {
      return client.delete<{ message: string }>(`/api/v1/app/members/${id}`)
    },

    getMemberPermissions: (id: string | number) => {
      return client.get<{ memberId: string; permissions: Array<{ permission_key: string; created_at: string; created_by: string }> }>(
        `/api/v1/app/members/${id}/permissions`
      )
    },

    grantMemberPermission: (id: string | number, permissionKey: string, createdBy?: string) => {
      return client.post<{ message: string }>(`/api/v1/app/members/${id}/permissions`, { permissionKey, createdBy })
    },

    revokeMemberPermission: (id: string | number, permissionKey: string) => {
      return client.delete<{ message: string }>(`/api/v1/app/members/${id}/permissions/${encodeURIComponent(permissionKey)}`)
    },

    getMemberAuthContext: (username: string, email: string) => {
      return client.post<{
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
      return client.post<{ allowed: boolean }>('/api/v1/app/members/check-position-permission', {
        username,
        permissionKeys
      })
    },

    checkMemberPermission: (username: string, keys: string[]) => {
      return client.post<{ allowed: boolean }>('/api/v1/app/members/check-member-permission', {
        username,
        keys,
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
      return client.post<{ logId: number }>('/api/v1/audit/log', entry)
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
      return client.get<{
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
      return client.get<{
        success: boolean
        data: Record<string, any>
      }>(`/api/v1/app/news/${encoded}?slug=${encoded}`)
    },

    incrementNewsView: (id: string | number) => {
      const strId = String(id)
      const encoded = encodeURIComponent(strId)
      return client.post<{ success: boolean; message?: string }>(`/api/v1/app/news/${encoded}/view?slug=${encoded}`, {})
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
      return client.post<{
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
      return client.put<{ success: boolean; message: string; data?: Record<string, any> }>(`/api/v1/app/news/${id}`, news)
    },

    getPublishedNews: (limit = 20) => {
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/news/published?limit=${limit}`)
    },

    getSitemapNews: () => {
      return client.get<Array<{ id: number; slug: string; updatedAt: string }>>('/api/v1/app/news/sitemap')
    },

    deleteNews: (id: string | number) => {
      return client.delete<{ success: boolean; message: string }>(`/api/v1/app/news/${id}`)
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
      return client.get<{
        success: boolean
        albums: Array<Record<string, any>>
        availableMonths?: Array<{ year: number; month: number; count: number }>
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/v1/app/albums${q ? `?${q}` : ''}`)
    },

    getAlbumById: (idOrSlug: string | number) => {
      return client.get<{ success: boolean; data: Record<string, any> }>(
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
      return client.post<{
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
      return client.put<{
        success: boolean
        message: string
        previousImageUrls?: string[]
        data?: Record<string, any>
      }>(`/api/v1/app/albums/${id}`, album)
    },

    deleteAlbum: (id: string | number) => {
      return client.delete<{
        success: boolean
        message: string
        deletedImageUrls?: string[]
      }>(`/api/v1/app/albums/${id}`)
    },

    incrementAlbumView: (idOrSlug: string | number) => {
      return client.post<{ success: boolean }>(
        `/api/v1/app/albums/${encodeURIComponent(String(idOrSlug))}/view`,
        {}
      )
    },

    // ── Hero Slides ──
    getSlides: async (all = false) => {
      const qs = all ? '?all=true' : ''
      const res = await client.get<any>(`/api/v1/app/slides${qs}`)
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
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/slides/active')
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
      return client.post<{
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
      return client.put<{
        success: boolean
        slide: Record<string, any>
        previousImagePath?: string
      }>(`/api/v1/app/slides/${id}`, slide)
    },

    deleteSlide: (id: string | number) => {
      return client.delete<{
        success: boolean
        message: string
        slide: Record<string, any>
      }>(`/api/v1/app/slides/${id}`)
    },

    updateSlideDuration: (slideDuration: number) => {
      return client.patch<{
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

      return client.get<any>(`/api/v1/app/locations${qs}`)
    },

    createLocation: (location: {
      room_name: string
      floor_id?: number
      floor_name: string
      building_id?: number
      building_name: string
      is_active?: boolean | number
    }) => {
      return client.post<{
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
      return client.put<{
        success: boolean
        message: string
        data?: Record<string, any>
      }>(`/api/v1/app/locations/${id}`, location)
    },

    deleteLocation: (id: string | number) => {
      return client.delete<{
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
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/assets${qs}`)
    },

    getEvents: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/events')
    },

    getTasks: (params?: { type?: string; status?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (params?.type) q.set('type', params.type)
      if (params?.status) q.set('status', params.status)
      if (params?.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/tasks${qs}`)
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
      const res = await client.get<any>(`/api/v1/app/tasks/inbox${qs}`)
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
      const res = await client.post<any>('/api/v1/app/tasks/create', data)
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
      const res = await client.post<any>('/api/v1/app/tasks/generate-no', {
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
      const res = await client.get<any>(`/api/v1/app/tasks/${encodeURIComponent(String(id))}/full-details`)
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
      const res = await client.post<any>('/api/v1/app/tasks/workflow-action', data)
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
      const res = await client.post<any>('/api/v1/app/tasks/repair-action', data)
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
      return client.put<{ success: boolean; message: string }>(
        `/api/v1/app/tasks/${encodeURIComponent(String(id))}/manager-edit`,
        data
      )
    },

    // ── Member Registrations ──
    getRegistrations: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/registrations')
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
      return client.get<{
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
      return client.get<Record<string, unknown>>(`/api/v1/app/palliative-care/registries/${id}`)
    },

    getPalliativeRegistryByHn: (hn: string) => {
      return client.get<{ exists: boolean; data: { id: number; hn: string; patientName: string } | null }>(
        `/api/v1/app/palliative-care/registries/by-hn/${encodeURIComponent(hn.trim())}`
      )
    },

    importKpiBatch: (topicId: number, rows: Array<Record<string, unknown>>) => {
      return client.post<{ insertedCount: number }>('/api/v1/app/kpi/import-batch', { topicId, rows })
    },

    createPalliativeRegistry: (record: Record<string, unknown>) => {
      return client.post<{ insertId: number }>('/api/v1/app/palliative-care/registries', record)
    },

    updatePalliativeRegistry: (id: string | number, updates: Record<string, unknown>) => {
      return client.put<{ affectedRows: number }>(`/api/v1/app/palliative-care/registries/${id}`, updates)
    },

    deletePalliativeRegistry: (id: string | number) => {
      return client.delete<{ message: string }>(`/api/v1/app/palliative-care/registries/${id}`)
    },

    lookupPalliativePatientByHn: (hn: string) => {
      return client.get<Record<string, any> | null>(
        `/api/v1/app/palliative-care/lookup/${encodeURIComponent(hn.trim())}`
      )
    },

    syncPalliativeWithHosxp: (payload?: { actor?: string }) => {
      return client.post<Record<string, any>>('/api/v1/app/palliative-care/sync-hosxp', payload || {}, {
        timeoutMs: 90000,
      })
    },

    getPalliativeRawBundle: () => {
      return client.get<{
        registries: Array<Record<string, any>>
        visits: Array<Record<string, any>>
      }>('/api/v1/app/palliative-care/raw-bundle')
    },

    // ── LTC (Long-Term Care) Registry ──
    getLtcHns: () => {
      return client.get<{ success: boolean; count: number; data: string[] } | string[]>('/api/v1/app/ltc/hns')
    },

    lookupLtcPatientByHn: (hn: string) => {
      return client.get<Record<string, any> | null>(
        `/api/v1/app/ltc/lookup/${encodeURIComponent(hn.trim())}`
      )
    },

    syncLtcWithHosxp: (payload?: { recordId?: number; actor?: string }) => {
      return client.post<{
        totalChecked: number
        updatedCount: number
        mismatches: Array<{ hn: string; currentName: string; hosName: string; cid: string }>
      }>('/api/v1/app/ltc/sync-hosxp', payload || {}, { timeoutMs: 90000 })
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
      return client.get<{
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
      return client.get<{ success: boolean; data: any }>(`/api/v1/app/ltc/registries/${id}`)
    },

    getLtcRegistryByHn: (hn: string) => {
      return client.get<{ success: boolean; exists: boolean; data: any | null }>(
        `/api/v1/app/ltc/registries/by-hn/${encodeURIComponent(hn.trim())}`
      )
    },

    createLtcRegistry: (record: Record<string, unknown>) => {
      return client.post<{ success: boolean; insertId: number }>('/api/v1/app/ltc/registries', record)
    },

    updateLtcRegistry: (id: string | number, updates: Record<string, unknown>) => {
      return client.put<{ success: boolean; affectedRows: number }>(`/api/v1/app/ltc/registries/${id}`, updates)
    },

    deleteLtcRegistry: (id: string | number) => {
      return client.delete<{ success: boolean; message: string }>(`/api/v1/app/ltc/registries/${id}`)
    },

    // ── ITA Blogs ──
    getItaBlogs: async (options?: { authorId?: string | number; admin?: boolean | string; search?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (options?.authorId !== undefined) q.set('authorId', String(options.authorId))
      if (options?.admin !== undefined) q.set('admin', String(options.admin))
      if (options?.search) q.set('search', options.search)
      if (options?.limit !== undefined) q.set('limit', String(options.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await client.get<{ success?: boolean; data?: any[] } | any[]>(`/api/v1/app/ita/blogs${qs}`)
      if (Array.isArray(res)) return res
      return (res as any)?.data || []
    },

    getItaBlogById: async (idOrSlug: string | number) => {
      const target = String(idOrSlug).trim()
      const isNumeric = /^\d+$/.test(target)
      const path = isNumeric
        ? `/api/v1/app/ita/blogs/${encodeURIComponent(target)}`
        : `/api/v1/app/ita/blogs/by-slug?slug=${encodeURIComponent(target)}`
      const res = await client.get<{ success?: boolean; data?: any } | any>(path)
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
      return client.post<{ success: boolean; id: number }>('/api/v1/app/ita/blogs', data)
    },

    updateItaBlog: (
      id: string | number,
      data: {
        title?: string
        slug?: string
        content?: string
      }
    ) => {
      return client.put<{ success: boolean; affectedRows: number }>(`/api/v1/app/ita/blogs/${id}`, data)
    },

    deleteItaBlog: (id: string | number) => {
      return client.delete<{ success: boolean; message: string; authorId?: number }>(`/api/v1/app/ita/blogs/${id}`)
    },

    // ── RDU (Rational Drug Use) ──
    getRduTree: async (options?: { includeInactive?: boolean }) => {
      const q = new URLSearchParams()
      if (options?.includeInactive) q.set('includeInactive', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await client.get<{ success?: boolean; folders?: any[] }>(`/api/v1/app/rdu/tree${qs}`)
      return res?.folders || []
    },

    createRduFolder: (data: { folder_name: string }) => {
      return client.post<{ success: boolean; folderId: number; folderName: string; displayOrder: number }>(
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
      return client.put<{ success: boolean; message: string; oldFolderName?: string; newFolderName?: string }>(
        `/api/v1/app/rdu/folders/${id}`,
        data
      )
    },

    deleteRduFolder: (id: string | number) => {
      return client.delete<{ success: boolean; message: string; folderName: string }>(`/api/v1/app/rdu/folders/${id}`)
    },

    getRduFileById: async (id: string | number) => {
      const res = await client.get<any>(`/api/v1/app/rdu/files/${id}`)
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
      return client.post<{ success: boolean; file: any }>('/api/v1/app/rdu/files', data)
    },

    updateRduFile: (
      id: string | number,
      data: {
        action?: string
        display_name?: string
        orders?: Array<{ id: number; display_order: number }>
      }
    ) => {
      return client.put<{ success: boolean; message: string }>(`/api/v1/app/rdu/files/${id}`, data)
    },

    deleteRduFile: (id: string | number) => {
      return client.delete<{ success: boolean; message: string; file: any }>(`/api/v1/app/rdu/files/${id}`)
    },

    // ── Outgoing Documents ──
    getOutgoingDocuments: async (options?: { activeOnly?: boolean; order?: 'service' | 'manager' }) => {
      const q = new URLSearchParams()
      if (options?.activeOnly) q.set('activeOnly', 'true')
      if (options?.order) q.set('order', options.order)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await client.get<{ success?: boolean; documents?: any[] }>(`/api/v1/app/outgoing-documents${qs}`)
      return res?.documents || []
    },

    getOutgoingDocumentById: async (id: string | number) => {
      const res = await client.get<any>(`/api/v1/app/outgoing-documents/${id}`)
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
      return client.post<{ success: boolean; document: any; message: string }>('/api/v1/app/outgoing-documents', data)
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
      return client.put<{ success: boolean; document: any; message: string }>(`/api/v1/app/outgoing-documents/${id}`, data)
    },

    deleteOutgoingDocument: (id: string | number) => {
      return client.delete<{ success: boolean; message: string; document: any }>(`/api/v1/app/outgoing-documents/${id}`)
    },

    // ── Online Media Library ──
    getOnlineMediaCategories: (options?: { includeInactive?: boolean; isAuthenticated?: boolean }) => {
      const q = new URLSearchParams()
      if (options?.includeInactive) q.set('includeInactive', 'true')
      if (options?.isAuthenticated) q.set('isAuthenticated', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/online-media/categories${qs}`)
    },

    saveOnlineMediaCategory: (data: {
      id?: number
      name: string
      slug?: string
      visibility: string
      displayOrder: number
      isActive: boolean
    }) => {
      return client.post<Record<string, unknown>>('/api/v1/app/online-media/categories', data)
    },

    deleteOnlineMediaCategory: (id: number) => {
      return client.delete<{ name: string }>(`/api/v1/app/online-media/categories/${id}`)
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
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/online-media/items${qs}`)
    },

    getOnlineMediaItemBySlugOrId: (
      slugOrId: string | number,
      options?: { isAuthenticated?: boolean; includeUnpublished?: boolean }
    ) => {
      const q = new URLSearchParams()
      if (options?.isAuthenticated) q.set('isAuthenticated', 'true')
      if (options?.includeUnpublished) q.set('includeUnpublished', 'true')
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{ item: Record<string, unknown> | null; requiresAuth: boolean }>(
        `/api/v1/app/online-media/items/${encodeURIComponent(String(slugOrId))}${qs}`
      )
    },

    getOnlineMediaItemForManage: (id: number) => {
      return client.get<Record<string, unknown>>(`/api/v1/app/online-media/items/${id}/manage`)
    },

    getOnlineMediaStreamTarget: (id: number, attachmentId?: number | null) => {
      const qs = attachmentId ? `?attachmentId=${attachmentId}` : ''
      return client.get<{
        item: Record<string, unknown>
        attachment: Record<string, unknown> | null
      }>(`/api/v1/app/online-media/items/${id}/stream-target${qs}`)
    },

    createOnlineMediaItem: (payload: Record<string, unknown>) => {
      return client.post<Record<string, unknown>>('/api/v1/app/online-media/items', payload)
    },

    updateOnlineMediaItem: (id: number, payload: Record<string, unknown>) => {
      return client.put<Record<string, unknown>>(`/api/v1/app/online-media/items/${id}`, payload)
    },

    deleteOnlineMediaItem: (id: number) => {
      return client.delete<{ success: boolean }>(`/api/v1/app/online-media/items/${id}`)
    },

    recordOnlineMediaView: (
      id: number,
      viewer?: { memberId: number; memberName: string; memberDepartment?: string | null } | null
    ) => {
      return client.post<{ success: boolean }>(`/api/v1/app/online-media/items/${id}/view`, { viewer })
    },

    getOnlineMediaViewers: (id: number) => {
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/online-media/items/${id}/viewers`)
    }
  }
}
