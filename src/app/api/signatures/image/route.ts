import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')

    let targetUsername = session.username

    // If queryUserId is provided, we fetch that user's signature path and verify authorization
    if (queryUserId) {
      const sessionUsers = await queryMemberDb('SELECT id, role FROM members WHERE username = ? AND email = ? LIMIT 1', [session.username, session.email])
      if (sessionUsers.length === 0) {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้ของคุณในระบบ' }, { status: 404 })
      }
      const currentUser = sessionUsers[0]
      const targetUserIdParsed = parseInt(queryUserId, 10)

      const users = await queryMemberDb('SELECT username FROM members WHERE id = ? LIMIT 1', [queryUserId])
      if (users.length > 0) {
        targetUsername = users[0].username
      } else {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้ที่ระบุ' }, { status: 404 })
      }

      // Authorization Check: Only allow if owner, admin, or related through PR/Approval tickets
      const isOwner = currentUser.id === targetUserIdParsed
      const isAdmin = currentUser.role === 'admin'
      
      let isRelated = false
      if (!isOwner && !isAdmin) {
        const relationship = await queryMemberDb(`
          SELECT 1 FROM approval_tickets t 
          JOIN pr_requests r ON t.source_id = r.id AND t.source_system = 'PR' 
          WHERE (r.requester_id = ? AND t.current_approver_id = ?) 
             OR (r.requester_id = ? AND t.current_approver_id = ?) 
             OR (t.current_approver_id = ? AND EXISTS (
                 SELECT 1 FROM approval_tickets t2 
                 WHERE t2.source_id = r.id AND t2.source_system = 'PR' AND t2.current_approver_id = ?
             ))
          LIMIT 1
        `, [currentUser.id, targetUserIdParsed, targetUserIdParsed, currentUser.id, currentUser.id, targetUserIdParsed])
        isRelated = relationship.length > 0
      }

      if (!isOwner && !isAdmin && !isRelated) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงลายเซ็นของผู้ใช้นี้' }, { status: 403 })
      }
    }

    const members = await queryMemberDb(
      'SELECT signature_path FROM members WHERE username = ? LIMIT 1',
      [targetUsername]
    )

    if (members.length === 0 || !members[0].signature_path) {
      return NextResponse.json(
        { error: 'ไม่พบลายเซ็นดิจิทัล' },
        { status: 404 }
      )
    }

    const filepath = path.join(/*turbopackIgnore: true*/ process.cwd(), members[0].signature_path)

    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์ลายเซ็นบนเซิร์ฟเวอร์' },
        { status: 404 }
      )
    }

    const fileBuffer = await fs.promises.readFile(filepath)

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error) {
    console.error('Serve signature image error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงรูปภาพลายเซ็น' },
      { status: 500 }
    )
  }
}
