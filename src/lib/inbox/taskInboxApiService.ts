import crypto from 'crypto'
import { apiGateway } from '@/lib/apiGateway'
import { queryMemberDb } from '@/lib/memberDb'
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

export const TaskInboxApiService = {
  async listAssignees() {
    let members: Array<{
      id: number
      name: string | null
      position: string | null
      department: string | null
      email: string | null
    }> = []

    if (typeof apiGateway.app.getMembers === 'function') {
      try {
        const res = await apiGateway.app.getMembers()
        const rawList = Array.isArray(res) ? res : (res as any)?.data || []
        if (Array.isArray(rawList) && rawList.length > 0) {
          members = rawList
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              position: m.position,
              department: m.department,
              email: m.email,
            }))
            .sort((a: any, b: any) =>
              (a.name || '').localeCompare(b.name || '', 'th')
            )
        }
      } catch {
        // Fallback to queryMemberDb
      }
    }

    if (members.length === 0) {
      members = await queryMemberDb(
        'SELECT id, name, position, department, email FROM members ORDER BY name ASC'
      )
    }

    return members
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
    const members = await queryMemberDb<{
      id: number
      username: string
      name: string
      department: string | null
      position: string | null
      role: string
      signature_path: string | null
    }>(
      'SELECT id, username, name, department, position, role, signature_path FROM members WHERE username = ? LIMIT 1',
      [params.username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]

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
    const members = await queryMemberDb<{
      id: number
      username: string
      name: string
      department: string | null
      position: string | null
      role: string
    }>(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [params.username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]

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
    let task: any = null
    let steps: any[] = []
    let auditLogs: any[] = []
    let rawRepairRow: any = null

    try {
      const fullRes = await apiGateway.app.getTaskFullDetails(taskId)
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

      if (fullData?.task) {
        task = fullData.task
        steps = fullData.steps || []
        auditLogs = fullData.auditLogs || []
        rawRepairRow = fullData.repairDetail
      }
    } catch {
      // Fallback to queryMemberDb
    }

    if (!task) {
      const tasks = await queryMemberDb(
        `SELECT 
          t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
          t.requester_id, t.requester_name, t.requester_dept,
          t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
          t.reference_id, t.custom_payload, t.created_at, t.updated_at,
          req.signature_path as requester_signature_path
         FROM inbox_tasks t
         LEFT JOIN members req ON t.requester_id = req.id
         WHERE t.id = ? LIMIT 1`,
        [taskId]
      )

      if (!tasks || tasks.length === 0) {
        throw new TaskInboxApiError('ไม่พบข้อมูลงานนี้', 404)
      }
      task = tasks[0]

      steps = await queryMemberDb(
        `SELECT 
          s.id, s.step_no, s.step_name, s.assignee_type, s.assigned_to_id, s.assigned_role,
          s.status, s.action_taken, s.action_by, s.action_by_name, s.action_at,
          s.comment, s.signature_path, s.signature_hash,
          m.name as assigned_to_name, m.position as assigned_to_position
         FROM inbox_task_steps s
         LEFT JOIN members m ON s.assigned_to_id = m.id
         WHERE s.task_id = ?
         ORDER BY s.step_no ASC`,
        [taskId]
      )

      auditLogs = await queryMemberDb(
        `SELECT 
          id, action, performed_by, performer_name, details, created_at
         FROM inbox_task_audit_logs
         WHERE task_id = ?
         ORDER BY created_at ASC`,
        [taskId]
      )

      const repairRows = await queryMemberDb(
        'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
        [taskId]
      )
      if (repairRows && repairRows.length > 0) {
        rawRepairRow = repairRows[0]
      }
    }

    let customPayload = null
    try {
      customPayload = task.custom_payload
        ? typeof task.custom_payload === 'string'
          ? JSON.parse(task.custom_payload)
          : task.custom_payload
        : null
    } catch {
      // Ignore invalid JSON
    }

    const parsedAuditLogs = auditLogs.map((log: any) => {
      let details = log.details
      try {
        details = log.details
          ? typeof log.details === 'string'
            ? JSON.parse(log.details)
            : log.details
          : null
      } catch {
        // Ignore invalid JSON
      }
      return { ...log, details }
    })

    let repairDetail = null
    if (rawRepairRow) {
      const row = rawRepairRow
      let photos = []
      let coWorkers = []
      try {
        photos = row.photos
          ? typeof row.photos === 'string'
            ? JSON.parse(row.photos)
            : row.photos
          : []
      } catch {
        // Ignore
      }
      try {
        coWorkers = row.co_workers
          ? typeof row.co_workers === 'string'
            ? JSON.parse(row.co_workers)
            : row.co_workers
          : []
      } catch {
        // Ignore
      }
      repairDetail = {
        ...row,
        photos,
        co_workers: coWorkers,
      }
    }

    const currentMemberRows = await queryMemberDb(
      'SELECT id, username, name, department, position, role, signature_path FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    const currentMember = currentMemberRows[0]
    const userPos = (currentMember?.position || '').trim()

    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)',
      [userPos]
    )
    const permissions = permRows.map((r: any) => r.permission_key)

    const memberLike = {
      id: currentMember?.id,
      username: currentMember?.username,
      name: currentMember?.name,
      role: currentMember?.role || session.role || 'member',
      position: currentMember?.position,
      department: currentMember?.department,
      permissions,
      isAdmin: Boolean(
        session.role === 'admin' || currentMember?.role === 'admin'
      ),
    }

    const taskPerms = resolveTaskPermissions(memberLike, task, {
      repairDetail,
      steps,
    })

    if (!taskPerms.canView) {
      throw new TaskInboxApiError(
        'คุณไม่มีสิทธิ์เข้าถึงหรือดูรายละเอียดงานนี้',
        403
      )
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
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]

    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)',
      [(currentMember.position || '').trim()]
    )
    const permissions = permRows.map((r: any) => r.permission_key)

    const memberLike = {
      id: currentMember.id,
      username: currentMember.username,
      name: currentMember.name,
      role: currentMember.role || session.role || 'member',
      position: currentMember.position,
      department: currentMember.department,
      permissions,
      isAdmin: Boolean(
        session.role === 'admin' || currentMember.role === 'admin'
      ),
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

    if (typeof apiGateway.tasks?.getInboxTasks === 'function') {
      try {
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
            : gwRes &&
              typeof gwRes === 'object' &&
              Array.isArray((gwRes as any).tasks)
            ? gwRes
            : null

        if (inboxData) {
          return inboxData
        }
      } catch {
        // Fallback to local queryMemberDb
      }
    }

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]
    const memberId = currentMember.id
    const userRole = currentMember.role
    const userPosition = (currentMember.position || '').trim()

    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE position_name = ?',
      [userPosition]
    )
    const hasPerm = (key: string) =>
      permRows.some((p: any) => p.permission_key === key)

    const isPrStaff =
      userPosition.includes('นักประชาสัมพันธ์') ||
      userPosition.includes('ประชาสัมพันธ์')
    const isItStaff =
      userPosition.includes('คอมพิวเตอร์') ||
      userPosition.includes('ไอที') ||
      Boolean(
        currentMember.department &&
          (currentMember.department.includes('ดิจิทัล') ||
            currentMember.department.includes('สารสนเทศ'))
      )
    const isGeneralTechStaff =
      userPosition.includes('ช่าง') ||
      Boolean(
        currentMember.department &&
          currentMember.department.includes('ซ่อมบำรุง')
      )
    const isMedicalTechStaff =
      userPosition.includes('เครื่องมือแพทย์') ||
      Boolean(
        currentMember.department &&
          currentMember.department.includes('เครื่องมือแพทย์')
      )

    const canViewAll =
      userRole === 'admin' ||
      hasPerm('manage_inbox') ||
      hasPerm('manage_repairs') ||
      hasPerm('view_all_work') ||
      hasPerm('manage_media_requests')

    const canViewItRepairs =
      canViewAll ||
      hasPerm('view_it_repairs') ||
      hasPerm('manage_repairs') ||
      isItStaff
    const canViewGeneralRepairs =
      canViewAll ||
      hasPerm('view_general_repairs') ||
      hasPerm('manage_repairs') ||
      isGeneralTechStaff
    const canViewMedicalRepairs =
      canViewAll ||
      hasPerm('view_medical_repairs') ||
      hasPerm('manage_repairs') ||
      isMedicalTechStaff
    const canViewMediaRequests =
      canViewAll ||
      hasPerm('view_media_requests') ||
      hasPerm('manage_media_requests') ||
      isPrStaff

    const whereClauses: string[] = []
    const queryParams: any[] = []

    if (tab === 'my-requests') {
      whereClauses.push('t.requester_id = ?')
      queryParams.push(memberId)
    } else if (tab === 'department') {
      const deptConditions: string[] = []
      const deptParams: any[] = []

      if (currentMember.department && currentMember.department.trim()) {
        deptConditions.push('t.requester_dept = ?')
        deptParams.push(currentMember.department.trim())
      }
      if (canViewItRepairs) deptConditions.push("t.task_type = 'IT_REPAIR'")
      if (canViewGeneralRepairs)
        deptConditions.push("t.task_type = 'GENERAL_REPAIR'")
      if (canViewMedicalRepairs)
        deptConditions.push("t.task_type = 'MEDICAL_REPAIR'")
      if (canViewMediaRequests)
        deptConditions.push("t.task_type = 'MEDIA_REQUEST'")

      if (deptConditions.length > 0) {
        whereClauses.push(`(${deptConditions.join(' OR ')})`)
        queryParams.push(...deptParams)
      } else {
        whereClauses.push('t.requester_id = ?')
        queryParams.push(memberId)
      }
    } else if (tab === 'all') {
      if (!canViewAll) {
        const allowedConditions: string[] = [
          't.requester_id = ?',
          't.current_assignee = ?',
        ]
        const allowedParams: any[] = [memberId, memberId]

        if (canViewMediaRequests)
          allowedConditions.push("t.task_type = 'MEDIA_REQUEST'")
        if (canViewItRepairs)
          allowedConditions.push("t.task_type = 'IT_REPAIR'")
        if (canViewGeneralRepairs)
          allowedConditions.push("t.task_type = 'GENERAL_REPAIR'")
        if (canViewMedicalRepairs)
          allowedConditions.push("t.task_type = 'MEDICAL_REPAIR'")
        if (currentMember.department && currentMember.department.trim()) {
          allowedConditions.push('t.requester_dept = ?')
          allowedParams.push(currentMember.department.trim())
        }

        whereClauses.push(`(${allowedConditions.join(' OR ')})`)
        queryParams.push(...allowedParams)
      }
    } else {
      whereClauses.push(
        `(t.status IN ('PENDING', 'IN_PROGRESS') AND (
          t.current_assignee = ? 
          OR (t.\`current_role\` IS NOT NULL AND (
            t.\`current_role\` = ? 
            OR t.\`current_role\` = ?
            OR (t.\`current_role\` = 'ผู้อำนวยการโรงพยาบาลเถิน' AND ? LIKE '%ผู้อำนวยการ%')
            OR (t.\`current_role\` = 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' AND (? LIKE '%ดิจิทัลทางการแพทย์%' OR ? LIKE '%หัวหน้ากลุ่มงานดิจิทัล%'))
            OR (t.\`current_role\` = 'หัวหน้าเจ้าหน้าที่พัสดุ' AND (? LIKE '%หัวหน้าเจ้าหน้าที่พัสดุ%' OR ? LIKE '%หัวหน้าพัสดุ%'))
            OR (t.\`current_role\` = 'เจ้าหน้าที่พัสดุ' AND ? LIKE '%พัสดุ%')
            OR (t.\`current_role\` = 'นักประชาสัมพันธ์' AND (? LIKE '%ประชาสัมพันธ์%' OR ? LIKE '%นักประชาสัมพันธ์%'))
          ))
          OR EXISTS (
            SELECT 1 FROM repair_details rd 
            WHERE rd.task_id = t.id 
            AND JSON_CONTAINS(rd.co_workers, JSON_OBJECT('id', ?))
          )
        ))`
      )
      queryParams.push(
        memberId,
        userPosition,
        userRole,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        memberId
      )
    }

    if (type) {
      whereClauses.push('t.task_type = ?')
      queryParams.push(type)
    }

    if (status) {
      whereClauses.push('t.status = ?')
      queryParams.push(status)
    }

    if (search) {
      whereClauses.push(
        '(t.task_no LIKE ? OR t.title LIKE ? OR t.requester_name LIKE ?)'
      )
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const tasks = await queryMemberDb(
      `SELECT 
        t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
        t.requester_id, t.requester_name, t.requester_dept,
        t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
        t.reference_id, t.custom_payload, t.created_at, t.updated_at,
        s.step_name as current_step_name
       FROM inbox_tasks t
       LEFT JOIN inbox_task_steps s ON t.id = s.task_id AND t.current_step_no = s.step_no
       ${whereSql}
       ORDER BY 
         t.created_at DESC,
         t.updated_at DESC
       LIMIT 100`,
      queryParams
    )

    const parsedTasks = tasks.map((t: any) => ({
      ...t,
      custom_payload:
        typeof t.custom_payload === 'string'
          ? JSON.parse(t.custom_payload)
          : t.custom_payload,
    }))

    const inboxBadgeRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t 
       WHERE t.status IN ('PENDING', 'IN_PROGRESS') 
       AND (
         t.current_assignee = ? 
         OR (t.\`current_role\` IS NOT NULL AND (
           t.\`current_role\` = ? 
           OR t.\`current_role\` = ?
           OR (t.\`current_role\` = 'ผู้อำนวยการโรงพยาบาลเถิน' AND ? LIKE '%ผู้อำนวยการ%')
           OR (t.\`current_role\` = 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' AND (? LIKE '%ดิจิทัลทางการแพทย์%' OR ? LIKE '%หัวหน้ากลุ่มงานดิจิทัล%'))
           OR (t.\`current_role\` = 'หัวหน้าเจ้าหน้าที่พัสดุ' AND (? LIKE '%หัวหน้าเจ้าหน้าที่พัสดุ%' OR ? LIKE '%หัวหน้าพัสดุ%'))
           OR (t.\`current_role\` = 'เจ้าหน้าที่พัสดุ' AND ? LIKE '%พัสดุ%')
           OR (t.\`current_role\` = 'นักประชาสัมพันธ์' AND (? LIKE '%ประชาสัมพันธ์%' OR ? LIKE '%นักประชาสัมพันธ์%'))
         ))
         OR EXISTS (
           SELECT 1 FROM repair_details rd 
           WHERE rd.task_id = t.id 
           AND JSON_CONTAINS(rd.co_workers, JSON_OBJECT('id', ?))
         )
       )`,
      [
        memberId,
        userPosition,
        userRole,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        userPosition,
        memberId,
      ]
    )
    const inboxCount = inboxBadgeRows[0]?.cnt || 0

    let deptCountSql = 'SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE 1=0'
    const deptCountParams: any[] = []
    const deptBadgeConditions: string[] = []
    if (currentMember.department && currentMember.department.trim()) {
      deptBadgeConditions.push('t.requester_dept = ?')
      deptCountParams.push(currentMember.department.trim())
    }
    if (canViewItRepairs) deptBadgeConditions.push("t.task_type = 'IT_REPAIR'")
    if (canViewGeneralRepairs)
      deptBadgeConditions.push("t.task_type = 'GENERAL_REPAIR'")
    if (canViewMedicalRepairs)
      deptBadgeConditions.push("t.task_type = 'MEDICAL_REPAIR'")
    if (canViewMediaRequests)
      deptBadgeConditions.push("t.task_type = 'MEDIA_REQUEST'")

    if (deptBadgeConditions.length > 0) {
      deptCountSql = `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE (${deptBadgeConditions.join(' OR ')})`
    }
    const deptBadgeRows = await queryMemberDb(deptCountSql, deptCountParams)
    const departmentCount = deptBadgeRows[0]?.cnt || 0

    const allPendingRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE t.status IN ('PENDING', 'IN_PROGRESS')`
    )
    const allPendingCount = allPendingRows[0]?.cnt || 0

    const approvedRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE t.status = 'APPROVED'`
    )
    const approvedCount = approvedRows[0]?.cnt || 0

    const myRequestsRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks t WHERE t.requester_id = ?`,
      [memberId]
    )
    const myRequestsCount = myRequestsRows[0]?.cnt || 0

    return {
      tasks: parsedTasks,
      inboxCount,
      departmentCount,
      canViewAll,
      userDepartment: currentMember.department || '',
      stats: {
        pendingCount: inboxCount,
        departmentCount,
        allPendingCount,
        approvedCount,
        myRequestsCount,
      },
    }
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
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]

    const {
      taskType,
      title,
      description,
      urgency = 'NORMAL',
      customPayload,
      steps,
    } = body

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

    if (typeof apiGateway.tasks?.createTask === 'function') {
      try {
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
        const isGatewaySuccess = Boolean(
          gwRes &&
            (gwRes as any).success !== false &&
            ((gwRes as any).success === true ||
              gwData?.taskId ||
              gwData?.taskNo)
        )

        if (isGatewaySuccess) {
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
            }).catch((e) =>
              logger.error(
                { err: e },
                'Telegram dispatch error on task creation'
              )
            )
          }

          return { taskId: createdTaskId, taskNo: createdTaskNo }
        }
      } catch {
        // Fallback to queryMemberDb
      }
    }

    await queryMemberDb(
      `INSERT INTO inbox_tasks 
       (\`id\`, \`task_no\`, \`task_type\`, \`title\`, \`description\`, \`urgency\`, \`requester_id\`, \`requester_name\`, \`requester_dept\`, \`status\`, \`current_step_no\`, \`current_assignee\`, \`current_role\`, \`custom_payload\`) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?)`,
      [
        taskId,
        taskNo,
        taskType,
        title.trim(),
        description || '',
        urgency,
        currentMember.id,
        currentMember.name || session.username,
        currentMember.department || null,
        initialAssignee,
        initialRole,
        customPayload ? JSON.stringify(customPayload) : null,
      ]
    )

    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i]
      const stepId = crypto.randomUUID()
      const stepStatus = i === 0 ? 'PENDING' : 'WAITING'

      await queryMemberDb(
        `INSERT INTO inbox_task_steps 
         (id, task_id, step_no, step_name, assignee_type, assigned_to_id, assigned_role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stepId,
          taskId,
          step.stepNo || i + 1,
          step.stepName,
          step.assigneeType || 'INDIVIDUAL',
          step.assignedToId || null,
          step.assignedRole || null,
          stepStatus,
        ]
      )
    }

    const auditId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'CREATE_TASK', ?, ?, ?)`,
      [
        auditId,
        taskId,
        currentMember.id,
        currentMember.name || session.username,
        JSON.stringify({ taskNo, taskType, title, initialAssignee }),
      ]
    )

    if (initialAssignee) {
      notifyAssigneeOnTelegram({
        taskId,
        taskNo,
        taskType,
        title,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department,
        assigneeId: initialAssignee,
        stepName: firstStep.stepName,
      }).catch((e) =>
        logger.error({ err: e }, 'Telegram dispatch error on task creation')
      )
    }

    return { taskId, taskNo }
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
    if (typeof (apiGateway.app as any).getMemberAuthContext === 'function') {
      try {
        const authCtx = await apiGateway.app.getMemberAuthContext(
          session.username,
          session.email || ''
        )
        if (authCtx && authCtx.member) {
          currentMember = authCtx.member
        }
      } catch {
        // Fallback to queryMemberDb
      }
    }

    if (!currentMember) {
      const members = await queryMemberDb(
        'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
        [session.username]
      )
      if (!members || members.length === 0) {
        throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
      }
      currentMember = members[0]
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

    if (
      !repairType ||
      !['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(repairType)
    ) {
      throw new TaskInboxApiError('กรุณาเลือกประเภทงานซ่อมที่ถูกต้อง', 400)
    }

    if (itemCategory === 'EQUIPMENT') {
      if (!equipmentNumber?.trim() && !equipmentName?.trim()) {
        throw new TaskInboxApiError(
          'กรุณาระบุเลขทะเบียนครุภัณฑ์ หรือชื่อครุภัณฑ์',
          400
        )
      }
    } else if (!nonEquipmentItem?.trim()) {
      throw new TaskInboxApiError(
        'กรุณาระบุชื่อรายการ/สิ่งของที่ชำรุดเสียหาย',
        400
      )
    }

    if (!locationFullName?.trim()) {
      throw new TaskInboxApiError('กรุณาระบุสถานที่ (ตึก/ชั้น/ห้อง)', 400)
    }

    if (!symptomDetail?.trim()) {
      throw new TaskInboxApiError('กรุณาระบุรายละเอียดหรืออาการเสีย', 400)
    }

    let techName: string | null = null
    const techId: number | null = assignedTechnicianId
      ? Number(assignedTechnicianId)
      : null

    if (techId) {
      const techRows = await queryMemberDb(
        'SELECT id, name FROM members WHERE id = ? LIMIT 1',
        [techId]
      )
      if (techRows.length > 0) {
        techName = techRows[0].name
      }
    }

    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo(repairType)

    const itemName =
      itemCategory === 'EQUIPMENT'
        ? equipmentName
          ? `${equipmentName} (${equipmentNumber || 'ไม่ระบุเลข'})`
          : `ครุภัณฑ์เลขที่ ${equipmentNumber}`
        : nonEquipmentItem

    const taskTitle = `แจ้งซ่อม: ${itemName}`

    let targetRole: string | null = null
    if (!techId) {
      if (repairType === 'IT_REPAIR') targetRole = 'นักวิชาการคอมพิวเตอร์'
      else if (repairType === 'GENERAL_REPAIR') targetRole = 'นายช่างเทคนิค'
      else if (repairType === 'MEDICAL_REPAIR')
        targetRole = 'นักวิทยาศาสตร์การแพทย์'
    }

    if (typeof apiGateway.tasks?.createTask === 'function') {
      try {
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
            equipmentNumber:
              itemCategory === 'EQUIPMENT'
                ? equipmentNumber?.trim() || null
                : null,
            equipmentName:
              itemCategory === 'EQUIPMENT'
                ? equipmentName?.trim() || null
                : null,
            nonEquipmentItem:
              itemCategory === 'NON_EQUIPMENT'
                ? nonEquipmentItem?.trim() || null
                : null,
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
        const isGatewaySuccess = Boolean(
          gwRes &&
            (gwRes as any).success !== false &&
            ((gwRes as any).success === true ||
              gwData?.taskId ||
              gwData?.taskNo)
        )

        if (isGatewaySuccess) {
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
            equipmentNumber:
              itemCategory === 'EQUIPMENT'
                ? equipmentNumber?.trim() || null
                : null,
            itemName,
            location: locationFullName,
            symptom: symptomDetail.trim(),
            urgency,
          }).catch((e) =>
            logger.error({ err: e }, 'Telegram assignee notification error')
          )

          if (techId !== currentMember.id) {
            notifyRepairCreatedRequesterOnTelegram({
              taskId: createdTaskId,
              taskNo: createdTaskNo,
              taskType: repairType,
              title: taskTitle,
              requesterId: currentMember.id,
              itemName,
              equipmentNumber:
                itemCategory === 'EQUIPMENT'
                  ? equipmentNumber?.trim() || null
                  : null,
              location: locationFullName,
              symptom: symptomDetail.trim(),
              urgency,
              assignedTechName: techName,
            }).catch((e) =>
              logger.error({ err: e }, 'Telegram requester notification error')
            )
          }

          return { taskId: createdTaskId, taskNo: createdTaskNo }
        }
      } catch {
        // Fallback to queryMemberDb
      }
    }

    await queryMemberDb(
      `INSERT INTO inbox_tasks 
       (\`id\`, \`task_no\`, \`task_type\`, \`title\`, \`description\`, \`urgency\`, \`requester_id\`, \`requester_name\`, \`requester_dept\`, \`status\`, \`current_step_no\`, \`current_assignee\`, \`current_role\`, \`custom_payload\`, \`created_at\`, \`updated_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?, ?, NOW(), NOW())`,
      [
        taskId,
        taskNo,
        repairType,
        taskTitle,
        symptomDetail.trim(),
        urgency,
        currentMember.id,
        currentMember.name || session.username,
        currentMember.department || 'โรงพยาบาลเถิน',
        techId,
        targetRole,
        JSON.stringify({
          itemCategory,
          itemName,
          locationFullName,
        }),
      ]
    )

    const stepId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO inbox_task_steps 
       (id, task_id, step_no, step_name, assignee_type, assigned_to_id, assigned_role, status)
       VALUES (?, ?, 1, 'ช่างรับงานและดำเนินการซ่อม', ?, ?, ?, 'PENDING')`,
      [
        stepId,
        taskId,
        techId ? 'INDIVIDUAL' : 'ROLE',
        techId,
        targetRole,
      ]
    )

    const repairDetailId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO repair_details 
       (id, task_id, repair_type, item_category, equipment_number, equipment_name, non_equipment_item, location_id, location_full_name, symptom_detail, assigned_technician_id, assigned_technician_name, co_workers, repair_nature, repair_status, is_external_repair, cost_type, photos, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'NORMAL', 'WAITING', 0, 'NO_COST', ?, NOW(), NOW())`,
      [
        repairDetailId,
        taskId,
        repairType,
        itemCategory,
        equipmentNumber?.trim() || null,
        equipmentName?.trim() || null,
        nonEquipmentItem?.trim() || null,
        locationId || null,
        locationFullName.trim(),
        symptomDetail.trim(),
        techId,
        techName,
        JSON.stringify(photos || []),
      ]
    )

    const auditId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'CREATE_REPAIR_TICKET', ?, ?, ?)`,
      [
        auditId,
        taskId,
        currentMember.id,
        currentMember.name || session.username,
        JSON.stringify({
          taskNo,
          repairType,
          itemName,
          location: locationFullName,
        }),
      ]
    )

    notifyAssigneeOnTelegram({
      taskId,
      taskNo,
      taskType: repairType,
      title: taskTitle,
      requesterName: currentMember.name || session.username,
      requesterDept: currentMember.department,
      assigneeId: techId,
      targetRole,
      stepName: 'มีงานแจ้งซ่อมใหม่มอบหมายถึงคุณ',
      equipmentNumber:
        itemCategory === 'EQUIPMENT' ? equipmentNumber?.trim() || null : null,
      itemName,
      location: locationFullName,
      symptom: symptomDetail.trim(),
      urgency,
    }).catch((e) =>
      logger.error({ err: e }, 'Telegram assignee notification error')
    )

    if (techId !== currentMember.id) {
      notifyRepairCreatedRequesterOnTelegram({
        taskId,
        taskNo,
        taskType: repairType,
        title: taskTitle,
        requesterId: currentMember.id,
        itemName,
        equipmentNumber:
          itemCategory === 'EQUIPMENT' ? equipmentNumber?.trim() || null : null,
        location: locationFullName,
        symptom: symptomDetail.trim(),
        urgency,
        assignedTechName: techName,
      }).catch((e) =>
        logger.error({ err: e }, 'Telegram requester notification error')
      )
    }

    return { taskId, taskNo }
  },

  async listMediaRequests(params: {
    username: string
    status: string | null
    search: string | undefined
    limit: number
  }) {
    const { username, status, search, limit } = params

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]

    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE position_name = ?',
      [currentMember.position || '']
    )
    const hasPerm = (key: string) =>
      permRows.some((p: any) => p.permission_key === key)
    const userPos = currentMember.position || ''
    const isPrStaff =
      userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')
    const canViewAll =
      currentMember.role === 'admin' ||
      hasPerm('manage_inbox') ||
      hasPerm('view_all_work') ||
      hasPerm('manage_media_requests') ||
      isPrStaff ||
      userPos.includes('ดิจิทัลทางการแพทย์')

    const whereClauses: string[] = ["t.task_type = 'MEDIA_REQUEST'"]
    const queryParams: any[] = []

    if (!canViewAll) {
      whereClauses.push('t.requester_id = ?')
      queryParams.push(currentMember.id)
    }

    if (status) {
      whereClauses.push('t.status = ?')
      queryParams.push(status)
    }

    if (search) {
      whereClauses.push(
        '(t.task_no LIKE ? OR t.title LIKE ? OR t.requester_name LIKE ?)'
      )
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const tasks = await queryMemberDb(
      `SELECT 
        t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
        t.requester_id, t.requester_name, t.requester_dept,
        t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
        t.custom_payload, t.created_at, t.updated_at,
        s.step_name as current_step_name
       FROM inbox_tasks t
       LEFT JOIN inbox_task_steps s ON t.id = s.task_id AND t.current_step_no = s.step_no
       ${whereSql}
       ORDER BY 
         CASE WHEN t.urgency = 'VERY_URGENT' THEN 1 WHEN t.urgency = 'URGENT' THEN 2 ELSE 3 END ASC,
         t.created_at DESC
       LIMIT ?`,
      [...queryParams, limit]
    )

    return {
      tasks,
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
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      throw new TaskInboxApiError('ไม่พบข้อมูลสมาชิก', 404)
    }
    const currentMember = members[0]

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

    await queryMemberDb(
      `INSERT INTO inbox_tasks 
       (\`id\`, \`task_no\`, \`task_type\`, \`title\`, \`description\`, \`urgency\`, \`requester_id\`, \`requester_name\`, \`requester_dept\`, \`status\`, \`current_step_no\`, \`current_assignee\`, \`current_role\`, \`custom_payload\`) 
       VALUES (?, ?, 'MEDIA_REQUEST', ?, ?, ?, ?, ?, ?, 'PENDING', 1, NULL, ?, ?)`,
      [
        taskId,
        taskNo,
        data.title.trim(),
        data.description.trim(),
        data.urgency,
        currentMember.id,
        currentMember.name || session.username,
        currentMember.department || null,
        initialRole,
        JSON.stringify(customPayload),
      ]
    )

    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i]
      const stepId = crypto.randomUUID()
      const stepStatus = i === 0 ? 'PENDING' : 'WAITING'

      await queryMemberDb(
        `INSERT INTO inbox_task_steps 
         (id, task_id, step_no, step_name, assignee_type, assigned_to_id, assigned_role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stepId,
          taskId,
          step.stepNo || i + 1,
          step.stepName,
          step.assigneeType || 'ROLE',
          step.assignedToId || null,
          step.assignedRole || null,
          stepStatus,
        ]
      )
    }

    const auditId = crypto.randomUUID()
    await queryMemberDb(
      `INSERT INTO inbox_task_audit_logs 
       (id, task_id, action, performed_by, performer_name, details)
       VALUES (?, ?, 'CREATE_MEDIA_REQUEST', ?, ?, ?)`,
      [
        auditId,
        taskId,
        currentMember.id,
        currentMember.name || session.username,
        JSON.stringify({
          taskNo,
          title: data.title,
          costType: data.costType,
          totalSteps: workflowSteps.length,
          workTypesCount: data.workTypes.length,
        }),
      ]
    )

    const workTypesSummary = data.workTypes
      .map((w) => (w.customDetail ? `${w.label} (${w.customDetail})` : w.label))
      .join(', ')

    notifyAssigneeOnTelegram({
      taskId,
      taskNo,
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
    }).catch((e) =>
      logger.error({ err: e }, 'Telegram dispatch error on media request')
    )

    notifyMediaRequestCreatedRequesterOnTelegram({
      taskId,
      taskNo,
      title: data.title,
      requesterId: currentMember.id,
      urgency: data.urgency,
      deliveryDate: data.deliveryDate,
      costType: data.costType,
      workTypesSummary,
    }).catch((e) =>
      logger.error(
        { err: e },
        'Telegram requester confirmation error on media request'
      )
    )

    return { taskId, taskNo }
  },

  async getInitialMediaRequestsForMember(member: {
    id: number
    position?: string | null
    isAdmin?: boolean
    can: (perm: string) => boolean
  }) {
    const userPos = member.position || ''
    const isPrStaff =
      userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')
    const canViewAll = Boolean(
      member.isAdmin ||
        member.can('manage_inbox') ||
        member.can('manage_media_requests') ||
        member.can('view_all_work') ||
        isPrStaff ||
        userPos.includes('ดิจิทัลทางการแพทย์')
    )

    const whereClauses: string[] = ["t.task_type = 'MEDIA_REQUEST'"]
    const queryParams: unknown[] = []

    if (!canViewAll) {
      whereClauses.push('t.requester_id = ?')
      queryParams.push(member.id)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const tasks = await queryMemberDb(
      `SELECT 
        t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
        t.requester_id, t.requester_name, t.requester_dept,
        t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
        t.custom_payload, t.created_at, t.updated_at,
        s.step_name as current_step_name
       FROM inbox_tasks t
       LEFT JOIN inbox_task_steps s ON t.id = s.task_id AND t.current_step_no = s.step_no
       ${whereSql}
       ORDER BY 
         CASE WHEN t.urgency = 'VERY_URGENT' THEN 1 WHEN t.urgency = 'URGENT' THEN 2 ELSE 3 END ASC,
         t.created_at DESC
       LIMIT 50`,
      queryParams
    )

    const parsedTasks = tasks.map((t: any) => ({
      ...t,
      custom_payload:
        typeof t.custom_payload === 'string'
          ? JSON.parse(t.custom_payload)
          : t.custom_payload,
    }))

    return { parsedTasks, canViewAll }
  },

  async getNewRepairFormPreloadData(username: string) {
    const [members, initialLocations] = await Promise.all([
      queryMemberDb(
        'SELECT id, username, name, department, position, email FROM members WHERE username = ? LIMIT 1',
        [username]
      ),
      queryMemberDb(
        `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name 
         FROM hospital_locations 
         WHERE is_active = 1 
         ORDER BY building_name ASC, floor_id ASC, room_name ASC`
      ),
    ])

    const currentMember = members[0] || {
      id: 0,
      username,
      name: username,
      department: '',
      position: '',
    }

    return { currentMember, initialLocations }
  },
}
