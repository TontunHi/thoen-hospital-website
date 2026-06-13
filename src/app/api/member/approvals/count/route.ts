import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // Get member details
    const members = await queryMemberDb('SELECT id FROM members WHERE username = ? LIMIT 1', [session.username])
    if (members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }
    const memberId = members[0].id

    // Count pending approvals assigned to this member (status = 'PENDING')
    const results = await queryMemberDb(
      `SELECT COUNT(*) as count FROM approval_tickets
       WHERE current_approver_id = ? AND status = 'PENDING'`,
      [memberId]
    )

    const count = results[0]?.count || 0

    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Fetch approvals count error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลจำนวนรายการรออนุมัติ' }, { status: 500 })
  }
}
