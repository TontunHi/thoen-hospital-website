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
    const { title, youtubeUrl, pdfUrl, status, category, publishedAt, expiredAt, images } = body

    const existing = await prisma.news.findUnique({
      where: { id: newsId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบข่าวที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    // Start Transaction to update news and recreate attachments
    const news = await prisma.$transaction(async (tx: any) => {
      // Calculate start and end date
      let startDate = publishedAt ? new Date(publishedAt) : existing.startDate
      let endDate = expiredAt ? new Date(expiredAt) : existing.endDate

      if (status !== undefined) {
        if (status === 'DRAFT') {
          const future = new Date()
          future.setFullYear(future.getFullYear() + 10)
          startDate = future
          // Reset end date to far future if it was archived in the past
          if (endDate < new Date()) {
            const farFuture = new Date()
            farFuture.setFullYear(farFuture.getFullYear() + 50)
            endDate = farFuture
          }
        } else if (status === 'ARCHIVED') {
          const past = new Date()
          past.setDate(past.getDate() - 1)
          endDate = past
          // Reset start date to now if it was draft in the future
          if (startDate > new Date()) {
            startDate = new Date()
          }
        } else if (status === 'PUBLISHED') {
          // If restoring from draft (future startDate) or archived (past endDate)
          if (startDate > new Date()) {
            startDate = publishedAt ? new Date(publishedAt) : new Date()
          }
          if (endDate < new Date()) {
            endDate = expiredAt ? new Date(expiredAt) : new Date()
            if (!expiredAt) {
              const farFuture = new Date()
              farFuture.setFullYear(farFuture.getFullYear() + 50)
              endDate = farFuture
            }
          }
        }
      }

      // Recreate attachments if images or pdfUrl are provided
      if (images !== undefined || pdfUrl !== undefined) {
        // Retrieve current attachments to preserve what is not explicitly modified if needed
        const existingAttachments = await tx.attachment.findMany({
          where: { newsId }
        })

        // Determine images: if images parameter is undefined, keep existing images
        let finalImages = []
        if (images !== undefined) {
          finalImages = Array.isArray(images) ? images : []
        } else {
          finalImages = existingAttachments
            .filter((att: any) => att.fileType && att.fileType.startsWith('image/'))
            .map((att: any) => att.filePath)
        }

        // Determine PDF: if pdfUrl parameter is undefined, keep existing pdf
        let finalPdfUrl = null
        if (pdfUrl !== undefined) {
          finalPdfUrl = pdfUrl
        } else {
          const existingPdf = existingAttachments.find((att: any) => att.fileType === 'application/pdf')
          finalPdfUrl = existingPdf ? existingPdf.filePath : null
        }

        // Delete old attachments
        await tx.attachment.deleteMany({
          where: { newsId }
        })

        const attachmentsToCreate = []

        // Set images
        finalImages.forEach((imgUrl: string) => {
          attachmentsToCreate.push({
            filePath: imgUrl,
            fileType: 'image/jpeg',
            originalName: imgUrl.split('/').pop() || 'image.jpg'
          })
        })

        // Set PDF
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
