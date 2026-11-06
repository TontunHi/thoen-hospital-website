import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmCervicalCancerService } from '@/lib/clinical/rcmCervicalCancerService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const baseParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  screeningFilter: z
    .enum([
      'ALL',
      'SCREENED',
      'UNSCREENED',
      'ABNORMAL',
      'COMPENSATED',
      'MATCHED_SAME_DAY',
      'MATCHED_DIFF_DAY',
      'REP_ONLY',
    ])
    .optional(),
  typeareaFilter: z.enum(['ALL', '1_3']).optional(),
  searchField: z.enum(['ALL', 'HN', 'CID', 'PTNAME']).optional(),
  search: z.string().max(120).optional(),
  sortBy: z
    .enum(['hn', 'person_id', 'cid', 'ptname', 'age', 'vstdate', 'comeback_date', 'note', 'compensated'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(10).max(500).optional(),
  exportAll: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  refresh: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
})

const postBodySchema = baseParamsSchema.extend({
  extraRepRows: z
    .array(
      z.object({
        cid: z.string().regex(/^\d{13}$/),
        comebackDate: z.string().max(30).nullable(),
      })
    )
    .max(10000)
    .optional(),
})

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
    const parsed = baseParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_ccs_1_target_population',
      `Viewed CCS 1. target population 30-60 report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.screeningFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'CCS target population audit log failed'))

    const result = await RcmCervicalCancerService.getTargetPopulationReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/ccs/target-population Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่มเป้าหมายคัดกรองมะเร็งปากมดลูก',
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null)
    const parsed = postBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'ข้อมูลไฟล์ Rep Individual ที่ส่งมาไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_ccs_1_target_population_rep_check',
      `Reconciled CCS 1. target population with Rep_Individual (${params.extraRepRows?.length || 0} rows, ${params.ds1 || 'default'} to ${params.ds2 || 'default'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'CCS Rep_Individual reconciliation audit log failed'))

    const result = await RcmCervicalCancerService.getTargetPopulationReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'POST /api/service/dashboard-rcm/funds/ccs/target-population Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการกระทบยอดไฟล์ Rep Individual',
        },
      },
      { status: 500 }
    )
  }
}
