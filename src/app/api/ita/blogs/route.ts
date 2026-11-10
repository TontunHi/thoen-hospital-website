import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { z } from 'zod'

const CreateBlogSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อเรื่อง').max(255, 'ชื่อเรื่องยาวเกินไป'),
  content: z.string().min(1, 'กรุณากรอกเนื้อหาบทความ'),
})

function generateSlug(title: string): string {
  const yearMatch = title.match(/\b(25\d{2})\b/)
  if (yearMatch) {
    return `ita-${yearMatch[1]}`
  }
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Public GET: Fetch all blog posts
export async function GET() {
  try {
    const blogs = await apiGateway.app.getItaBlogs()
    return NextResponse.json({ success: true, data: blogs })
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

    const members = await apiGateway.app.getMembers({ search: session.username, limit: 5 })
    const author = members.find((m: any) => m.username === session.username)

    if (!author) {
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

    const { title, content } = parsed.data
    const authorName = typeof author.name === 'string' ? author.name : session.username
    const authorPosition = author.position ? String(author.position).trim() : 'เจ้าพนักงานเครื่องคอมพิวเตอร์'
    const slug = generateSlug(title)

    const result = await apiGateway.app.createItaBlog({
      title,
      slug,
      content,
      authorId: author.id as number,
      authorName,
      authorPosition,
    })

    return NextResponse.json({ success: true, data: { id: result.id } })
  } catch (error: any) {
    console.error('Failed to create ITA blog:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการเขียนบทความ' } },
      { status: 500 }
    )
  }
}
