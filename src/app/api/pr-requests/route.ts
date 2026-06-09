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

    // Get all requests submitted by this member
    const requests = await queryMemberDb(
      `SELECT r.*, 
       (SELECT COUNT(*) FROM approval_tickets WHERE source_system = 'PR_MEDIA' AND source_id = r.id AND status = 'APPROVED') as approved_steps,
       (SELECT COUNT(*) FROM approval_tickets WHERE source_system = 'PR_MEDIA' AND source_id = r.id) as total_steps
       FROM pr_requests r 
       WHERE r.requester_id = ? 
       ORDER BY r.created_at DESC`,
      [memberId]
    )

    return NextResponse.json({ success: true, requests })
  } catch (error) {
    console.error('Fetch pr-requests error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // Get member details
    const members = await queryMemberDb('SELECT id, name, department FROM members WHERE username = ? LIMIT 1', [session.username])
    if (members.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 })
    }
    const requester = members[0]

    const body = await request.json()
    const { title, urgency, orderDate, targetDate, jobType, jobTypeOther, details, channels, phone, hasCost } = body

    if (!title || !urgency || !orderDate || !targetDate || !phone) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 })
    }

    // Insert request
    const insertResult = await queryMemberDb(
      `INSERT INTO pr_requests (title, urgency, order_date, target_date, job_type, job_type_other, details, channels, phone, has_cost, requester_id, department, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        title,
        urgency,
        orderDate,
        targetDate,
        jobType ? JSON.stringify(jobType) : null,
        jobTypeOther || null,
        details || null,
        channels ? JSON.stringify(channels) : null,
        phone,
        hasCost ? 1 : 0,
        requester.id,
        requester.department,
      ]
    )

    // mysql2 returns OkPacket where insertId is a property of the result object
    // When using queryMemberDb, it returns the results array
    // Let's query the last inserted ID for this requester to be safe across different mysql drivers
    const lastRequest = await queryMemberDb(
      'SELECT id FROM pr_requests WHERE requester_id = ? ORDER BY id DESC LIMIT 1',
      [requester.id]
    )
    const requestId = lastRequest[0].id

    // Setup Approval Workflow Steps
    // 1. Head of Medical Digital Group
    const digHeads = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ดิจิทัลทางการแพทย์%' LIMIT 1")
    const digHeadId = digHeads.length > 0 ? digHeads[0].id : null

    if (hasCost) {
      // Flow with cost: 4 steps
      // 1. Head of Medical Digital Group (PENDING)
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 1, 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', ?, 'PENDING')`,
        [requestId, digHeadId]
      )

      // 2. เจ้าหน้าที่พัสดุ (WAITING)
      const pasOfficer = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%เจ้าหน้าที่พัสดุ%' OR (position LIKE '%พัสดุ%' AND position NOT LIKE '%หัวหน้า%') LIMIT 1")
      const pasOfficerId = pasOfficer.length > 0 ? pasOfficer[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 2, 'เจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
        [requestId, pasOfficerId]
      )

      // 3. หัวหน้าเจ้าหน้าที่พัสดุ (WAITING)
      const pasHead = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%หัวหน้าเจ้าหน้าที่พัสดุ%' OR position LIKE '%หัวหน้าพัสดุ%' OR (position LIKE '%หัวหน้า%' AND position LIKE '%พัสดุ%') LIMIT 1")
      const pasHeadId = pasHead.length > 0 ? pasHead[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 3, 'หัวหน้าเจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
        [requestId, pasHeadId]
      )

      // 4. ผู้อำนวยการโรงพยาบาลเถิน (WAITING)
      const directors = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ผู้อำนวยการ%' LIMIT 1")
      const directorId = directors.length > 0 ? directors[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 4, 'ผู้อำนวยการโรงพยาบาลเถิน', ?, 'WAITING')`,
        [requestId, directorId]
      )
    } else {
      const digHeadId = digHeads.length > 0 ? digHeads[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 1, 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', ?, 'PENDING')`,
        [requestId, digHeadId]
      )
    }

    return NextResponse.json({ success: true, message: 'บันทึกคำขอผลิตสื่อประชาสัมพันธ์เรียบร้อยแล้ว', requestId })
  } catch (error) {
    console.error('Create pr-request error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกคำขอ' }, { status: 500 })
  }
}
