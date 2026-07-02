import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

async function getMemberDetails(username: string) {
  const members = await queryMemberDb(
    'SELECT id, name, position, role FROM members WHERE username = ? LIMIT 1',
    [username]
  )
  return members && members.length > 0 ? members[0] : null
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id } = await props.params
    const workRequestId = parseInt(id)
    if (isNaN(workRequestId)) {
      return NextResponse.json({ error: 'รหัสอ้างอิงงานไม่ถูกต้อง' }, { status: 400 })
    }

    const member = await getMemberDetails(session.username)
    if (!member) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }

    const requests = await queryMemberDb(
      `SELECT wr.*, m.name as creator_name, m.department as creator_dept
       FROM work_requests wr
       LEFT JOIN members m ON wr.created_by = m.id
       WHERE wr.id = ? LIMIT 1`,
      [workRequestId]
    )

    if (!requests || requests.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลงานที่ค้นหา' }, { status: 404 })
    }

    const workRequest = requests[0]
    
    // Parse JSON arrays safely
    let assignees = []
    let attachments = []
    let history = []
    try { assignees = workRequest.assignees ? JSON.parse(workRequest.assignees) : [] } catch (e) {}
    try { attachments = workRequest.attachments ? JSON.parse(workRequest.attachments) : [] } catch (e) {}
    try { history = workRequest.status_history ? JSON.parse(workRequest.status_history) : [] } catch (e) {}
    
    const isAssignee = assignees.some((a: any) => (a.id || a.user_id) === member.id)
    const isCreator = workRequest.created_by === member.id
    const hasFullAccess = 
      member.role === 'admin' ||
      member.position.includes('ผู้อำนวยการ') ||
      member.position.includes('ดิจิทัลทางการแพทย์')

    if (!isAssignee && !isCreator && !hasFullAccess) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลงานนี้' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      workRequest: {
        ...workRequest,
        assignments: assignees.map((a: any) => ({
          role: a.role,
          user_id: a.id || a.user_id,
          name: a.name,
          position: a.position
        })),
        progressNotes: workRequest.progress_notes ? JSON.parse(workRequest.progress_notes) : null,
        completion: workRequest.completion ? JSON.parse(workRequest.completion) : null,
        review: workRequest.review ? JSON.parse(workRequest.review) : null,
        attachments,
        history
      }
    })
  } catch (error: any) {
    console.error('Fetch work request detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงรายละเอียดงาน' }, { status: 500 })
  }
}

