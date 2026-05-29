import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\u0E00-\u0E7Fa-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200) + '-' + Date.now().toString(36)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const all = searchParams.get('all') === 'true'
    const category = searchParams.get('category')
    const skip = (page - 1) * limit
    const now = new Date()

    const where: any = {}

    // In the external DB schema, we don't have a status column. Instead, active news are determined by dates.
    // We check if start_date <= now <= end_date
    if (!all) {
      where.startDate = { lte: now }
      where.endDate = { gte: now }
    }

    if (category) {
      where.category = category
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        include: {
          attachments: {
            orderBy: { id: 'asc' }
          }
        }
      }),
      prisma.news.count({ where }),
    ])

    // Adapt fields to retain compatibility with old frontend references (like images, publishedAt, pdfUrl, status)
    const adaptedNews = news.map((item: any) => {
      // images logic: filter only image attachments
      const imageAttachments = item.attachments.filter((att: any) => 
        att.fileType && att.fileType.startsWith('image/')
      )
      const images = imageAttachments.map((att: any) => ({
        id: att.id,
        imageUrl: att.filePath,
        order: 0
      }))

      // pdfUrl logic: filter only pdf attachments
      const pdfAttachment = item.attachments.find((att: any) => 
        att.fileType === 'application/pdf'
      )

      // status mapping based on dates
      let status = 'PUBLISHED'
      if (item.startDate > now) {
        status = 'DRAFT' // Scheduled to show later
      } else if (item.endDate < now) {
        status = 'ARCHIVED' // Expired
      }

      // excerpt fallback (no excerpt column in database)
      // we can try to extract clean text from any other sources if available, or empty string
      const excerpt = ''

      return {
        id: item.id,
        title: item.title,
        slug: item.slug,
        excerpt,
        content: '', // content not present in the new schema but used in view detail.
        youtubeUrl: item.youtubeLink,
        pdfUrl: pdfAttachment ? pdfAttachment.filePath : null,
        status,
        category: item.category,
        views: item.viewCount || 0,
        publishedAt: item.startDate,
        expiredAt: item.endDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        images
      }
    })

    return NextResponse.json({
      news: adaptedNews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('News list error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข่าว' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, youtubeUrl, pdfUrl, status, category, publishedAt, expiredAt, images } = body

    if (!title) {
      return NextResponse.json(
        { error: 'กรุณากรอกหัวข้อข่าว' },
        { status: 400 }
      )
    }

    const slug = generateSlug(title)

    // Calculate dates based on status or publishedAt
    const startDate = publishedAt ? new Date(publishedAt) : new Date()
    // For end_date, set a very far future date (e.g., 50 years later) if published, or in the past if archived/draft
    let endDate = expiredAt ? new Date(expiredAt) : new Date()
    if (!expiredAt) {
      endDate.setFullYear(endDate.getFullYear() + 50) // 50 years in the future
    }

    if (status === 'DRAFT') {
      // For draft, start date is in the future so it's not active yet
      startDate.setFullYear(startDate.getFullYear() + 10) 
    } else if (status === 'ARCHIVED') {
      // For archived, end date is in the past to prevent it showing on site, but can be restored
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      endDate = pastDate
    }

    // Attachments generation
    const attachmentsToCreate = []
    
    // Add images to attachments list
    if (Array.isArray(images)) {
      images.forEach((imgUrl: string) => {
        attachmentsToCreate.push({
          filePath: imgUrl,
          fileType: 'image/jpeg', // Defaulting to jpeg, could parse extension
          originalName: imgUrl.split('/').pop() || 'image.jpg'
        })
      })
    }

    // Add PDF to attachments list
    if (pdfUrl) {
      attachmentsToCreate.push({
        filePath: pdfUrl,
        fileType: 'application/pdf',
        originalName: pdfUrl.split('/').pop() || 'document.pdf'
      })
    }

    const news = await prisma.news.create({
      data: {
        title,
        slug,
        category: category || 'PR',
        youtubeLink: youtubeUrl || null,
        startDate,
        endDate,
        viewCount: 0,
        attachments: {
          create: attachmentsToCreate
        }
      },
      include: {
        attachments: true
      }
    })

    return NextResponse.json({ success: true, news }, { status: 201 })
  } catch (error) {
    console.error('News create error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างข่าว' },
      { status: 500 }
    )
  }
}
