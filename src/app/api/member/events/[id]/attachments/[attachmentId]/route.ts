import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { id, attachmentId } = await context.params
    const eventId = parseInt(id, 10)
    const attId = parseInt(attachmentId, 10)

    if (isNaN(eventId) || isNaN(attId)) {
      return NextResponse.json({ success: false, error: 'รหัสข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    const eventService = new HospitalEventService()
    const result = await eventService.deleteAttachment(eventId, attId, auth.member)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'เกิดข้อผิดพลาดในการลบไฟล์แนบ' },
      { status: 500 }
    )
  }
}
