import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThalassemiaService } from '@/lib/clinical/rcmThalassemiaService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const service31ParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cardFilter: z
    .enum(['ALL', 'SCREENED', 'UNSCREENED', 'NORMAL', 'RISK', 'THOEN_HOSPITAL'])
    .optional(),
  laborTypeFilter: z.enum(['ALL', 'NORMAL', 'CESAREAN', 'OTHER']).optional(),
  searchField: z.enum(['ALL', 'HN', 'CID', 'PTNAME', 'LABRESULT', 'HOSPITAL', 'PTTYPE']).optional(),
  search: z.string().max(120).optional(),
  sortBy: z
    .enum([
      'labor_date',
      'ptname',
      'hn',
      'cid',
      'age',
      'hospital',
      'labor_type',
      'labresult',
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
    const parsed = service31ParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_thalassemia_3_1',
      `Viewed Thalassemia screening in pregnancy report (3.1) (${params.ds1 || 'default'} to ${params.ds2 || 'default'}, filter: ${params.cardFilter || 'ALL'}, export: ${Boolean(params.exportAll)})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Thalassemia 3.1 audit log failed'))

    const result = await RcmThalassemiaService.getThalassemiaReport(params)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/thalassemia/service-31 Error')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคัดกรองธาลัสซีเมียในหญิงตั้งครรภ์',
        },
      },
      { status: 500 }
    )
  }
}
