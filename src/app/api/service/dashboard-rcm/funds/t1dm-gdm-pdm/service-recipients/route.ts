import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmT1dmGdmPdmService } from '@/lib/clinical/rcmT1dmGdmPdmService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const t1dmRecipientParamsSchema = z.object({
  ds1: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ds2: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fiscalYear: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
  cardFilter: z
    .enum([
      'ALL',
      'REGISTERED',
      'NOT_REGISTERED',
      'COMPENSATED',
      'UNCOMPENSATED',
      'WITH_AUTHEN',
      'NO_AUTHEN',
      'UC_ONLY',
    ])
    .optional(),
  searchField: z
    .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'ICD10', 'TYPE', 'PTTYPE', 'REP'])
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
      'type',
      'regdate',
      'lmp',
      'pdx',
      'status',
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
  pttypes: z.string().max(300).optional(),
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
    const parsed = t1dmRecipientParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'พารามิเตอร์ที่ระบุไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const params = parsed.data

    logThrottledAudit(
      'READ',
      'rcm_funds_t1dm_recipients',
      `Viewed T1DM/GDM/PDM Recipients Report (ds1: ${params.ds1 || 'default'}, ds2: ${params.ds2 || 'default'}, cardFilter: ${params.cardFilter || 'ALL'})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'T1DM Recipients audit log failed'))

    const report = await RcmT1dmGdmPdmService.getRecipientsReport(params)

    return NextResponse.json({
      success: true,
      data: report,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'GET /api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients Error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานรายชื่อผู้รับบริการ T1DM/GDM/PDM' },
      },
      { status: 500 }
    )
  }
}
