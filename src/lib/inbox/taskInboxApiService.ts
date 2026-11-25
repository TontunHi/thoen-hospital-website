import crypto from 'crypto'
import { apiGateway } from '@/lib/apiGateway'
import { safeJsonParse } from '@/lib/utils/safeJson'
import { resolveTaskPermissions } from '@/lib/taskPermissionResolver'
import {
  executeRepairAction,
  executeWorkflowAction,
  generateTaskNo,
  getMediaRequestWorkflowSteps,
  notifyAssigneeOnTelegram,
  notifyMediaRequestCreatedRequesterOnTelegram,
  notifyRepairCreatedRequesterOnTelegram,
  REGISTERED_TASK_TYPES,
  updateTaskByManager,
  WorkflowStepDefinition,
} from '@/lib/taskInboxService'
import { logger } from '@/lib/logger'

export class TaskInboxApiError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message)
    this.name = 'TaskInboxApiError'
  }
}

async function fetchMemberWithPermissions(username: string) {
  const res = await apiGateway.app.getMemberByUsernameWithPermissions(username)
  if (!res?.member) {
    throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
  }
  return {
    member: res.member,
    permissions: Array.isArray(res.permissions) ? res.permissions : [],
  }
}

export const TaskInboxApiService = {
  async listAssignees() {
    const res = await apiGateway.app.getMembers()
    const rawList = Array.isArray(res) ? res : (res as any)?.data || []
    return (Array.isArray(rawList) ? rawList : [])
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        position: m.position,
        department: m.department,
        email: m.email,
      }))
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'th'))
  },

  async performTaskWorkflowAction(params: {
    username: string
    taskId: string
    action: 'APPROVE' | 'REJECT' | 'SEND_BACK' | 'HOLD' | 'RESUME' | 'COMPLETE'
    comment?: string
    nextAssigneeId?: number | null
    partialEdits?: any
    holdReason?: string
    holdDetails?: string
    targetStepNo?: number | null
    sendToRequester?: boolean
  }) {
    const { member: currentMember } = await fetchMemberWithPermissions(params.username)

    return executeWorkflowAction({
      taskId: params.taskId,
      action: params.action,
      comment: params.comment,
      nextAssigneeId: params.nextAssigneeId || null,
      partialEdits: params.partialEdits,
      holdReason: params.holdReason,
      holdDetails: params.holdDetails,
      targetStepNo: params.targetStepNo ?? null,
      sendToRequester: Boolean(params.sendToRequester),
      actorMemberId: currentMember.id,
      actorUsername: currentMember.username,
      actorName: currentMember.name,
      actorPosition: currentMember.position || '',
      actorRole: currentMember.role,
      signaturePath: currentMember.signature_path,
    })
  },

  async performTaskRepairAction(params: {
    username: string
    taskId: string
    action: string
    payload: Record<string, unknown>
  }) {
    const { member: currentMember } = await fetchMemberWithPermissions(params.username)

    return executeRepairAction({
      taskId: params.taskId,
      action: params.action as any,
      performer: currentMember as any,
      payload: params.payload as any,
    })
  },

  async getTaskFullDetailForSession(
    session: { username: string; role: string },
    taskId: string
  ) {
    const [fullRes, memberCtx] = await Promise.all([
      apiGateway.app.getTaskFullDetails(taskId),
      apiGateway.app.getMemberByUsernameWithPermissions(session.username),
    ])

    const fullData =
      fullRes &&
      typeof fullRes === 'object' &&
      'data' in fullRes &&
      fullRes.data &&
      (fullRes as any).success !== false
        ? fullRes.data
        : fullRes && typeof fullRes === 'object' && 'task' in fullRes
        ? (fullRes as any)
        : null

    if (!fullData?.task) {
      throw new TaskInboxApiError('ไม่พบข้อมูลงานนี้', 404)
    }

    const task = fullData.task
    const steps: any[] = fullData.steps || []
    const auditLogs: any[] = fullData.auditLogs || []
    const rawRepairRow: any = fullData.repairDetail

    const customPayload = safeJsonParse<Record<string, unknown> | null>(task.custom_payload, null)

    const parsedAuditLogs = auditLogs.map((log: any) => {
      const details = safeJsonParse<unknown>(log.details, log.details)
      return { ...log, details }
    })

    let repairDetail = null
    if (rawRepairRow) {
      const row = rawRepairRow
      const photos = safeJsonParse<unknown[]>(row.photos, [])
      const coWorkers = safeJsonParse<unknown[]>(row.co_workers, [])
      repairDetail = {
        ...row,
        photos,
        co_workers: coWorkers,
      }
    }

    const currentMember = memberCtx?.member
    const permissions = Array.isArray(memberCtx?.permissions) ? memberCtx.permissions : []

    const memberLike = {
      id: currentMember?.id,
      username: currentMember?.username,
      name: currentMember?.name,
      role: currentMember?.role || session.role || 'member',
      position: currentMember?.position,
      department: currentMember?.department,
      permissions,
      isAdmin: Boolean(session.role === 'admin' || currentMember?.role === 'admin'),
    }

    const taskPerms = resolveTaskPermissions(memberLike, task, {
      repairDetail,
      steps,
    })

    if (!taskPerms.canView) {
      throw new TaskInboxApiError('คุณไม่มีสิทธิ์เข้าถึงหรือดูรายละเอียดงานนี้', 403)
    }

    return {
      task: {
        ...task,
        custom_payload: customPayload,
      },
      steps,
      repairDetail,
      auditLogs: parsedAuditLogs,
      currentUser: {
        id: currentMember?.id,
        name: currentMember?.name,
        position: currentMember?.position,
        role: currentMember?.role,
        hasSignature: Boolean(currentMember?.signature_path),
        isRequester: taskPerms.isRequester,
        isCurrentAssignee: taskPerms.isCurrentAssignee,
        isCoWorker: taskPerms.isCoWorker,
        isAdmin: taskPerms.isAdmin,
        canManageTask: taskPerms.canEdit,
        permissions: taskPerms,
      },
    }
  },

  async editTaskAsManager(
    session: { username: string; role: string },
    taskId: string,
    updates: Record<string, unknown>
  ) {
    const { member: currentMember, permissions } = await fetchMemberWithPermissions(session.username)

    const memberLike = {
      id: currentMember.id,
      username: currentMember.username,
      name: currentMember.name,
      role: currentMember.role || session.role || 'member',
      position: currentMember.position,
      department: currentMember.department,
      permissions,
      isAdmin: Boolean(session.role === 'admin' || currentMember.role === 'admin'),
    }

    return updateTaskByManager({
      taskId,
      performer: memberLike,
      updates,
    })
  },

  async listUnifiedInboxTasks(params: {
    username: string
    tab: string
    type: string | null
    status: string | null
    search: string | undefined
  }) {
    const { username, tab, type, status, search } = params
    const gwRes = await apiGateway.tasks.getInboxTasks({
      tab,
      username,
      type: type || undefined,
      status: status || undefined,
      search: search || undefined,
    })
    const inboxData =
      gwRes &&
      typeof gwRes === 'object' &&
      'data' in gwRes &&
      gwRes.data &&
      (gwRes as any).success !== false
        ? gwRes.data
        : gwRes && typeof gwRes === 'object' && Array.isArray((gwRes as any).tasks)
        ? gwRes
        : null

    if (!inboxData) {
      throw new TaskInboxApiError('ไม่พบข้อมูลรายการงาน', 404)
    }

    return inboxData
  },

  async createGenericInboxTask(
    session: { username: string },
    body: {
      taskType?: string
      title?: string
      description?: string
      urgency?: string
      customPayload?: unknown
      steps?: WorkflowStepDefinition[]
    }
  ) {
    const { member: currentMember } = await fetchMemberWithPermissions(session.username)

    const { taskType, title, description, urgency = 'NORMAL', customPayload, steps } = body

    if (!taskType || !title) {
      throw new TaskInboxApiError('กรุณาระบุประเภทงานและหัวข้อเรื่อง', 400)
    }

    const typeConfig = REGISTERED_TASK_TYPES[taskType]
    if (!typeConfig) {
      throw new TaskInboxApiError('ประเภทงานไม่ถูกต้อง', 400)
    }

    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo(taskType)

    const workflowSteps: WorkflowStepDefinition[] =
      steps && steps.length > 0 ? steps : typeConfig.defaultSteps

    const firstStep = workflowSteps[0]
    const initialAssignee = firstStep.assignedToId || null
    const initialRole = firstStep.assignedRole || null

    const gwRes = await apiGateway.tasks.createTask({
      task: {
        id: taskId,
        taskNo,
        taskType,
        title: title.trim(),
        description: description || '',
        urgency,
        requesterId: currentMember.id,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department || null,
        initialAssignee,
        initialRole,
        customPayload: customPayload
          ? typeof customPayload === 'string'
            ? JSON.parse(customPayload)
            : customPayload
          : null,
      },
      steps: workflowSteps,
      auditLog: {
        action: 'CREATE_TASK',
        performedBy: currentMember.id,
        performerName: currentMember.name || session.username,
        details: { taskNo, taskType, title, initialAssignee },
      },
    })

    const gwData = (gwRes as any)?.data ?? gwRes
    const createdTaskId = gwData?.taskId || taskId
    const createdTaskNo = gwData?.taskNo || taskNo

    if (initialAssignee) {
      notifyAssigneeOnTelegram({
        taskId: createdTaskId,
        taskNo: createdTaskNo,
        taskType,
        title,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department,
        assigneeId: initialAssignee,
        stepName: firstStep.stepName,
      }).catch((e) => logger.error({ err: e }, 'Telegram dispatch error on task creation'))
    }

    return { taskId: createdTaskId, taskNo: createdTaskNo }
  },

  async createRepairTicket(
    session: { username: string; email?: string },
    body: {
      repairType?: string
      itemCategory?: string
      equipmentNumber?: string
      equipmentName?: string
      nonEquipmentItem?: string
      locationId?: number | null
      locationFullName?: string
      symptomDetail?: string
      assignedTechnicianId?: number | string | null
      urgency?: string
      photos?: string[]
    }
  ) {
    let currentMember: any = null
    if (typeof apiGateway.app.getMemberAuthContext === 'function') {
      try {
        const authCtx = await apiGateway.app.getMemberAuthContext(
          session.username,
          session.email || ''
        )
        if (authCtx && authCtx.member) {
          currentMember = authCtx.member
        }
      } catch (err: unknown) {
        logger.debug({ err }, 'getMemberAuthContext fallback to getMemberByUsernameWithPermissions')
      }
    }

    if (!currentMember && typeof apiGateway.app.getMemberByUsernameWithPermissions === 'function') {
      const ctx = await apiGateway.app.getMemberByUsernameWithPermissions(session.username)
      if (ctx?.member) currentMember = ctx.member
    }

    if (!currentMember) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }

    const {
      repairType,
      itemCategory,
      equipmentNumber,
      equipmentName,
      nonEquipmentItem,
      locationId,
      locationFullName,
      symptomDetail,
      assignedTechnicianId,
      urgency = 'NORMAL',
      photos = [],
    } = body

    if (!repairType || !['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(repairType)) {
      throw new TaskInboxApiError('กรุณาเลือกประเภทงานซ่อมที่ถูกต้อง', 400)
    }

    if (itemCategory === 'EQUIPMENT') {
      if (!equipmentNumber?.trim() && !equipmentName?.trim()) {
        throw new TaskInboxApiError('กรุณาระบุเลขทะเบียนครุภัณฑ์ หรือชื่อครุภัณฑ์', 400)
      }
    } else if (!nonEquipmentItem?.trim()) {
      throw new TaskInboxApiError('กรุณาระบุชื่อรายการ/สิ่งของที่ชำรุดเสียหาย', 400)
    }

    if (!locationFullName?.trim()) {
      throw new TaskInboxApiError('กรุณาระบุสถานที่ (ตึก/ชั้น/ห้อง)', 400)
    }

    if (!symptomDetail?.trim()) {
      throw new TaskInboxApiError('กรุณาระบุรายละเอียดหรืออาการเสีย', 400)
    }

    let techName: string | null = null
    const techId: number | null = assignedTechnicianId ? Number(assignedTechnicianId) : null

    if (techId) {
      const tech = await apiGateway.app.getMemberById(techId)
      if (tech?.name) techName = String(tech.name)
    }

    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo(repairType)

    const itemName: string =
      itemCategory === 'EQUIPMENT'
        ? equipmentName
          ? `${equipmentName} (${equipmentNumber || 'ไม่ระบุเลข'})`
          : `ครุภัณฑ์เลขที่ ${equipmentNumber}`
        : nonEquipmentItem || ''

    const taskTitle = `แจ้งซ่อม: ${itemName}`

    let targetRole: string | null = null
    if (!techId) {
      if (repairType === 'IT_REPAIR') targetRole = 'นักวิชาการคอมพิวเตอร์'
      else if (repairType === 'GENERAL_REPAIR') targetRole = 'นายช่างเทคนิค'
      else if (repairType === 'MEDICAL_REPAIR') targetRole = 'นักวิทยาศาสตร์การแพทย์'
    }

    const gwRes = await apiGateway.tasks.createTask({
      task: {
        id: taskId,
        taskNo,
        taskType: repairType,
        title: taskTitle,
        description: symptomDetail.trim(),
        urgency,
        requesterId: currentMember.id,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department || 'โรงพยาบาลเถิน',
        initialAssignee: techId,
        initialRole: targetRole,
        customPayload: {
          itemCategory,
          itemName,
          locationFullName,
        },
      },
      steps: [
        {
          stepNo: 1,
          stepName: 'ช่างรับงานและดำเนินการซ่อม',
          assigneeType: techId ? 'INDIVIDUAL' : 'ROLE',
          assignedToId: techId,
          assignedRole: targetRole,
        },
      ],
      repairDetail: {
        repairType,
        itemCategory,
        equipmentNumber: itemCategory === 'EQUIPMENT' ? equipmentNumber?.trim() || null : null,
        equipmentName: itemCategory === 'EQUIPMENT' ? equipmentName?.trim() || null : null,
        nonEquipmentItem: itemCategory === 'NON_EQUIPMENT' ? nonEquipmentItem?.trim() || null : null,
        locationId: locationId || null,
        locationFullName: locationFullName.trim(),
        symptomDetail: symptomDetail.trim(),
        assignedTechnicianId: techId,
        assignedTechnicianName: techName,
        photos: photos || [],
      },
      auditLog: {
        action: 'CREATE_REPAIR_TICKET',
        performedBy: currentMember.id,
        performerName: currentMember.name || session.username,
        details: {
          taskNo,
          repairType,
          itemName,
          location: locationFullName,
        },
      },
    })

    const gwData = (gwRes as any)?.data ?? gwRes
    const createdTaskId = gwData?.taskId || taskId
    const createdTaskNo = gwData?.taskNo || taskNo

    notifyAssigneeOnTelegram({
      taskId: createdTaskId,
      taskNo: createdTaskNo,
      taskType: repairType,
      title: taskTitle,
      requesterName: currentMember.name || session.username,
      requesterDept: currentMember.department,
      assigneeId: techId,
      targetRole,
      stepName: 'มีงานแจ้งซ่อมใหม่มอบหมายถึงคุณ',
      equipmentNumber: itemCategory === 'EQUIPMENT' ? equipmentNumber?.trim() || null : null,
      itemName,
      location: locationFullName,
      symptom: symptomDetail.trim(),
      urgency,
    }).catch((e) => logger.error({ err: e }, 'Telegram assignee notification error'))

    if (techId !== currentMember.id) {
      notifyRepairCreatedRequesterOnTelegram({
        taskId: createdTaskId,
        taskNo: createdTaskNo,
        taskType: repairType,
        title: taskTitle,
        requesterId: currentMember.id,
        itemName,
        equipmentNumber: itemCategory === 'EQUIPMENT' ? equipmentNumber?.trim() || null : null,
        location: locationFullName,
        symptom: symptomDetail.trim(),
        urgency,
        assignedTechName: techName,
      }).catch((e) => logger.error({ err: e }, 'Telegram requester notification error'))
    }

    return { taskId: createdTaskId, taskNo: createdTaskNo }
  },

  async listMediaRequests(params: {
    username: string
    status: string | null
    search: string | undefined
    limit: number
  }) {
    const { username, status, search, limit } = params
    const { member: currentMember, permissions } = await fetchMemberWithPermissions(username)

    const hasPerm = (key: string) => permissions.includes(key)
    const userPos = currentMember.position || ''
    const isPrStaff = userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')
    const canViewAll =
      currentMember.role === 'admin' ||
      hasPerm('manage_inbox') ||
      hasPerm('view_all_work') ||
      hasPerm('manage_media_requests') ||
      isPrStaff ||
      userPos.includes('ดิจิทัลทางการแพทย์')

    const tasks = await apiGateway.app.getMediaRequestTasks({
      requesterId: canViewAll ? undefined : currentMember.id,
      status,
      search,
      limit,
    })

    return {
      tasks: tasks || [],
      canViewAll,
    }
  },

  async createMediaRequest(
    session: { username: string },
    data: {
      title: string
      urgency: 'NORMAL' | 'URGENT' | 'VERY_URGENT'
      deliveryDate: string
      costType: 'NO_COST' | 'HAS_COST'
      workTypes: Array<{ key: string; label: string; customDetail?: string | null }>
      channels: Array<{ key: string; label: string; customDetail?: string | null }>
      description: string
      phone: string
      attachments: Array<{
        fileName: string
        filePath: string
        fileType?: string | null
        fileSize?: number | null
      }>
      quotations: Array<{
        fileName: string
        filePath: string
        fileType?: string | null
        fileSize?: number | null
      }>
      driveLink?: string | null
    }
  ) {
    const { member: currentMember } = await fetchMemberWithPermissions(session.username)

    const hasCost = data.costType === 'HAS_COST'
    const workflowSteps = getMediaRequestWorkflowSteps(hasCost)

    let normalizedDeliveryDate = data.deliveryDate
    if (normalizedDeliveryDate) {
      const parts = normalizedDeliveryDate.split('-')
      if (parts.length === 3) {
        let y = parseInt(parts[0], 10)
        if (y > 2400) y -= 543
        normalizedDeliveryDate = `${y}-${parts[1]}-${parts[2]}`
      }
    }

    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo('MEDIA_REQUEST')

    const firstStep = workflowSteps[0]
    const initialRole = firstStep.assignedRole || 'นักประชาสัมพันธ์'

    const customPayload = {
      requestDate: new Date().toISOString(),
      deliveryDate: normalizedDeliveryDate,
      costType: data.costType,
      workTypes: data.workTypes,
      channels: data.channels,
      phone: data.phone?.trim() || null,
      attachments: data.attachments || [],
      quotations: data.quotations || [],
      driveLink: data.driveLink?.trim() || null,
      requesterInfo: {
        id: currentMember.id,
        name: currentMember.name || session.username,
        department: currentMember.department || '-',
        position: currentMember.position || '-',
      },
    }

    const gwRes = await apiGateway.tasks.createTask({
      task: {
        id: taskId,
        taskNo,
        taskType: 'MEDIA_REQUEST',
        title: data.title.trim(),
        description: data.description.trim(),
        urgency: data.urgency,
        requesterId: currentMember.id,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department || null,
        initialAssignee: null,
        initialRole,
        customPayload,
      },
      steps: workflowSteps,
      auditLog: {
        action: 'CREATE_MEDIA_REQUEST',
        performedBy: currentMember.id,
        performerName: currentMember.name || session.username,
        details: {
          taskNo,
          title: data.title,
          costType: data.costType,
          totalSteps: workflowSteps.length,
          workTypesCount: data.workTypes.length,
        },
      },
    })

    const gwData = (gwRes as any)?.data ?? gwRes
    const createdTaskId = gwData?.taskId || taskId
    const createdTaskNo = gwData?.taskNo || taskNo

    const workTypesSummary = data.workTypes
      .map((w) => (w.customDetail ? `${w.label} (${w.customDetail})` : w.label))
      .join(', ')

    notifyAssigneeOnTelegram({
      taskId: createdTaskId,
      taskNo: createdTaskNo,
      taskType: 'MEDIA_REQUEST',
      title: data.title,
      requesterName: currentMember.name || session.username,
      requesterDept: currentMember.department,
      targetRole: initialRole,
      stepName: firstStep.stepName,
      urgency: data.urgency,
      deliveryDate: data.deliveryDate,
      costType: data.costType,
      workTypesSummary,
    }).catch((e) => logger.error({ err: e }, 'Telegram dispatch error on media request'))

    notifyMediaRequestCreatedRequesterOnTelegram({
      taskId: createdTaskId,
      taskNo: createdTaskNo,
      title: data.title,
      requesterId: currentMember.id,
      urgency: data.urgency,
      deliveryDate: data.deliveryDate,
      costType: data.costType,
      workTypesSummary,
    }).catch((e) =>
      logger.error({ err: e }, 'Telegram requester confirmation error on media request')
    )

    return { taskId: createdTaskId, taskNo: createdTaskNo }
  },

  async getInitialMediaRequestsForMember(member: {
    id: number
    position?: string | null
    isAdmin?: boolean
    can: (perm: string) => boolean
  }) {
    const userPos = member.position || ''
    const isPrStaff = userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')
    const canViewAll = Boolean(
      member.isAdmin ||
        member.can('manage_inbox') ||
        member.can('manage_media_requests') ||
        member.can('view_all_work') ||
        isPrStaff ||
        userPos.includes('ดิจิทัลทางการแพทย์')
    )

    const tasks = await apiGateway.app.getMediaRequestTasks({
      requesterId: canViewAll ? undefined : member.id,
      limit: 50,
    })

    const parsedTasks = (tasks || []).map((t: any) => ({
      ...t,
      custom_payload:
        typeof t.custom_payload === 'string' ? JSON.parse(t.custom_payload) : t.custom_payload,
    }))

    return { parsedTasks, canViewAll }
  },

  async getNewRepairFormPreloadData(username: string): Promise<{
    currentMember: {
      id: number
      username: string
      name: string
      department: string
      position: string
      email?: string
      phone?: string
    }
    initialLocations: Array<{
      id: number
      room_name: string
      floor_id: number
      floor_name: string
      building_id: number
      building_name: string
      full_name: string
    }>
  }> {
    const res = await apiGateway.app.getRepairFormPreloadData(username)
    const m = res?.currentMember
    return {
      currentMember: m
        ? {
            id: Number(m.id || 0),
            username: String(m.username || username),
            name: String(m.name || username),
            department: String(m.department || ''),
            position: String(m.position || ''),
            email: m.email ? String(m.email) : undefined,
          }
        : {
            id: 0,
            username,
            name: username,
            department: '',
            position: '',
          },
      initialLocations: (res?.initialLocations || []) as any,
    }
  },
}
