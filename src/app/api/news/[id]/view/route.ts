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

    // 1. Get Client IP Address
    const xForwardedFor = request.headers.get('x-forwarded-for')
    const ip = xForwardedFor 
      ? xForwardedFor.split(',')[0].trim() 
      : (request.headers.get('x-real-ip') || '127.0.0.1')

    // 2. Check for existing view from this IP in the last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const recentView = await prisma.newsView.findFirst({
      where: {
        newsId,
        ip,
        viewedAt: {
          gt: oneHourAgo
        }
      }
    })

    if (!recentView) {
      // Record view log and increment view count in a transaction
      await prisma.$transaction([
        prisma.newsView.create({
          data: {
            newsId,
            ip
          }
        }),
        prisma.news.update({
          where: { id: newsId },
          data: {
            views: {
              increment: 1
            }
          }
        })
      ])

      return NextResponse.json({ success: true, incremented: true })
    }

    return NextResponse.json({ success: true, incremented: false })
  } catch (error) {
    console.error('Increment view error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
