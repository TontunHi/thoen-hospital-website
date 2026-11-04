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
    const rep = searchParams.get('rep') || undefined
    const fund = searchParams.get('fund') || undefined
    const subFund = searchParams.get('subFund') || undefined
    const department = (searchParams.get('department') as 'ALL' | 'OP' | 'IP') || 'ALL'
    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const hn = searchParams.get('hn') || undefined
    const status = searchParams.get('status') || undefined
    const errorCode = searchParams.get('errorCode') || undefined
    const search = searchParams.get('search') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 250
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0

    logThrottledAudit(
      'READ',
      'rep_cases',
      `Viewed patient cases for REP/Fund (rep: ${rep || 'all'}, fund: ${fund || 'all'}, dept: ${department}, status: ${status || 'all'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'REP cases audit log failed'))

    const cases = await RcmRepFundsService.getRepCases({
      rep,
      fund,
      subFund,
      department,
      fiscalYear,
      hn,
      status,
      errorCode,
      search,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      count: cases.length,
      cases,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/rep-funds/cases Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายชื่อเคสใน REP' },
      { status: 500 }
    )
  }
}
