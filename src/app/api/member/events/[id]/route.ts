import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import { z } from 'zod'

const eventService = new HospitalEventService()

const UpdateEventSchema = z.object({
  title: z.string().min(1, 'กรุณาระบุชื่อกิจกรรม').optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  eventStartDate: z.string().optional(),
  eventEndDate: z.string().optional(),
  checkinOpenTime: z.string().nullable().optional(),
  checkinCloseTime: z.string().nullable().optional(),
  fiscalYear: z.string().nullable().optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']).optional(),
  coOrganizerMemberIds: z.array(z.number()).optional(),
})

export async function GET(
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
    const event = await eventService.getEventById(eventId, auth.member.id)
    if (!event) {
      return NextResponse.json({ success: false, error: 'ไม่พบกิจกรรมที่ระบุ' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: event })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const body = await request.json()
    const parsed = UpdateEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const actor = {
      id: auth.member.id,
      name: auth.member.name,
      username: auth.member.username,
      role: auth.member.role,
      department: auth.member.department,
    }

    const updated = await eventService.updateEvent(eventId, parsed.data, actor)
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขกิจกรรม' },
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
    const actor = {
      id: auth.member.id,
      name: auth.member.name,
      username: auth.member.username,
      role: auth.member.role,
      department: auth.member.department,
    }

    const result = await eventService.deleteEvent(eventId, actor)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบกิจกรรม' },
      { status: 400 }
    )
  }
}
