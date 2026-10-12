import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'

const eventService = new HospitalEventService()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  const { id } = await params
  const eventId = parseInt(id, 10)
  if (isNaN(eventId)) {
    return NextResponse.json({ success: false, error: 'รหัสกิจกรรมไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const result = await eventService.registerForEvent(eventId, auth.member.id)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  const { id } = await params
  const eventId = parseInt(id, 10)
  if (isNaN(eventId)) {
    return NextResponse.json({ success: false, error: 'รหัสกิจกรรมไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const result = await eventService.cancelRegistration(eventId, auth.member.id)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการยกเลิกการลงทะเบียน' },
      { status: 400 }
    )
  }
}
