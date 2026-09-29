import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { generateTaskNo, notifyAssigneeOnTelegram } from '@/lib/taskInboxService'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // 1. Fetch current member info
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const body = await request.json()
    const {
      repairType, // 'IT_REPAIR' | 'GENERAL_REPAIR' | 'MEDICAL_REPAIR'
      itemCategory, // 'EQUIPMENT' | 'NON_EQUIPMENT'
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

    // 2. Validate essential fields
    if (!repairType || !['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(repairType)) {
      return NextResponse.json({ error: 'กรุณาเลือกประเภทงานซ่อมที่ถูกต้อง' }, { status: 400 })
    }

    if (itemCategory === 'EQUIPMENT') {
      if (!equipmentNumber?.trim() && !equipmentName?.trim()) {
        return NextResponse.json({ error: 'กรุณาระบุเลขทะเบียนครุภัณฑ์ หรือชื่อครุภัณฑ์' }, { status: 400 })
      }
    } else {
      if (!nonEquipmentItem?.trim()) {
        return NextResponse.json({ error: 'กรุณาระบุชื่อรายการ/สิ่งของที่ชำรุดเสียหาย' }, { status: 400 })
      }
    }

    if (!locationFullName?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุสถานที่ (ตึก/ชั้น/ห้อง)' }, { status: 400 })
    }

    if (!symptomDetail?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุรายละเอียดหรืออาการเสีย' }, { status: 400 })
    }

    // 3. Find technician info if assigned
    let techName: string | null = null
    let techId: number | null = assignedTechnicianId ? Number(assignedTechnicianId) : null

    if (techId) {
      const techRows = await queryMemberDb('SELECT id, name FROM members WHERE id = ? LIMIT 1', [techId])
      if (techRows.length > 0) {
        techName = techRows[0].name
      }
    }

    // 4. Generate Task No and ID
    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo(repairType)

    const itemName = itemCategory === 'EQUIPMENT' 
      ? (equipmentName ? `${equipmentName} (${equipmentNumber || 'ไม่ระบุเลข'})` : `ครุภัณฑ์เลขที่ ${equipmentNumber}`)
      : nonEquipmentItem

    const taskTitle = `แจ้งซ่อม: ${itemName} (${locationFullName})`

    // Determine target department / role for technician queue if not direct assignee
    let targetRole = null
    if (!techId) {
      if (repairType === 'IT_REPAIR') targetRole = 'นักวิชาการคอมพิวเตอร์'
      else if (repairType === 'GENERAL_REPAIR') targetRole = 'นายช่างเทคนิค'
      else if (repairType === 'MEDICAL_REPAIR') targetRole = 'นักวิทยาศาสตร์การแพทย์'
    }

    // 5. Insert into inbox_tasks
    await queryMemberDb(
      `INSERT INTO inbox_tasks 
       (id, task_no, task_type, title, description, urgency, requester_id, requester_name, requester_dept, status, current_step_no, current_assignee, current_role, custom_payload, created_at, updated_at)
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

    // 6. Insert Step 1 (ช่างรับงานและดำเนินการซ่อม)
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

    // 7. Insert into repair_details (1:1 relation)
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

    // 8. Insert Audit Log
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

    // 9. Telegram Alert to Assignee if assigned
    if (techId) {
      notifyAssigneeOnTelegram({
        taskId,
        taskNo,
        taskType: repairType,
        title: taskTitle,
        requesterName: currentMember.name || session.username,
        requesterDept: currentMember.department,
        assigneeId: techId,
        stepName: 'มีงานแจ้งซ่อมใหม่มอบหมายถึงคุณ',
      }).catch((e) => console.error('Telegram notification error:', e))
    }

    return NextResponse.json({
      success: true,
      message: 'ยื่นใบแจ้งซ่อมสำเร็จเรียบร้อยแล้ว',
      data: {
        taskId,
        taskNo,
      },
    })
  } catch (error: any) {
    console.error('Create repair ticket error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างใบแจ้งซ่อม: ' + error.message }, { status: 500 })
  }
}
