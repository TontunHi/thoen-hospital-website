import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { registrationService } from '@/lib/registration/registrationService.default'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { error } = await requireMemberApi({ requiredRole: 'admin' })
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await registrationService.list({
      status,
      search,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
      page,
      limit,
    })
  } catch (err) {
    console.error('List registrations error:', err)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอสมัคร' },
      { status: 500 }
    )
  }
}
