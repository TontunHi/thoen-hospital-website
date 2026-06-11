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

    const parsedRequests = requests.map(r => {
      let formData: any = {}
      if (r.form_data) {
        try {
          formData = typeof r.form_data === 'string' ? JSON.parse(r.form_data) : r.form_data
        } catch (e) {
          console.error('Failed to parse form_data JSON for request ID', r.id, e)
        }
      }
      
      const { form_data, ...rest } = r
      const orderDate = formData.order_date || formData.orderDate || r.order_date
      const targetDate = formData.target_date || formData.targetDate || r.target_date
      const jobType = formData.job_type || formData.jobType || r.job_type
      const jobTypeOther = formData.job_type_other || formData.jobTypeOther || r.job_type_other
      const details = formData.details || r.details
      const channels = formData.channels || r.channels
      const phone = formData.phone || r.phone
      const urgency = formData.urgency || r.urgency

      return {
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
    })

    return NextResponse.json({ success: true, requests: parsedRequests })
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
    const { title, urgency, orderDate, targetDate, jobType, jobTypeOther, details, channels, phone, hasCost, attachments } = body

    if (!title || !urgency || !orderDate || !targetDate || !phone) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 })
    }

    // Serialize form fields into form_data JSON
    const formData = {
      urgency,
      orderDate,
      targetDate,
      jobType: jobType || [],
      jobTypeOther: jobTypeOther || null,
      details: details || null,
      channels: channels || [],
      phone,
      attachments: attachments || []
    }

    // Insert request using JSON document storage for form details
    const insertResult = await queryMemberDb(
      `INSERT INTO pr_requests (title, has_cost, requester_id, department, status, form_data)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [
        title,
        hasCost ? 1 : 0,
        requester.id,
        requester.department,
        JSON.stringify(formData),
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
    // 1. PR Officer (นักประชาสัมพันธ์)
    const prOfficers = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%นักประชาสัมพันธ์%' LIMIT 1")
    const prOfficerId = prOfficers.length > 0 ? prOfficers[0].id : null

    // 2. Head of Medical Digital Group
    const digHeads = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ดิจิทัลทางการแพทย์%' LIMIT 1")
    const digHeadId = digHeads.length > 0 ? digHeads[0].id : null

    // Insert Step 1 (นักประชาสัมพันธ์)
    await queryMemberDb(
      `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
       VALUES ('PR_MEDIA', ?, 1, 'นักประชาสัมพันธ์', ?, 'PENDING')`,
      [requestId, prOfficerId]
    )

    // Insert Step 2 (หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์)
    await queryMemberDb(
      `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
       VALUES ('PR_MEDIA', ?, 2, 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', ?, 'WAITING')`,
      [requestId, digHeadId]
    )

    if (hasCost) {
      // 3. เจ้าหน้าที่พัสดุ (WAITING)
      const pasOfficer = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%เจ้าหน้าที่พัสดุ%' OR (position LIKE '%พัสดุ%' AND position NOT LIKE '%หัวหน้า%') LIMIT 1")
      const pasOfficerId = pasOfficer.length > 0 ? pasOfficer[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 3, 'เจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
        [requestId, pasOfficerId]
      )

      // 4. หัวหน้าเจ้าหน้าที่พัสดุ (WAITING)
      const pasHead = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%หัวหน้าเจ้าหน้าที่พัสดุ%' OR position LIKE '%หัวหน้าพัสดุ%' OR (position LIKE '%หัวหน้า%' AND position LIKE '%พัสดุ%') LIMIT 1")
      const pasHeadId = pasHead.length > 0 ? pasHead[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 4, 'หัวหน้าเจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
        [requestId, pasHeadId]
      )

      // 5. ผู้อำนวยการโรงพยาบาลเถิน (WAITING)
      const directors = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ผู้อำนวยการ%' LIMIT 1")
      const directorId = directors.length > 0 ? directors[0].id : null
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 5, 'ผู้อำนวยการโรงพยาบาลเถิน', ?, 'WAITING')`,
        [requestId, directorId]
      )
    }

    return NextResponse.json({ success: true, message: 'บันทึกคำขอผลิตสื่อประชาสัมพันธ์เรียบร้อยแล้ว', requestId })
  } catch (error) {
    console.error('Create pr-request error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกคำขอ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
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

    const body = await request.json()
    const { id, title, urgency, orderDate, targetDate, jobType, jobTypeOther, details, channels, phone, hasCost, attachments } = body

    if (!id || !title || !urgency || !orderDate || !targetDate || !phone) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 })
    }

    // Fetch existing request to verify ownership and status
    const existingRequests = await queryMemberDb(
      'SELECT requester_id, status FROM pr_requests WHERE id = ? LIMIT 1',
      [id]
    )

    if (existingRequests.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลใบคำขอ' }, { status: 404 })
    }

    const pr = existingRequests[0]
    
    // Check if user is a PR Officer (นักประชาสัมพันธ์)
    let isPrOfficer = false
    const memberPosition = await queryMemberDb('SELECT position FROM members WHERE id = ? LIMIT 1', [memberId])
    const positionName = memberPosition.length > 0 ? memberPosition[0].position || '' : ''
    
    if (positionName.includes('นักประชาสัมพันธ์')) {
      isPrOfficer = true
    }

    if (pr.requester_id !== memberId && !isPrOfficer) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขใบคำขอนี้' }, { status: 403 })
    }

    if (pr.status !== 'PENDING') {
      return NextResponse.json({ error: 'ไม่สามารถแก้ไขใบคำขอที่ได้รับการอนุมัติหรือปฏิเสธแล้วได้' }, { status: 400 })
    }

    // Serialize updated form fields into form_data JSON (snake_case for database consistency)
    const formData = {
      urgency,
      order_date: orderDate,
      target_date: targetDate,
      job_type: jobType || [],
      job_type_other: jobTypeOther || null,
      details: details || null,
      channels: channels || [],
      phone,
      attachments: attachments || []
    }

    // Update the pr_request record
    await queryMemberDb(
      `UPDATE pr_requests 
       SET title = ?, has_cost = ?, form_data = ? 
       WHERE id = ?`,
      [
        title,
        hasCost ? 1 : 0,
        JSON.stringify(formData),
        id
      ]
    )

    if (isPrOfficer) {
      // If PR Officer is editing, we do not reset Step 1.
      // We only delete all steps after Step 1 and re-create them.
      await queryMemberDb(
        "DELETE FROM approval_tickets WHERE source_system = 'PR_MEDIA' AND source_id = ? AND step_number > 1",
        [id]
      )

      const digHeads = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ดิจิทัลทางการแพทย์%' LIMIT 1")
      const digHeadId = digHeads.length > 0 ? digHeads[0].id : null

      // Step 2: หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ (WAITING)
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 2, 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', ?, 'WAITING')`,
        [id, digHeadId]
      )

      if (hasCost) {
        // Step 3: เจ้าหน้าที่พัสดุ (WAITING)
        const pasOfficer = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%เจ้าหน้าที่พัสดุ%' OR (position LIKE '%พัสดุ%' AND position NOT LIKE '%หัวหน้า%') LIMIT 1")
        const pasOfficerId = pasOfficer.length > 0 ? pasOfficer[0].id : null
        await queryMemberDb(
          `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
           VALUES ('PR_MEDIA', ?, 3, 'เจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
          [id, pasOfficerId]
        )

        // Step 4: หัวหน้าเจ้าหน้าที่พัสดุ (WAITING)
        const pasHead = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%หัวหน้าเจ้าหน้าที่พัสดุ%' OR position LIKE '%หัวหน้าพัสดุ%' OR (position LIKE '%หัวหน้า%' AND position LIKE '%พัสดุ%') LIMIT 1")
        const pasHeadId = pasHead.length > 0 ? pasHead[0].id : null
        await queryMemberDb(
          `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
           VALUES ('PR_MEDIA', ?, 4, 'หัวหน้าเจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
          [id, pasHeadId]
        )

        // Step 5: ผู้อำนวยการโรงพยาบาลเถิน (WAITING)
        const directors = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ผู้อำนวยการ%' LIMIT 1")
        const directorId = directors.length > 0 ? directors[0].id : null
        await queryMemberDb(
          `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
           VALUES ('PR_MEDIA', ?, 5, 'ผู้อำนวยการโรงพยาบาลเถิน', ?, 'WAITING')`,
          [id, directorId]
        )
      }
    } else {
      // If original creator is editing, we reset the entire workflow back to Step 1 (PENDING)
      await queryMemberDb(
        "DELETE FROM approval_tickets WHERE source_system = 'PR_MEDIA' AND source_id = ?",
        [id]
      )

      const prOfficers = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%นักประชาสัมพันธ์%' LIMIT 1")
      const prOfficerId = prOfficers.length > 0 ? prOfficers[0].id : null

      const digHeads = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ดิจิทัลทางการแพทย์%' LIMIT 1")
      const digHeadId = digHeads.length > 0 ? digHeads[0].id : null

      // Step 1: นักประชาสัมพันธ์ (PENDING)
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 1, 'นักประชาสัมพันธ์', ?, 'PENDING')`,
        [id, prOfficerId]
      )

      // Step 2: หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ (WAITING)
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('PR_MEDIA', ?, 2, 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', ?, 'WAITING')`,
        [id, digHeadId]
      )

      if (hasCost) {
        // Step 3: เจ้าหน้าที่พัสดุ (WAITING)
        const pasOfficer = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%เจ้าหน้าที่พัสดุ%' OR (position LIKE '%พัสดุ%' AND position NOT LIKE '%หัวหน้า%') LIMIT 1")
        const pasOfficerId = pasOfficer.length > 0 ? pasOfficer[0].id : null
        await queryMemberDb(
          `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
           VALUES ('PR_MEDIA', ?, 3, 'เจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
          [id, pasOfficerId]
        )

        // Step 4: หัวหน้าเจ้าหน้าที่พัสดุ (WAITING)
        const pasHead = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%หัวหน้าเจ้าหน้าที่พัสดุ%' OR position LIKE '%หัวหน้าพัสดุ%' OR (position LIKE '%หัวหน้า%' AND position LIKE '%พัสดุ%') LIMIT 1")
        const pasHeadId = pasHead.length > 0 ? pasHead[0].id : null
        await queryMemberDb(
          `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
           VALUES ('PR_MEDIA', ?, 4, 'หัวหน้าเจ้าหน้าที่พัสดุ', ?, 'WAITING')`,
          [id, pasHeadId]
        )

        // Step 5: ผู้อำนวยการโรงพยาบาลเถิน (WAITING)
        const directors = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ผู้อำนวยการ%' LIMIT 1")
        const directorId = directors.length > 0 ? directors[0].id : null
        await queryMemberDb(
          `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
           VALUES ('PR_MEDIA', ?, 5, 'ผู้อำนวยการโรงพยาบาลเถิน', ?, 'WAITING')`,
          [id, directorId]
        )
      }
    }

    return NextResponse.json({ success: true, message: 'แก้ไขคำขอผลิตสื่อประชาสัมพันธ์เรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Update pr-request error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขคำขอ' }, { status: 500 })
  }
}
