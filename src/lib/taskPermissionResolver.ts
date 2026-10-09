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

  const isAdmin = userRole === 'admin' || Boolean(member.isAdmin)

  const hasPerm = (key: string): boolean => {
    if (isAdmin) return true
    return permSet.has(key)
  }

  // Role heuristics derived strictly from permissions and admin status
  const isITStaff = Boolean(hasPerm('take_repairs_it') || hasPerm('manage_repairs') || isAdmin)
  const isTechStaff = Boolean(hasPerm('take_repairs_general') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs') || isAdmin)
  const isPrStaff = Boolean(hasPerm('produce_media') || hasPerm('manage_media_requests') || isAdmin)

  const isRequester = Boolean(userId && task.requester_id === userId)
  const isDirectAssignee = Boolean(userId && task.current_assignee === userId)

  const isRoleMatch = Boolean(
    task.current_role &&
    (task.current_role === userPos || task.current_role === userRole)
  )

  const isCurrentAssignee = Boolean(
    isDirectAssignee ||
    isRoleMatch ||
    hasPerm('manage_inbox')
  )

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
  const canViewSpecificType = Boolean(
    (task.task_type === 'IT_REPAIR' && (hasPerm('view_it_repairs') || hasPerm('take_repairs_it') || hasPerm('manage_repairs'))) ||
    (task.task_type === 'GENERAL_REPAIR' && (hasPerm('view_general_repairs') || hasPerm('take_repairs_general') || hasPerm('manage_repairs'))) ||
    (task.task_type === 'MEDICAL_REPAIR' && (hasPerm('view_medical_repairs') || hasPerm('take_repairs_medical') || hasPerm('manage_repairs'))) ||
    (task.task_type === 'MEDIA_REQUEST' && (hasPerm('view_media_requests') || hasPerm('produce_media') || hasPerm('manage_media_requests'))) ||
    (hasPerm('view_department_tasks') && Boolean(userDept && task.requester_dept === userDept)) ||
    hasPerm('view_all_work')
  )

  const canView = Boolean(
    isAdmin ||
    isRequester ||
    isCurrentAssignee ||
    isStepSigner ||
    isTechnicianAssigned ||
    isCoWorker ||
    canViewSpecificType ||
    (isRepairTask && hasPerm('approve_repairs')) ||
    (isMediaTask && hasPerm('approve_media'))
  )

  // Editability rules
  const canEdit = Boolean(
    isAdmin ||
    hasPerm('manage_inbox') ||
    hasPerm('view_all_work') ||
    (isRepairTask && (
      hasPerm('manage_repairs') ||
      (task.task_type === 'IT_REPAIR' && hasPerm('take_repairs_it')) ||
      (task.task_type === 'GENERAL_REPAIR' && hasPerm('take_repairs_general')) ||
      (task.task_type === 'MEDICAL_REPAIR' && hasPerm('take_repairs_medical')) ||
      isTechnicianAssigned ||
      isCoWorker
    )) ||
    (isMediaTask && (
      hasPerm('manage_media_requests') ||
      hasPerm('produce_media')
    )) ||
    (isRequester && ['PENDING', 'SENT_BACK', 'IN_PROGRESS', 'ON_HOLD'].includes(task.status)) ||
    (isCurrentAssignee && !hasPerm('approve_repairs') && !hasPerm('approve_media'))
  )

  // Approval rules
  const canApprove = Boolean(
    (task.status === 'PENDING' || task.status === 'IN_PROGRESS') &&
    (
      isCurrentAssignee ||
      (isRepairTask && hasPerm('approve_repairs')) ||
      (isMediaTask && hasPerm('approve_media'))
    )
  )

  const canHold = Boolean(
    (task.status === 'PENDING' || task.status === 'IN_PROGRESS') &&
    (
      isAdmin ||
      isCurrentAssignee ||
      hasPerm('manage_inbox') ||
      (isRepairTask && hasPerm('manage_repairs')) ||
      (isMediaTask && (hasPerm('manage_media_requests') || isPrStaff))
    )
  )

  const canResume = Boolean(
    task.status === 'ON_HOLD' &&
    (
      isAdmin ||
      isCurrentAssignee ||
      hasPerm('manage_inbox') ||
      (isRepairTask && hasPerm('manage_repairs')) ||
      (isMediaTask && (hasPerm('manage_media_requests') || isPrStaff))
    )
  )

  // Job acceptance rules
  const canTakeJob = Boolean(
    (isRepairTask && (
      isAdmin ||
      hasPerm('manage_repairs') ||
      (task.task_type === 'IT_REPAIR' && hasPerm('take_repairs_it')) ||
      (task.task_type === 'GENERAL_REPAIR' && hasPerm('take_repairs_general')) ||
      (task.task_type === 'MEDICAL_REPAIR' && hasPerm('take_repairs_medical')) ||
      isTechnicianAssigned ||
      isCoWorker
    )) ||
    (isMediaTask && (
      isAdmin ||
      hasPerm('manage_media_requests') ||
      hasPerm('produce_media')
    ))
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
