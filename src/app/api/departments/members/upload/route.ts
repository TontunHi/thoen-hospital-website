import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/jfif',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
]

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.avif', '.heic', '.heif']

export async function POST(request: Request) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error || !member) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 })
    }

    const fileExt = file.name && file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : ''

    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type?.toLowerCase())
    const isExtValid = fileExt && ALLOWED_EXTENSIONS.includes(fileExt)

    if (!isMimeValid && !isExtValid) {
      return NextResponse.json(
        { success: false, error: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP หรือ HEIC เท่านั้น' },
        { status: 400 }
      )
    }

    // Generate safe ASCII base name to prevent Windows URL/filesystem mojibake and encoding issues
    const rawBase = file.name && file.name.includes('.')
      ? file.name.slice(0, file.name.lastIndexOf('.'))
      : (file.name || 'staff')
    const cleanAscii = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '')
    const safeBaseName = cleanAscii ? `staff-${cleanAscii.slice(0, 30)}` : 'staff'

    const saved = await DocumentStorage.save(file, {
      destinationDir: 'public/uploads/org-chart',
      baseName: safeBaseName,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      allowedExtensions: ALLOWED_EXTENSIONS,
      maxSizeBytes: 15 * 1024 * 1024, // 15MB max for staff photo
      collisionStrategy: 'timestamp'
    })

    await logAudit(
      'CREATE',
      'department_members_photo',
      JSON.stringify({ fileName: saved.fileName, size: saved.fileSize, url: saved.publicUrl }),
      { username: member.name || member.username }
    ).catch(() => {})

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
