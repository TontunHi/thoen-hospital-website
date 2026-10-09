import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { registrationService } from '@/lib/registration/registrationService.default'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, props: RouteParams) {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const params = await props.params
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const registration = await registrationService.getById(id)
    if (!registration) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลคำขอสมัคร' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: registration })
  } catch (err) {
    console.error('Get registration error:', err)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}

export async function PUT(request: Request, props: RouteParams) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const params = await props.params
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const result = await registrationService.update(id, body, {
      username: member!.username,
      email: member!.email,
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'บันทึกการแก้ไขเรียบร้อยแล้ว' })
  } catch (err) {
    console.error('Update registration error:', err)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }, { status: 500 })
  }
}

export async function DELETE(request: Request, props: RouteParams) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const params = await props.params
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const result = await registrationService.delete(id, {
      username: member!.username,
      email: member!.email,
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'ลบคำขอสมัครเรียบร้อยแล้ว' })
  } catch (err) {
    console.error('Delete registration error:', err)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบคำขอ' }, { status: 500 })
  }
}
