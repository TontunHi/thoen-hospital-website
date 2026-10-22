import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError, sanitizeName } from '@/lib/storage/documentStorage'

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์' },
        { status: 400 }
      )
    }

    if (file.name && file.name.length > 80) {
      return NextResponse.json(
        { error: `ไม่อนุญาตให้ตั้งชื่อไฟล์ยาวเกิน 80 ตัวอักษร (ชื่อไฟล์ปัจจุบัน: ${file.name.length} ตัวอักษร) กรุณาเปลี่ยนชื่อไฟล์ให้สั้นลงก่อนอัปโหลด` },
        { status: 400 }
      )
    }

    const publishedAt = (formData.get('publishedAt') as string) || ''
    const dateStr = DocumentStorage.formatDateDirectory('', publishedAt, 'daily')

    const isPdf = file.type === 'application/pdf'
    const origExt = file.name && file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const rawFileBase = file.name && file.name.includes('.')
      ? file.name.slice(0, file.name.lastIndexOf('.'))
      : (file.name || 'file')
    const safeBaseName = sanitizeName(rawFileBase, 50) || 'file'

    const saved = await DocumentStorage.save(file, {
      destinationDir: `public/uploads/member-pr/${dateStr}`,
      baseName: safeBaseName,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed',
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip'],
      maxSizeBytes: 25 * 1024 * 1024,
      collisionStrategy: 'timestamp',
    })

    return NextResponse.json(
      { success: true, url: saved.publicUrl, filename: file.name, isPdf },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Member upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { member, error } = await requireMemberApi()
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'ไม่ระบุพาธของไฟล์' }, { status: 400 })
    }

    if (!filePath.startsWith('/uploads/member-pr/') || filePath.includes('..')) {
      return NextResponse.json({ error: 'พาธของไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    await DocumentStorage.delete(filePath)
    return NextResponse.json({ success: true, message: 'ลบไฟล์เรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Delete member upload error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบไฟล์อัปโหลด' },
      { status: 500 }
    )
  }
}

