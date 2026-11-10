import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { requireNewsPermission } from '@/lib/memberAuth'
import { newsCreateSchema } from '@/lib/schemas/news'

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

export function adaptNewsItem(item: any, now: Date = new Date()) {
  const atts = item.attachments || []
  const imageAttachments = atts.filter((att: any) => 
    att.fileType && att.fileType.startsWith('image/')
  )
  const images = imageAttachments.map((att: any) => ({
    id: att.id,
    imageUrl: att.filePath,
    order: 0,
  }))

  const pdfAttachment = atts.find((att: any) => 
    att.fileType === 'application/pdf'
  )

  let status = 'PUBLISHED'
  const startD = new Date(item.startDate)
  const endD = new Date(item.endDate)
  if (startD > now) {
    status = 'DRAFT'
  } else if (endD < now) {
    status = 'ARCHIVED'
  }

  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    excerpt: '',
    content: '',
    youtubeUrl: item.youtubeLink,
    pdfUrl: pdfAttachment ? pdfAttachment.filePath : null,
    status,
    category: item.category,
    views: item.viewCount || 0,
    publishedAt: item.startDate,
    expiredAt: item.endDate,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    images,
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const all = url.searchParams.get('all') === 'true'
    const category = url.searchParams.get('category') || undefined
    const search = url.searchParams.get('search') || undefined

    const res = await apiGateway.app.getNews({
      page,
      limit,
      category,
      all,
      search,
    })

    const now = new Date()
    const adaptedNews = (res.data || []).map((item: any) => adaptNewsItem(item, now))

    return NextResponse.json({
      news: adaptedNews,
      pagination: res.pagination || {
        page,
        limit,
        total: res.total || adaptedNews.length,
        totalPages: Math.ceil((res.total || adaptedNews.length) / limit) || 1,
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
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const parsed = newsCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { title, youtubeUrl, pdfUrl, status, category, publishedAt, expiredAt, images } = parsed.data
    const slug = generateSlug(title)

    const startDate = publishedAt ? new Date(publishedAt) : new Date()
    let endDate = expiredAt ? new Date(expiredAt) : new Date()
    if (!expiredAt) {
      endDate.setFullYear(endDate.getFullYear() + 50)
    }

    if (status === 'DRAFT') {
      startDate.setFullYear(startDate.getFullYear() + 10)
    } else if (status === 'ARCHIVED') {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      endDate = pastDate
    }

    const attachmentsToCreate: Array<{ filePath: string; fileType: string; originalName: string }> = []
    if (Array.isArray(images)) {
      images.forEach((imgUrl: string) => {
        attachmentsToCreate.push({
          filePath: imgUrl,
          fileType: 'image/jpeg',
          originalName: imgUrl.split('/').pop() || 'image.jpg',
        })
      })
    }

    if (pdfUrl) {
      attachmentsToCreate.push({
        filePath: pdfUrl,
        fileType: 'application/pdf',
        originalName: pdfUrl.split('/').pop() || 'document.pdf',
      })
    }

    const res = await apiGateway.app.createNews({
      title,
      slug,
      category: category || 'PR',
      youtubeLink: youtubeUrl || null,
      startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
      endDate: endDate.toISOString().slice(0, 19).replace('T', ' '),
      attachments: attachmentsToCreate,
    })

    return NextResponse.json({ success: true, news: res.data || { id: res.insertId, title, slug } }, { status: 201 })
  } catch (error) {
    console.error('News create error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างข่าว' },
      { status: 500 }
    )
  }
}
