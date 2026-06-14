import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์ที่อัปโหลด' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'รูปแบบไฟล์ไม่ถูกต้อง กรุณาอัปโหลดรูปภาพ (PNG, JPG, WEBP)' },
        { status: 400 }
      )
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์ใหญ่เกินไป จำกัดไม่เกิน 5MB' },
        { status: 400 }
      )
    }

    const safeUsername = session.username.replace(/[^a-zA-Z0-9_-]/g, '_')
    const userDir = path.join(process.cwd(), 'storage', safeUsername)

    // Ensure directory exists
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true })
    }

    // Validate and extract file extension safely to prevent directory traversal
    const originalExt = path.extname(file.name).toLowerCase()
    let ext = 'png'
    if (originalExt) {
      const parsedExt = originalExt.slice(1) // Remove leading dot
      if (/^[a-zA-Z0-9]{1,5}$/.test(parsedExt) && ['png', 'jpg', 'jpeg', 'webp'].includes(parsedExt)) {
        ext = parsedExt
      }
    }
    const filename = `profile.${ext}`
    const filepath = path.join(userDir, filename)

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Save to disk
    await fs.promises.writeFile(filepath, buffer)

    const relativePath = `storage/${safeUsername}/${filename}`

    // Update profile_path in members table
    await queryMemberDb(
      'UPDATE members SET profile_path = ? WHERE username = ?',
      [relativePath, session.username]
    )

    return NextResponse.json({
      success: true,
      message: 'อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว',
      path: relativePath
    })
  } catch (error) {
    console.error('Upload profile picture error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์' },
      { status: 500 }
    )
  }
}
