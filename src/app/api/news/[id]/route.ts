import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { requireNewsPermission } from '@/lib/memberAuth'
import { newsCreateSchema } from '@/lib/schemas/news'
import { adaptNewsItem } from '../route'
import {
  buildNewsAttachmentsPayload,
  calculateNewsDates,
} from '@/lib/cms/newsUpdateHelper'
import { logger } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const rawRes: any = await apiGateway.app.getNewsById(id)
    const news = rawRes?.data || rawRes
    if (!news || !news.id) {
      return NextResponse.json({ error: 'ไม่พบข่าวที่ต้องการ' }, { status: 404 })
    }

    const adaptedNews = adaptNewsItem(news, new Date())
    return NextResponse.json({ news: adaptedNews })
  } catch (error) {
    logger.error({ err: error }, 'News detail error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const { id } = await ctx.params
    const newsId = Number.parseInt(id, 10)
    if (Number.isNaN(newsId)) {
      return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = newsCreateSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { title, youtubeUrl, pdfUrl, status, category, publishedAt, expiredAt, images } =
      parsed.data

    const existingRes = await apiGateway.app.getNewsById(newsId)
    if (!existingRes.success || !existingRes.data) {
      return NextResponse.json({ error: 'ไม่พบข่าวที่ต้องการแก้ไข' }, { status: 404 })
    }
    const existing = existingRes.data

    const { startDate, endDate } = calculateNewsDates(
      status,
      publishedAt,
      expiredAt,
      existing
    )
    const attachments = buildNewsAttachmentsPayload(
      images,
      pdfUrl,
      existing.attachments || []
    )

    const updateRes = await apiGateway.app.updateNews(newsId, {
      title,
      category,
      youtubeLink: youtubeUrl,
      startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
      endDate: endDate.toISOString().slice(0, 19).replace('T', ' '),
      attachments,
    })

    return NextResponse.json({ success: true, news: updateRes.data || { id: newsId } })
  } catch (error) {
    logger.error({ err: error }, 'News update error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข่าว' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const { id } = await ctx.params
    const newsId = Number.parseInt(id, 10)
    if (Number.isNaN(newsId)) {
      return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 })
    }

    await apiGateway.app.deleteNews(newsId)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'News delete error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบข่าว' }, { status: 500 })
  }
}
