import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import { requireNewsPermission } from '@/lib/memberAuth'
import { newsCreateSchema } from '@/lib/schemas/news'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
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

    const newsRows = await queryMemberDb(`
      SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate, view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt
      FROM news
      WHERE id = ?
      LIMIT 1
    `, [newsId])

    if (newsRows.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการ' },
        { status: 404 }
      )
    }
    const news = newsRows[0]

    const attachments = await queryMemberDb(`
      SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName
      FROM attachments
      WHERE news_id = ?
      ORDER BY id ASC
    `, [newsId])
    news.attachments = attachments

    // Adapt to match what front-end expects
    const now = new Date()
    const imageAttachments = news.attachments.filter((att: any) => 
      att.fileType && att.fileType.startsWith('image/')
    )
    const images = imageAttachments.map((att: any) => ({
      id: att.id,
      imageUrl: att.filePath,
      order: 0
    }))

    const pdfAttachment = news.attachments.find((att: any) => 
      att.fileType === 'application/pdf'
    )

    let status = 'PUBLISHED'
    if (news.startDate > now) {
      status = 'DRAFT'
    } else if (news.endDate < now) {
      status = 'ARCHIVED'
    }

    const adaptedNews = {
      id: news.id,
      title: news.title,
      slug: news.slug,
      excerpt: '',
      content: '', // content not present in the new schema but returned as blank
      youtubeUrl: news.youtubeLink,
      pdfUrl: pdfAttachment ? pdfAttachment.filePath : null,
      status,
      category: news.category,
      views: news.viewCount || 0,
      publishedAt: news.startDate,
      expiredAt: news.endDate,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
      images
    }

    return NextResponse.json({ news: adaptedNews })
  } catch (error) {
    console.error('News detail error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}

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
  const startDate = publishedAt ? new Date(publishedAt) : existing.startDate
  const endDate = expiredAt ? new Date(expiredAt) : existing.endDate

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

async function recreateNewsAttachments(
  newsId: number,
  images: any,
  pdfUrl: any,
  existingAttachments: any
) {
  let finalImages: string[] = []
  if (images !== undefined) {
    finalImages = Array.isArray(images) ? images : []
  } else {
    finalImages = existingAttachments
      .filter((att: any) => att.file_type && att.file_type.startsWith('image/'))
      .map((att: any) => att.file_path)
  }

  let finalPdfUrl = null
  if (pdfUrl !== undefined) {
    finalPdfUrl = pdfUrl
  } else {
    const existingPdf = existingAttachments.find((att: any) => att.file_type === 'application/pdf')
    finalPdfUrl = existingPdf ? existingPdf.file_path : null
  }

  await queryMemberDb('DELETE FROM attachments WHERE news_id = ?', [newsId])

  for (const imgUrl of finalImages) {
    await queryMemberDb(`
      INSERT INTO attachments (news_id, file_path, file_type, original_name, created_at)
      VALUES (?, ?, 'image/jpeg', ?, NOW())
    `, [newsId, imgUrl, imgUrl.split('/').pop() || 'image.jpg'])
  }

  if (finalPdfUrl) {
    await queryMemberDb(`
      INSERT INTO attachments (news_id, file_path, file_type, original_name, created_at)
      VALUES (?, ?, 'application/pdf', ?, NOW())
    `, [newsId, finalPdfUrl, finalPdfUrl.split('/').pop() || 'document.pdf'])
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
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const parsed = newsCreateSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { title, youtubeUrl, pdfUrl, status, category, publishedAt, expiredAt, images } = parsed.data

    const existingRows = await queryMemberDb(`
      SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate
      FROM news
      WHERE id = ?
      LIMIT 1
    `, [newsId])

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }
    const existing = existingRows[0]

    const { startDate, endDate } = calculateNewsDates(status, publishedAt, expiredAt, existing)

    if (images !== undefined || pdfUrl !== undefined) {
      const existingAttachments = await queryMemberDb('SELECT * FROM attachments WHERE news_id = ?', [newsId])
      await recreateNewsAttachments(newsId, images, pdfUrl, existingAttachments)
    }

    await queryMemberDb(`
      UPDATE news
      SET title = COALESCE(?, title),
          youtube_link = COALESCE(?, youtube_link),
          category = COALESCE(?, category),
          start_date = ?,
          end_date = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [
      title !== undefined ? title : null,
      youtubeUrl !== undefined ? youtubeUrl : null,
      category !== undefined ? category : null,
      startDate,
      endDate,
      newsId,
    ])

    const updatedRows = await queryMemberDb('SELECT * FROM news WHERE id = ? LIMIT 1', [newsId])
    const updatedAttachments = await queryMemberDb('SELECT * FROM attachments WHERE news_id = ? ORDER BY id ASC', [newsId])
    const updatedNews = {
      ...updatedRows[0],
      attachments: updatedAttachments,
    }

    return NextResponse.json({ success: true, news: updatedNews })
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
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const { id } = await ctx.params
    const newsId = Number.parseInt(id, 10)

    if (Number.isNaN(newsId)) {
      return NextResponse.json(
        { error: 'ID ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const existingRows = await queryMemberDb('SELECT id FROM news WHERE id = ? LIMIT 1', [newsId])

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการลบ' },
        { status: 404 }
      )
    }

    await queryMemberDb('DELETE FROM attachments WHERE news_id = ?', [newsId])
    await queryMemberDb('DELETE FROM news WHERE id = ?', [newsId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('News delete error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข่าว' },
      { status: 500 }
    )
  }
}
