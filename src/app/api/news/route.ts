import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
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

export async function GET(request: Request) {
  try {
    const page = parseInt(new URL(request.url).searchParams.get('page') || '1')
    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '10')
    const all = new URL(request.url).searchParams.get('all') === 'true'
    const category = new URL(request.url).searchParams.get('category')
    const skip = (page - 1) * limit
    const now = new Date()

    const whereClauses: string[] = []
    const params: any[] = []

    if (!all) {
      whereClauses.push('start_date <= NOW() AND end_date >= NOW()')
    }

    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const [news, countRows] = await Promise.all([
      queryMemberDb(`
        SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate, view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt
        FROM news
        ${whereSql}
        ORDER BY start_date DESC
        LIMIT ${Number(limit)} OFFSET ${Number(skip)}
      `, params),
      queryMemberDb(`
        SELECT COUNT(*) AS total
        FROM news
        ${whereSql}
      `, params),
    ])

    const total = countRows[0]?.total ? Number(countRows[0].total) : 0

    const attachmentsByNewsId = new Map<number, any[]>()
    if (news.length > 0) {
      const newsIds = news.map((n: any) => n.id)
      const placeholders = newsIds.map(() => '?').join(',')
      const attachments = await queryMemberDb(`
        SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName
        FROM attachments
        WHERE news_id IN (${placeholders})
        ORDER BY id ASC
      `, newsIds)

      for (const att of attachments) {
        const list = attachmentsByNewsId.get(att.newsId) || []
        list.push(att)
        attachmentsByNewsId.set(att.newsId, list)
      }
    }

    // Adapt fields to retain compatibility with old frontend references (like images, publishedAt, pdfUrl, status)
    const adaptedNews = news.map((item: any) => {
      const atts = attachmentsByNewsId.get(item.id) || []
      // images logic: filter only image attachments
      const imageAttachments = atts.filter((att: any) => 
        att.fileType && att.fileType.startsWith('image/')
      )
      const images = imageAttachments.map((att: any) => ({
        id: att.id,
        imageUrl: att.filePath,
        order: 0
      }))

      // pdfUrl logic: filter only pdf attachments
      const pdfAttachment = atts.find((att: any) => 
        att.fileType === 'application/pdf'
      )

      // status mapping based on dates
      let status = 'PUBLISHED'
      const startD = new Date(item.startDate)
      const endD = new Date(item.endDate)
      if (startD > now) {
        status = 'DRAFT' // Scheduled to show later
      } else if (endD < now) {
        status = 'ARCHIVED' // Expired
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
        images
      }
    })

    return NextResponse.json({
      news: adaptedNews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
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
    const attachmentsToCreate: any[] = []
    
    // Add images to attachments list
    if (Array.isArray(images)) {
      images.forEach((imgUrl: string) => {
        attachmentsToCreate.push({
          filePath: imgUrl,
          fileType: 'image/jpeg',
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

    const insertRes = await queryMemberDb(`
      INSERT INTO news (title, slug, category, youtube_link, start_date, end_date, view_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
    `, [title, slug, category || 'PR', youtubeUrl || null, startDate, endDate])

    const insertId = (insertRes as any)?.insertId || (insertRes as any)?.[0]?.insertId

    const createdAttachments: any[] = []
    for (const att of attachmentsToCreate) {
      const attRes = await queryMemberDb(`
        INSERT INTO attachments (news_id, file_path, file_type, original_name, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [insertId, att.filePath, att.fileType, att.originalName])
      const attId = (attRes as any)?.insertId || (attRes as any)?.[0]?.insertId
      createdAttachments.push({
        id: attId,
        newsId: insertId,
        filePath: att.filePath,
        fileType: att.fileType,
        originalName: att.originalName,
      })
    }

    const news = {
      id: insertId,
      title,
      slug,
      category: category || 'PR',
      youtubeLink: youtubeUrl || null,
      startDate,
      endDate,
      viewCount: 0,
      attachments: createdAttachments
    }

    return NextResponse.json({ success: true, news }, { status: 201 })
  } catch (error) {
    console.error('News create error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างข่าว' },
      { status: 500 }
    )
  }
}
