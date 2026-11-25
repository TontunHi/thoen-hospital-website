import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import { handleEventAttachmentUpload } from '@/lib/events/eventAttachmentUploadHelper'
import { getErrorMessage } from '@/lib/http/apiResponse'

export async function GET(
  _request: Request,
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
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err, 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์แนบ') },
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

    return await handleEventAttachmentUpload(request, eventId, auth.member)
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึกสิ่งที่แนบ') },
      { status: 500 }
    )
  }
}
