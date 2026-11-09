import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const familyPlanning932ParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['NEW_ECLAIM', 'KRUNGTHAI']).optional(),
  cardFilter: z
    .enum([
      'ALL',
      'COMPENSATED',
      'UNCOMPENSATED',
      'ECLAIM_SENT',
      'UNSENT',
      'WITH_AUTHEN',
      'NO_AUTHEN',
      'WITH_DRUG',
      'WITH_SERVICE',
      'HAS_ERROR',
    ])
    .optional(),
  searchField: z
    .enum([
      'ALL',
      'HN',
      'CID',
      'PTNAME',
      'VN',
      'PTTYPE',
      'DEPARTMENT',
      'CLINIC',
      'DX',
      'OP',
      'DRUG',
      'SERVICE',
      'ADP',
      'REP',
    ])
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
      'compensated_eclaim',
      'compensated_rep',
      'compensated_nhso',
      'status',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  pttypes: z.string().max(300).optional(),
  ucOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).optional(),
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
    const parsed = familyPlanning932ParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_family_planning_9_3_2',
      `Viewed Family Planning 9.3.2 semi-permanent contraception in women >= 20 report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, format: ${params.format || 'NEW_ECLAIM'}, filter: ${params.cardFilter || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Family Planning 9.3.2 audit log failed'))

    const result = await RcmFamilyPlanningService.getFamilyPlanning932Report(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error(
      { error: err.message },
      'GET /api/service/dashboard-rcm/funds/family-planning/service-9-3-2 Error'
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป (9.3.2)',
        },
      },
      { status: 500 }
    )
  }
}
