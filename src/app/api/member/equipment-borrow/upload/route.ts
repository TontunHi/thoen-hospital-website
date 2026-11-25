import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError } from '@/lib/storage/documentStorage'
import { logAudit } from '@/lib/audit'
import { getErrorMessage } from '@/lib/http/apiResponse'

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const MAX_EQUIPMENT_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
const EQUIPMENT_UPLOAD_PREFIX = '/uploads/equipment-borrow/'

export async function POST(request: Request) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const rawItemType = String(formData.get('itemType') || '').toUpperCase()
    const baseName = rawItemType === 'ASSET' ? 'asset' : 'material'

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเลือกไฟล์รูปภาพที่ต้องการอัปโหลด' },
        { status: 400 }
      )
    }

    const destinationDir = DocumentStorage.formatDateDirectory(
      'public/uploads/equipment-borrow',
      new Date(),
      'monthly'
    )

    const saved = await DocumentStorage.save(file, {
      destinationDir,
      baseName,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
      allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
      maxSizeBytes: MAX_EQUIPMENT_IMAGE_BYTES,
      collisionStrategy: 'timestamp',
    })

    await logAudit(
      'CREATE',
      'uploads',
      `อัปโหลดรูปภาพอุปกรณ์ (${baseName}): ${saved.publicUrl} (${Math.round(saved.fileSize / 1024)} KB)`,
      { username: auth.member.username }
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          url: saved.publicUrl,
          fileName: saved.fileName,
          fileSize: saved.fileSize,
          mimeType: saved.mimeType,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ') },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireMemberApi({ requiredPermission: 'manage_borrow' })
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath || !filePath.startsWith(EQUIPMENT_UPLOAD_PREFIX) || filePath.includes('..')) {
      return NextResponse.json(
        { success: false, error: 'พาธของไฟล์รูปภาพไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    await DocumentStorage.delete(filePath)

    await logAudit(
      'DELETE',
      'uploads',
      `ลบรูปภาพอุปกรณ์: ${filePath}`,
      { username: auth.member.username }
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการลบรูปภาพ') },
      { status: 500 }
    )
  }
}
