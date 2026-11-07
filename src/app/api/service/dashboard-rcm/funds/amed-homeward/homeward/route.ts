import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { homewardReportQuerySchema } from '@/lib/clinical/rcmValidation'
import { RcmAmedHomewardService } from '@/lib/clinical/rcmAmedHomewardService'
import { logThrottledAudit } from '@/lib/audit'
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
        { success: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลกองทุน RCM' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams.entries())
    const parsed = homewardReportQuerySchema.safeParse(rawParams)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: issue?.message || 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_homeward',
      `Viewed HOMEWARD Report (ds1: ${params.ds1 || 'default'}, ds2: ${params.ds2 || 'default'}, cardFilter: ${params.cardFilter || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'HOMEWARD audit log failed'))

    const report = await RcmAmedHomewardService.getHomewardReport(params)

    return NextResponse.json({
      success: true,
      data: report,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/amed-homeward/homeward Error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน HOMEWARD' },
      },
      { status: 500 }
    )
  }
}
