import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
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
    const blogs = await queryMemberDb(
      'SELECT id, title, slug, content, author_name, author_position, created_at, updated_at FROM ita_blogs ORDER BY created_at DESC'
    )
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

    // Fetch author details
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

    const author = users[0]
    const body = await request.json()
    const parsed = CreateBlogSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 }
      )
    }

    const { title, content } = parsed.data
    const authorName = author.name || session.username
    const authorPosition = author.position ? author.position.trim() : 'เจ้าพนักงานเครื่องคอมพิวเตอร์'
    const slug = generateSlug(title)

    const result = await queryMemberDb(
      'INSERT INTO ita_blogs (title, slug, content, author_id, author_name, author_position) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, content, author.id, authorName, authorPosition]
    )

    return NextResponse.json({ success: true, data: { id: (result as any).insertId } })
  } catch (error: any) {
    console.error('Failed to create ITA blog:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการเขียนบทความ' } },
      { status: 500 }
    )
  }
}
