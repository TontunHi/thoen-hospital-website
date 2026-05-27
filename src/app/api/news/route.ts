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
    const skip = (page - 1) * limit

    const where = all ? {} : { isPublished: true }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
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
    const { title, excerpt, content, image, isPublished } = body

    if (!title || !excerpt || !content) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน (หัวข้อ, บทคัดย่อ, เนื้อหา)' },
        { status: 400 }
      )
    }

    const slug = generateSlug(title)

    const news = await prisma.news.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        image: image || null,
        isPublished: isPublished !== false,
        publishedAt: new Date(),
      },
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
