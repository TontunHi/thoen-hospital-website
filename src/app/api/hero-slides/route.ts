import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { heroSlideSchema } from '@/lib/schemas/heroSlide'

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

    return NextResponse.json({ success: true, slides })
  } catch (error: any) {
    console.error('Fetch slides error:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสไลด์ภาพได้' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Validate role
    const authResult = await requireMemberAdmin()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const parsed = heroSlideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { imagePath, title, linkUrl, startDate, endDate, displayOrder } = parsed.data

    const start = new Date(startDate)
    const end = new Date(endDate)

    const slide = await prisma.heroSlide.create({
      data: {
        imagePath,
        title: title || null,
        linkUrl: linkUrl || null,
        startDate: start,
        endDate: end,
        displayOrder: displayOrder || 0,
      },
    })

    return NextResponse.json({ success: true, slide }, { status: 201 })
  } catch (error: any) {
    console.error('Create slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกสไลด์ภาพ' },
      { status: 500 }
    )
  }
}
