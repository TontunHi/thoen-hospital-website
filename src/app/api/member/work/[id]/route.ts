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

function safeJsonParse(val: string, fallback: any = []) {
  if (!val) return fallback
  try {
    return JSON.parse(val)
  } catch (e) {
    console.error('JSON parsing failed:', e)
    return fallback
  }
}

function checkWorkRequestAccess(workRequest: any, member: any, assignees: any[]) {
  const isAssignee = assignees.some((a: any) => (a.id || a.user_id) === member.id)
  const isCreator = workRequest.created_by === member.id
  const hasFullAccess = 
    member.role === 'admin' ||
    (member.position && (member.position.includes('ผู้อำนวยการ') || member.position.includes('ดิจิทัลทางการแพทย์')))

  return isAssignee || isCreator || hasFullAccess
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
    const workRequestId = Number.parseInt(id, 10)
    if (Number.isNaN(workRequestId)) {
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
    const assignees = safeJsonParse(workRequest.assignees, [])
    const attachments = safeJsonParse(workRequest.attachments, [])
    const history = safeJsonParse(workRequest.status_history, [])
    
    if (!checkWorkRequestAccess(workRequest, member, assignees)) {
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
        progressNotes: workRequest.progress_notes ? safeJsonParse(workRequest.progress_notes, null) : null,
        completion: workRequest.completion ? safeJsonParse(workRequest.completion, null) : null,
        review: workRequest.review ? safeJsonParse(workRequest.review, null) : null,
        attachments,
        history
      }
    })
  } catch (error: any) {
    console.error('Fetch work request detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงรายละเอียดงาน' }, { status: 500 })
  }
}

