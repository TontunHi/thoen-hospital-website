/**
 * Task Permission Resolver (Domain Module)
 * Single source of truth for resolving permissions, viewability, editability,
 * and approval rights across hospital inbox tasks.
 */

export interface MemberLike {
  id?: number | null
  username?: string | null
  name?: string | null
  role?: string | null
  position?: string | null
  department?: string | null
  permissions?: string[] | Set<string>
  isAdmin?: boolean
}

export interface TaskLike {
  id?: string
  task_no?: string
  task_type: string
  requester_id?: number | null
  requester_dept?: string | null
  current_assignee?: number | null
  current_role?: string | null
  status: string
}

export interface RepairDetailLike {
  assigned_technician_id?: number | null
  co_workers?: Array<{ id: number; name?: string; position?: string }> | null
  repair_status?: string | null
}

export interface TaskStepLike {
  step_no?: number
  assigned_to_id?: number | null
  action_by?: number | null
  assigned_role?: string | null
  status?: string
}

export interface TaskPermissionsResult {
  canView: boolean
  canEdit: boolean
  canApprove: boolean
  canTakeJob: boolean
  canCancel: boolean
  canHold: boolean
  canResume: boolean
  isRequester: boolean
  isCurrentAssignee: boolean
  isTechnicianAssigned: boolean
  isCoWorker: boolean
  isAdmin: boolean
  isITStaff: boolean
  isTechStaff: boolean
  isPrStaff: boolean
}

