import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const familyPlanningParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patientType: z.enum(['OPD', 'IPD']).optional(),
  cardFilter: z
    .enum([
      'ALL',
      'COMPENSATED',
      'ECLAIM_SENT',
      'UNSENT',
      'ERROR_DX',
      'ERROR_DRUG',
      'HAS_ERROR',
      'WITH_AUTHEN',
      'NO_AUTHEN',
    ])
    .optional(),
  searchField: z
    .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'PTTYPE', 'DEPARTMENT', 'CLINIC', 'DX', 'DRUG'])
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
      'status',
      'errorDx',
      'errorDrug',
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
    const parsed = familyPlanningParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_family_planning_9_7',
      `Viewed Family Planning 9.7 injectable contraceptive report (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, type: ${params.patientType || 'OPD'}, filter: ${params.cardFilter || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Family Planning 9.7 audit log failed'))

    const result = await RcmFamilyPlanningService.getFamilyPlanningReport({
      ...params,
      reportType: '9.7',
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/family-planning/injectable-contraceptives Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน 9.7 ยาฉีดคุมกำเนิด',
        },
      },
      { status: 500 }
    )
  }
}
