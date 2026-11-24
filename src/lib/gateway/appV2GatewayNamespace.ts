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

    // ── Phase 3A: Member Auth ──
    getAuthMemberByUsername: (params: { username: string; email?: string; includeOtp?: boolean }) => {
      const q = new URLSearchParams({ username: params.username })
      if (params.email) q.set('email', params.email)
      if (params.includeOtp) q.set('includeOtp', 'true')
      return client.get<{
        id: number
        username: string
        name?: string
        email: string
        role?: string
        otp_code?: string | null
        is_valid?: number | boolean
      } | null>(`/api/v1/app/auth/member-by-username?${q.toString()}`)
    },

    getAuthMemberByHashCid: (hashCid: string) =>
      client.get<{
        id: number
        username: string
        email: string
        role?: string
        name?: string
      } | null>(`/api/v1/app/auth/member-by-hash-cid/${encodeURIComponent(hashCid)}`),

    setMemberOtp: (memberId: number, otp: string) =>
      client.post<{ updated: boolean }>('/api/v1/app/auth/set-otp', { memberId, otp }),

    clearMemberOtp: (memberId: number) =>
      client.post<{ cleared: boolean }>('/api/v1/app/auth/clear-otp', { memberId }),

    checkMemberSessionActive: (username: string, email: string) => {
      const q = new URLSearchParams({ username, email })
      return client.get<{ active: boolean; role: string | null }>(
        `/api/v1/app/auth/check-active?${q.toString()}`
      )
    },

    // ── Phase 3A: Member Signatures ──
    isSignatureFeatureEnabled: () =>
      client.get<{ enabled: boolean }>('/api/v1/app/signatures/feature-flag'),

    getMemberSignaturePath: (username: string) =>
      client.get<{ signaturePath: string | null; updatedAt: string | null }>(
        `/api/v1/app/signatures/status?username=${encodeURIComponent(username)}`
      ),

    updateMemberSignaturePath: (username: string, signaturePath: string) =>
      client.put<{ path: string }>('/api/v1/app/signatures/path', { username, signaturePath }),

    resolveMemberSignatureAccess: (params: {
      sessionUsername: string
      sessionEmail: string
      targetUserId: string
    }) => {
      const q = new URLSearchParams(params)
      return client.get<{
        sessionUser: { id: number; username: string; role: string } | null
        targetUser: { id: number; username: string; role: string } | null
      }>(`/api/v1/app/signatures/resolve-access?${q.toString()}`)
    },

    // ── Phase 3A: Task Permissions ──
    getTaskCentricPermissionsRaw: () =>
      client.get<{
        members: Array<{
          id: number
          username: string
          name: string | null
          department: string | null
          position: string | null
          role: string | null
        }>
        permissionRows: Array<{ memberId: number; permissionKey: string }>
        positionPerms: Array<{ id: number; permissionKey: string; positionName: string }>
      }>('/api/v1/app/permissions/task-centric'),

    listMembersWithPermissionsRaw: (params: { query?: string; department?: string }) => {
      const q = new URLSearchParams()
      if (params.query) q.set('query', params.query)
      if (params.department) q.set('department', params.department)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return client.get<{
        members: Array<{
          id: number
          username: string
          name: string | null
          department: string | null
          position: string | null
          role: string | null
        }>
        permissionRows: Array<{ memberId: number; permissionKey: string }>
      }>(`/api/v1/app/permissions/members-list${qs}`)
    },

    grantMemberPermissionV2: (body: {
      memberId: number
      permissionKey: string
      actorUsername: string
    }) =>
      client.post<{ member: { id: number; name?: string | null; username: string } }>(
        '/api/v1/app/permissions/grant-member',
        body
      ),

    revokeMemberPermissionV2: (body: { memberId: number; permissionKey: string }) =>
      client.post<{ member: { id: number; name?: string | null; username: string } | null }>(
        '/api/v1/app/permissions/revoke-member',
        body
      ),

    grantPositionPermissionV2: (body: { positionName: string; permissionKey: string }) =>
      client.post<{ granted: boolean }>('/api/v1/app/permissions/grant-position', body),

    revokePositionPermissionV2: (body: { positionName: string; permissionKey: string }) =>
      client.post<{ revoked: boolean }>('/api/v1/app/permissions/revoke-position', body),

    replaceMemberPermissionsV2: (
      memberId: number,
      body: { permissions: string[]; performedBy: string }
    ) => client.put<{ updated: boolean; count: number }>(`/api/v1/app/permissions/member/${memberId}`, body),

    batchReplaceMemberPermissionsV2: (body: {
      updates: Array<{ memberId: number; permissions: string[] }>
      performedBy: string
    }) => client.put<{ updatedCount: number }>('/api/v1/app/permissions/batch', body),

    listPositionPermissionsV2: () =>
      client.get<{
        mappings: Array<{ id: number; permission_key: string; position_name: string }>
        availablePositions: string[]
      }>('/api/v1/app/permissions/positions'),

    // ── Phase 3A: Audit Logs Admin ──
    listAuditLogsAdmin: (params: {
      page?: number
      limit?: number
      search?: string
      maskedSearch?: string
      actionType?: string
      startDate?: string
      endDate?: string
    }) => {
      const q = new URLSearchParams()
      if (params.page) q.set('page', String(params.page))
      if (params.limit) q.set('limit', String(params.limit))
      if (params.search) q.set('search', params.search)
      if (params.maskedSearch) q.set('maskedSearch', params.maskedSearch)
      if (params.actionType) q.set('actionType', params.actionType)
      if (params.startDate) q.set('startDate', params.startDate)
      if (params.endDate) q.set('endDate', params.endDate)
      return client.get<{ total: number; logs: Array<Record<string, any>> }>(
        `/api/v1/app/audit-logs?${q.toString()}`
      )
    },

    exportAuditLogsAdminRaw: (params: {
      search?: string
      maskedSearch?: string
      actionType?: string
      startDate?: string
      endDate?: string
    }) => {
      const q = new URLSearchParams()
      if (params.search) q.set('search', params.search)
      if (params.maskedSearch) q.set('maskedSearch', params.maskedSearch)
      if (params.actionType) q.set('actionType', params.actionType)
      if (params.startDate) q.set('startDate', params.startDate)
      if (params.endDate) q.set('endDate', params.endDate)
      return client.get<Array<Record<string, any>>>(`/api/v1/app/audit-logs/export?${q.toString()}`)
    },

    getAuditLogStatsRaw: () =>
      client.get<{
        summary: { total_logs?: number; oldest_log?: string | null; newest_log?: string | null }
        today: { logins_today?: number; reads_today?: number; changes_today?: number }
        storage: { size_mb?: string | number | null }
      }>('/api/v1/app/audit-logs/stats'),

    getExpiredAuditLogsCount: (retentionDays: number) =>
      client.get<{ expiredCount: number }>(
        `/api/v1/app/audit-logs/expired-count?retentionDays=${retentionDays}`
      ),

    purgeExpiredAuditLogs: (body: {
      retentionDays: number
      mode: 'admin' | 'cron'
      adminActor?: { username: string; email: string }
    }) =>
      client.post<{ expiredCount: number; purgedCount: number }>(
        '/api/v1/app/audit-logs/purge',
        body,
        { timeoutMs: 60000 }
      ),

    // ── Phase 3B: Staff Registrations V2 ──
    findExistingMemberForRegistration: (params: { citizenId?: string; email?: string }) => {
      const q = new URLSearchParams()
      if (params.citizenId) q.set('citizenId', params.citizenId)
      if (params.email) q.set('email', params.email)
      return client.get<{ id: number; username: string; email: string } | null>(
        `/api/v1/app/v2/registrations/existing-member?${q.toString()}`
      )
    },

    findPendingRegistrationV2: (params: {
      citizenId?: string
      email?: string
      excludeId?: number
    }) => {
      const q = new URLSearchParams()
      if (params.citizenId) q.set('citizenId', params.citizenId)
      if (params.email) q.set('email', params.email)
      if (params.excludeId) q.set('excludeId', String(params.excludeId))
      return client.get<{ id: number; citizenId: string; email: string } | null>(
        `/api/v1/app/v2/registrations/pending?${q.toString()}`
      )
    },

    createRegistrationV2: (data: Record<string, unknown>) =>
      client.post<{ id: number }>('/api/v1/app/v2/registrations', data),

    listRegistrationsV2: (params: {
      status?: string
      search?: string
      page?: number
      limit?: number
    }) => {
      const q = new URLSearchParams()
      if (params.status) q.set('status', params.status)
      if (params.search) q.set('search', params.search)
      if (params.page) q.set('page', String(params.page))
      if (params.limit) q.set('limit', String(params.limit))
      return client.get<{ items: Array<Record<string, any>>; total: number }>(
        `/api/v1/app/v2/registrations?${q.toString()}`
      )
    },

    getRegistrationByIdV2: (id: number) =>
      client.get<Record<string, any> | null>(`/api/v1/app/v2/registrations/${id}`),

    updateRegistrationV2: (id: number, data: Record<string, unknown>) =>
      client.patch<{ id: number }>(`/api/v1/app/v2/registrations/${id}`, data),

    deleteRegistrationV2: (id: number) =>
      client.delete<{ deleted: boolean }>(`/api/v1/app/v2/registrations/${id}`),

    createMemberFromRegistrationV2: (data: {
      username: string
      email: string
      name: string
      department: string
      position: string
      role: string
    }) => client.post<{ id: number }>('/api/v1/app/v2/registrations/create-member', data),

    // ── Phase 3B: Telegram Bot Core V2 ──
    createTelegramChallengeV2: (memberId: number, token: string) =>
      client.post<{ created: boolean }>('/api/v1/app/v2/telegram/challenges', { memberId, token }),

    getMemberTelegramLinkV2: (memberId: number) =>
      client.get<{
        telegram_chat_id: string | number
        telegram_username: string | null
        first_name: string | null
        linked_at: string | null
      } | null>(`/api/v1/app/v2/telegram/link/${memberId}`),

    unlinkMemberTelegramV2: (memberId: number) =>
      client.delete<{ unlinked: boolean }>(`/api/v1/app/v2/telegram/link/${memberId}`),

    unlinkTelegramByChatIdV2: (chatId: number | string) =>
      client.delete<{ success: boolean; memberName?: string }>(
        `/api/v1/app/v2/telegram/link-by-chat/${encodeURIComponent(String(chatId))}`
      ),

    verifyAndLinkTelegramV2: (body: {
      token: string
      chatId: number
      userId: number
      username?: string
      firstName?: string
    }) =>
      client.post<{ success: boolean; memberName?: string; error?: string }>(
        '/api/v1/app/v2/telegram/verify-link',
        body
      ),

    getMemberByTelegramV2: (userId: number, chatId?: number | string) => {
      const q = new URLSearchParams({ userId: String(userId) })
      if (chatId !== undefined) q.set('chatId', String(chatId))
      return client.get<{
        id: number
        name: string
        username: string
        position?: string | null
        role?: string | null
      } | null>(`/api/v1/app/v2/telegram/member-by-telegram?${q.toString()}`)
    },

    getTelegramRepairContextV2: (taskId: string) =>
      client.get<{
        task: Record<string, any> | null
        repair: Record<string, any> | null
      }>(`/api/v1/app/v2/telegram/repair-context/${encodeURIComponent(taskId)}`),

    executeTelegramRepairActionV2: (body: {
      action: 'accept' | 'complete' | 'cancel'
      taskId: string
      memberId: number
      memberName: string
      username?: string
      solutionStep?: string
    }) =>
      client.post<{
        success: boolean
        error?: string
        task?: Record<string, any>
        repair?: Record<string, any> | null
        requesterChatId?: string | number | null
      }>('/api/v1/app/v2/telegram/repair-action', body),
  }
}
