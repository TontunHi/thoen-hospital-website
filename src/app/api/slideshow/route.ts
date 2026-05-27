import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// GET all slideshows (Public)
export async function GET() {
  try {
    const slideshows = await prisma.slideshow.findMany({
      orderBy: { order: 'asc' },
    })
    return NextResponse.json({ slideshows })
  } catch (error) {
    console.error('Failed to fetch slideshows:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลสไลด์โชว์' },
      { status: 500 }
    )
  }
}

// POST new slideshow (Protected)
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
    const { title, description, imageUrl, order, isActive } = body

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: 'กรุณากรอกหัวข้อและเลือกรูปภาพ' },
        { status: 400 }
      )
    }

    const slideshow = await prisma.slideshow.create({
      data: {
        title,
        description: description || null,
        imageUrl,
        order: order !== undefined ? parseInt(order) : 0,
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({ success: true, slideshow }, { status: 201 })
  } catch (error) {
    console.error('Failed to create slideshow:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มสไลด์โชว์' },
      { status: 500 }
    )
  }
}
