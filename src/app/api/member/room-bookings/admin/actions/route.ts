import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }

    const { id, status } = await request.json()
    if (!id || !status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง' }, { status: 400 })
    }

    // Verify booking exists
    const bookings = await queryMemberDb('SELECT * FROM meeting_room_bookings WHERE id = ?', [id])
    if (bookings.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
    }

    const booking = bookings[0]

    // If approving, do a final check for APPROVED overlaps to prevent double approval
    if (status === 'APPROVED') {
      const overlapQuery = `
        SELECT id FROM meeting_room_bookings 
        WHERE room_id = ? 
          AND status = 'APPROVED'
          AND id != ?
          AND start_date <= ? 
          AND end_date >= ?
          AND start_time < ? 
          AND end_time > ?
      `
      const overlaps = await queryMemberDb(overlapQuery, [
        booking.room_id,
        booking.id,
        booking.end_date,
        booking.start_date,
        booking.end_time,
        booking.start_time
      ])

      if (overlaps.length > 0) {
        return NextResponse.json({ 
          error: 'ไม่สามารถอนุมัติได้ เนื่องจากห้องประชุมนี้มีรายการอื่นที่ได้รับการอนุมัติแล้วในช่วงเวลาเดียวกัน' 
        }, { status: 400 })
      }
    }

    // Update status
    await queryMemberDb('UPDATE meeting_room_bookings SET status = ? WHERE id = ?', [status, id])

    // Update corresponding approval ticket status to keep task inbox in sync
    await queryMemberDb(
      `UPDATE approval_tickets 
       SET status = ?, approved_at = NOW(), comment = 'ดำเนินการโดยผู้ดูแลระบบห้องประชุม'
       WHERE source_system = 'ROOM_BOOKING' AND source_id = ? AND status IN ('PENDING', 'WAITING')`,
      [status, id]
    )

    return NextResponse.json({ 
      success: true, 
      message: status === 'APPROVED' ? 'อนุมัติการจองห้องประชุมสำเร็จ' : 'ปฏิเสธการจองห้องประชุมสำเร็จ' 
    })
  } catch (error) {
    console.error('Admin actions booking error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินการ' }, { status: 500 })
  }
}
export async function DELETE(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    await queryMemberDb('DELETE FROM meeting_room_bookings WHERE id = ?', [id])
    
    // Also delete any associated approval ticket
    await queryMemberDb("DELETE FROM approval_tickets WHERE source_system = 'ROOM_BOOKING' AND source_id = ?", [id])

    return NextResponse.json({ success: true, message: 'ลบรายการจองห้องประชุมเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Delete booking error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบรายการจอง' }, { status: 500 })
  }
}
