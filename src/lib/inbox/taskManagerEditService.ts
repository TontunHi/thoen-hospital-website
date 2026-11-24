import { apiGateway } from '@/lib/apiGateway'
import { resolveTaskPermissions, MemberLike } from '@/lib/taskPermissionResolver'
import { getMediaRequestWorkflowSteps } from './taskDefinitionsAndRepairAction'

export interface UpdateTaskManagerPayload {
  title?: string
  description?: string
  urgency?: string
  // For Media Request:
  costType?: 'HAS_COST' | 'NO_COST'
  estimatedBudget?: string | number
  deliveryDate?: string
  workTypesSummary?: string
  workTypes?: Array<{ key: string; label: string; customDetail?: string | null }>
  channels?: Array<{ key: string; label: string; customDetail?: string | null }>
  phone?: string | null
  driveLink?: string | null
  attachments?: Array<{ fileName: string; filePath: string; fileType?: string | null; fileSize?: number | null }>
  quotations?: Array<{ fileName: string; filePath: string; fileType?: string | null; fileSize?: number | null }>
  mediaDetails?: string
  objectives?: string
  // For Repair:
  itemCategory?: 'EQUIPMENT' | 'NON_EQUIPMENT'
  equipmentNumber?: string
  equipmentName?: string
  nonEquipmentItem?: string
  locationId?: number | null
  locationFullName?: string
  symptomDetail?: string
}

export interface UpdateTaskManagerParams {
  taskId: string
  performer: MemberLike
  updates: UpdateTaskManagerPayload
}

export interface UpdateTaskManagerResult {
  success: boolean
  message?: string
  error?: string
  statusCode?: number
  diff?: Record<string, { from: any; to: any }>
}

export interface TaskManagerEditGateway {
  getInboxTaskBundleV2: typeof apiGateway.app.getInboxTaskBundleV2
  submitManagerTaskEditV2: typeof apiGateway.app.submitManagerTaskEditV2
}

/**
 * Domain Service: Update task details by authorized manager/technician/requester
 * Handles dynamic workflow transformations (Step 4 for Media Request),
 * repair details updates, and writes structured field-diff audit logs via Gateway Named Endpoints.
 */
