import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMemberAdmin } from '@/lib/memberAuth'
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

    const news = await prisma.news.findUnique({
      where: { id: newsId },
      include: {
        attachments: true
      }
    })

    if (!news) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการ' },
        { status: 404 }
      )
    }

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
  tx: any,
  newsId: number,
  images: any,
  pdfUrl: any,
  existingAttachments: any
) {
  let finalImages = []
  if (images !== undefined) {
    finalImages = Array.isArray(images) ? images : []
  } else {
    finalImages = existingAttachments
      .filter((att: any) => att.fileType && att.fileType.startsWith('image/'))
      .map((att: any) => att.filePath)
  }

  let finalPdfUrl = null
  if (pdfUrl !== undefined) {
    finalPdfUrl = pdfUrl
  } else {
    const existingPdf = existingAttachments.find((att: any) => att.fileType === 'application/pdf')
    finalPdfUrl = existingPdf ? existingPdf.filePath : null
  }

  await tx.attachment.deleteMany({
    where: { newsId }
  })

  const attachmentsToCreate: any[] = []

  finalImages.forEach((imgUrl: string) => {
    attachmentsToCreate.push({
      filePath: imgUrl,
      fileType: 'image/jpeg',
      originalName: imgUrl.split('/').pop() || 'image.jpg'
    })
  })

  if (finalPdfUrl) {
    attachmentsToCreate.push({
      filePath: finalPdfUrl,
      fileType: 'application/pdf',
      originalName: finalPdfUrl.split('/').pop() || 'document.pdf'
    })
  }

  if (attachmentsToCreate.length > 0) {
    await tx.attachment.createMany({
      data: attachmentsToCreate.map((att: any) => ({
        newsId,
        filePath: att.filePath,
        fileType: att.fileType,
        originalName: att.originalName
      }))
    })
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireMemberAdmin()
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

    const existing = await prisma.news.findUnique({
      where: { id: newsId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    const news = await prisma.$transaction(async (tx: any) => {
      const { startDate, endDate } = calculateNewsDates(status, publishedAt, expiredAt, existing)

      if (images !== undefined || pdfUrl !== undefined) {
        const existingAttachments = await tx.attachment.findMany({
          where: { newsId }
        })
        await recreateNewsAttachments(tx, newsId, images, pdfUrl, existingAttachments)
      }

      return tx.news.update({
        where: { id: newsId },
        data: {
          ...(title !== undefined && { title }),
          youtubeLink: youtubeUrl !== undefined ? youtubeUrl : undefined,
          category: category !== undefined ? category : undefined,
          startDate,
          endDate,
        },
        include: {
          attachments: true
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
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireMemberAdmin()
    if (authResult.error) return authResult.error

    const { id } = await ctx.params
    const newsId = Number.parseInt(id, 10)

    if (Number.isNaN(newsId)) {
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
