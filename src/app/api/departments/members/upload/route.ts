import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError, sanitizeName } from '@/lib/storage/documentStorage'

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 })
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP เท่านั้น' },
        { status: 400 }
      )
    }

    const rawBase = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : 'staff'
    const safeBaseName = sanitizeName(rawBase, 40) || 'staff'

    const saved = await DocumentStorage.save(file, {
      destinationDir: 'public/uploads/org-chart',
      baseName: safeBaseName,
      allowedMimeTypes: allowedMimes,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      maxSizeBytes: 5 * 1024 * 1024, // 5MB max for staff photo
      collisionStrategy: 'timestamp'
    })

    return NextResponse.json({
      success: true,
      data: {
        url: saved.publicUrl,
        relativePath: saved.relativePath,
        fileName: saved.fileName
      }
    })
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' },
      { status: 500 }
    )
  }
}
