import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/banner/[id]'>
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const { id } = await ctx.params
    const bannerId = parseInt(id)

    if (isNaN(bannerId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, subtitle, imageUrl, linkUrl, isActive } = body

    const existing = await prisma.banner.findUnique({
      where: { id: bannerId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบแบนเนอร์ที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    const updated = await prisma.banner.update({
      where: { id: bannerId },
      data: {
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ success: true, banner: updated })
  } catch (error) {
    console.error('Failed to update banner:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขแบนเนอร์' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/banner/[id]'>
) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const { id } = await ctx.params
    const bannerId = parseInt(id)

    if (isNaN(bannerId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const existing = await prisma.banner.findUnique({
      where: { id: bannerId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบแบนเนอร์ที่ต้องการลบ' },
        { status: 404 }
      )
    }

    await prisma.banner.delete({
      where: { id: bannerId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete banner:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบแบนเนอร์' },
      { status: 500 }
    )
  }
}
