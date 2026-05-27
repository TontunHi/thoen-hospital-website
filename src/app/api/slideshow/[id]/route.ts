import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/slideshow/[id]'>
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
    const slideshowId = parseInt(id)

    if (isNaN(slideshowId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, description, imageUrl, order, isActive } = body

    const existing = await prisma.slideshow.findUnique({
      where: { id: slideshowId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบสไลด์โชว์ที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    const updated = await prisma.slideshow.update({
      where: { id: slideshowId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(order !== undefined && { order: parseInt(order) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ success: true, slideshow: updated })
  } catch (error) {
    console.error('Failed to update slideshow:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขสไลด์โชว์' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/slideshow/[id]'>
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
    const slideshowId = parseInt(id)

    if (isNaN(slideshowId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const existing = await prisma.slideshow.findUnique({
      where: { id: slideshowId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบสไลด์โชว์ที่ต้องการลบ' },
        { status: 404 }
      )
    }

    await prisma.slideshow.delete({
      where: { id: slideshowId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete slideshow:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสไลด์โชว์' },
      { status: 500 }
    )
  }
}
