import type { AppHttpClient } from './appGatewayNamespace'

export function createAppV2GatewayNamespace(client: AppHttpClient) {
  return {
    // ── Member Profile, System Settings & Admin Member CRUD ──
    updateMemberProfilePath: (username: string, profilePath: string) =>
      client.put<{ path: string }>('/api/v1/app/members/profile-path', { username, profilePath }),

    getMemberProfilePath: (params: { username?: string; userId?: string | null }) => {
      const q = new URLSearchParams()
      if (params.username) q.set('username', params.username)
      if (params.userId) q.set('userId', params.userId)
      return client.get<{ targetUsername: string; profilePath: string | null }>(
        `/api/v1/app/members/profile-path?${q.toString()}`
      )
    },

    getMemberByUsernameWithPermissions: (username: string) =>
      client.get<{
        member: Record<string, any> | null
        permissions: string[]
      }>(`/api/v1/app/members/by-username/${encodeURIComponent(username)}`),

    getMemberById: (id: number | string) =>
      client.get<Record<string, any> | null>(`/api/v1/app/members/by-id/${encodeURIComponent(String(id))}`),

    updateSystemSettings: (settings: Record<string, unknown>) =>
      client.put<{ updatedKeys: string[] }>('/api/v1/app/system-settings', { settings }),

    syncSalaryCredentialsToMembers: (salaryUsers: Array<{ user_name?: string; user_pass?: string }>) =>
      client.post<{
        matchedCount: number
        notMatchedCount: number
        totalSalaryUsers: number
      }>('/api/v1/app/members/sync-salary-credentials', { salaryUsers }),

    listAdminMembers: () =>
      client.get<Array<Record<string, unknown>>>('/api/v1/app/admin/members'),

    createAdminMember: (payload: Record<string, unknown>) =>
      client.post<{ insertId: number }>('/api/v1/app/admin/members', payload),

    updateAdminMember: (id: number | string, payload: Record<string, unknown>) =>
      client.put<{ finalRole: string }>(`/api/v1/app/admin/members/${encodeURIComponent(String(id))}`, payload),

    deleteAdminMember: (id: number | string, actorUsername?: string) => {
      const qs = actorUsername ? `?actorUsername=${encodeURIComponent(actorUsername)}` : ''
      return client.delete<{ targetUsername: string | null }>(
        `/api/v1/app/admin/members/${encodeURIComponent(String(id))}${qs}`
      )
    },

    // ── Screening Queue CRUD ──
    getScreeningQueues: (params: {
      startSql?: string
      endSql?: string
      status?: string
      search?: string
      includePhoto?: boolean
      includeRawPayload?: boolean
      limit?: number
    }) => {
      const q = new URLSearchParams()
      if (params.startSql) q.set('startSql', params.startSql)
      if (params.endSql) q.set('endSql', params.endSql)
      if (params.status) q.set('status', params.status)
      if (params.search) q.set('search', params.search)
      if (params.includePhoto) q.set('includePhoto', 'true')
      if (params.includeRawPayload) q.set('includeRawPayload', 'true')
      if (params.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, any>>>(`/api/v1/app/screening-queues${qs}`)
    },

    getScreeningQueueById: (id: number) =>
      client.get<Record<string, any> | null>(`/api/v1/app/screening-queues/${id}`),

    upsertScreeningQueue: (payload: Record<string, unknown>) =>
      client.post<Record<string, any> | null>('/api/v1/app/screening-queues/upsert', payload),

    updateScreeningQueueStatus: (id: number, status: string, vn?: string | null) =>
      client.patch<Record<string, any> | null>(`/api/v1/app/screening-queues/${id}/status`, { status, vn }),

    batchUpdateScreeningQueueStatus: (updates: Array<{ id: number; status: string; vn: string | null }>) =>
      client.post<{ updatedCount: number }>('/api/v1/app/screening-queues/batch-status', { updates }),

    cleanupScreeningQueues: (retentionDays: number) =>
      client.delete<{ count: number }>(`/api/v1/app/screening-queues/cleanup?retentionDays=${retentionDays}`),

    // ── KPI Topics, Indicators & Entries CRUD ──
    getKpiFiscalYears: () =>
      client.get<string[]>('/api/v1/app/kpi/fiscal-years'),

    getKpiTopics: (fiscalYear?: string) => {
      const qs = fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : ''
      return client.get<Array<Record<string, any>>>(`/api/v1/app/kpi/topics${qs}`)
    },

    getKpiCategories: (topicId: number) =>
      client.get<string[]>(`/api/v1/app/kpi/topics/${topicId}/categories`),

    getKpiResponsiblePersons: (topicId: number) =>
      client.get<string[]>(`/api/v1/app/kpi/topics/${topicId}/responsible-persons`),

    getKpiIndicators: (filters: {
      topicId: number
      fiscalYear?: string
      category?: string
      frequency?: string
      responsibleName?: string
      search?: string
    }) => {
      const q = new URLSearchParams()
      q.set('topicId', String(filters.topicId))
      if (filters.fiscalYear) q.set('fiscalYear', filters.fiscalYear)
      if (filters.category) q.set('category', filters.category)
      if (filters.frequency) q.set('frequency', filters.frequency)
      if (filters.responsibleName) q.set('responsibleName', filters.responsibleName)
      if (filters.search) q.set('search', filters.search)
      return client.get<Array<Record<string, any>>>(`/api/v1/app/kpi/indicators?${q.toString()}`)
    },

    getKpiIndicatorById: (id: number) =>
      client.get<{
        indicator: Record<string, any>
        entries: Array<Record<string, any>>
      } | null>(`/api/v1/app/kpi/indicators/${id}`),

    saveKpiEntry: (payload: Record<string, unknown>) =>
      client.post<{ entryId: number; authorName: string | null }>('/api/v1/app/kpi/entries/save', payload),

    updateKpiTarget: (
      id: number,
      payload: {
        targetOperator: string | null
        targetValue: number | null
        targetUnit: string | null
        targetRaw: string | null
        entryStatusUpdates: Array<{ id: number; status: string }>
      }
    ) => client.put<{ updated: boolean }>(`/api/v1/app/kpi/indicators/${id}/target`, payload),

    createKpiIndicator: (payload: Record<string, unknown>) =>
      client.post<{ insertId: number }>('/api/v1/app/kpi/indicators', payload),

    updateKpiIndicator: (id: number, payload: Record<string, unknown>) =>
      client.put<{ updated: boolean }>(`/api/v1/app/kpi/indicators/${id}`, payload),

    deleteKpiIndicator: (id: number) =>
      client.delete<{ deleted: boolean }>(`/api/v1/app/kpi/indicators/${id}`),

    upsertKpiTopicForImport: (payload: {
      fiscalYear: string
      code: string
      title: string
      description?: string | null
    }) => client.post<{ topicId: number }>('/api/v1/app/kpi/topics/upsert-for-import', payload),

    // ── Task Inbox V2 Auxiliary & Transactional Actions ──
    getMemberWorkSummary: (params: { memberId: number; role?: string; position?: string }) => {
      const q = new URLSearchParams()
      q.set('memberId', String(params.memberId))
      if (params.role) q.set('role', params.role)
      if (params.position) q.set('position', params.position)
      return client.get<{
        pendingInboxCount: number
        pendingRegistrationsCount: number
      }>(`/api/v1/app/tasks/work-summary?${q.toString()}`)
    },

    getMediaRequestTasks: (params: {
      requesterId?: number
      status?: string | null
      search?: string
      limit?: number
    }) => {
      const q = new URLSearchParams()
      if (params.requesterId) q.set('requesterId', String(params.requesterId))
      if (params.status) q.set('status', params.status)
      if (params.search) q.set('search', params.search)
      if (params.limit) q.set('limit', String(params.limit))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<Array<Record<string, any>>>(`/api/v1/app/tasks/media-requests${qs}`)
    },

    getRepairFormPreloadData: (username: string) =>
      client.get<{
        currentMember: Record<string, any>
        initialLocations: Array<Record<string, any>>
      }>(`/api/v1/app/tasks/preload-repair-form?username=${encodeURIComponent(username)}`),

    executeWorkflowActionV2: (data: {
      taskId: string
      action: string
      comment?: string
      nextAssigneeId?: number | null
      partialEdits?: Record<string, any>
      holdReason?: string
      holdDetails?: string
      targetStepNo?: number | null
      sendToRequester?: boolean
      signaturePath?: string | null
      signatureHash?: string | null
      actor: {
        id: number
        username: string
        name?: string | null
        position?: string | null
        role?: string | null
      }
    }) =>
      client.post<{
        message: string
        isFinalStep: boolean
        nextStep: Record<string, any> | null
        targetStep: Record<string, any> | null
      }>('/api/v1/app/tasks/workflow-action-v2', data),

    executeRepairActionV2: (data: {
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
    }) =>
      client.post<{ message: string }>('/api/v1/app/tasks/repair-action-v2', data),
  }
}
