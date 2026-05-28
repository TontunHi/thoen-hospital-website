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

    const where: any = all 
      ? {} 
      : { 
          status: 'PUBLISHED',
          publishedAt: {
            lte: new Date()
          }
        }

    if (category) {
      where.category = category
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: {
          images: {
            orderBy: { order: 'asc' }
          }
        }
      }),
      prisma.news.count({ where }),
    ])

    return NextResponse.json({
      news,
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
    const { title, excerpt, content, youtubeUrl, pdfUrl, status, category, publishedAt, images } = body

    if (!title) {
      return NextResponse.json(
        { error: 'กรุณากรอกหัวข้อข่าว' },
        { status: 400 }
      )
    }

    const slug = generateSlug(title)

    // Parse published date or default to now
    const pubDate = publishedAt ? new Date(publishedAt) : new Date()

    // Determine status
    const newsStatus = status || 'DRAFT'

    const news = await prisma.news.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        content: content || null,
        youtubeUrl: youtubeUrl || null,
        pdfUrl: pdfUrl || null,
        status: newsStatus,
        category: category || 'PR',
        publishedAt: pubDate,
        images: {
          create: (images || []).map((url: string, index: number) => ({
            imageUrl: url,
            order: index
          }))
        }
      },
      include: {
        images: true
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
