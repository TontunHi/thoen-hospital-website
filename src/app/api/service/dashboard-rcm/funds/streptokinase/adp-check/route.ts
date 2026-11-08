import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmStreptokinaseService } from '@/lib/clinical/rcmStreptokinaseService'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบสมาชิกก่อนใช้งาน' } },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    const adpCheck = await RcmStreptokinaseService.checkAdpMapping(undefined, refresh)

    return NextResponse.json({
      success: true,
      data: adpCheck,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/streptokinase/adp-check Error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดในการตรวจสอบ ADP Mapping' },
      },
      { status: 500 }
    )
  }
}
