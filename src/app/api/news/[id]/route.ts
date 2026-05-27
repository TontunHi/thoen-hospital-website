import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/news/[id]'>
) {
  try {
    const { id } = await ctx.params
    const newsId = parseInt(id)

    if (isNaN(newsId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const news = await prisma.news.findUnique({
      where: { id: newsId },
    })

    if (!news) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการ' },
        { status: 404 }
      )
    }

    return NextResponse.json({ news })
  } catch (error) {
    console.error('News detail error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/news/[id]'>
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
    const newsId = parseInt(id)

    if (isNaN(newsId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, excerpt, content, image, isPublished } = body

    const existing = await prisma.news.findUnique({
      where: { id: newsId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    const news = await prisma.news.update({
      where: { id: newsId },
      data: {
        ...(title !== undefined && { title }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...(image !== undefined && { image: image || null }),
        ...(isPublished !== undefined && { isPublished }),
      },
    })

    return NextResponse.json({ success: true, news })
  } catch (error) {
    console.error('News update error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขข่าว' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/news/[id]'>
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
    const newsId = parseInt(id)

    if (isNaN(newsId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const existing = await prisma.news.findUnique({
      where: { id: newsId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการลบ' },
        { status: 404 }
      )
    }

    await prisma.news.delete({
      where: { id: newsId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('News delete error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข่าว' },
      { status: 500 }
    )
  }
}