async function handlePhase2(
  body: any,
  workRequest: any,
  member: any,
  currentHistory: any[],
  workRequestId: number
) {
  const { assignees } = body
  const currentStatus = workRequest.status

  const isITStaff = 
    member.role === 'admin' ||
    (member.position && (
      member.position.includes('นักวิชาการคอมพิวเตอร์') ||
      member.position.includes('เจ้าพนักงานเครื่องคอมพิวเตอร์')
    ))

  if (!isITStaff) {
    return { error: 'คุณไม่มีสิทธิ์ในการรับหรือมอบหมายงานนี้', status: 403 }
  }

  if (currentStatus !== 'pending' && currentStatus !== 'assigned') {
    return { error: 'สถานะงานไม่รองรับการมอบหมายงานในขณะนี้', status: 400 }
  }

  if (!assignees || !Array.isArray(assignees) || assignees.length === 0) {
    return { error: 'กรุณาระบุผู้รับผิดชอบงาน', status: 400 }
  }

  const hasPrimary = assignees.some((a: any) => a.role === 'primary')
  if (!hasPrimary) {
    return { error: 'ต้องมีผู้รับผิดชอบหลักอย่างน้อย 1 คน', status: 400 }
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

  return { success: true, message: 'บันทึกการมอบหมายงานเรียบร้อยแล้ว' }
}

async function handlePhase3(
  body: any,
  workRequest: any,
  member: any,
  currentHistory: any[],
  currentAttachments: any[],
  workRequestId: number
) {
  const { targetStatus, waitingFor, blockers, startDate, details, note, attachments } = body
  const currentStatus = workRequest.status

  if (!targetStatus || (targetStatus !== 'waiting' && targetStatus !== 'in_progress')) {
    return { error: 'ไม่ระบุสถานะเป้าหมายที่ถูกต้อง', status: 400 }
  }

  if (currentStatus !== 'assigned' && currentStatus !== 'waiting' && currentStatus !== 'in_progress') {
    return { error: 'สถานะงานปัจจุบันไม่รองรับการอัปเดตขั้นตอนนี้', status: 400 }
  }

  // Add new Phase 3 attachments
  if (Array.isArray(attachments)) {
    attachments.forEach((att: any) => {
      currentAttachments.push({
        phase: 3,
        file_type: att.type,
        file_path: att.path,
        original_name: att.name,
        uploaded_by: member.id,
        uploaded_at: new Date().toISOString()
      })
    })
  }

  // Parse and append to progress_notes array
  let notesArray = safeJsonParse(workRequest.progress_notes, [])
  if (!Array.isArray(notesArray)) {
    notesArray = workRequest.progress_notes ? [safeJsonParse(workRequest.progress_notes, null)] : []
  }

  const noteEntry: any = {
    id: notesArray.length + 1,
    status: targetStatus,
    updated_by: member.id,
    updated_by_name: member.name,
    updated_by_position: member.position,
    updated_at: new Date().toISOString(),
    attachments: (attachments || []).map((att: any) => ({
      file_type: att.type,
      file_path: att.path,
      original_name: att.name
    }))
  }

  if (targetStatus === 'waiting') {
    noteEntry.waiting_for = waitingFor || null
    noteEntry.blockers = blockers || null
    noteEntry.note = note || details || null
  } else {
    noteEntry.start_date = startDate || null
    noteEntry.details = details || note || null
  }

  notesArray.push(noteEntry)

  let nextStatus = currentStatus
  if (currentStatus !== targetStatus) {
    nextStatus = targetStatus
    currentHistory.push({
      id: currentHistory.length + 1,
      from_status: currentStatus,
      to_status: targetStatus,
      comment: targetStatus === 'waiting' ? 'เปลี่ยนสถานะเป็น รอดำเนินการ' : 'เปลี่ยนสถานะเป็น กำลังดำเนินการ',
      changed_by: member.id,
      changed_at: new Date().toISOString(),
      changer_name: member.name,
      changer_position: member.position
    })
  }

  await queryMemberDb(
    'UPDATE work_requests SET status = ?, progress_notes = ?, attachments = ?, status_history = ? WHERE id = ?',
    [nextStatus, JSON.stringify(notesArray), JSON.stringify(currentAttachments), JSON.stringify(currentHistory), workRequestId]
  )

  return { success: true, message: 'อัปเดตความคืบหน้าการดำเนินงานเรียบร้อยแล้ว' }
}

async function handlePhase4(
  body: any,
  workRequest: any,
  member: any,
  currentHistory: any[],
  currentAttachments: any[],
  workRequestId: number
) {
  const { completedDate, completedTime, attachments } = body
  const currentStatus = workRequest.status

  if (currentStatus !== 'in_progress' && currentStatus !== 'waiting' && currentStatus !== 'completed') {
    return { error: 'สถานะงานไม่รองรับการส่งความสำเร็จงานในขณะนี้', status: 400 }
  }

  if (!completedDate || !completedTime) {
    return { error: 'กรุณาระบุวันที่และเวลาที่ทำเสร็จจริง', status: 400 }
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
      from_status: currentStatus,
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

  return { success: true, message: 'แจ้งดำเนินงานเสร็จสิ้นเรียบร้อยแล้ว รอหัวหน้ากลุ่มงานรีวิว' }
}

function checkWorkUpdateAuth(member: any, currentAssignees: any[]): boolean {
  const isAssigned = currentAssignees.some((a: any) => (a.id || a.user_id) === member.id)
  const hasAdminAccess = 
    member.role === 'admin' || 
    (member.position && member.position.includes('ดิจิทัลทางการแพทย์'))
  return isAssigned || hasAdminAccess
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
    const workRequestId = Number.parseInt(id, 10)
    if (Number.isNaN(workRequestId)) {
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

    const body = await request.json()
    const { phase } = body

    if (!phase) {
      return NextResponse.json({ error: 'ไม่ระบุเฟสการอัปเดตงาน' }, { status: 400 })
    }

    // Parse existing JSONs
    const currentAssignees = safeJsonParse(workRequest.assignees, [])
    const currentAttachments = safeJsonParse(workRequest.attachments, [])
    const currentHistory = safeJsonParse(workRequest.status_history, [])

    // PHASE 2: Accept/Assign Work
    if (phase === 2) {
      const result = await handlePhase2(body, workRequest, member, currentHistory, workRequestId)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    if (!checkWorkUpdateAuth(member, currentAssignees)) {
      return NextResponse.json({ error: 'คุณไม่มีชื่ออยู่ในงานนี้ ไม่สามารถดำเนินงานในส่วนนี้ได้' }, { status: 403 })
    }

    // PHASE 3: Progress Updates (waiting or in_progress)
    if (phase === 3) {
      const result = await handlePhase3(body, workRequest, member, currentHistory, currentAttachments, workRequestId)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    // PHASE 4: Complete Work
    if (phase === 4) {
      const result = await handlePhase4(body, workRequest, member, currentHistory, currentAttachments, workRequestId)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    return NextResponse.json({ error: 'ระบุเฟสงานไม่ถูกต้อง' }, { status: 400 })
  } catch (error: any) {
    console.error('Update work request detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลงาน' }, { status: 500 })
  }
}
