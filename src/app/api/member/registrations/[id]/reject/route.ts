import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { registrationService } from '@/lib/registration/registrationService.default'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, props: RouteParams) {
  try {
    const { member, error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const params = await props.params
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null

    const result = await registrationService.reject(id, reason, {
      username: member!.username,
      email: member!.email,
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'ปฏิเสธคำขอสมัครเรียบร้อยแล้ว',
    })
  } catch (err) {
    console.error('Reject registration error:', err)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ' }, { status: 500 })
  }
}
