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
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
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
    const { title, excerpt, content, youtubeUrl, pdfUrl, status, category, publishedAt, images } = body

    const existing = await prisma.news.findUnique({
      where: { id: newsId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    // Prepare transaction to update news and update its images
    const news = await prisma.$transaction(async (tx: any) => {
      // If images array is provided, clear old images and create new ones
      if (images !== undefined) {
        await tx.newsImage.deleteMany({
          where: { newsId }
        })

        if (Array.isArray(images) && images.length > 0) {
          await tx.newsImage.createMany({
            data: images.map((url: string, index: number) => ({
              newsId,
              imageUrl: url,
              order: index
            }))
          })
        }
      }

      const pubDate = publishedAt ? new Date(publishedAt) : undefined

      return tx.news.update({
        where: { id: newsId },
        data: {
          ...(title !== undefined && { title }),
          excerpt: excerpt !== undefined ? excerpt : undefined,
          content: content !== undefined ? content : undefined,
          youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : undefined,
          pdfUrl: pdfUrl !== undefined ? pdfUrl : undefined,
          ...(status !== undefined && { status }),
          ...(category !== undefined && { category }),
          ...(pubDate !== undefined && { publishedAt: pubDate }),
        },
        include: {
          images: true
        }
      })
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
