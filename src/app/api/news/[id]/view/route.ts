import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/news/[id]/view'>
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

    // In the new schema (hospital_news database), there is no newsView table to record IP logs.
    // We will just directly increment view_count on the news table when called.
    await prisma.news.update({
      where: { id: newsId },
      data: {
        viewCount: {
          increment: 1
        }
      }
    })

    return NextResponse.json({ success: true, incremented: true })
  } catch (error) {
    console.error('Increment view error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
