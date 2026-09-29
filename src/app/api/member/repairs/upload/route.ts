import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรูปภาพอย่างน้อย 1 ไฟล์' }, { status: 400 })
    }

    if (files.length > 5) {
      return NextResponse.json({ error: 'สามารถอัปโหลดรูปภาพได้สูงสุดไม่เกิน 5 ไฟล์' }, { status: 400 })
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    const maxFileSize = 10 * 1024 * 1024 // 10 MB per file

    // Folder structured by Year/Month: e.g. public/uploads/repairs/2026/09
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const uploadRelativeDir = `/uploads/repairs/${year}/${month}`
    const uploadAbsoluteDir = path.join(process.cwd(), 'public', 'uploads', 'repairs', year, month)

    await mkdir(uploadAbsoluteDir, { recursive: true })

    const uploadedUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validation
      if (!allowedMimeTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ (รองรับ JPEG, PNG, WebP, GIF)` },
          { status: 400 }
        )
      }

      if (file.size > maxFileSize) {
        return NextResponse.json(
          { error: `ไฟล์ "${file.name}" มีขนาดเกิน 10MB (ขนาดปัจจุบัน: ${(file.size / (1024 * 1024)).toFixed(1)}MB)` },
          { status: 400 }
        )
      }

      const ext = (path.extname(file.name) || '.jpg').toLowerCase()
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json(
          { error: `นามสกุลไฟล์ "${ext}" ไม่ได้รับอนุญาต` },
          { status: 400 }
        )
      }

      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const safeFileName = `repair_${uniqueSuffix}${ext}`
      const targetFilePath = path.join(uploadAbsoluteDir, safeFileName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(targetFilePath, buffer)

      uploadedUrls.push(`${uploadRelativeDir}/${safeFileName}`)
    }

    return NextResponse.json({
      success: true,
      message: `อัปโหลดรูปภาพสำเร็จ ${uploadedUrls.length} ไฟล์`,
      data: {
        urls: uploadedUrls,
      },
    })
  } catch (error: any) {
    console.error('Repair photo upload error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + error.message }, { status: 500 })
  }
}
