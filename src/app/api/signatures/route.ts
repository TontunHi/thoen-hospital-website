import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
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

    if (session.role !== 'admin') {
      const settingsRows = await queryMemberDb("SELECT config_value FROM member_system_settings WHERE config_key = 'feature_signature'")
      const isEnabled = settingsRows.length === 0 || settingsRows[0].config_value !== '0'
      if (!isEnabled) {
        return NextResponse.json(
          { error: 'ระบบจัดการลายเซ็นอิเล็กทรอนิกส์ถูกปิดใช้งานชั่วคราว' },
          { status: 403 }
        )
      }
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

    if (session.role !== 'admin') {
      const settingsRows = await queryMemberDb("SELECT config_value FROM member_system_settings WHERE config_key = 'feature_signature'")
      const isEnabled = settingsRows.length === 0 || settingsRows[0].config_value !== '0'
      if (!isEnabled) {
        return NextResponse.json(
          { error: 'ระบบจัดการลายเซ็นอิเล็กทรอนิกส์ถูกปิดใช้งานชั่วคราว' },
          { status: 403 }
        )
      }
    }

    const { imageBase64 } = await request.json()

    if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/png;base64,')) {
      return NextResponse.json(
        { error: 'รูปแบบไฟล์ลายเซ็นไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Limit base64 string length to avoid memory exhaustion (approx 2MB binary = ~2.8MB base64)
    const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
    const MAX_BASE64_LENGTH = Math.ceil((MAX_SIGNATURE_SIZE_BYTES * 4) / 3) + 100
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB' },
        { status: 400 }
      )
    }

    // Extract Base64 data
    const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > MAX_SIGNATURE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB' },
        { status: 400 }
      )
    }

    // Verify PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      return NextResponse.json(
        { error: 'ไฟล์ลายเซ็นไม่ใช่รูปภาพ PNG ที่ถูกต้อง' },
        { status: 400 }
      )
    }

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

    // Audit log
    await logAudit(
      'UPDATE',
      'members',
      'บันทึกหรืออัปเดตลายเซ็นอิเล็กทรอนิกส์ (E-Signature)',
      { username: session.username, email: session.email }
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
