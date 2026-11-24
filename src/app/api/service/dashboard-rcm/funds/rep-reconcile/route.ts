import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  RcmFundsRepReconcileService,
  type RepSourceKind,
} from '@/lib/clinical/rcmFundsRepReconcileService'
import { fundsRepReconcileQuerySchema, validateSearchParams } from '@/lib/clinical/rcmValidation'

const ALLOWED_SOURCES = new Set<RepSourceKind>([
  'repdata',
  'repeclaim',
  'seamless',
])

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
    const validation = validateSearchParams(fundsRepReconcileQuerySchema, searchParams)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: validation.error } },
        { status: 400 }
      )
    }

    const p = validation.data
    const fundIds = p.funds
      ? p.funds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined
    const sources = p.sources
      ? p.sources
          .split(',')
          .map((s) => s.trim())
          .filter((s): s is RepSourceKind => ALLOWED_SOURCES.has(s as RepSourceKind))
      : undefined
    const repPrefixes = p.repPrefixes
      ? p.repPrefixes
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : undefined

    logThrottledAudit(
      'READ',
      'rcm_funds_rep_reconcile',
      `Viewed unified funds REP reconcile (${p.ds1 || 'default'} to ${p.ds2 || 'default'}, funds: ${fundIds?.length || 'ALL'}, export: ${Boolean(p.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Funds REP reconcile audit log failed'))

    const data = await RcmFundsRepReconcileService.getReconcileReport({
      ds1: p.ds1,
      ds2: p.ds2,
      fundIds,
      focusFundId: p.focusFundId,
      sources,
      repPrefixes,
      department: p.department,
      status: p.status,
      includePendingRep: Boolean(p.includePendingRep),
      search: p.search,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      page: p.page ?? 1,
      pageSize: p.pageSize ?? 50,
      exportAll: Boolean(p.exportAll),
      refresh: Boolean(p.refresh),
    })

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    if (error instanceof GatewayUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GATEWAY_UNAVAILABLE',
            message: 'ไม่สามารถเชื่อมต่อ API Gateway ของโรงพยาบาลได้ในขณะนี้',
          },
        },
        { status: 503 }
      )
    }

    const err = error as Error
    const isTimeout = /timeout|abort|timed out/i.test(err.message || '')
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/rep-reconcile Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isTimeout ? 'GATEWAY_TIMEOUT' : 'INTERNAL_ERROR',
          message: isTimeout
            ? 'การดึงข้อมูลใช้เวลานานเกินกำหนด กรุณาลองเลือกช่วงเวลาเป็นรายเดือน'
            : 'เกิดข้อผิดพลาดในการดึงข้อมูลรวม REP กองทุน',
        },
      },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
