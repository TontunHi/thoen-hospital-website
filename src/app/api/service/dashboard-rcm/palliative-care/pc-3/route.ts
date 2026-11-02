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
    const ucOnly = searchParams.has('ucOnly') ? searchParams.get('ucOnly') === 'true' : true
    const filterType = (searchParams.get('filterType') as 'ALL' | 'Chronic' | 'Opioid' | 'Death') || 'ALL'
    const deathStatus = (searchParams.get('deathStatus') as 'ALL' | 'Y' | 'N') || undefined
    const paidStatus = (searchParams.get('paidStatus') as 'ALL' | 'PAID' | 'UNPAID') || undefined
    const compensated = searchParams.get('compensated') || undefined
    const hasRepInvoice = searchParams.has('hasRepInvoice') ? searchParams.get('hasRepInvoice') === 'true' : undefined
    const search = searchParams.get('search') || undefined

    logThrottledAudit(
      'READ',
      'palliative_care_pc3',
      `Viewed Palliative Care PC.3 report (date: ${ds1 || 'default'} to ${ds2 || 'default'}, ucOnly: ${ucOnly}, filter: ${filterType}, death: ${deathStatus || 'ALL'}, paid: ${paidStatus || 'ALL'}, comp: ${compensated || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Palliative care PC.3 audit log failed'))

    const result = await RcmDashboardService.getPalliativeCareReport({
      ds1,
      ds2,
      ucOnly,
      filterType,
      deathStatus,
      paidStatus,
      compensated,
      hasRepInvoice,
      search,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/palliative-care/pc-3 Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน Palliative Care PC.3' },
      { status: 500 }
    )
  }
}
