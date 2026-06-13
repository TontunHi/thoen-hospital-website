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
    let formData: any = {}
    if (rawRequest.form_data) {
      try {
        formData = typeof rawRequest.form_data === 'string' ? JSON.parse(rawRequest.form_data) : rawRequest.form_data
      } catch (e) {
        console.error('Failed to parse form_data JSON for request detail ID', rawRequest.id, e)
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
    console.error('Fetch request detail error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด' }, { status: 500 })
  }
}
