import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

async function canCreateWork(username: string): Promise<{ authorized: boolean; memberId: number; name: string; position: string; role: string }> {
  const members = await queryMemberDb(
    'SELECT id, name, position, role FROM members WHERE username = ? LIMIT 1',
    [username]
  )
  if (!members || members.length === 0) {
    return { authorized: false, memberId: 0, name: '', position: '', role: '' }
  }

  const member = members[0]
  const position = member.position || ''
  const isAuthorized = 
    member.role === 'admin' ||
    position.includes('ดิจิทัลทางการแพทย์') ||
    position.includes('เจ้าพนักงานเครื่องคอมพิวเตอร์')

  return { 
    authorized: isAuthorized, 
    memberId: member.id, 
    name: member.name,
    position,
    role: member.role
  }
}

// POST: Create a new work request (Phase 1)
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { authorized, memberId, name, position } = await canCreateWork(session.username)
    if (!authorized) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์สร้างคำขอรับมอบหมายงาน' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, attachments } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'กรุณากรอกหัวข้อและรายละเอียดงาน' }, { status: 400 })
    }

    // Auto-generate request ID: WR-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `WR-${todayStr}-`
    
    const countResult = await queryMemberDb(
      'SELECT COUNT(*) as cnt FROM work_requests WHERE request_no LIKE ?',
      [`${prefix}%`]
    )
    const runningNum = String((countResult[0]?.cnt || 0) + 1).padStart(4, '0')
    const requestNo = `${prefix}${runningNum}`

    // Format Phase 1 attachments JSON
    const phase1Attachments = (attachments || []).map((att: any) => ({
      phase: 1,
      file_type: att.type,
      file_path: att.path,
      original_name: att.name,
      uploaded_by: memberId,
      uploaded_at: new Date().toISOString()
    }))

    // Format initial history log JSON
    const initialHistory = [{
      id: 1,
      from_status: null,
      to_status: 'pending',
      comment: 'สร้างคำขอสำเร็จ',
      changed_by: memberId,
      changed_at: new Date().toISOString(),
      changer_name: name,
      changer_position: position
    }]

    // Insert work request with initial JSON data
    await queryMemberDb(
      `INSERT INTO work_requests 
       (request_no, title, description, status, created_by, assignees, attachments, status_history) 
       VALUES (?, ?, ?, 'pending', ?, '[]', ?, ?)`,
      [
        requestNo, 
        title.trim(), 
        description.trim(), 
        memberId, 
        JSON.stringify(phase1Attachments), 
        JSON.stringify(initialHistory)
      ]
    )

    return NextResponse.json({ success: true, message: 'สร้างคำขอจัดทำรายงาน/งานคอมพิวเตอร์เรียบร้อยแล้ว', requestNo })
  } catch (error: any) {
    console.error('Create work request error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างคำขอ' }, { status: 500 })
  }
}

// GET: Retrieve work requests based on permissions and dashboard scope
export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // Get current user details
    const members = await queryMemberDb(
      'SELECT id, position, role FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )
    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }

    const currentMember = members[0]
    const memberId = currentMember.id
    const position = currentMember.position || ''
    const role = currentMember.role

    const canSeeAll = 
      role === 'admin' ||
      position.includes('ผู้อำนวยการ') ||
      position.includes('ดิจิทัลทางการแพทย์')

    // Retrieve all work requests
    const query = `
      SELECT wr.*, m.name as creator_name, m.department as creator_dept 
      FROM work_requests wr
      LEFT JOIN members m ON wr.created_by = m.id
      ORDER BY wr.created_at DESC
    `
    const requests = await queryMemberDb(query)

    const formattedRequests = []
    for (const req of requests) {
      // Parse JSON fields safely
      let assignees = []
      try {
        assignees = req.assignees ? JSON.parse(req.assignees) : []
      } catch (e) {
        assignees = []
      }

      // Filter visibility checks:
      // - Users who canSeeAll see everything
      // - Others see only if they created it OR are assigned to it
      const isCreator = req.created_by === memberId
      const isAssigned = assignees.some((a: any) => a.id === memberId || a.user_id === memberId)

      if (canSeeAll || isCreator || isAssigned) {
        // Standardize assignees format for FE compatibility
        const mappedAssignees = assignees.map((a: any) => ({
          id: a.id || a.user_id,
          name: a.name,
          position: a.position,
          role: a.role
        }))

        formattedRequests.push({
          ...req,
          assignees: mappedAssignees,
          attachments: req.attachments ? JSON.parse(req.attachments) : [],
          status_history: req.status_history ? JSON.parse(req.status_history) : [],
          progress_notes: req.progress_notes ? JSON.parse(req.progress_notes) : null,
          completion: req.completion ? JSON.parse(req.completion) : null,
          review: req.review ? JSON.parse(req.review) : null
        })
      }
    }

    return NextResponse.json({ success: true, workRequests: formattedRequests })
  } catch (error: any) {
    console.error('Fetch work requests error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการงาน' }, { status: 500 })
  }
}
