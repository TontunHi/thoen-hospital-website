import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = await request.json()
    const { action } = body

    // 1. Fetch current member
    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    // 2. Fetch Task and Repair Detail
    const tasks = await queryMemberDb(
      'SELECT * FROM inbox_tasks WHERE id = ? LIMIT 1',
      [taskId]
    )
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: 'ไม่พบงานที่ระบุ' }, { status: 404 })
    }
    const task = tasks[0]

    const repairRows = await queryMemberDb(
      'SELECT * FROM repair_details WHERE task_id = ? LIMIT 1',
      [taskId]
    )
    if (!repairRows || repairRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายละเอียดงานซ่อม' }, { status: 404 })
    }
    const repairDetail = repairRows[0]

    let coWorkers: any[] = []
    try {
      coWorkers = repairDetail.co_workers ? (typeof repairDetail.co_workers === 'string' ? JSON.parse(repairDetail.co_workers) : repairDetail.co_workers) : []
    } catch {}

    const isAssignee = task.current_assignee === currentMember.id
    const isCoWorker = coWorkers.some((cw: any) => cw.id === currentMember.id)
    const isAdmin = currentMember.role === 'admin'

    if (!isAssignee && !isCoWorker && !isAdmin) {
      return NextResponse.json({ error: 'เฉพาะช่างผู้รับผิดชอบหรือผู้ร่วมงานเท่านั้นที่สามารถดำเนินการได้' }, { status: 403 })
    }

    // ── Action 1: ACCEPT_JOB (ช่างรับงาน) ──
    if (action === 'ACCEPT_JOB') {
      await queryMemberDb(
        `UPDATE inbox_tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?`,
        [taskId]
      )
      await queryMemberDb(
        `UPDATE repair_details SET repair_status = 'IN_PROGRESS', updated_at = NOW() WHERE task_id = ?`,
        [taskId]
      )
      await queryMemberDb(
        `UPDATE inbox_task_steps SET status = 'IN_PROGRESS' WHERE task_id = ? AND step_no = 1`,
        [taskId]
      )

      // Audit Log
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'ACCEPT_JOB', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          taskId,
          currentMember.id,
          currentMember.name || session.username,
          JSON.stringify({ status: 'IN_PROGRESS', technician: currentMember.name }),
        ]
      )

      return NextResponse.json({
        success: true,
        message: 'รับงานซ่อมเรียบร้อยแล้ว',
      })
    }

    // ── Action 2: UPDATE_COWORKERS (เพิ่ม/ลดผู้ร่วมงาน) ──
    if (action === 'UPDATE_COWORKERS') {
      const { newCoWorkers } = body
      if (!Array.isArray(newCoWorkers)) {
        return NextResponse.json({ error: 'ข้อมูลผู้ร่วมงานไม่ถูกต้อง' }, { status: 400 })
      }

      await queryMemberDb(
        `UPDATE repair_details SET co_workers = ?, updated_at = NOW() WHERE task_id = ?`,
        [JSON.stringify(newCoWorkers), taskId]
      )

      // Audit Log
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'UPDATE_COWORKERS', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          taskId,
          currentMember.id,
          currentMember.name || session.username,
          JSON.stringify({ co_workers: newCoWorkers }),
        ]
      )

      return NextResponse.json({
        success: true,
        message: 'อัปเดตรายชื่อผู้ร่วมงานสำเร็จ',
      })
    }

    // ── Action 3: SAVE_REPAIR_PROGRESS (บันทึกความคืบหน้า / ส่งซ่อมภายนอก / ค่าใช้จ่าย) ──
    if (action === 'SAVE_REPAIR_PROGRESS') {
      const {
        repairNature,
        isExternalRepair,
        externalVendorName,
        externalReason,
        costType,
        costAmount,
        foundProblem,
        solutionStep,
      } = body

      const newRepairStatus = isExternalRepair ? 'EXTERNAL_REPAIR' : 'IN_PROGRESS'

      await queryMemberDb(
        `UPDATE repair_details 
         SET repair_nature = ?,
             is_external_repair = ?,
             external_vendor_name = ?,
             external_reason = ?,
             cost_type = ?,
             cost_amount = ?,
             found_problem = ?,
             solution_step = ?,
             repair_status = ?,
             updated_at = NOW()
         WHERE task_id = ?`,
        [
          repairNature || 'NORMAL',
          isExternalRepair ? 1 : 0,
          externalVendorName?.trim() || null,
          externalReason?.trim() || null,
          costType || 'NO_COST',
          costType === 'HAS_COST' && costAmount ? Number(costAmount) : null,
          foundProblem?.trim() || null,
          solutionStep?.trim() || null,
          newRepairStatus,
          taskId,
        ]
      )

      // Audit Log
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'UPDATE_REPAIR_PROGRESS', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          taskId,
          currentMember.id,
          currentMember.name || session.username,
          JSON.stringify({
            isExternalRepair,
            externalVendorName,
            costType,
            costAmount,
            foundProblem,
            solutionStep,
          }),
        ]
      )

      return NextResponse.json({
        success: true,
        message: 'บันทึกข้อมูลผลการซ่อมเรียบร้อยแล้ว',
      })
    }

    // ── Action 4: COMPLETE_REPAIR (ซ่อมเสร็จสิ้น) ──
    if (action === 'COMPLETE_REPAIR') {
      const { foundProblem, solutionStep, costType, costAmount, repairNature } = body

      await queryMemberDb(
        `UPDATE repair_details 
         SET repair_status = 'COMPLETED',
             repair_nature = COALESCE(?, repair_nature),
             found_problem = COALESCE(?, found_problem),
             solution_step = COALESCE(?, solution_step),
             cost_type = COALESCE(?, cost_type),
             cost_amount = CASE WHEN ? = 'HAS_COST' THEN ? ELSE cost_amount END,
             updated_at = NOW()
         WHERE task_id = ?`,
        [
          repairNature || null,
          foundProblem?.trim() || null,
          solutionStep?.trim() || null,
          costType || null,
          costType,
          costAmount ? Number(costAmount) : null,
          taskId,
        ]
      )

      await queryMemberDb(
        `UPDATE inbox_tasks SET status = 'APPROVED', updated_at = NOW() WHERE id = ?`,
        [taskId]
      )

      await queryMemberDb(
        `UPDATE inbox_task_steps 
         SET status = 'COMPLETED', action_taken = 'COMPLETE', action_by = ?, action_by_name = ?, action_at = NOW(), comment = 'ดำเนินการซ่อมเสร็จสิ้นเรียบร้อย'
         WHERE task_id = ? AND step_no = 1`,
        [currentMember.id, currentMember.name || session.username, taskId]
      )

      // Audit Log
      await queryMemberDb(
        `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
         VALUES (?, ?, 'COMPLETE_REPAIR', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          taskId,
          currentMember.id,
          currentMember.name || session.username,
          JSON.stringify({ status: 'COMPLETED' }),
        ]
      )

      return NextResponse.json({
        success: true,
        message: 'บันทึกการซ่อมเสร็จสิ้นสมบูรณ์',
      })
    }

    return NextResponse.json({ error: 'Action ที่ส่งมาไม่ถูกต้อง' }, { status: 400 })
  } catch (error: any) {
    console.error('Repair action error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการทำรายการ: ' + error.message }, { status: 500 })
  }
}
