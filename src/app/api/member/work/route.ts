import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

// POST: Create a new work request (Phase 1)
export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const canCreate = member.role === 'admin' || member.can('create_work')
    if (!canCreate) {
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
      uploaded_by: member.id,
      uploaded_at: new Date().toISOString()
    }))

    // Format initial history log JSON
    const initialHistory = [{
      id: 1,
      from_status: null,
      to_status: 'pending',
      comment: 'สร้างคำขอสำเร็จ',
      changed_by: member.id,
      changed_at: new Date().toISOString(),
      changer_name: member.name,
      changer_position: member.position
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
        member.id, 
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

function formatWorkRequest(req: any, memberId: number, canSeeAll: boolean) {
  let assignees = []
  try {
    assignees = req.assignees ? JSON.parse(req.assignees) : []
  } catch (e) {
    console.error('Failed to parse assignees JSON:', e)
    assignees = []
  }

  const isCreator = req.created_by === memberId
  const isAssigned = assignees.some((a: any) => a.id === memberId || a.user_id === memberId)

  if (canSeeAll || isCreator || isAssigned) {
    const mappedAssignees = assignees.map((a: any) => ({
      id: a.id || a.user_id,
      name: a.name,
      position: a.position,
      role: a.role
    }))

    return {
      ...req,
      assignees: mappedAssignees,
      attachments: req.attachments ? JSON.parse(req.attachments) : [],
      status_history: req.status_history ? JSON.parse(req.status_history) : [],
      progress_notes: req.progress_notes ? JSON.parse(req.progress_notes) : null,
      completion: req.completion ? JSON.parse(req.completion) : null,
      review: req.review ? JSON.parse(req.review) : null
    }
  }

  return null
}

// GET: Retrieve work requests based on permissions and dashboard scope
export async function GET() {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const canSeeAll = member.role === 'admin' || member.can('view_all_work')

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
      const formatted = formatWorkRequest(req, member.id, canSeeAll)
      if (formatted) {
        formattedRequests.push(formatted)
      }
    }

    return NextResponse.json({ success: true, workRequests: formattedRequests })
  } catch (error: any) {
    console.error('Fetch work requests error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการงาน' }, { status: 500 })
  }
}
