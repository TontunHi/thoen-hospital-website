import crypto from 'crypto'
import { queryMemberDb } from '@/lib/memberDb'
import { resolveTaskPermissions, MemberLike } from '@/lib/taskPermissionResolver'
import { getMediaRequestWorkflowSteps, MemberDbExecutor } from './taskDefinitionsAndRepairAction'

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

/**
 * Domain Service: Update task details by authorized manager/technician/requester
 * Handles dynamic workflow transformations (Step 4 for Media Request),
 * repair details updates, and writes structured field-diff audit logs.
 */
export async function updateTaskByManager(
  params: UpdateTaskManagerParams,
  executor: MemberDbExecutor = queryMemberDb
): Promise<UpdateTaskManagerResult> {
  const { taskId, performer, updates } = params

  // 1. Fetch Task
  const tasks = await executor('SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1', [taskId])
  if (!tasks || tasks.length === 0) {
    return { success: false, error: 'ไม่พบข้อมูลงานนี้', statusCode: 404 }
  }
  const task = tasks[0]

  // 2. Fetch Repair Detail (if any)
  const repairRows = await executor('SELECT * FROM repair_details WHERE task_id = ? LIMIT 1', [taskId])
  let repairDetail = null
  if (repairRows && repairRows.length > 0) {
    const row = repairRows[0]
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

  // 3. Fetch Steps
  const steps = await executor(
    'SELECT * FROM inbox_task_steps WHERE task_id = ? ORDER BY step_no ASC',
    [taskId]
  )

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
          const targetSteps = getMediaRequestWorkflowSteps(true)
          for (const s of targetSteps) {
            if (s.stepNo > 2) {
              const stepRows = await executor(
                'SELECT id, status FROM inbox_task_steps WHERE task_id = ? AND step_no = ? LIMIT 1',
                [taskId, s.stepNo]
              )
              if (!Array.isArray(stepRows) || stepRows.length === 0) {
                const stepId = crypto.randomUUID()
                await executor(
                  `INSERT INTO inbox_task_steps 
                   (id, task_id, step_no, step_name, assignee_type, assigned_role, status)
                   VALUES (?, ?, ?, ?, 'ROLE', ?, 'WAITING')`,
                  [stepId, taskId, s.stepNo, s.stepName, s.assignedRole]
                )
              } else if (stepRows[0] && (stepRows[0].status === 'WAITING' || stepRows[0].status === 'PENDING')) {
                await executor(
                  `UPDATE inbox_task_steps 
                   SET step_name = ?, assigned_role = ?
                   WHERE id = ?`,
                  [s.stepName, s.assignedRole, stepRows[0].id]
                )
              }
            }
          }
          await executor(
            `DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no > ? AND status IN ('PENDING', 'WAITING')`,
            [taskId, targetSteps.length]
          )
        } else if (updates.costType === 'NO_COST') {
          const targetSteps = getMediaRequestWorkflowSteps(false)
          await executor(
            `DELETE FROM inbox_task_steps WHERE task_id = ? AND step_no > 4 AND status IN ('PENDING', 'WAITING')`,
            [taskId]
          )
          for (const s of targetSteps) {
            if (s.stepNo > 2) {
              const stepRows = await executor(
                'SELECT id, status FROM inbox_task_steps WHERE task_id = ? AND step_no = ? LIMIT 1',
                [taskId, s.stepNo]
              )
              if (Array.isArray(stepRows) && stepRows.length > 0 && stepRows[0] && (stepRows[0].status === 'WAITING' || stepRows[0].status === 'PENDING')) {
                await executor(
                  `UPDATE inbox_task_steps 
                   SET step_name = ?, assigned_role = ?
                   WHERE id = ?`,
                  [s.stepName, s.assignedRole, stepRows[0].id]
                )
              }
            }
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

    await executor(
      `UPDATE repair_details SET 
        item_category = ?, 
        equipment_number = ?, 
        equipment_name = ?, 
        non_equipment_item = ?, 
        location_id = ?, 
        location_full_name = ?, 
        symptom_detail = ?, 
        updated_at = NOW() 
       WHERE task_id = ?`,
      [
        finalItemCat,
        finalEqNum?.trim() || null,
        finalEqName?.trim() || null,
        finalNonEq?.trim() || null,
        finalLocId || null,
        finalLocName?.trim() || 'โรงพยาบาลเถิน',
        finalSymptom?.trim() || '',
        taskId,
      ]
    )

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

  // Update inbox_tasks table if there are changes
  const updateSets: string[] = ['updated_at = NOW()']
  const updateParams: any[] = []

  if (updatedTaskFields.title) {
    updateSets.push('title = ?')
    updateParams.push(updatedTaskFields.title)
  }
  if (updatedTaskFields.description !== undefined) {
    updateSets.push('description = ?')
    updateParams.push(updatedTaskFields.description)
  }
  if (updatedTaskFields.urgency) {
    updateSets.push('urgency = ?')
    updateParams.push(updatedTaskFields.urgency)
  }
  if (updatedTaskFields.custom_payload) {
    updateSets.push('custom_payload = ?')
    updateParams.push(updatedTaskFields.custom_payload)
  }

  updateParams.push(taskId)
  await executor(
    `UPDATE inbox_tasks SET ${updateSets.join(', ')} WHERE id = ?`,
    updateParams
  )

  // Write structured field-diff Audit Log
  const auditId = crypto.randomUUID()
  await executor(
    `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
     VALUES (?, ?, 'MANAGER_EDIT_TASK', ?, ?, ?)`,
    [
      auditId,
      taskId,
      performer.id,
      performer.name || performer.username,
      JSON.stringify({
        diff,
        updatedFields: updates,
        taskType: task.task_type,
        editorRole: performer.position || performer.role,
      }),
    ]
  )

  return {
    success: true,
    message: 'แก้ไขข้อมูลคำขอเรียบร้อยแล้ว',
    diff,
  }
}
