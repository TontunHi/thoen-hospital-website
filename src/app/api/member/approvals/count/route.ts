import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // Get member details with role and position
    const members = await queryMemberDb('SELECT id, role, position FROM members WHERE username = ? LIMIT 1', [session.username])
    if (members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }
    const { id: memberId, role, position: rawPosition } = members[0]
    const position = rawPosition || ''

    // 1. Count pending PR approvals assigned to this member (status = 'PENDING')
    const prResults = await queryMemberDb(
      `SELECT COUNT(*) as count FROM approval_tickets
       WHERE current_approver_id = ? AND status = 'PENDING'`,
      [memberId]
    )
    const prCount = prResults[0]?.count || 0

    // 2. Count active work requests requiring action
    const canSeeAll = 
      role === 'admin' ||
      position.includes('ผู้อำนวยการ') ||
      position.includes('ดิจิทัลทางการแพทย์')

    const workRequests = await queryMemberDb('SELECT status, created_by, assignees FROM work_requests')
    let workCount = 0

    for (const req of workRequests) {
      let assignees = []
      try {
        assignees = req.assignees ? JSON.parse(req.assignees) : []
      } catch (e) {}

      const isCreator = req.created_by === memberId
      const isAssigned = assignees.some((a: any) => a.id === memberId || a.user_id === memberId)

      if (req.status === 'pending' && canSeeAll) {
        // Needs assignment from department head/admin
        workCount++
      } else if (req.status === 'completed' && isCreator) {
        // Creator needs to evaluate/review the finished work
        workCount++
      } else if ((req.status === 'assigned' || req.status === 'in_progress') && isAssigned) {
        // Assigned IT staff currently working on it
        workCount++
      }
    }

    const count = prCount + workCount

    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Fetch approvals count error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลจำนวนรายการรออนุมัติ' }, { status: 500 })
  }
}
