import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import { z } from 'zod'

const eventService = new HospitalEventService()

const AddAttendanceSchema = z.object({
  memberId: z.number().int().positive('กรุณาระบุบุคลากร'),
  pointsAwarded: z.number().int().min(0).max(10).default(1),
  checkedInAt: z.string().optional(),
  note: z.string().optional(),
})

const UpdateAttendanceSchema = z.object({
  attendanceId: z.number().int().positive('รหัสการเข้าร่วมไม่ถูกต้อง'),
  pointsAwarded: z.number().int().min(0).max(10).optional(),
  checkedInAt: z.string().optional(),
})

const DeleteAttendanceSchema = z.object({
  attendanceId: z.number().int().positive('รหัสการเข้าร่วมไม่ถูกต้อง'),
})

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
    const body = await request.json()
    const parsed = AddAttendanceSchema.safeParse(body)
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
    }

    const attendance = await eventService.addManualAttendance(eventId, parsed.data, actor)
    return NextResponse.json({ success: true, data: attendance }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มผู้เข้าร่วม' },
      { status: 400 }
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
    const parsed = UpdateAttendanceSchema.safeParse(body)
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
    }

    const updated = await eventService.updateAttendance(
      eventId,
      parsed.data.attendanceId,
      {
        pointsAwarded: parsed.data.pointsAwarded,
        checkedInAt: parsed.data.checkedInAt,
      },
      actor
    )
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้เข้าร่วม' },
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
    const body = await request.json()
    const parsed = DeleteAttendanceSchema.safeParse(body)
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
    }

    const result = await eventService.deleteAttendance(eventId, parsed.data.attendanceId, actor)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบผู้เข้าร่วม' },
      { status: 400 }
    )
  }
}
