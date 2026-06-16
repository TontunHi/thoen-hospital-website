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
    const personalOnly = searchParams.get('personal') === 'true'

    let query = `
      SELECT b.*, 
             DATE_FORMAT(b.start_date, '%Y-%m-%d') as start_date,
             DATE_FORMAT(b.end_date, '%Y-%m-%d') as end_date,
             r.name as room_name, 
             m.name as requester_name, 
             m.department as requester_dept
      FROM meeting_room_bookings b
      LEFT JOIN meeting_rooms r ON b.room_id = r.id
      LEFT JOIN members m ON b.requester_id = m.id
    `
    const params: any[] = []

    if (personalOnly) {
      // Find member ID first
      const users = await queryMemberDb('SELECT id FROM members WHERE username = ?', [session.username])
      if (users.length > 0) {
        query += ' WHERE b.requester_id = ?'
        params.push(users[0].id)
      }
    }

    query += ' ORDER BY b.start_date DESC, b.start_time DESC'
    const bookings = await queryMemberDb(query, params)

    return NextResponse.json({ success: true, bookings })
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจอง' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    // Find member ID
    const users = await queryMemberDb('SELECT id FROM members WHERE username = ?', [session.username])
    if (users.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้ในระบบ' }, { status: 404 })
    }
    const requesterId = users[0].id

    const body = await request.json()
    const {
      topic,
      target_group,
      room_id,
      start_time,
      end_time,
      start_date,
      end_date,
      details,
      fiscal_year,
      attendees_count,
      objective,
      contact_number,
      equipment_json,
      food_json
    } = body

    // Validation
    if (!topic || !target_group || !room_id || !start_time || !end_time || !start_date || !end_date || !fiscal_year || !attendees_count || !objective || !contact_number) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' }, { status: 400 })
    }

    // Overlap Check for APPROVED bookings
    const overlapQuery = `
      SELECT id FROM meeting_room_bookings 
      WHERE room_id = ? 
        AND status = 'APPROVED'
        AND start_date <= ? 
        AND end_date >= ?
        AND start_time < ? 
        AND end_time > ?
    `
    const overlaps = await queryMemberDb(overlapQuery, [
      room_id,
      end_date, // requested end_date
      start_date, // requested start_date
      end_time, // requested end_time
      start_time // requested start_time
    ])

    if (overlaps.length > 0) {
      return NextResponse.json({ 
        error: 'ห้องประชุมนี้ถูกจองและอนุมัติแล้วในช่วงเวลาดังกล่าว กรุณาตรวจสอบเวลาอีกครั้ง' 
      }, { status: 400 })
    }

    // Insert booking
    const insertResult: any = await queryMemberDb(
      `INSERT INTO meeting_room_bookings (
        requester_id, topic, target_group, room_id, start_time, end_time, 
        start_date, end_date, details, fiscal_year, attendees_count, 
        objective, contact_number, equipment_json, food_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        requesterId,
        topic,
        target_group,
        room_id,
        start_time,
        end_time,
        start_date,
        end_date,
        details || null,
        fiscal_year,
        parseInt(attendees_count) || 0,
        objective,
        contact_number,
        equipment_json ? JSON.stringify(equipment_json) : null,
        food_json ? JSON.stringify(food_json) : null
      ]
    )

    const bookingId = insertResult.insertId

    if (bookingId) {
      // Find Director member ID (position LIKE '%ผู้อำนวยการ%')
      const directors = await queryMemberDb("SELECT id FROM members WHERE position LIKE '%ผู้อำนวยการ%' LIMIT 1")
      const directorId = directors.length > 0 ? directors[0].id : null

      // Create immediately pending approval ticket for the Director
      await queryMemberDb(
        `INSERT INTO approval_tickets (source_system, source_id, step_number, assigned_position, current_approver_id, status)
         VALUES ('ROOM_BOOKING', ?, 1, 'ผู้อำนวยการ', ?, 'PENDING')`,
        [bookingId, directorId]
      )
    }

    return NextResponse.json({ success: true, message: 'ส่งคำขอจองห้องประชุมเรียบร้อยแล้ว รอการตรวจสอบอนุมัติ' })
  } catch (error) {
    console.error('Create booking error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกคำขอจองห้องประชุม' }, { status: 500 })
  }
}
