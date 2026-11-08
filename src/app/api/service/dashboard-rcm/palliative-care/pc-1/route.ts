import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ds1 = searchParams.get('ds1') || undefined
    const ds2 = searchParams.get('ds2') || undefined
    const paidStatus = (searchParams.get('paidStatus') as 'ALL' | 'PAID' | 'UNPAID' | 'INVOICE') || undefined
    const search = searchParams.get('search') || undefined

    logThrottledAudit(
      'READ',
      'palliative_care_pc1',
      `Viewed Palliative Care PC.1 End Of Life report (date: ${ds1 || 'default'} to ${ds2 || 'default'}, paid: ${paidStatus || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Palliative care PC.1 audit log failed'))

    const result = await RcmDashboardService.getPalliativeCarePc1Report({
      ds1,
      ds2,
      paidStatus,
      search,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/palliative-care/pc-1 Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน Palliative Care PC.1' },
      { status: 500 }
    )
  }
}
