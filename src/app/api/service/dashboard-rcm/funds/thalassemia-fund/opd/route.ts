import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThalassemiaFundService } from '@/lib/clinical/rcmThalassemiaFundService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const thalassemiaOpdParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fiscalYear: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
  cardFilter: z
    .enum([
      'ALL',
      'WITH_DRUG',
      'WITH_BLOOD',
      'WITH_FERRITIN',
      'WITH_HB_HCT',
      'COMPENSATED',
      'UNCOMPENSATED',
      'UC_ONLY',
    ])
    .optional(),
  pttypes: z.string().max(300).optional(),
  ucOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  searchField: z
    .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'ICD10', 'ICD9', 'DRUG', 'BLOOD', 'PTTYPE'])
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
      'icd10',
      'bloodQty',
      'compensated',
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
    const parsed = thalassemiaOpdParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_thalassemia_opd',
      `Viewed Thalassemia OPD Report (ds1: ${params.ds1 || 'default'}, ds2: ${params.ds2 || 'default'}, cardFilter: ${params.cardFilter || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Thalassemia OPD audit log failed'))

    const report = await RcmThalassemiaFundService.getOpdReport(params)

    return NextResponse.json({
      success: true,
      data: report,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/thalassemia-fund/opd Error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานผู้ป่วยนอก Thalassemia' },
      },
      { status: 500 }
    )
  }
}
