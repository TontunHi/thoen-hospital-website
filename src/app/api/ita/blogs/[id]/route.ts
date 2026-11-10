import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { apiGateway } from '@/lib/apiGateway'
import { z } from 'zod'

const UpdateBlogSchema = z.object({
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

// Public GET: Fetch single blog post details
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'รหัสบทความไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const blog = await apiGateway.app.getItaBlogById(id)

    if (!blog) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข่าวหรือบทความนี้' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: blog })
  } catch (error: any) {
    console.error('Failed to fetch ITA blog details:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' } },
      { status: 500 }
    )
  }
}

// Protected PUT: Update an existing blog post
export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'รหัสบทความไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการ' } },
        { status: 401 }
      )
    }

    const blog = await apiGateway.app.getItaBlogById(id)
    if (!blog) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบบทความที่ต้องการแก้ไข' } },
        { status: 404 }
      )
    }

    const members = await apiGateway.app.getMembers({ search: session.username, limit: 5 })
    const member = members.find((m: any) => m.username === session.username)

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้ใช้นี้ในระบบ' } },
        { status: 404 }
      )
    }

    // Verify ownership or admin role
    if (blog.author_id !== member.id && member.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์แก้ไขบทความนี้' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = UpdateBlogSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
        { status: 400 }
      )
    }

    const { title, content } = parsed.data
    const slug = generateSlug(title)

    await apiGateway.app.updateItaBlog(id, { title, slug, content })

    return NextResponse.json({ success: true, message: 'แก้ไขบทความสำเร็จแล้ว' })
  } catch (error: any) {
    console.error('Failed to update ITA blog:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการแก้ไขบทความ' } },
      { status: 500 }
    )
  }
}

// Protected DELETE: Delete a blog post
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'รหัสบทความไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการ' } },
        { status: 401 }
      )
    }

    const blog = await apiGateway.app.getItaBlogById(id)
    if (!blog) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบบทความที่ต้องการลบ' } },
        { status: 404 }
      )
    }

    const members = await apiGateway.app.getMembers({ search: session.username, limit: 5 })
    const member = members.find((m: any) => m.username === session.username)

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้ใช้นี้ในระบบ' } },
        { status: 404 }
      )
    }

    // Verify ownership or admin role
    if (blog.author_id !== member.id && member.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ลบบทความนี้' } },
        { status: 403 }
      )
    }

    await apiGateway.app.deleteItaBlog(id)

    return NextResponse.json({ success: true, message: 'ลบบทความสำเร็จแล้ว' })
  } catch (error: any) {
    console.error('Failed to delete ITA blog:', error)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดในการลบบทความ' } },
      { status: 500 }
    )
  }
}
