import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import { z } from 'zod'

const eventService = new HospitalEventService()

const BorrowItemSchema = z.object({
  itemType: z.enum(['ASSET', 'MATERIAL']),
  assetId: z.number().nullable().optional(),
  materialId: z.number().nullable().optional(),
  itemName: z.string().min(1, 'ต้องระบุชื่อวัสดุ/ครุภัณฑ์'),
  itemCode: z.string().nullable().optional(),
  quantity: z.number().int().min(1, 'จำนวนต้องมากกว่า 0'),
})

const CreateEventSchema = z.object({
  title: z.string().min(1, 'กรุณาระบุชื่อกิจกรรม'),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  eventStartDate: z.string().min(1, 'กรุณาระบุวันเวลาเริ่มต้นกิจกรรม'),
  eventEndDate: z.string().min(1, 'กรุณาระบุวันเวลาสิ้นสุดกิจกรรม'),
  checkinOpenTime: z.string().nullable().optional(),
  checkinCloseTime: z.string().nullable().optional(),
  fiscalYear: z.string().nullable().optional(),
  coOrganizerMemberIds: z.array(z.number()).optional(),
  borrowItems: z.array(BorrowItemSchema).optional(),
})

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const tab = searchParams.get('tab') || 'all'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const result = await eventService.getEvents({
      status,
      search,
      fiscalYear,
      memberId: auth.member.id,
      onlyUpcoming: tab === 'upcoming',
      onlyCompleted: tab === 'completed',
      onlyMyEvents: tab === 'my_events',
      onlyMyRegistrations: tab === 'registered',
      page,
      limit,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถดึงข้อมูลกิจกรรมได้' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  if (auth.member.role !== 'admin' && !auth.member.isAdmin) {
    return NextResponse.json(
      { success: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างกิจกรรมได้' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const parsed = CreateEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'ข้อมูลกิจกรรมไม่ถูกต้อง' },
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

    const event = await eventService.createEvent(parsed.data, actor)

    return NextResponse.json({ success: true, data: event })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการสร้างกิจกรรม' },
      { status: 400 }
    )
  }
}