export function resolveTaskPermissions(
  member: MemberLike | null | undefined,
  task: TaskLike | null | undefined,
  options?: {
    repairDetail?: RepairDetailLike | null
    steps?: TaskStepLike[] | null
  }
): TaskPermissionsResult {
  if (!member || !task) {
    return {
      canView: false,
      canEdit: false,
      canApprove: false,
      canTakeJob: false,
      canCancel: false,
      canHold: false,
      canResume: false,
      isRequester: false,
      isCurrentAssignee: false,
      isTechnicianAssigned: false,
      isCoWorker: false,
      isAdmin: false,
      isITStaff: false,
      isTechStaff: false,
      isPrStaff: false,
    }
  }

  const userPos = (member.position || '').trim()
  const userRole = (member.role || 'member').trim()
  const userDept = (member.department || '').trim()
  const userId = member.id

  const permSet: Set<string> = member.permissions instanceof Set
    ? member.permissions
    : new Set(Array.isArray(member.permissions) ? member.permissions : [])

  const hasPerm = (key: string): boolean => {
    if (userRole === 'admin' || Boolean(member.isAdmin)) return true
    return permSet.has(key)
  }

  const isAdmin = userRole === 'admin' || Boolean(member.isAdmin) || hasPerm('view_all_work') || hasPerm('manage_inbox')

  // Specialized position heuristics
  const isITStaff = userPos.includes('คอมพิวเตอร์') || userPos.includes('ดิจิทัล')
  const isTechStaff = userPos.includes('ช่าง')
  const isPrStaff = userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')

  const isRequester = Boolean(userId && task.requester_id === userId)
  const isDirectAssignee = Boolean(userId && task.current_assignee === userId)

  const isRoleMatch = Boolean(
    task.current_role &&
    (task.current_role === userPos ||
     task.current_role === userRole ||
     (task.current_role === 'ผู้อำนวยการโรงพยาบาลเถิน' && userPos.includes('ผู้อำนวยการ')) ||
     (task.current_role === 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' && (userPos.includes('ดิจิทัลทางการแพทย์') || userPos.includes('หัวหน้ากลุ่มงานดิจิทัล'))) ||
     (task.current_role === 'หัวหน้าเจ้าหน้าที่พัสดุ' && (userPos.includes('หัวหน้าเจ้าหน้าที่พัสดุ') || userPos.includes('หัวหน้าพัสดุ'))) ||
     (task.current_role === 'เจ้าหน้าที่พัสดุ' && userPos.includes('พัสดุ')) ||
     (task.current_role === 'นักประชาสัมพันธ์' && (userPos.includes('ประชาสัมพันธ์') || userPos.includes('นักประชาสัมพันธ์'))))
  )

  const isCurrentAssignee = isDirectAssignee || isRoleMatch || hasPerm('manage_inbox')

  // Repair relations
  const repairDetail = options?.repairDetail
  const isTechnicianAssigned = Boolean(userId && repairDetail?.assigned_technician_id === userId)
  const isCoWorker = Boolean(userId && repairDetail?.co_workers?.some((cw) => cw.id === userId))

  // Steps verification
  const steps = options?.steps || []
  const isStepSigner = Boolean(userId && steps.some((s) => s.assigned_to_id === userId || s.action_by === userId))

  const isRepairTask = ['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type)
  const isMediaTask = task.task_type === 'MEDIA_REQUEST'

  // Viewability rules
  const canViewSpecificType =
    (task.task_type === 'IT_REPAIR' && (hasPerm('view_it_repairs') || hasPerm('manage_repairs') || isITStaff)) ||
    (task.task_type === 'GENERAL_REPAIR' && (hasPerm('view_general_repairs') || hasPerm('manage_repairs') || isTechStaff)) ||
    (task.task_type === 'MEDICAL_REPAIR' && (hasPerm('view_medical_repairs') || hasPerm('manage_repairs') || isTechStaff)) ||
    (task.task_type === 'MEDIA_REQUEST' && (hasPerm('view_media_requests') || hasPerm('manage_media_requests') || isPrStaff || isITStaff)) ||
    (hasPerm('view_department_tasks') && Boolean(userDept && task.requester_dept === userDept))

  const canView = Boolean(
    isAdmin ||
    isRequester ||
    isCurrentAssignee ||
    isStepSigner ||
    isTechnicianAssigned ||
    isCoWorker ||
    canViewSpecificType
  )

  // Editability rules
  const canEdit = Boolean(
    isAdmin ||
    hasPerm('manage_inbox') ||
    hasPerm('view_all_work') ||
    (isRepairTask && (
      hasPerm('manage_repairs') ||
      (task.task_type === 'IT_REPAIR' && isITStaff) ||
      (task.task_type === 'GENERAL_REPAIR' && isTechStaff) ||
      hasPerm('view_it_repairs') ||
      hasPerm('view_general_repairs') ||
      hasPerm('view_medical_repairs') ||
      isTechnicianAssigned ||
      isCoWorker
    )) ||
    (isMediaTask && (
      hasPerm('manage_media_requests') ||
      hasPerm('view_media_requests') ||
      isPrStaff ||
      isITStaff
    )) ||
    (isRequester && ['PENDING', 'SENT_BACK', 'IN_PROGRESS', 'ON_HOLD'].includes(task.status)) ||
    isCurrentAssignee
  )

  const canApprove = Boolean(
    isCurrentAssignee && (task.status === 'PENDING' || task.status === 'IN_PROGRESS')
  )

  const canHold = Boolean(
    (task.status === 'PENDING' || task.status === 'IN_PROGRESS') &&
    (isAdmin || isCurrentAssignee || (isMediaTask && isPrStaff) || hasPerm('manage_inbox'))
  )

  const canResume = Boolean(
    task.status === 'ON_HOLD' &&
    (isAdmin || isCurrentAssignee || (isMediaTask && isPrStaff) || hasPerm('manage_inbox'))
  )

  const canTakeJob = Boolean(
    isRepairTask && (
      isAdmin ||
      hasPerm('manage_repairs') ||
      (task.task_type === 'IT_REPAIR' && isITStaff) ||
      (task.task_type === 'GENERAL_REPAIR' && isTechStaff) ||
      (task.task_type === 'MEDICAL_REPAIR' && isTechStaff) ||
      isTechnicianAssigned ||
      isCoWorker
    )
  )

  const canCancel = Boolean(
    isAdmin ||
    canEdit ||
    (isRequester && task.status === 'PENDING')
  )

  return {
    canView,
    canEdit,
    canApprove,
    canTakeJob,
    canCancel,
    canHold,
    canResume,
    isRequester,
    isCurrentAssignee,
    isTechnicianAssigned,
    isCoWorker,
    isAdmin,
    isITStaff,
    isTechStaff,
    isPrStaff,
  }
}
