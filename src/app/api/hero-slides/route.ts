import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { requireNewsPermission } from '@/lib/memberAuth'
import { heroSlideSchema } from '@/lib/schemas/heroSlide'
import { logAudit } from '@/lib/audit'
import { toDbSqlDateTime } from '@/lib/events/eventTimeUtils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    const res: any = await apiGateway.app.getSlides(all)
    const slides = Array.isArray(res)
      ? res
      : (Array.isArray(res?.slides) ? res.slides : (Array.isArray(res?.data) ? res.data : []))
    const slideDuration = (!Array.isArray(res) && typeof res?.slideDuration === 'number')
      ? res.slideDuration
      : 6

    return NextResponse.json({
      success: true,
      slides,
      slideDuration,
    })
  } catch (error: any) {
    console.error('Fetch slides error:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสไลด์ภาพได้' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { slideDuration } = body
    const durationNum = typeof slideDuration === 'number' ? slideDuration : parseInt(String(slideDuration), 10)

    if (isNaN(durationNum) || durationNum < 2 || durationNum > 30) {
      return NextResponse.json(
        { error: 'ความเร็วการเปลี่ยนสไลด์ต้องอยู่ระหว่าง 2 ถึง 30 วินาที' },
        { status: 400 }
      )
    }

    const res = await apiGateway.app.updateSlideDuration(durationNum)

    await logAudit(
      'UPDATE',
      'member_system_settings',
      `ตั้งค่าความเร็วสไลด์โชว์หน้าแรกเป็น ${durationNum} วินาที`,
      authResult.session
    )

    return NextResponse.json({ success: true, slideDuration: res.slideDuration || durationNum })
  } catch (error: any) {
    console.error('Update slide duration error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่าความเร็วสไลด์' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const parsed = heroSlideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { imagePath, title, linkUrl, startDate, endDate, displayOrder, duration } = parsed.data

    const dbStart = toDbSqlDateTime(startDate)
    const dbEnd = toDbSqlDateTime(endDate)

    const res = await apiGateway.app.createSlide({
      imagePath,
      title: title || null,
      linkUrl: linkUrl || null,
      startDate: dbStart,
      endDate: dbEnd,
      displayOrder,
      duration: duration || 6,
    })

    const slide = res.slide || {
      id: res.insertId,
      imagePath,
      title: title || null,
      linkUrl: linkUrl || null,
      startDate: dbStart,
      endDate: dbEnd,
      displayOrder,
      duration: duration || 6,
    }

    await logAudit(
      'CREATE',
      'hero_slides',
      `สร้างสไลด์หัวเว็บ ID ${slide.id || res.insertId}: ${title || 'ไม่มีหัวข้อ'} (${imagePath.endsWith('.mp4') ? 'วิดีโอ MP4' : 'รูปภาพ'})`,
      authResult.session
    )

    return NextResponse.json({ success: true, slide }, { status: 201 })
  } catch (error: any) {
    console.error('Create slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกสไลด์ภาพ' },
      { status: 500 }
    )
  }
}
