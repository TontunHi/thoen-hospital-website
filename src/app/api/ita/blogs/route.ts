import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { ItaBlogService } from '@/lib/cms/ItaBlogService'
import { z } from 'zod'

const CreateBlogSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อเรื่อง').max(255, 'ชื่อเรื่องยาวเกินไป'),
  content: z.string().min(1, 'กรุณากรอกเนื้อหาบทความ'),
})

// Public GET: Fetch paginated blog posts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const result = await ItaBlogService.listBlogs({ page, limit })
    return NextResponse.json({ success: true, data: result.data, pagination: result.pagination })
  } catch (error: any) {
    console.error('Failed to fetch ITA blogs:', error)
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบทความ' } },
      { status: 500 }
    )
  }
}

// Protected POST: Create a new blog post
export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการ' } },
        { status: 401 }
      )
    }

    const users = await queryMemberDb(
      'SELECT id, name, position FROM members WHERE username = ? AND email = ? LIMIT 1',
      [session.username, session.email]
    )

    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้ใช้นี้ในระบบ' } },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = CreateBlogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 }
      )
    }

    const author = users[0]
    const created = await ItaBlogService.createBlog({
      title: parsed.data.title,
      content: parsed.data.content,
      author: {
        id: author.id,
        name: author.name || session.username,
        position: author.position,
      },
    })

    return NextResponse.json({ success: true, data: { id: created.id } })
  } catch (error: any) {
    console.error('Failed to create ITA blog:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการเขียนบทความ' } },
      { status: 500 }
    )
  }
}
