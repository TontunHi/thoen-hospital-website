import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmCervicalCancerService } from '@/lib/clinical/rcmCervicalCancerService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const baseParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  methodFilter: z.enum(['ALL', 'PapSmear', 'VIA', 'HPV', 'ColpoScopy']).optional(),
  okFilter: z.enum(['ALL', 'OK', 'NOT_OK']).optional(),
  resultStatusFilter: z.enum(['ALL', 'NORMAL', 'ABNORMAL']).optional(),
  compensationFilter: z.enum(['ALL', 'COMPENSATED', 'UNCOMPENSATED']).optional(),
  pttypes: z.string().max(300).optional(),
  ucOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  searchField: z.enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN']).optional(),
  search: z.string().max(120).optional(),
  sortBy: z.enum(['vstdate', 'hn', 'cid', 'ptname', 'age', 'compensated', 'nhso']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
  exportAll: z
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
      'rcm_funds_ccs_2_screened_recipients',
      `Viewed CCS 1.2 screened recipients report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, method: ${params.methodFilter || 'ALL'}, ok: ${params.okFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'CCS screened recipients audit log failed'))

    const result = await RcmCervicalCancerService.getScreenedRecipientsReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/ccs/screened-recipients Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก',
        },
      },
      { status: 500 }
    )
  }
}
