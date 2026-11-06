import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmCervicalCancerService } from '@/lib/clinical/rcmCervicalCancerService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const service1B004NParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compensationFilter: z
    .enum(['ALL', 'COMPENSATED', 'UNCOMPENSATED', 'HAS_AUTHEN', 'NO_AUTHEN'])
    .optional(),
  searchField: z.enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'DIAG']).optional(),
  search: z.string().max(120).optional(),
  sortBy: z
    .enum([
      'vstdate',
      'vsttime',
      'hn',
      'cid',
      'ptname',
      'age',
      'compensated',
      'pdx',
      'authencode',
    ])
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
    const parsed = service1B004NParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_ccs_3_service_1b004n',
      `Viewed CCS 1.3 1B004N service report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, compensation: ${params.compensationFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'CCS 1.3 service 1B004N audit log failed'))

    const result = await RcmCervicalCancerService.getService1B004NReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/ccs/service-1b004n Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบริการตรวจ 1B004N',
        },
      },
      { status: 500 }
    )
  }
}
