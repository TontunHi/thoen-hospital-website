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
    const members = await queryMemberDb('SELECT id, position FROM members WHERE username = ? LIMIT 1', [session.username])
    if (members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }
    const memberId = members[0].id
    const position = members[0].position || ''

    // Get all pending approvals assigned to this member
    const tickets = await queryMemberDb(
      `SELECT t.*, r.title as req_title, r.created_at as req_created_at, r.form_data,
       m.name as requester_name, m.department as requester_dept, r.has_cost
       FROM approval_tickets t
       JOIN pr_requests r ON t.source_id = r.id AND t.source_system = 'PR_MEDIA'
       JOIN members m ON r.requester_id = m.id
       WHERE t.current_approver_id = ? AND t.status = 'PENDING'
       ORDER BY t.created_at ASC`,
      [memberId]
    )

    const parsedTickets = tickets.map(t => {
      let reqUrgency = 'ไม่ด่วน'
      if (t.form_data) {
        try {
          const formData = typeof t.form_data === 'string' ? JSON.parse(t.form_data) : t.form_data
          reqUrgency = formData.urgency || 'ไม่ด่วน'
        } catch (e) {
          console.error('Failed to parse form_data JSON for ticket request ID', t.source_id, e)
        }
      }
      const { form_data, ...rest } = t
      return {
        ...rest,
        req_urgency: reqUrgency
      }
    })

    // Get approval history (APPROVED / REJECTED) for this member
    const history = await queryMemberDb(
      `SELECT t.*, r.title as req_title, r.created_at as req_created_at, r.form_data,
       m.name as requester_name, m.department as requester_dept, r.has_cost, r.status as req_status
       FROM approval_tickets t
       JOIN pr_requests r ON t.source_id = r.id AND t.source_system = 'PR_MEDIA'
       JOIN members m ON r.requester_id = m.id
       WHERE t.current_approver_id = ? AND t.status IN ('APPROVED', 'REJECTED')
       ORDER BY t.approved_at DESC
       LIMIT 50`,
      [memberId]
    )

    const parsedHistory = history.map(t => {
      let reqUrgency = 'ไม่ด่วน'
      if (t.form_data) {
        try {
          const formData = typeof t.form_data === 'string' ? JSON.parse(t.form_data) : t.form_data
          reqUrgency = formData.urgency || 'ไม่ด่วน'
        } catch (e) {
          console.error('Failed to parse form_data JSON for history request ID', t.source_id, e)
        }
      }
      const { form_data, ...rest } = t
      return {
        ...rest,
        req_urgency: reqUrgency
      }
    })

    return NextResponse.json({ success: true, tickets: parsedTickets, history: parsedHistory, position })
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
    const { ticketId, status, comment, action } = body

    if (action === 'CLOSE_REQUEST') {
      if (!ticketId) {
        return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
      }
      
      const tickets = await queryMemberDb('SELECT * FROM approval_tickets WHERE id = ? LIMIT 1', [ticketId])
      if (tickets.length === 0) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลตั๋วอนุมัติ' }, { status: 404 })
      }
      const ticket = tickets[0]
      
      if (ticket.current_approver_id !== approver.id) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์อนุมัติหรือปิดรายการนี้' }, { status: 403 })
      }

      // Check if user is indeed a PR Officer
      const memberPosition = await queryMemberDb('SELECT position FROM members WHERE id = ? LIMIT 1', [approver.id])
      const isPrOfficer = (memberPosition[0]?.position || '').includes('นักประชาสัมพันธ์')
      if (!isPrOfficer) {
        return NextResponse.json({ error: 'เฉพาะตำแหน่งนักประชาสัมพันธ์เท่านั้นที่สามารถปิดคำร้องนอกระบบได้' }, { status: 403 })
      }

      // 1. Force approve the original request
      await queryMemberDb('UPDATE pr_requests SET status = "APPROVED" WHERE id = ?', [ticket.source_id])

      // 2. Force approve ALL remaining tickets associated with this request
      await queryMemberDb(
        `UPDATE approval_tickets 
         SET status = 'APPROVED', comment = 'อนุมัติผ่านเอกสารลงนามจริงนอกระบบโดยนักประชาสัมพันธ์', approved_at = NOW()
         WHERE source_system = ? AND source_id = ? AND status IN ('PENDING', 'WAITING')`,
        [ticket.source_system, ticket.source_id]
      )

      return NextResponse.json({ success: true, message: 'ปิดคำร้องผลิตสื่อด้วยเอกสารลงนามจริงนอกระบบเรียบร้อยแล้ว' })
    }

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

    const isPrOfficerRole = ticket.assigned_position === 'นักประชาสัมพันธ์'

    if (status === 'APPROVED' && !isPrOfficerRole && !approver.signature_path) {
      return NextResponse.json({ error: 'กรุณาลงทะเบียนลายเซ็นดิจิทัลในระบบก่อนกดอนุมัติ' }, { status: 400 })
    }

    const signaturePath = (status === 'APPROVED' && !isPrOfficerRole) ? approver.signature_path : null

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
