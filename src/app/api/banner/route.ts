import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// GET all banners (Public)
export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ banners })
  } catch (error) {
    console.error('Failed to fetch banners:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลแบนเนอร์' },
      { status: 500 }
    )
  }
}

// POST new banner (Protected)
export async function POST(request: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, subtitle, imageUrl, linkUrl, isActive } = body

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: 'กรุณากรอกหัวข้อและเลือกรูปภาพ' },
        { status: 400 }
      )
    }

    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle: subtitle || null,
        imageUrl,
        linkUrl: linkUrl || null,
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({ success: true, banner }, { status: 201 })
  } catch (error) {
    console.error('Failed to create banner:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มแบนเนอร์' },
      { status: 500 }
    )
  }
}
