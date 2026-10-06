import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import {
  generateTaskNo,
  getMediaRequestWorkflowSteps,
  notifyAssigneeOnTelegram,
} from '@/lib/taskInboxService'
import { z } from 'zod'
import crypto from 'crypto'

const MediaRequestWorkTypeSchema = z.object({
  key: z.string(),
  label: z.string(),
  customDetail: z.string().optional().nullable(),
})

const MediaRequestChannelSchema = z.object({
  key: z.string(),
  label: z.string(),
  customDetail: z.string().optional().nullable(),
})

const MediaRequestAttachmentSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  fileType: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
})

const CreateMediaRequestSchema = z.object({
  title: z.string().min(2, 'กรุณาระบุเรื่อง / หัวข้องาน'),
  urgency: z.enum(['NORMAL', 'URGENT', 'VERY_URGENT']).default('NORMAL'),
  deliveryDate: z.string().min(1, 'กรุณาระบุวันที่ขอรับงาน'),
  costType: z.enum(['NO_COST', 'HAS_COST']).default('NO_COST'),
  workTypes: z.array(MediaRequestWorkTypeSchema).min(1, 'กรุณาเลือกลักษณะงานอย่างน้อย 1 รายการ'),
  channels: z.array(MediaRequestChannelSchema).min(1, 'กรุณาเลือกช่องทางเผยแพร่อย่างน้อย 1 รายการ'),
  description: z.string().min(5, 'กรุณาระบุรายละเอียดงานให้ชัดเจน'),
  phone: z.string().min(1, 'กรุณาระบุเบอร์โทรส่วนตัว / แผนก'),
  attachments: z.array(MediaRequestAttachmentSchema).optional().default([]),
  driveLink: z.string().optional().nullable(),
})

// GET: Fetch list of media requests
export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const permRows = await queryMemberDb(
      'SELECT permission_key FROM position_permissions WHERE position_name = ?',
      [currentMember.position || '']
    )
    const hasPerm = (key: string) => permRows.some((p: any) => p.permission_key === key)
    const userPos = currentMember.position || ''
    const isPrStaff = userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')
    const canViewAll =
      currentMember.role === 'admin' ||
      hasPerm('manage_inbox') ||
      hasPerm('view_all_work') ||
      hasPerm('manage_media_requests') ||
      isPrStaff ||
      userPos.includes('ดิจิทัลทางการแพทย์') ||
      userPos.includes('พัสดุ')

    let whereClauses: string[] = ["t.task_type = 'MEDIA_REQUEST'"]
    let queryParams: any[] = []

    if (!canViewAll) {
      whereClauses.push('t.requester_id = ?')
      queryParams.push(currentMember.id)
    }

    if (status) {
      whereClauses.push('t.status = ?')
      queryParams.push(status)
    }

    if (search) {
      whereClauses.push('(t.task_no LIKE ? OR t.title LIKE ? OR t.requester_name LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

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

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        canViewAll,
      },
    })
  } catch (error: any) {
    console.error('Media requests GET error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอสื่อ' }, { status: 500 })
  }
}

// POST: Create a new media request
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const members = await queryMemberDb(
      'SELECT id, username, name, department, position FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 })
    }
    const currentMember = members[0]

    const json = await request.json()
    const parsed = CreateMediaRequestSchema.safeParse(json)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'ข้อมูลที่ส่งมาไม่ถูกต้อง'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const data = parsed.data
    const hasCost = data.costType === 'HAS_COST'
    const workflowSteps = getMediaRequestWorkflowSteps(hasCost)

    const taskId = crypto.randomUUID()
    const taskNo = await generateTaskNo('MEDIA_REQUEST')

    const firstStep = workflowSteps[0]
    const initialRole = firstStep.assignedRole || 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์'

    const customPayload = {
      requestDate: new Date().toISOString(),
      deliveryDate: data.deliveryDate,
      costType: data.costType,
      workTypes: data.workTypes,
      channels: data.channels,
      phone: data.phone?.trim() || null,
      attachments: data.attachments || [],
      driveLink: data.driveLink?.trim() || null,
      requesterInfo: {
        id: currentMember.id,
        name: currentMember.name || session.username,
        department: currentMember.department || '-',
        position: currentMember.position || '-',
      },
    }

    // 1. Insert into inbox_tasks
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

    // 2. Insert workflow steps into inbox_task_steps
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

    // 3. Write Audit Log
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

    // 4. Send Telegram Alert to First Step Role
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
    }).catch((e) => console.error('Telegram dispatch error on media request:', e))

    return NextResponse.json({
      success: true,
      message: 'ยื่นคำขอสื่อประชาสัมพันธ์เรียบร้อยแล้ว',
      data: { taskId, taskNo },
    })
  } catch (error: any) {
    console.error('Create media request error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างคำขอสื่อ' }, { status: 500 })
  }
}
