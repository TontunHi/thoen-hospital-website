import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

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

    // Get request details with requester name
    const requests = await queryMemberDb(
      `SELECT r.*, m.name as requester_name, m.position as requester_position, m.department as requester_dept, m.signature_path as requester_signature_path
       FROM pr_requests r
       JOIN members m ON r.requester_id = m.id
       WHERE r.id = ? LIMIT 1`,
      [id]
    )

    if (requests.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายละเอียดรายการ' }, { status: 404 })
    }

    const rawRequest = requests[0]

    // IDOR Check: Ensure user is the requester, an admin, or an assigned approver
    const userRows = await queryMemberDb('SELECT id FROM members WHERE username = ? LIMIT 1', [session.username])
    const currentMemberId = userRows[0]?.id

    const isRequester = currentMemberId === rawRequest.requester_id
    const isAdmin = session.role === 'admin'
    const approverCheck = await queryMemberDb(
      'SELECT id FROM approval_tickets WHERE source_system = "PR_MEDIA" AND source_id = ? AND current_approver_id = ? LIMIT 1',
      [id, currentMemberId]
    )
    const isApprover = approverCheck.length > 0

    if (!isRequester && !isAdmin && !isApprover) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงรายการนี้' }, { status: 403 })
    }

    logAudit(
      'READ',
      'pr_requests',
      `Viewed PR request details ID: ${id}`,
      { username: session.username, email: session.email }
    ).catch(err => logger.error({ err }, 'PR detail audit log failed'))

    let formData: any = {}
    if (rawRequest.form_data) {
      try {
        formData = typeof rawRequest.form_data === 'string' ? JSON.parse(rawRequest.form_data) : rawRequest.form_data
      } catch (e) {
        logger.error({ err: e }, `Failed to parse form_data JSON for request detail ID: ${rawRequest.id}`)
      }
    }

    const { form_data, ...rest } = rawRequest
    const orderDate = formData.order_date || formData.orderDate
    const targetDate = formData.target_date || formData.targetDate
    const jobType = formData.job_type || formData.jobType
    const jobTypeOther = formData.job_type_other || formData.jobTypeOther
    const details = formData.details
    const channels = formData.channels
    const phone = formData.phone
    const urgency = formData.urgency

    const prRequest = {
      ...rest,
      ...formData,
      // Snake case for print preview / details list
      order_date: orderDate,
      target_date: targetDate,
      job_type: jobType,
      job_type_other: jobTypeOther,
      details: details,
      channels: channels,
      phone: phone,
      urgency: urgency,
      // Camel case for edit form prefill
      orderDate: orderDate,
      targetDate: targetDate,
      jobType: jobType,
      jobTypeOther: jobTypeOther
    }

    // Get approval history steps
    const approvals = await queryMemberDb(
      `SELECT t.*, m.name as approver_name, m.position as approver_position
       FROM approval_tickets t
       LEFT JOIN members m ON t.current_approver_id = m.id
       WHERE t.source_system = 'PR_MEDIA' AND t.source_id = ?
       ORDER BY t.step_number ASC`,
      [id]
    )

    return NextResponse.json({ success: true, request: prRequest, approvals })
  } catch (error) {
    logger.error({ error }, 'Fetch request detail error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด' }, { status: 500 })
  }
}
