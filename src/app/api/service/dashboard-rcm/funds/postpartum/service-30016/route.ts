import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmPostpartumService } from '@/lib/clinical/rcmPostpartumService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const service30016ParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compensationFilter: z
    .enum(['ALL', 'COMPENSATED', 'UNCOMPENSATED', 'HAS_AUTHEN', 'NO_AUTHEN', 'HAS_PDX', 'HAS_OP'])
    .optional(),
  searchField: z.enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'DIAG', 'PTTYPE']).optional(),
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
    const parsed = service30016ParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_postpartum_7_3_service_30016',
      `Viewed Postpartum 7.3 30016 service report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.compensationFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Postpartum 7.3 service 30016 audit log failed'))

    const result = await RcmPostpartumService.getService30016Report(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/postpartum/service-30016 Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจ่ายยา Triforine 30016',
        },
      },
      { status: 500 }
    )
  }
}
