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

    // Get all pending approvals assigned to this member
    const tickets = await queryMemberDb(
      `SELECT t.*, r.title as req_title, r.urgency as req_urgency, r.created_at as req_created_at,
       m.name as requester_name, m.department as requester_dept, r.has_cost
       FROM approval_tickets t
       JOIN pr_requests r ON t.source_id = r.id AND t.source_system = 'PR_MEDIA'
       JOIN members m ON r.requester_id = m.id
       WHERE t.current_approver_id = ? AND t.status = 'PENDING'
       ORDER BY t.created_at ASC`,
      [memberId]
    )

    // Get approval history (APPROVED / REJECTED) for this member
    const history = await queryMemberDb(
      `SELECT t.*, r.title as req_title, r.urgency as req_urgency, r.created_at as req_created_at,
       m.name as requester_name, m.department as requester_dept, r.has_cost
       FROM approval_tickets t
       JOIN pr_requests r ON t.source_id = r.id AND t.source_system = 'PR_MEDIA'
       JOIN members m ON r.requester_id = m.id
       WHERE t.current_approver_id = ? AND t.status IN ('APPROVED', 'REJECTED')
       ORDER BY t.approved_at DESC
       LIMIT 50`,
      [memberId]
    )

    return NextResponse.json({ success: true, tickets, history })
  } catch (error) {
    console.error('Fetch approvals error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการรออนุมัติ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // Get member details with signature
    const members = await queryMemberDb('SELECT id, name, signature_path FROM members WHERE username = ? LIMIT 1', [session.username])
    if (members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }
    const approver = members[0]

    const body = await request.json()
    const { ticketId, status, comment } = body

    if (!ticketId || !status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    // Fetch the ticket to confirm assignment and current status
    const tickets = await queryMemberDb('SELECT * FROM approval_tickets WHERE id = ? LIMIT 1', [ticketId])
    if (tickets.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลตั๋วอนุมัติ' }, { status: 404 })
    }
    const ticket = tickets[0]

    if (ticket.current_approver_id !== approver.id) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์อนุมัติรายการนี้' }, { status: 403 })
    }

    if (ticket.status !== 'PENDING') {
      return NextResponse.json({ error: 'ตั๋วนี้ไม่อยู่ในสถานะรออนุมัติ' }, { status: 400 })
    }

    if (status === 'APPROVED' && !approver.signature_path) {
      return NextResponse.json({ error: 'กรุณาลงทะเบียนลายเซ็นดิจิทัลในระบบก่อนกดอนุมัติ' }, { status: 400 })
    }

    const signaturePath = status === 'APPROVED' ? approver.signature_path : null

    // Update current ticket status
    await queryMemberDb(
      `UPDATE approval_tickets 
       SET status = ?, comment = ?, signature_path = ?, approved_at = NOW() 
       WHERE id = ?`,
      [status, comment || null, signaturePath, ticketId]
    )

    // Handle Workflow Progression
    if (status === 'APPROVED') {
      // Find if there is a next step for this request
      const nextSteps = await queryMemberDb(
        `SELECT id FROM approval_tickets 
         WHERE source_system = ? AND source_id = ? AND step_number = ?
         LIMIT 1`,
        [ticket.source_system, ticket.source_id, ticket.step_number + 1]
      )

      if (nextSteps.length > 0) {
        // Activate next step: change WAITING to PENDING
        await queryMemberDb(
          'UPDATE approval_tickets SET status = "PENDING" WHERE id = ?',
          [nextSteps[0].id]
        )
      } else {
        // No next step: Entire request is fully approved
        await queryMemberDb(
          'UPDATE pr_requests SET status = "APPROVED" WHERE id = ?',
          [ticket.source_id]
        )
      }
    } else {
      // If REJECTED, reject the entire request
      await queryMemberDb(
        'UPDATE pr_requests SET status = "REJECTED" WHERE id = ?',
        [ticket.source_id]
      )
      // Cancel all remaining steps
      await queryMemberDb(
        `UPDATE approval_tickets 
         SET status = 'REJECTED', comment = 'ถูกยกเลิกเนื่องจากถูกปฏิเสธก่อนหน้า' 
         WHERE source_system = ? AND source_id = ? AND status = 'WAITING'`,
        [ticket.source_system, ticket.source_id]
      )
    }

    return NextResponse.json({ success: true, message: 'บันทึกสถานะการอนุมัติเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Submit approval error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกการอนุมัติ' }, { status: 500 })
  }
}
