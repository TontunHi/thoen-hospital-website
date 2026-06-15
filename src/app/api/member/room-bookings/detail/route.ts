import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบ ID รายการ' }, { status: 400 })
    }

    // Get booking details with requester info and room name
    const bookings = await queryMemberDb(
      `SELECT b.*, 
              r.name as room_name, 
              m.name as requester_name, 
              m.position as requester_position, 
              m.department as requester_dept,
              m.signature_path as requester_signature_path
       FROM meeting_room_bookings b
       JOIN meeting_rooms r ON b.room_id = r.id
       JOIN members m ON b.requester_id = m.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    )

    if (bookings.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายละเอียดการจอง' }, { status: 404 })
    }

    // Get approval steps history/status
    const approvals = await queryMemberDb(
      `SELECT t.*, m.name as approver_name, m.position as approver_position
       FROM approval_tickets t
       LEFT JOIN members m ON t.current_approver_id = m.id
       WHERE t.source_system = 'ROOM_BOOKING' AND t.source_id = ?
       ORDER BY t.step_number ASC`,
      [id]
    )

    return NextResponse.json({ success: true, booking: bookings[0], approvals })
  } catch (error) {
    console.error('Fetch booking detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดการจอง' }, { status: 500 })
  }
}
