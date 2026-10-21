import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { z } from 'zod'

const NoteAttachmentSchema = z.object({
  attachmentType: z.literal('NOTE'),
  title: z.string().min(1, 'กรุณาระบุหัวข้อบันทึก'),
  textContent: z.string().min(1, 'กรุณาระบุข้อความสรุปหรือเนื้อหาบันทึก'),
  displayOrder: z.number().int().optional(),
})

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.avif', '.svg', '.heic', '.heif']
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/jfif',
  'image/png',
  'image/x-png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/heic',
  'image/heif',
]
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_DOC_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']
const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/octet-stream',
]
const MAX_DOC_SIZE = 25 * 1024 * 1024 // 25MB

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { id } = await context.params
    const eventId = parseInt(id, 10)
    if (isNaN(eventId)) {
      return NextResponse.json({ success: false, error: 'รหัสกิจกรรมไม่ถูกต้อง' }, { status: 400 })
    }

    const eventService = new HospitalEventService()
    const attachments = await eventService.getAttachments(eventId)
    return NextResponse.json({ success: true, attachments })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์แนบ' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { id } = await context.params
    const eventId = parseInt(id, 10)
    if (isNaN(eventId)) {
      return NextResponse.json({ success: false, error: 'รหัสกิจกรรมไม่ถูกต้อง' }, { status: 400 })
    }

    const eventService = new HospitalEventService()
    const contentType = request.headers.get('content-type') || ''

    // 1. JSON Payload: Note / Text Announcement
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const parsed = NoteAttachmentSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' },
          { status: 400 }
        )
      }

      const created = await eventService.addAttachment(
        eventId,
        {
          attachmentType: 'NOTE',
          title: parsed.data.title,
          textContent: parsed.data.textContent,
          displayOrder: parsed.data.displayOrder ?? 0,
        },
        auth.member
      )

      return NextResponse.json({ success: true, data: created })
    }

    // 2. Multipart Form Data: Image (Single/Batch) or Document
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const rawType = formData.get('attachmentType')?.toString() || 'IMAGE'
      const attachmentType = rawType === 'DOCUMENT' ? 'DOCUMENT' : 'IMAGE'
      const baseTitle = formData.get('title')?.toString()?.trim() || ''

      const files: any[] = []
      const formFiles = formData.getAll('files')
      for (const item of formFiles) {
        if (item && typeof item === 'object' && 'name' in item && 'size' in item && (item as any).size > 0) {
          files.push(item)
        }
      }
      const singleFile = formData.get('file')
      if (
        singleFile &&
        typeof singleFile === 'object' &&
        'name' in singleFile &&
        'size' in singleFile &&
        (singleFile as any).size > 0 &&
        !files.includes(singleFile)
      ) {
        files.push(singleFile)
      }

      if (files.length === 0) {
        return NextResponse.json({ success: false, error: 'กรุณาเลือกไฟล์ที่ต้องการอัปโหลด' }, { status: 400 })
      }

      const allowedExts = attachmentType === 'IMAGE' ? ALLOWED_IMAGE_EXTS : ALLOWED_DOC_EXTS
      const allowedMimes = attachmentType === 'IMAGE' ? ALLOWED_IMAGE_MIMES : ALLOWED_DOC_MIMES
      const maxSize = attachmentType === 'IMAGE' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE

      const savedAttachments = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (file.size > maxSize) {
          const limitMb = maxSize / (1024 * 1024)
          return NextResponse.json(
            { success: false, error: `ไฟล์ "${file.name}" มีขนาดเกิน ${limitMb}MB` },
            { status: 400 }
          )
        }

        const rawExt = file.name.split('.').pop()?.toLowerCase() || ''
        const ext = rawExt ? `.${rawExt}` : ''
        if (!allowedExts.includes(ext)) {
          return NextResponse.json(
            { success: false, error: `ไฟล์ "${file.name}" นามสกุล ${ext || 'ไม่ระบุ'} ไม่รองรับ` },
            { status: 400 }
          )
        }

        const savedFile = await DocumentStorage.save(file, {
          destinationDir: `public/uploads/events/${eventId}`,
          allowedExtensions: allowedExts,
          allowedMimeTypes: allowedMimes,
          maxSizeBytes: maxSize,
        })

        // Determine title: if baseTitle provided and multiple files, append index
        let itemTitle = baseTitle
        if (!itemTitle) {
          itemTitle = file.name.replace(/\.[^/.]+$/, '')
        } else if (files.length > 1) {
          itemTitle = `${baseTitle} (${i + 1})`
        }

        const created = await eventService.addAttachment(
          eventId,
          {
            attachmentType,
            title: itemTitle,
            filePath: savedFile.publicUrl,
            fileType: savedFile.mimeType,
            fileSize: savedFile.fileSize,
            displayOrder: i,
          },
          auth.member
        )

        savedAttachments.push(created)
      }

      return NextResponse.json({
        success: true,
        count: savedAttachments.length,
        data: savedAttachments.length === 1 ? savedAttachments[0] : savedAttachments,
      })
    }

    return NextResponse.json({ success: false, error: 'Unsupported Content-Type' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'เกิดข้อผิดพลาดในการบันทึกสิ่งที่แนบ' },
      { status: 500 }
    )
  }
}
