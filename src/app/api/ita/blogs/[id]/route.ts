import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { ItaBlogService } from '@/lib/cms/ItaBlogService'
import { z } from 'zod'

const UpdateBlogSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อเรื่อง').max(255, 'ชื่อเรื่องยาวเกินไป'),
  content: z.string().min(1, 'กรุณากรอกเนื้อหาบทความ'),
})

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

    const blog = await ItaBlogService.getBlogByIdOrSlug(id)
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

    const users = await queryMemberDb('SELECT id, role FROM members WHERE username = ? AND email = ? LIMIT 1', [
      session.username,
      session.email,
    ])
    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้ใช้นี้ในระบบ' } },
        { status: 404 }
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

    await ItaBlogService.updateBlog(id, parsed.data, users[0])
    return NextResponse.json({ success: true, message: 'แก้ไขบทความสำเร็จแล้ว' })
  } catch (error: any) {
    console.error('Failed to update ITA blog:', error)
    const status = error.message?.includes('ไม่พบ') ? 404 : error.message?.includes('คุณไม่มีสิทธิ์') ? 403 : 500
    const code = status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'
    return NextResponse.json(
      { success: false, error: { code, message: error.message || 'เกิดข้อผิดพลาดในการแก้ไขบทความ' } },
      { status }
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

    const users = await queryMemberDb('SELECT id, role FROM members WHERE username = ? AND email = ? LIMIT 1', [
      session.username,
      session.email,
    ])
    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้ใช้นี้ในระบบ' } },
        { status: 404 }
      )
    }

    await ItaBlogService.deleteBlog(id, users[0])
    return NextResponse.json({ success: true, message: 'ลบบทความสำเร็จแล้ว' })
  } catch (error: any) {
    console.error('Failed to delete ITA blog:', error)
    const status = error.message?.includes('ไม่พบ') ? 404 : error.message?.includes('คุณไม่มีสิทธิ์') ? 403 : 500
    const code = status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR'
    return NextResponse.json(
      { success: false, error: { code, message: error.message || 'เกิดข้อผิดพลาดในการลบบทความ' } },
      { status }
    )
  }
}
