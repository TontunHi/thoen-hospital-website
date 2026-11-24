import type { AppHttpClient } from './appGatewayNamespace'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v))
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export function createAppV3GatewayNamespace(client: AppHttpClient) {
  return {
    // ── Phase 4A: Inbox Auxiliary V2 ──
    recordInboxTaskAuditLogV2: (payload: {
      id?: string
      taskId: string
      action: string
      performedBy: number | string
      performerName: string
      details: Record<string, unknown> | string
    }) => {
      return client.post<{ id: string }>('/api/v1/app/v2/inbox/audit-log', payload)
    },

    getInboxTaskBundleV2: (taskId: string) => {
      return client.get<{
        task: Record<string, unknown> | null
        repairDetail: Record<string, unknown> | null
        steps: Array<Record<string, unknown>>
      }>(`/api/v1/app/v2/inbox/task-bundle/${encodeURIComponent(taskId)}`)
    },

    submitManagerTaskEditV2: (
      taskId: string,
      payload: {
        taskUpdates?: Record<string, unknown>
        repairUpdates?: Record<string, unknown> | null
        stepSync?: {
          mode: 'HAS_COST' | 'NO_COST'
          targetSteps: Array<{ stepNo: number; stepName: string; assignedRole: string }>
        } | null
        auditEntry?: {
          performedBy: number | string
          performerName: string
          details: Record<string, unknown> | string
        } | null
      }
    ) => {
      return client.post<{ updated: boolean }>(
        `/api/v1/app/v2/inbox/manager-edit/${encodeURIComponent(taskId)}`,
        payload
      )
    },

    getInboxTelegramTargetsV2: (params: {
      memberId?: number
      username?: string
      prRole?: boolean
      rolePattern?: string
    }) => {
      const qs = buildQuery({
        memberId: params.memberId,
        username: params.username,
        prRole: params.prRole ? 'true' : undefined,
        rolePattern: params.rolePattern,
      })
      return client.get<{ chatIds: Array<string | number> }>(`/api/v1/app/v2/inbox/telegram-targets${qs}`)
    },

    // ── Phase 4B: Hospital Assets V2 ──
    listAssetsV2: (params?: {
      search?: string
      category?: string
      warrantyStatus?: string
      department?: string
      status?: string
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: string
    }) => {
      return client.get<{ total: number; items: Array<Record<string, unknown>> }>(
        `/api/v1/app/v2/assets${buildQuery(params)}`
      )
    },

    getAssetStatsV2: () => {
      return client.get<Record<string, unknown>>('/api/v1/app/v2/assets/stats')
    },

    getAssetByArticleNumV2: (articleNum: string) => {
      return client.get<Record<string, unknown> | null>(
        `/api/v1/app/v2/assets/by-article${buildQuery({ articleNum })}`
      )
    },

    getAssetByIdV2: (id: number) => {
      return client.get<Record<string, unknown> | null>(`/api/v1/app/v2/assets/${id}`)
    },

    createAssetV2: (payload: Record<string, unknown>) => {
      return client.post<Record<string, unknown> | null>('/api/v1/app/v2/assets', payload)
    },

    updateAssetV2: (id: number, payload: Record<string, unknown>) => {
      return client.patch<Record<string, unknown> | null>(`/api/v1/app/v2/assets/${id}`, payload)
    },

    deleteAssetV2: (id: number) => {
      return client.delete<{ id: number }>(`/api/v1/app/v2/assets/${id}`)
    },

    // ── Phase 4B: Equipment Borrowing V2 ──
    listBorrowMaterialsV2: (params?: {
      search?: string
      category?: string
      materialType?: string
      isActive?: boolean
      page?: number
      limit?: number
    }) => {
      return client.get<{ total: number; items: Array<Record<string, unknown>> }>(
        `/api/v1/app/v2/equipment-borrow/materials${buildQuery({
          ...params,
          isActive: typeof params?.isActive === 'boolean' ? String(params.isActive) : undefined,
        })}`
      )
    },

    createBorrowMaterialV2: (payload: Record<string, unknown>) => {
      return client.post<Record<string, unknown>>('/api/v1/app/v2/equipment-borrow/materials', payload)
    },

    updateBorrowMaterialV2: (id: number, payload: Record<string, unknown>) => {
      return client.patch<Record<string, unknown>>(`/api/v1/app/v2/equipment-borrow/materials/${id}`, payload)
    },

    deleteBorrowMaterialV2: (id: number) => {
      return client.delete<{ name: string }>(`/api/v1/app/v2/equipment-borrow/materials/${id}`)
    },

    toggleBorrowAssetLoanableV2: (assetId: number, isLoanable: boolean) => {
      return client.patch<{ asset: Record<string, unknown>; articleNum: string }>(
        `/api/v1/app/v2/equipment-borrow/assets/${assetId}/loanable`,
        { isLoanable }
      )
    },

    listLoanableAssetsV2: (params?: {
      search?: string
      category?: string
      isLoanable?: boolean
      page?: number
      limit?: number
    }) => {
      return client.get<{ total: number; items: Array<Record<string, unknown>> }>(
        `/api/v1/app/v2/equipment-borrow/loanable-assets${buildQuery({
          ...params,
          isLoanable: typeof params?.isLoanable === 'boolean' ? String(params.isLoanable) : undefined,
        })}`
      )
    },

    getBorrowCatalogV2: (params?: { search?: string; category?: string; type?: string }) => {
      return client.get<{
        assets: Array<Record<string, unknown>>
        borrowedAssetIds: number[]
        materials: Array<Record<string, unknown>>
      }>(`/api/v1/app/v2/equipment-borrow/catalog${buildQuery(params)}`)
    },

    createBorrowRequestV2: (payload: {
      input: Record<string, unknown>
      requester: { id: number; name: string; department?: string | null }
    }) => {
      return client.post<{
        request: Record<string, unknown>
        items: Array<Record<string, unknown>>
      }>('/api/v1/app/v2/equipment-borrow/requests', payload)
    },

    listBorrowRequestsV2: (params?: {
      requesterId?: number
      status?: string
      search?: string
      overdueOnly?: boolean
      activeOnly?: boolean
      page?: number
      limit?: number
    }) => {
      return client.get<{
        total: number
        bundles: Array<{ request: Record<string, unknown>; items: Array<Record<string, unknown>> }>
      }>(
        `/api/v1/app/v2/equipment-borrow/requests${buildQuery({
          ...params,
          overdueOnly: params?.overdueOnly ? 'true' : undefined,
          activeOnly: params?.activeOnly ? 'true' : undefined,
        })}`
      )
    },

    getBorrowRequestByIdV2: (id: number) => {
      return client.get<{
        request: Record<string, unknown>
        items: Array<Record<string, unknown>>
      } | null>(`/api/v1/app/v2/equipment-borrow/requests/${id}`)
    },

    approveBorrowRequestV2: (id: number, actor: Record<string, unknown>) => {
      return client.post<{
        updated: { request: Record<string, unknown>; items: Array<Record<string, unknown>> }
        nextStatus: string
        requestNo: string
      }>(`/api/v1/app/v2/equipment-borrow/requests/${id}/approve`, { actor })
    },

    rejectBorrowRequestV2: (id: number, reason: string, actor: Record<string, unknown>) => {
      return client.post<{
        request: Record<string, unknown>
        items: Array<Record<string, unknown>>
      }>(`/api/v1/app/v2/equipment-borrow/requests/${id}/reject`, { reason, actor })
    },

    returnBorrowItemsV2: (
      id: number,
      returns: Array<Record<string, unknown>>,
      actor: Record<string, unknown>
    ) => {
      return client.post<{
        updated: { request: Record<string, unknown>; items: Array<Record<string, unknown>> }
        allDone: boolean
      }>(`/api/v1/app/v2/equipment-borrow/requests/${id}/return`, { returns, actor })
    },

    getBorrowStatsV2: () => {
      return client.get<{
        totalItems: number
        availableItems: number
        borrowedItems: number
        overdueRequests: number
      }>('/api/v1/app/v2/equipment-borrow/stats')
    },

    getOverdueBorrowTargetsV2: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/v2/equipment-borrow/overdue-targets')
    },

    // ── Phase 4B: Hospital Events & Leaderboard V2 ──
    syncEventStatusesV2: (dbNow: string) => {
      return client.post<{ updatedToCompleted: number; updatedToOngoing: number }>(
        '/api/v1/app/v2/events/sync-statuses',
        { dbNow }
      )
    },

    listEventsV2: (params?: {
      status?: string
      search?: string
      fiscalYear?: string
      memberId?: number
      onlyUpcoming?: boolean
      onlyCompleted?: boolean
      onlyMyEvents?: boolean
      onlyMyRegistrations?: boolean
      dbNow?: string
      page?: number
      limit?: number
    }) => {
      return client.get<{ total: number; events: Array<Record<string, unknown>> }>(
        `/api/v1/app/v2/events${buildQuery({
          ...params,
          onlyUpcoming: params?.onlyUpcoming ? 'true' : undefined,
          onlyCompleted: params?.onlyCompleted ? 'true' : undefined,
          onlyMyEvents: params?.onlyMyEvents ? 'true' : undefined,
          onlyMyRegistrations: params?.onlyMyRegistrations ? 'true' : undefined,
        })}`
      )
    },

    createEventV2: (body: {
      payload: Record<string, unknown>
      actor: Record<string, unknown>
      borrowItems?: Array<Record<string, unknown>>
      coOrganizerMemberIds?: number[]
    }) => {
      return client.post<{ eventId: number; borrowRequestId: number | null }>('/api/v1/app/v2/events', body)
    },

    getEventsPreloadV2: () => {
      return client.get<{
        materials: Array<Record<string, unknown>>
        assets: Array<Record<string, unknown>>
        members: Array<Record<string, unknown>>
      }>('/api/v1/app/v2/events/preload')
    },

    getEventsMembersPickerV2: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/v2/events/members-picker')
    },

    getEventByQrTokenV2: (token: string) => {
      return client.get<Record<string, unknown> | null>(
        `/api/v1/app/v2/events/by-qr/${encodeURIComponent(token)}`
      )
    },

    getEventMemberStatsV2: (memberId: number) => {
      return client.get<{ totalPoints: number; registeredCount: number }>(
        `/api/v1/app/v2/events/member-stats/${memberId}`
      )
    },

    getEventIndividualLeaderboardRawV2: (params?: { fiscalYear?: string; timeframe?: string }) => {
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/app/v2/events/leaderboard/individual${buildQuery(params)}`
      )
    },

    getEventDepartmentLeaderboardRawV2: (params?: { fiscalYear?: string; timeframe?: string }) => {
      return client.get<{
        members: Array<Record<string, unknown>>
        attRows: Array<Record<string, unknown>>
      }>(`/api/v1/app/v2/events/leaderboard/department${buildQuery(params)}`)
    },

    getEventFiscalYearsV2: () => {
      return client.get<string[]>('/api/v1/app/v2/events/fiscal-years')
    },

    getEventByIdV2: (id: number) => {
      return client.get<{
        event: Record<string, unknown>
        coRows: Array<Record<string, unknown>>
        regRows: Array<Record<string, unknown>>
        attRows: Array<Record<string, unknown>>
        borrowRequest: Record<string, unknown> | null
        attachRows: Array<Record<string, unknown>>
      } | null>(`/api/v1/app/v2/events/${id}`)
    },

    updateEventStatusV2: (id: number, status: string) => {
      return client.patch<{ updated: boolean }>(`/api/v1/app/v2/events/${id}/status`, { status })
    },

    updateEventV2: (
      id: number,
      body: {
        fields: Record<string, unknown>
        coOrganizerMemberIds?: number[]
        actor: Record<string, unknown>
      }
    ) => {
      return client.patch<{ title: string }>(`/api/v1/app/v2/events/${id}`, body)
    },

    deleteEventV2: (id: number, actor: Record<string, unknown>) => {
      return client.delete<{ title: string }>(`/api/v1/app/v2/events/${id}`, { actor })
    },

    registerForEventV2: (eventId: number, memberId: number) => {
      return client.post<{ alreadyRegistered: boolean; registration: Record<string, unknown> }>(
        `/api/v1/app/v2/events/${eventId}/register`,
        { memberId }
      )
    },

    cancelEventRegistrationV2: (eventId: number, memberId: number) => {
      return client.delete<{ cancelled: boolean }>(`/api/v1/app/v2/events/${eventId}/register/${memberId}`)
    },

    checkinEventViaThaidV2: (body: { eventId: number; citizenId: string; checkedInAt: string }) => {
      return client.post<{
        duplicate: boolean
        existingCheckedInAt?: unknown
        member: Record<string, unknown>
      }>('/api/v1/app/v2/events/checkin-thaid', body)
    },

    addEventAttendanceV2: (
      eventId: number,
      body: {
        memberId: number
        pointsAwarded: number
        checkedInAt: string
        actor: Record<string, unknown>
      }
    ) => {
      return client.post<{
        id: number
        eventTitle: string
        member: Record<string, unknown>
      }>(`/api/v1/app/v2/events/${eventId}/attendances`, body)
    },

    updateEventAttendanceV2: (
      eventId: number,
      attendanceId: number,
      body: {
        pointsAwarded?: number
        checkedInAt?: string
        actor: Record<string, unknown>
      }
    ) => {
      return client.patch<{
        row: Record<string, unknown>
        eventTitle: string
        memberName: string
      }>(`/api/v1/app/v2/events/${eventId}/attendances/${attendanceId}`, body)
    },

    deleteEventAttendanceV2: (
      eventId: number,
      attendanceId: number,
      actor: Record<string, unknown>
    ) => {
      return client.delete<{
        eventTitle: string
        memberName: string
        memberId: number
      }>(`/api/v1/app/v2/events/${eventId}/attendances/${attendanceId}`, { actor })
    },

    getEventAttachmentsV2: (eventId: number) => {
      return client.get<Array<Record<string, unknown>>>(`/api/v1/app/v2/events/${eventId}/attachments`)
    },

    addEventAttachmentV2: (eventId: number, body: Record<string, unknown>) => {
      return client.post<{ insertId: number }>(`/api/v1/app/v2/events/${eventId}/attachments`, body)
    },

    deleteEventAttachmentV2: (
      eventId: number,
      attachmentId: number,
      body: { actor: Record<string, unknown>; isOrganizer: boolean }
    ) => {
      return client.delete<{ filePath: string | null }>(
        `/api/v1/app/v2/events/${eventId}/attachments/${attachmentId}`,
        body
      )
    },

    // ── Phase 4C: KPI Audits & Topics V2 ──
    ensureKpiAuditsTableV2: () => {
      return client.post<{ ensured: boolean }>('/api/v1/app/v2/kpi/audits/ensure-table', {})
    },

    upsertKpiAuditBatchV2: (body: {
      fiscalYear: string
      periodKey: string
      auditedAtSql?: string | null
      items: Array<Record<string, unknown>>
    }) => {
      return client.post<{ savedCount: number; skippedCount: number }>(
        '/api/v1/app/v2/kpi/audits/upsert-batch',
        body
      )
    },

    getKpiAuditsByTopicV2: (params: {
      topicId: number
      fiscalYear?: string
      periodKey?: string
    }) => {
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/app/v2/kpi/audits${buildQuery(params)}`
      )
    },

    getKpiTopicByIdV2: (topicId: number) => {
      return client.get<Record<string, unknown> | null>(`/api/v1/app/v2/kpi/topics/${topicId}`)
    },

    // ── Phase 4C: Project Tracker V2 ──
    ensureProjectsSchemaV2: () => {
      return client.post<{ ensured: boolean }>('/api/v1/app/v2/projects/ensure-schema', {})
    },

    getProjectsBundleV2: (fiscalYear?: number) => {
      return client.get<{
        targetFiscalYear: number
        fyRows: Array<Record<string, unknown>>
        allYearRows: Array<Record<string, unknown>>
      }>(`/api/v1/app/v2/projects/bundle${buildQuery({ fiscalYear })}`)
    },

    createProjectV2: (fields: Record<string, unknown>, actorKey: string | null) => {
      return client.post<Record<string, unknown>>('/api/v1/app/v2/projects', { fields, actorKey })
    },

    updateProjectV2: (id: number, fields: Record<string, unknown>, actorKey: string | null) => {
      return client.patch<Record<string, unknown>>(`/api/v1/app/v2/projects/${id}`, { fields, actorKey })
    },

    deleteProjectV2: (id: number) => {
      return client.delete<Record<string, unknown>>(`/api/v1/app/v2/projects/${id}`)
    },

    batchImportProjectsV2: (body: {
      fiscalYear: number
      rows: Array<Record<string, unknown>>
      mode: 'append' | 'replace'
      actorKey: string | null
    }) => {
      return client.post<{ inserted: number; deletedCount: number; fiscalYear: number }>(
        '/api/v1/app/v2/projects/batch-import',
        body
      )
    },

    // ── Phase 4C: Ethics CMS V2 ──
    getEthicsTreeRawV2: (activeOnly = false) => {
      return client.get<{
        years: Array<Record<string, unknown>>
        documents: Array<Record<string, unknown>>
      }>(`/api/v1/app/v2/ethics/tree-raw${buildQuery({ activeOnly: activeOnly ? 'true' : undefined })}`)
    },

    getEthicsYearByIdV2: (id: number) => {
      return client.get<{ id: number; year: string } | null>(`/api/v1/app/v2/ethics/years/${id}`)
    },

    createEthicsYearV2: (body: { year: string; displayOrder?: number; isActive?: boolean }) => {
      return client.post<{ id: number }>('/api/v1/app/v2/ethics/years', body)
    },

    updateEthicsYearV2: (
      id: number,
      body: { year: string; displayOrder?: number; isActive?: boolean }
    ) => {
      return client.put<{ updated: boolean }>(`/api/v1/app/v2/ethics/years/${id}`, body)
    },

    deleteEthicsYearV2: (id: number) => {
      return client.delete<{ year: string; filePaths: string[] }>(`/api/v1/app/v2/ethics/years/${id}`)
    },

    getEthicsDocumentByIdV2: (id: number) => {
      return client.get<Record<string, unknown> | null>(`/api/v1/app/v2/ethics/documents/${id}`)
    },

    createEthicsDocumentV2: (body: Record<string, unknown>) => {
      return client.post<{ id: number }>('/api/v1/app/v2/ethics/documents', body)
    },

    updateEthicsDocumentV2: (id: number, body: Record<string, unknown>) => {
      return client.put<{ updated: boolean }>(`/api/v1/app/v2/ethics/documents/${id}`, body)
    },

    deleteEthicsDocumentV2: (id: number) => {
      return client.delete<{ title: string; filePaths: string[] }>(
        `/api/v1/app/v2/ethics/documents/${id}`
      )
    },

    // ── Phase 4C: Departments & Org Chart V2 ──
    listDepartmentGroupsV2: (activeOnly = false) => {
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/app/v2/departments/groups${buildQuery({ activeOnly: activeOnly ? 'true' : undefined })}`
      )
    },

    getDepartmentGroupByIdV2: (id: number) => {
      return client.get<Record<string, unknown> | null>(`/api/v1/app/v2/departments/groups/${id}`)
    },

    createDepartmentGroupV2: (body: { name: string; parentId?: number | null; orderIndex?: number }) => {
      return client.post<{ id: number }>('/api/v1/app/v2/departments/groups', body)
    },

    updateDepartmentGroupV2: (id: number, body: Record<string, unknown>) => {
      return client.patch<{ updated: boolean }>(`/api/v1/app/v2/departments/groups/${id}`, body)
    },

    reorderDepartmentGroupsV2: (groupIds: number[]) => {
      return client.post<{ reordered: boolean }>('/api/v1/app/v2/departments/groups/reorder', {
        groupIds,
      })
    },

    deleteDepartmentGroupV2: (id: number) => {
      return client.delete<{ deleted: boolean }>(`/api/v1/app/v2/departments/groups/${id}`)
    },

    listDepartmentRolesV2: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/v2/departments/roles')
    },

    createDepartmentRoleV2: (body: { name: string; orderIndex?: number; isDefault?: boolean }) => {
      return client.post<{ id: number; orderIndex: number }>('/api/v1/app/v2/departments/roles', body)
    },

    updateDepartmentRoleV2: (id: number, body: Record<string, unknown>) => {
      return client.patch<{ updated: boolean }>(`/api/v1/app/v2/departments/roles/${id}`, body)
    },

    deleteDepartmentRoleV2: (id: number) => {
      return client.delete<{ deleted: boolean }>(`/api/v1/app/v2/departments/roles/${id}`)
    },

    reorderDepartmentRolesV2: (roleIds: number[]) => {
      return client.post<{ reordered: boolean }>('/api/v1/app/v2/departments/roles/reorder', {
        roleIds,
      })
    },

    listDepartmentMembersV2: (groupId: number) => {
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/app/v2/departments/groups/${groupId}/members`
      )
    },

    createDepartmentMemberV2: (body: Record<string, unknown>) => {
      return client.post<{ id: number }>('/api/v1/app/v2/departments/members', body)
    },

    updateDepartmentMemberV2: (id: number, body: Record<string, unknown>) => {
      return client.patch<{ updated: boolean }>(`/api/v1/app/v2/departments/members/${id}`, body)
    },

    deleteDepartmentMemberV2: (id: number) => {
      return client.delete<{ deleted: boolean }>(`/api/v1/app/v2/departments/members/${id}`)
    },

    reorderDepartmentMembersV2: (groupId: number, memberIds: number[]) => {
      return client.post<{ reordered: boolean }>(
        `/api/v1/app/v2/departments/groups/${groupId}/members/reorder`,
        { memberIds }
      )
    },

    searchDepartmentStaffV2: (keyword: string) => {
      return client.get<Array<Record<string, unknown>>>(
        `/api/v1/app/v2/departments/search-staff${buildQuery({ keyword })}`
      )
    },

    getPublicOrgChartRawV2: () => {
      return client.get<{
        groups: Array<Record<string, unknown>>
        members: Array<Record<string, unknown>>
      }>('/api/v1/app/v2/departments/public-org-chart')
    },

    // ── Phase 4C: Internal Phones V2 ──
    ensureAndSeedInternalPhonesV2: (body: {
      seedKey?: string
      initialItems: Array<Record<string, unknown>>
    }) => {
      return client.post<{ seeded: boolean }>('/api/v1/app/v2/internal-phones/ensure-and-seed', body)
    },

    listInternalPhonesV2: () => {
      return client.get<Array<Record<string, unknown>>>('/api/v1/app/v2/internal-phones')
    },

    getInternalPhoneByIdV2: (id: number) => {
      return client.get<Record<string, unknown>>(`/api/v1/app/v2/internal-phones/${id}`)
    },

    createInternalPhoneV2: (body: Record<string, unknown>) => {
      return client.post<Record<string, unknown>>('/api/v1/app/v2/internal-phones', body)
    },

    updateInternalPhoneV2: (id: number, body: Record<string, unknown>) => {
      return client.patch<Record<string, unknown>>(`/api/v1/app/v2/internal-phones/${id}`, body)
    },

    deleteInternalPhoneV2: (id: number) => {
      return client.delete<Record<string, unknown>>(`/api/v1/app/v2/internal-phones/${id}`)
    },
  }
}
