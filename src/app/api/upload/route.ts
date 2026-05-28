import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์' },
        { status: 400 }
      )
    }

    const isPdf = file.type === 'application/pdf'
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ภาพ (JPEG, PNG, GIF, WebP) และเอกสาร PDF' },
        { status: 400 }
      )
    }

    const maxSize = isPdf ? 15 * 1024 * 1024 : 5 * 1024 * 1024 // 15MB for PDF, 5MB for images
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `ขนาดไฟล์ต้องไม่เกิน ${isPdf ? '15MB' : '5MB'}` },
        { status: 400 }
      )
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const ext = path.extname(file.name) || '.jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
    const filepath = path.join(uploadsDir, filename)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    const url = `/uploads/${filename}`

    return NextResponse.json(
      { success: true, url, filename, isPdf },
      { status: 201 }
    )
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' },
      { status: 500 }
    )
  }
}
