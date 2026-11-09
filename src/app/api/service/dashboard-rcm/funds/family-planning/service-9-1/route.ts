import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const familyPlanningParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['NEW_ECLAIM', 'KRUNGTHAI']).optional(),
  serviceOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  status: z.string().max(100).optional(),
  cardFilter: z
    .enum(['ALL', 'SERVICE_ONLY', 'COMPENSATED', 'UNCOMPENSATED', 'HAS_ERROR', 'NO_AUTHEN'])
    .optional(),
  errorFilter: z.string().max(100).optional(),
  searchField: z
    .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'DRUG', 'SERVICE', 'DIAG', 'DOCTOR', 'ERROR'])
    .optional(),
  search: z.string().max(120).optional(),
  sortBy: z
    .enum([
      'vstdate',
      'hn',
      'cid',
      'ptname',
      'age',
      'income',
      'compensated',
      'status',
      'errorname',
      'listname',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  pttypes: z.string().max(300).optional(),
  ucOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
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
      'rcm_funds_family_planning_9_1',
      `Viewed Family Planning and Unintended Pregnancy Prevention report (9.1) (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, format: ${params.format || 'NEW_ECLAIM'}, cardFilter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Family Planning 9.1 audit log failed'))

    const result = await RcmFamilyPlanningService.getFamilyPlanningReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error(
      { error: err.message },
      'GET /api/service/dashboard-rcm/funds/family-planning/service-9-1 Error'
    )
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบริการวางแผนครอบครัวและการป้องกันการตั้งครรภ์ไม่พึงประสงค์',
        },
      },
      { status: 500 }
    )
  }
}
