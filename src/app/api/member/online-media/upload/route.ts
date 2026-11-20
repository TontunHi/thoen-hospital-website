import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage, StorageValidationError } from '@/lib/storage/documentStorage'
import { resolveBucketForVisibility, type MediaVisibility } from '@/lib/media/onlineMediaService'

export const dynamic = 'force-dynamic'

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 * 1024 // 10GB

const ALLOWED_MEDIA_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  'video/x-msvideo',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const ALLOWED_MEDIA_EXTS = [
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.mkv',
  '.avi',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]

const initMultipartSchema = z.object({
  action: z.literal('init'),
  visibility: z
    .string()
    .optional()
    .transform((v) => (String(v || 'PUBLIC').toUpperCase() === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC') as MediaVisibility),
  fileName: z.string().trim().min(1, 'กรุณาระบุชื่อไฟล์'),
  mimeType: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || 'video/mp4'),
  fileSize: z.coerce
    .number()
    .positive('ขนาดไฟล์ต้องมากกว่า 0 byte')
    .max(MAX_UPLOAD_SIZE_BYTES, 'ขนาดไฟล์เกินกำหนดสูงสุด 10GB'),
})

const completeMultipartSchema = z.object({
  action: z.literal('complete'),
  bucket: z.string().trim().min(1),
  s3Key: z.string().trim().min(1),
  uploadId: z.string().trim().min(1),
  parts: z
    .array(
      z.object({
        ETag: z.string().min(1),
        PartNumber: z.coerce.number().int().positive(),
      })
    )
    .min(1),
})

const abortMultipartSchema = z.object({
  action: z.literal('abort'),
  bucket: z.string().trim().min(1),
  s3Key: z.string().trim().min(1),
  uploadId: z.string().trim().min(1),
})

function buildS3Prefix(visibility: MediaVisibility): string {
  return DocumentStorage.formatDateDirectory(
    `online-media/${visibility.toLowerCase()}`,
    new Date(),
    'monthly'
  )
}

export async function POST(request: NextRequest) {
  try {
    const { member, error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
    if (error || !member) return error

    const { searchParams } = new URL(request.url)
    const queryAction = searchParams.get('action')

    // Fast path for raw binary chunk streaming (avoids multipart/form-data parser limits)
    if (queryAction === 'part') {
      const uploadId = String(searchParams.get('uploadId') || '')
      const bucket = String(searchParams.get('bucket') || '')
      const s3Key = String(searchParams.get('s3Key') || '')
      const partNumber = parseInt(String(searchParams.get('partNumber') || '0'), 10)

      if (!uploadId || !bucket || !s3Key || isNaN(partNumber) || partNumber <= 0) {
        return NextResponse.json(
          { success: false, error: 'พารามิเตอร์ชิ้นส่วนไฟล์ไม่ครบถ้วน' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await request.arrayBuffer())
      if (buffer.length === 0) {
        return NextResponse.json(
          { success: false, error: 'ชิ้นส่วนไฟล์ว่างเปล่า' },
          { status: 400 }
        )
      }

      const uploadedPart = await DocumentStorage.uploadMultipartPartS3({
        bucket,
        s3Key,
        uploadId,
        partNumber,
        body: buffer,
      })

      return NextResponse.json({ success: true, data: uploadedPart })
    }

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json()

      if (body?.action === 'init') {
        const parsed = initMultipartSchema.safeParse(body)
        if (!parsed.success) {
          const detail = parsed.error.issues.map((i) => i.message).join(', ')
          return NextResponse.json(
            { success: false, error: `ข้อมูลเริ่มต้นการอัปโหลดไม่ถูกต้อง: ${detail}` },
            { status: 400 }
          )
        }
        const bucket = resolveBucketForVisibility(parsed.data.visibility)
        const keyPrefix = buildS3Prefix(parsed.data.visibility)
        const initRes = await DocumentStorage.initMultipartS3({
          bucket,
          keyPrefix,
          fileName: parsed.data.fileName,
          mimeType: parsed.data.mimeType,
          fileSize: parsed.data.fileSize,
          allowedMimeTypes: ALLOWED_MEDIA_MIMES,
          allowedExtensions: ALLOWED_MEDIA_EXTS,
          maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        })
        return NextResponse.json({ success: true, data: initRes })
      }

      if (body?.action === 'complete') {
        const parsed = completeMultipartSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'ข้อมูลรวมไฟล์ Multipart ไม่ถูกต้อง' },
            { status: 400 }
          )
        }
        const completed = await DocumentStorage.completeMultipartS3(parsed.data)
        return NextResponse.json({ success: true, data: completed })
      }

      if (body?.action === 'abort') {
        const parsed = abortMultipartSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json({ success: false, error: 'ข้อมูลยกเลิกไม่ถูกต้อง' }, { status: 400 })
        }
        await DocumentStorage.abortMultipartS3(parsed.data)
        return NextResponse.json({ success: true })
      }

      return NextResponse.json({ success: false, error: 'Action ไม่ถูกต้อง' }, { status: 400 })
    }

    const formData = await request.formData()
    const action = formData.get('action')

    if (action === 'part') {
      const chunk = formData.get('chunk') as File | null
      const uploadId = String(formData.get('uploadId') || '')
      const bucket = String(formData.get('bucket') || '')
      const s3Key = String(formData.get('s3Key') || '')
      const partNumber = parseInt(String(formData.get('partNumber') || '0'), 10)

      if (!chunk || !uploadId || !bucket || !s3Key || isNaN(partNumber) || partNumber <= 0) {
        return NextResponse.json(
          { success: false, error: 'ข้อมูลชิ้นส่วนไฟล์ไม่ครบถ้วน' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await chunk.arrayBuffer())
      const uploadedPart = await DocumentStorage.uploadMultipartPartS3({
        bucket,
        s3Key,
        uploadId,
        partNumber,
        body: buffer,
      })

      return NextResponse.json({ success: true, data: uploadedPart })
    }

    const file = formData.get('file') as File | null
    const visibilityRaw = String(formData.get('visibility') || 'PUBLIC').toUpperCase()
    const visibility: MediaVisibility = visibilityRaw === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC'
    const kind = String(formData.get('kind') || 'primary')

    if (!file) {
      return NextResponse.json({ success: false, error: 'กรุณาเลือกไฟล์' }, { status: 400 })
    }

    const bucket = resolveBucketForVisibility(visibility)
    const keyPrefix = buildS3Prefix(visibility)

    const isThumbnail = kind === 'thumbnail'
    const saved = await DocumentStorage.saveToS3Only(file, {
      bucket,
      keyPrefix,
      allowedMimeTypes: isThumbnail
        ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        : ALLOWED_MEDIA_MIMES,
      allowedExtensions: isThumbnail
        ? ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        : ALLOWED_MEDIA_EXTS,
      maxSizeBytes: isThumbnail ? 10 * 1024 * 1024 : 25 * 1024 * 1024,
    })

    return NextResponse.json({ success: true, data: saved }, { status: 201 })
  } catch (error: any) {
    if (error instanceof StorageValidationError || error?.name === 'StorageValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    console.error('Online media upload error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ไปยัง MinIO' },
      { status: 500 }
    )
  }
}
