import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { requireNewsPermission } from '@/lib/memberAuth'
import { newsCreateSchema } from '@/lib/schemas/news'
import { adaptNewsItem } from '../route'

function handleDraftDates(endDate: Date): { startDate: Date; endDate: Date } {
  const future = new Date()
  future.setFullYear(future.getFullYear() + 10)
  const startDate = future
  let finalEndDate = endDate
  if (finalEndDate < new Date()) {
    const farFuture = new Date()
    farFuture.setFullYear(farFuture.getFullYear() + 50)
    finalEndDate = farFuture
  }
  return { startDate, endDate: finalEndDate }
}

function handleArchivedDates(startDate: Date): { startDate: Date; endDate: Date } {
  const past = new Date()
  past.setDate(past.getDate() - 1)
  const endDate = past
  let finalStartDate = startDate
  if (finalStartDate > new Date()) {
    finalStartDate = new Date()
  }
  return { startDate: finalStartDate, endDate }
}

function handlePublishedDates(
  startDate: Date,
  endDate: Date,
  publishedAt: string | null | undefined,
  expiredAt: string | null | undefined
): { startDate: Date; endDate: Date } {
  let finalStartDate = startDate
  const fiveYears = new Date()
  fiveYears.setFullYear(fiveYears.getFullYear() + 5)
  if (finalStartDate > fiveYears) {
    finalStartDate = new Date()
  } else if (finalStartDate > new Date()) {
    finalStartDate = publishedAt ? new Date(publishedAt) : new Date()
  }

  let finalEndDate = endDate
  if (finalEndDate < new Date()) {
    finalEndDate = expiredAt ? new Date(expiredAt) : new Date()
    if (!expiredAt) {
      const farFuture = new Date()
      farFuture.setFullYear(farFuture.getFullYear() + 50)
      finalEndDate = farFuture
    }
  }
  return { startDate: finalStartDate, endDate: finalEndDate }
}

function calculateNewsDates(
  status: string | undefined,
  publishedAt: string | null | undefined,
  expiredAt: string | null | undefined,
  existing: any
) {
  const startDate = publishedAt ? new Date(publishedAt) : new Date(existing.startDate || existing.start_date)
  const endDate = expiredAt ? new Date(expiredAt) : new Date(existing.endDate || existing.end_date)

  if (status === 'DRAFT') {
    return handleDraftDates(endDate)
  }
  if (status === 'ARCHIVED') {
    return handleArchivedDates(startDate)
  }
  if (status === 'PUBLISHED') {
    return handlePublishedDates(startDate, endDate, publishedAt, expiredAt)
  }

  return { startDate, endDate }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const res = await apiGateway.app.getNewsById(id)
    if (!res.success || !res.data) {
      return NextResponse.json({ error: 'ไม่พบข่าวที่ต้องการ' }, { status: 404 })
    }

    const adaptedNews = adaptNewsItem(res.data, new Date())
    return NextResponse.json({ news: adaptedNews })
  } catch (error) {
    console.error('News detail error:', error)
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

    const { title, youtubeUrl, pdfUrl, status, category, publishedAt, expiredAt, images } = parsed.data

    const existingRes = await apiGateway.app.getNewsById(newsId)
    if (!existingRes.success || !existingRes.data) {
      return NextResponse.json({ error: 'ไม่พบข่าวที่ต้องการแก้ไข' }, { status: 404 })
    }
    const existing = existingRes.data

    const { startDate, endDate } = calculateNewsDates(status, publishedAt, expiredAt, existing)

    let attachments: Array<{ filePath: string; fileType: string; originalName: string }> | undefined
    if (images !== undefined || pdfUrl !== undefined) {
      attachments = []
      const existingAttachments = existing.attachments || []

      let finalImages: string[] = []
      if (images !== undefined) {
        finalImages = Array.isArray(images) ? images : []
      } else {
        finalImages = existingAttachments
          .filter((att: any) => (att.fileType || att.file_type)?.startsWith('image/'))
          .map((att: any) => att.filePath || att.file_path)
      }

      let finalPdfUrl: string | null = null
      if (pdfUrl !== undefined) {
        finalPdfUrl = pdfUrl
      } else {
        const existingPdf = existingAttachments.find((att: any) => (att.fileType || att.file_type) === 'application/pdf')
        finalPdfUrl = existingPdf ? (existingPdf.filePath || existingPdf.file_path) : null
      }

      for (const imgUrl of finalImages) {
        attachments.push({
          filePath: imgUrl,
          fileType: 'image/jpeg',
          originalName: imgUrl.split('/').pop() || 'image.jpg',
        })
      }

      if (finalPdfUrl) {
        attachments.push({
          filePath: finalPdfUrl,
          fileType: 'application/pdf',
          originalName: finalPdfUrl.split('/').pop() || 'document.pdf',
        })
      }
    }

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
    console.error('News update error:', error)
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
    console.error('News delete error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบข่าว' }, { status: 500 })
  }
}
