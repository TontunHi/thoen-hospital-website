import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmRepFundsService } from '@/lib/clinical/rcmRepFundsService'
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
    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const department = (searchParams.get('department') as 'ALL' | 'OP' | 'IP') || 'ALL'
    const fund = searchParams.get('fund') || undefined
    const subFund = searchParams.get('subFund') || undefined
    const search = searchParams.get('search') || undefined

    logThrottledAudit(
      'READ',
      'rep_funds',
      `Viewed REP funds summary (FY: ${fiscalYear || 'default'}, dept: ${department})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'REP funds audit log failed'))

    const data = await RcmRepFundsService.getRepFundsSummary({
      fiscalYear,
      department,
      fund,
      subFund,
      search,
    })

    return NextResponse.json({
      success: true,
      ...data,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/rep-funds Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุป REP แต่ละกองทุน' },
      { status: 500 }
    )
  }
}