// PUT: Update work request details or transition status (Phase 2, 3, 4)
export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id } = await props.params
    const workRequestId = parseInt(id)
    if (isNaN(workRequestId)) {
      return NextResponse.json({ error: 'รหัสอ้างอิงงานไม่ถูกต้อง' }, { status: 400 })
    }

    const member = await getMemberDetails(session.username)
    if (!member) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }

    const requests = await queryMemberDb('SELECT * FROM work_requests WHERE id = ? LIMIT 1', [workRequestId])
    if (!requests || requests.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลงาน' }, { status: 404 })
    }
    const workRequest = requests[0]
    const currentStatus = workRequest.status

    const body = await request.json()
    const { phase, assignees, waitingFor, blockers, startDate, completedDate, completedTime, attachments } = body

    if (!phase) {
      return NextResponse.json({ error: 'ไม่ระบุเฟสการอัปเดตงาน' }, { status: 400 })
    }

    // Parse existing JSONs
    let currentAssignees = []
    let currentAttachments = []
    let currentHistory = []
    try { currentAssignees = workRequest.assignees ? JSON.parse(workRequest.assignees) : [] } catch (e) {}
    try { currentAttachments = workRequest.attachments ? JSON.parse(workRequest.attachments) : [] } catch (e) {}
    try { currentHistory = workRequest.status_history ? JSON.parse(workRequest.status_history) : [] } catch (e) {}

    // PHASE 2: Accept/Assign Work
    if (phase === 2) {
      const isITStaff = 
        member.role === 'admin' ||
        member.position.includes('นักวิชาการคอมพิวเตอร์') ||
        member.position.includes('เจ้าพนักงานเครื่องคอมพิวเตอร์')

      if (!isITStaff) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ในการรับหรือมอบหมายงานนี้' }, { status: 403 })
      }

      if (currentStatus !== 'pending' && currentStatus !== 'assigned') {
        return NextResponse.json({ error: 'สถานะงานไม่รองรับการมอบหมายงานในขณะนี้' }, { status: 400 })
      }

      if (!assignees || !Array.isArray(assignees) || assignees.length === 0) {
        return NextResponse.json({ error: 'กรุณาระบุผู้รับผิดชอบงาน' }, { status: 400 })
      }

      const hasPrimary = assignees.some((a: any) => a.role === 'primary')
      if (!hasPrimary) {
        return NextResponse.json({ error: 'ต้องมีผู้รับผิดชอบหลักอย่างน้อย 1 คน' }, { status: 400 })
      }

      // Fetch details of assigned members to store in JSON
      const staffIds = assignees.map((a: any) => a.userId)
      const staffDetails = await queryMemberDb(
        `SELECT id, name, position FROM members WHERE id IN (${staffIds.join(',')})`
      )

      const formattedAssignees = assignees.map((ass: any) => {
        const det = staffDetails.find((s: any) => s.id === ass.userId)
        return {
          id: ass.userId,
          user_id: ass.userId,
          name: det ? det.name : '',
          position: det ? det.position : '',
          role: ass.role
        }
      })

      let nextStatus = currentStatus
      if (currentStatus === 'pending') {
        nextStatus = 'assigned'
        currentHistory.push({
          id: currentHistory.length + 1,
          from_status: 'pending',
          to_status: 'assigned',
          comment: 'มอบหมายงานสำเร็จ',
          changed_by: member.id,
          changed_at: new Date().toISOString(),
          changer_name: member.name,
          changer_position: member.position
        })
      }

      await queryMemberDb(
        'UPDATE work_requests SET status = ?, assignees = ?, status_history = ? WHERE id = ?',
        [nextStatus, JSON.stringify(formattedAssignees), JSON.stringify(currentHistory), workRequestId]
      )

      return NextResponse.json({ success: true, message: 'บันทึกการมอบหมายงานเรียบร้อยแล้ว' })
    }

    // Authorization checks for phase 3 & 4
    const isAssigned = currentAssignees.some((a: any) => (a.id || a.user_id) === member.id)
    const hasAdminAccess = member.role === 'admin' || member.position.includes('ดิจิทัลทางการแพทย์')

    if (!isAssigned && !hasAdminAccess) {
      return NextResponse.json({ error: 'คุณไม่มีชื่ออยู่ในงานนี้ ไม่สามารถดำเนินงานในส่วนนี้ได้' }, { status: 403 })
    }

    // PHASE 3: In Progress Updates
    if (phase === 3) {
      if (currentStatus !== 'assigned' && currentStatus !== 'in_progress') {
        return NextResponse.json({ error: 'สถานะงานไม่อยู่ในขั้นตอนกำลังดำเนินการ' }, { status: 400 })
      }

      const progressNotes = {
        waiting_for: waitingFor || null,
        blockers: blockers || null,
        start_date: startDate || null
      }

      // Add new Phase 3 attachments
      if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
          currentAttachments.push({
            phase: 3,
            file_type: att.type,
            file_path: att.path,
            original_name: att.name,
            uploaded_by: member.id,
            uploaded_at: new Date().toISOString()
          })
        }
      }

      let nextStatus = currentStatus
      if (currentStatus === 'assigned') {
        nextStatus = 'in_progress'
        currentHistory.push({
          id: currentHistory.length + 1,
          from_status: 'assigned',
          to_status: 'in_progress',
          comment: 'เริ่มขั้นตอนดำเนินการจริง',
          changed_by: member.id,
          changed_at: new Date().toISOString(),
          changer_name: member.name,
          changer_position: member.position
        })
      }

      await queryMemberDb(
        'UPDATE work_requests SET status = ?, progress_notes = ?, attachments = ?, status_history = ? WHERE id = ?',
        [nextStatus, JSON.stringify(progressNotes), JSON.stringify(currentAttachments), JSON.stringify(currentHistory), workRequestId]
      )

      return NextResponse.json({ success: true, message: 'อัปเดตความคืบหน้าการดำเนินงานเรียบร้อยแล้ว' })
    }

    // PHASE 4: Complete Work
    if (phase === 4) {
      if (currentStatus !== 'in_progress' && currentStatus !== 'completed') {
        return NextResponse.json({ error: 'สถานะงานไม่รองรับการส่งความสำเร็จงานในขณะนี้' }, { status: 400 })
      }

      if (!completedDate || !completedTime) {
        return NextResponse.json({ error: 'กรุณาระบุวันที่และเวลาที่ทำเสร็จจริง' }, { status: 400 })
      }

      const completion = {
        completed_date: completedDate,
        completed_time: completedTime
      }

      // Add new Phase 4 attachments
      if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
          currentAttachments.push({
            phase: 4,
            file_type: att.type,
            file_path: att.path,
            original_name: att.name,
            uploaded_by: member.id,
            uploaded_at: new Date().toISOString()
          })
        }
      }

      let nextStatus = currentStatus
      if (currentStatus !== 'completed') {
        nextStatus = 'completed'
        currentHistory.push({
          id: currentHistory.length + 1,
          from_status: 'in_progress',
          to_status: 'completed',
          comment: 'ดำเนินงานเสร็จสมบูรณ์',
          changed_by: member.id,
          changed_at: new Date().toISOString(),
          changer_name: member.name,
          changer_position: member.position
        })
      }

      await queryMemberDb(
        'UPDATE work_requests SET status = ?, completion = ?, attachments = ?, status_history = ? WHERE id = ?',
        [nextStatus, JSON.stringify(completion), JSON.stringify(currentAttachments), JSON.stringify(currentHistory), workRequestId]
      )

      return NextResponse.json({ success: true, message: 'แจ้งดำเนินงานเสร็จสิ้นเรียบร้อยแล้ว รอหัวหน้ากลุ่มงานรีวิว' })
    }

    return NextResponse.json({ error: 'ระบุเฟสงานไม่ถูกต้อง' }, { status: 400 })
  } catch (error: any) {
    console.error('Update work request detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลงาน' }, { status: 500 })
  }
}