export async function updateTaskByManager(
  params: UpdateTaskManagerParams,
  gateway: TaskManagerEditGateway = apiGateway.app
): Promise<UpdateTaskManagerResult> {
  const { taskId, performer, updates } = params

  // 1-3. Fetch Task, Repair Detail, and Steps atomically via Gateway
  const bundle = await gateway.getInboxTaskBundleV2(taskId)
  const task: any = bundle?.task
  if (!task) {
    return { success: false, error: 'ไม่พบข้อมูลงานนี้', statusCode: 404 }
  }

  let repairDetail: any = null
  if (bundle?.repairDetail) {
    const row: any = bundle.repairDetail
    let photos = []
    let coWorkers = []
    try {
      photos = row.photos ? (typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos) : []
    } catch {}
    try {
      coWorkers = row.co_workers ? (typeof row.co_workers === 'string' ? JSON.parse(row.co_workers) : row.co_workers) : []
    } catch {}
    repairDetail = {
      ...row,
      photos,
      co_workers: coWorkers,
    }
  }

  const steps: any[] = bundle?.steps || []

  // 4. Permission Check via Domain Resolver
  const permissions = resolveTaskPermissions(performer, task, { repairDetail, steps })
  if (!permissions.canEdit) {
    return { success: false, error: 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลคำขอนี้', statusCode: 403 }
  }

  const isMediaTask = task.task_type === 'MEDIA_REQUEST'
  const isRepairTask = ['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type)

  let customPayload: Record<string, any> = {}
  try {
    customPayload = task.custom_payload ? JSON.parse(task.custom_payload) : {}
  } catch {}

  const diff: Record<string, { from: any; to: any }> = {}
  const updatedTaskFields: Record<string, any> = {}
  let stepSync: {
    mode: 'HAS_COST' | 'NO_COST'
    targetSteps: Array<{ stepNo: number; stepName: string; assignedRole: string }>
  } | null = null
  let repairUpdates: Record<string, unknown> | null = null

  // Basic task field diff & updates
  if (updates.title !== undefined && updates.title.trim() && updates.title.trim() !== task.title) {
    diff.title = { from: task.title, to: updates.title.trim() }
    updatedTaskFields.title = updates.title.trim()
  }
  if (updates.description !== undefined && updates.description.trim() !== (task.description || '').trim()) {
    diff.description = { from: task.description, to: updates.description.trim() }
    updatedTaskFields.description = updates.description.trim()
  }
  if (updates.urgency !== undefined && updates.urgency !== task.urgency) {
    diff.urgency = { from: task.urgency, to: updates.urgency }
    updatedTaskFields.urgency = updates.urgency
  }

  // Media Request Handling
  if (isMediaTask) {
    if (updates.costType !== undefined) {
      const oldCostType = customPayload.costType || 'NO_COST'
      if (oldCostType !== updates.costType) {
        diff.costType = { from: oldCostType, to: updates.costType }
        customPayload.costType = updates.costType

        if (updates.costType === 'HAS_COST') {
          stepSync = {
            mode: 'HAS_COST',
            targetSteps: getMediaRequestWorkflowSteps(true).map((s) => ({
              stepNo: s.stepNo,
              stepName: s.stepName,
              assignedRole: s.assignedRole || '',
            })),
          }
        } else if (updates.costType === 'NO_COST') {
          stepSync = {
            mode: 'NO_COST',
            targetSteps: getMediaRequestWorkflowSteps(false).map((s) => ({
              stepNo: s.stepNo,
              stepName: s.stepName,
              assignedRole: s.assignedRole || '',
            })),
          }
        }
      }
    }

    if (updates.estimatedBudget !== undefined && String(updates.estimatedBudget) !== String(customPayload.estimatedBudget ?? '')) {
      diff.estimatedBudget = { from: customPayload.estimatedBudget, to: updates.estimatedBudget }
      customPayload.estimatedBudget = updates.estimatedBudget
    }
    if (updates.deliveryDate !== undefined && updates.deliveryDate !== (customPayload.deliveryDate ?? '')) {
      let normDelivery = updates.deliveryDate
      if (normDelivery) {
        const parts = normDelivery.split('-')
        if (parts.length === 3) {
          let y = parseInt(parts[0], 10)
          if (y > 2400) y -= 543
          normDelivery = `${y}-${parts[1]}-${parts[2]}`
        }
      }
      diff.deliveryDate = { from: customPayload.deliveryDate, to: normDelivery }
      customPayload.deliveryDate = normDelivery
    }
    if (updates.workTypesSummary !== undefined && updates.workTypesSummary !== (customPayload.workTypesSummary ?? '')) {
      diff.workTypesSummary = { from: customPayload.workTypesSummary, to: updates.workTypesSummary }
      customPayload.workTypesSummary = updates.workTypesSummary
    }
    if (updates.mediaDetails !== undefined && updates.mediaDetails !== (customPayload.details ?? '')) {
      diff.mediaDetails = { from: customPayload.details, to: updates.mediaDetails }
      customPayload.details = updates.mediaDetails
    }
    if (updates.objectives !== undefined && updates.objectives !== (customPayload.objectives ?? '')) {
      diff.objectives = { from: customPayload.objectives, to: updates.objectives }
      customPayload.objectives = updates.objectives
    }
    if (updates.workTypes !== undefined) {
      diff.workTypes = { from: customPayload.workTypes, to: updates.workTypes }
      customPayload.workTypes = updates.workTypes
      customPayload.workTypesSummary = updates.workTypes
        .map((w: any) => (w.customDetail ? `${w.label} (${w.customDetail})` : w.label))
        .join(', ')
    }
    if (updates.channels !== undefined) {
      diff.channels = { from: customPayload.channels, to: updates.channels }
      customPayload.channels = updates.channels
    }
    if (updates.phone !== undefined && (updates.phone || null) !== (customPayload.phone ?? null)) {
      diff.phone = { from: customPayload.phone, to: updates.phone }
      customPayload.phone = updates.phone ? updates.phone.trim() : null
    }
    if (updates.driveLink !== undefined && (updates.driveLink || null) !== (customPayload.driveLink ?? null)) {
      diff.driveLink = { from: customPayload.driveLink, to: updates.driveLink }
      customPayload.driveLink = updates.driveLink ? updates.driveLink.trim() : null
    }
    if (updates.attachments !== undefined) {
      diff.attachments = { from: customPayload.attachments, to: updates.attachments }
      customPayload.attachments = updates.attachments
    }
    if (updates.quotations !== undefined) {
      diff.quotations = { from: customPayload.quotations, to: updates.quotations }
      customPayload.quotations = updates.quotations
    }

    updatedTaskFields.custom_payload = JSON.stringify(customPayload)
  }

  // Repair Task Handling
  if (isRepairTask && repairDetail) {
    const finalItemCat = updates.itemCategory || repairDetail.item_category || 'EQUIPMENT'
    const finalEqNum = updates.equipmentNumber !== undefined ? updates.equipmentNumber : repairDetail.equipment_number
    const finalEqName = updates.equipmentName !== undefined ? updates.equipmentName : repairDetail.equipment_name
    const finalNonEq = updates.nonEquipmentItem !== undefined ? updates.nonEquipmentItem : repairDetail.non_equipment_item
    const finalLocId = updates.locationId !== undefined ? updates.locationId : repairDetail.location_id
    const finalLocName = updates.locationFullName !== undefined ? updates.locationFullName : repairDetail.location_full_name
    const finalSymptom = updates.symptomDetail !== undefined ? updates.symptomDetail : repairDetail.symptom_detail

    if (updates.itemCategory !== undefined && updates.itemCategory !== repairDetail.item_category) {
      diff.itemCategory = { from: repairDetail.item_category, to: updates.itemCategory }
    }
    if (updates.equipmentNumber !== undefined && updates.equipmentNumber !== (repairDetail.equipment_number || '')) {
      diff.equipmentNumber = { from: repairDetail.equipment_number, to: updates.equipmentNumber }
    }
    if (updates.equipmentName !== undefined && updates.equipmentName !== (repairDetail.equipment_name || '')) {
      diff.equipmentName = { from: repairDetail.equipment_name, to: updates.equipmentName }
    }
    if (updates.nonEquipmentItem !== undefined && updates.nonEquipmentItem !== (repairDetail.non_equipment_item || '')) {
      diff.nonEquipmentItem = { from: repairDetail.non_equipment_item, to: updates.nonEquipmentItem }
    }
    if (updates.locationFullName !== undefined && updates.locationFullName !== (repairDetail.location_full_name || '')) {
      diff.locationFullName = { from: repairDetail.location_full_name, to: updates.locationFullName }
    }
    if (updates.symptomDetail !== undefined && updates.symptomDetail !== (repairDetail.symptom_detail || '')) {
      diff.symptomDetail = { from: repairDetail.symptom_detail, to: updates.symptomDetail }
    }

    repairUpdates = {
      itemCategory: finalItemCat,
      equipmentNumber: finalEqNum?.trim() || null,
      equipmentName: finalEqName?.trim() || null,
      nonEquipmentItem: finalNonEq?.trim() || null,
      locationId: finalLocId || null,
      locationFullName: finalLocName?.trim() || 'โรงพยาบาลเถิน',
      symptomDetail: finalSymptom?.trim() || '',
    }

    const itemName = finalItemCat === 'EQUIPMENT'
      ? (finalEqName ? `${finalEqName} (${finalEqNum || 'ไม่ระบุเลข'})` : `ครุภัณฑ์เลขที่ ${finalEqNum}`)
      : finalNonEq

    if (itemName && !updates.title) {
      updatedTaskFields.title = `แจ้งซ่อม: ${itemName}`
    }
    if (finalSymptom && updates.description === undefined) {
      updatedTaskFields.description = finalSymptom.trim()
    }

    customPayload.itemCategory = finalItemCat
    customPayload.itemName = itemName
    customPayload.locationFullName = finalLocName
    updatedTaskFields.custom_payload = JSON.stringify(customPayload)
  }

  // Persist task updates, step sync, repair details & audit log in a single Gateway transaction
  await gateway.submitManagerTaskEditV2(taskId, {
    taskUpdates: updatedTaskFields,
    repairUpdates,
    stepSync,
    auditEntry: {
      performedBy: performer.id ?? 0,
      performerName: performer.name || performer.username || 'unknown',
      details: {
        diff,
        updatedFields: updates,
        taskType: task.task_type,
        editorRole: performer.position || performer.role,
      },
    },
  })

  return {
    success: true,
    message: 'แก้ไขข้อมูลคำขอเรียบร้อยแล้ว',
    diff,
  }
}
