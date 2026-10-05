import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireNewsPermission } from '@/lib/memberAuth'
import { heroSlideSchema } from '@/lib/schemas/heroSlide'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    let slides
    if (all) {
      // For Admin: fetch all slides ordered by displayOrder then creation date
      slides = await prisma.heroSlide.findMany({
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
      })

      // Normalize gaps if any exist
      let hasGap = false
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].displayOrder !== i + 1) {
          hasGap = true
          break
        }
      }

      if (hasGap) {
        for (let i = 0; i < slides.length; i++) {
          if (slides[i].displayOrder !== i + 1) {
            await prisma.heroSlide.update({
              where: { id: slides[i].id },
              data: { displayOrder: i + 1 },
            })
            slides[i].displayOrder = i + 1
          }
        }
      }
    } else {
      // For Public: fetch only scheduled/active slides
      const now = new Date()
      slides = await prisma.heroSlide.findMany({
        where: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
      })
    }

    // Fetch slide duration setting
    let slideDuration = 6
    try {
      const durationSetting = await prisma.memberSystemSetting.findUnique({
        where: { configKey: 'hero_slide_duration_seconds' },
      })
      if (durationSetting?.configValue) {
        const parsedSec = parseInt(durationSetting.configValue, 10)
        if (!isNaN(parsedSec) && parsedSec >= 2 && parsedSec <= 30) {
          slideDuration = parsedSec
        }
      }
    } catch {
      // Fallback to default
    }

    return NextResponse.json({ success: true, slides, slideDuration })
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

    await prisma.memberSystemSetting.upsert({
      where: { configKey: 'hero_slide_duration_seconds' },
      update: { configValue: String(durationNum) },
      create: { configKey: 'hero_slide_duration_seconds', configValue: String(durationNum) },
    })

    await logAudit(
      'UPDATE',
      'member_system_settings',
      `ตั้งค่าความเร็วสไลด์โชว์หน้าแรกเป็น ${durationNum} วินาที`,
      authResult.session
    )

    return NextResponse.json({ success: true, slideDuration: durationNum })
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
    // Validate role
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

    const start = new Date(startDate)
    const end = new Date(endDate)

    let finalOrder = displayOrder
    if (!finalOrder || finalOrder <= 0) {
      const maxSlide = await prisma.heroSlide.findFirst({
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      finalOrder = (maxSlide?.displayOrder ?? 0) + 1
    }

    const slide = await prisma.heroSlide.create({
      data: {
        imagePath,
        title: title || null,
        linkUrl: linkUrl || null,
        startDate: start,
        endDate: end,
        displayOrder: finalOrder,
        duration: duration || 6,
      },
    })

    await logAudit(
      'CREATE',
      'hero_slides',
      `สร้างสไลด์หัวเว็บ ID ${slide.id}: ${title || 'ไม่มีหัวข้อ'} (${imagePath.endsWith('.mp4') ? 'วิดีโอ MP4' : 'รูปภาพ'})`,
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
