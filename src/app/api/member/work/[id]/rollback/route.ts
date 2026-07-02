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

export async function POST(
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

    const isDeptHead = 
      member.role === 'admin' ||
      member.position.includes('ดิจิทัลทางการแพทย์')

    if (!isDeptHead) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ในการถอยสถานะงานนี้' }, { status: 403 })
    }

    const requests = await queryMemberDb('SELECT status, status_history FROM work_requests WHERE id = ? LIMIT 1', [workRequestId])
    if (!requests || requests.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลงาน' }, { status: 404 })
    }
    const currentStatus = requests[0].status
    let statusHistory = []
    try { statusHistory = requests[0].status_history ? JSON.parse(requests[0].status_history) : [] } catch (e) {}

    if (currentStatus !== 'completed' && currentStatus !== 'reviewed') {
      return NextResponse.json({ error: 'สถานะงานไม่สามารถถอยกลับได้ (ต้องเป็นดำเนินการเสร็จสิ้นหรือรีวิวแล้ว)' }, { status: 400 })
    }

    const body = await request.json()
    const { comment } = body

    if (!comment || comment.trim() === '') {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลในการสั่งถอยสถานะงาน' }, { status: 400 })
    }

    statusHistory.push({
      id: statusHistory.length + 1,
      from_status: currentStatus,
      to_status: 'in_progress',
      comment: `สั่งถอยสถานะงานกลับไปดำเนินการต่อ: ${comment.trim()}`,
      changed_by: member.id,
      changed_at: new Date().toISOString(),
      changer_name: member.name,
      changer_position: member.position
    })

    // Rollback by resetting review, completion and setting status to in_progress
    await queryMemberDb(
      'UPDATE work_requests SET status = \'in_progress\', review = NULL, completion = NULL, status_history = ? WHERE id = ?',
      [JSON.stringify(statusHistory), workRequestId]
    )

    return NextResponse.json({ success: true, message: 'ถอยสถานะงานกลับไปอยู่ในขั้นตอนกำลังดำเนินการเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Work request rollback error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการถอยสถานะงาน' }, { status: 500 })
  }
}
