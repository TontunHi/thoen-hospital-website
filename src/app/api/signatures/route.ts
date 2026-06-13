import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import fs from 'fs'
import path from 'path'

// Ensure local directory exists
const SIGNATURE_DIR = path.join(process.cwd(), 'storage', 'signatures')

if (!fs.existsSync(SIGNATURE_DIR)) {
  fs.mkdirSync(SIGNATURE_DIR, { recursive: true })
}

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const members = await queryMemberDb(
      'SELECT signature_path, updated_at FROM members WHERE username = ? LIMIT 1',
      [session.username]
    )

    if (members.length === 0 || !members[0].signature_path) {
      return NextResponse.json({ success: true, exists: false })
    }

    return NextResponse.json({
      success: true,
      exists: true,
      updatedAt: members[0].updated_at
    })
  } catch (error) {
    console.error('Fetch signature error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลลายเซ็น' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const { imageBase64 } = await request.json()

    if (!imageBase64 || !imageBase64.startsWith('data:image/png;base64,')) {
      return NextResponse.json(
        { error: 'รูปแบบไฟล์ลายเซ็นไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Extract Base64 data
    const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Generate directory based on username (safe for OS filename)
    const safeUsername = session.username.replace(/[^a-zA-Z0-9_-]/g, '_')
    const userDir = path.join(process.cwd(), 'storage', safeUsername)
    
    // Ensure user directory exists
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true })
    }

    const filepath = path.join(userDir, 'signature.png')

    // Save to server local storage
    await fs.promises.writeFile(filepath, buffer)

    const relativePath = `storage/${safeUsername}/signature.png`
    
    // Update the member's signature path
    await queryMemberDb(
      'UPDATE members SET signature_path = ? WHERE username = ?',
      [relativePath, session.username]
    )

    return NextResponse.json({
      success: true,
      message: 'บันทึกลายเซ็นเรียบร้อยแล้ว',
      path: relativePath
    })
  } catch (error) {
    console.error('Save signature error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกลายเซ็น' },
      { status: 500 }
    )
  }
}
