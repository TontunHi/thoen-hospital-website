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

    // Fetch target user's username if userId is provided
    if (queryUserId) {
      const users = await queryMemberDb('SELECT username FROM members WHERE id = ? LIMIT 1', [queryUserId])
      if (users.length > 0) {
        targetUsername = users[0].username
      } else {
        return NextResponse.json({ error: 'ไม่พบผู้ใช้ที่ระบุ' }, { status: 404 })
      }
    }

    const members = await queryMemberDb(
      'SELECT profile_path FROM members WHERE username = ? LIMIT 1',
      [targetUsername]
    )

    if (members.length === 0 || !members[0].profile_path) {
      return NextResponse.json(
        { error: 'ไม่พบรูปโปรไฟล์' },
        { status: 404 }
      )
    }

    const filepath = path.join(process.cwd(), members[0].profile_path)

    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์รูปโปรไฟล์บนเซิร์สน์เวอร์' },
        { status: 404 }
      )
    }

    const fileBuffer = await fs.promises.readFile(filepath)

    // Detect Content-Type from file extension
    const ext = filepath.split('.').pop()?.toLowerCase() || 'png'
    let contentType = 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') {
      contentType = 'image/jpeg'
    } else if (ext === 'webp') {
      contentType = 'image/webp'
    }

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    })
  } catch (error) {
    console.error('Serve profile image error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงรูปโปรไฟล์' },
      { status: 500 }
    )
  }
}
