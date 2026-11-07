import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmAnemiaScreeningService } from '@/lib/clinical/rcmAnemiaScreeningService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const anemiaScreeningParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fiscalYear: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
  cardFilter: z
    .enum([
      'ALL',
      'COMPENSATED',
      'UNCOMPENSATED',
      'REPEAT_CLAIM',
      'WITH_AUTHEN',
      'NO_AUTHEN',
      'UC_ONLY',
      'TARGET_AGE',
    ])
    .optional(),
  ucOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  targetAgeOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  searchField: z
    .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'DIAG', 'PTTYPE'])
    .optional(),
  search: z.string().max(120).optional(),
  sortBy: z
    .enum([
      'vstdate',
      'vsttime',
      'hn',
      'cid',
      'ptname',
      'age',
      'income',
      'compensated',
      'pdx',
      'authencode',
      'camedate',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
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
    const parsed = anemiaScreeningParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_anemia_screening_17_1',
      `Viewed anemia screening report (17.1 ADP 13001) (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Anemia screening 17.1 audit log failed'))

    const result = await RcmAnemiaScreeningService.getAnemiaScreeningReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/anemia-screening/service-17-1 Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานบริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP (17.1)',
        },
      },
      { status: 500 }
    )
  }
}
