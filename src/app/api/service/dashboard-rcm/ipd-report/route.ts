import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService, getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { validateSearchParams, ipdReportQuerySchema } from '@/lib/clinical/rcmValidation'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const validation = validateSearchParams(ipdReportQuerySchema, searchParams)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    const defaultRange = getDefaultFiscalYearDateRange()
    const ds1 = validation.data.ds1 || defaultRange.startDate
    const ds2 = validation.data.ds2 || defaultRange.endDate
    const pttype = validation.data.pttype || ''
    const ward = validation.data.ward || ''
    const admdoctor = validation.data.admdoctor || ''
    const dchdoctor = validation.data.dchdoctor || ''
    const search = validation.data.search || ''
    const page = validation.data.page || 1
    const pageSize = validation.data.pageSize || 50
    const exportAll = Boolean(validation.data.exportAll)
    const mode = validation.data.mode || 'full'

    logThrottledAudit(
      'READ',
      'ipd_report',
      `Viewed IPD service report (date: ${ds1} to ${ds2}, pttype: ${pttype || 'ALL'}, mode: ${mode})`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'IPD report audit log failed'))

    const rows = await RcmDashboardService.getIpdReport({
      ds1,
      ds2,
      pttype,
    })

    // If client requested paginated details mode
    if (mode === 'details' && !exportAll) {
      let filtered = rows
      if (ward) {
        filtered = filtered.filter((r) => r.ward === ward || r.ward_name === ward)
      }
      if (admdoctor) {
        filtered = filtered.filter((r) => r.admdoctor === admdoctor)
      }
      if (dchdoctor) {
        filtered = filtered.filter((r) => r.dchdoctor === dchdoctor)
      }
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(
          (r) =>
            r.hn.toLowerCase().includes(q) ||
            r.an.toLowerCase().includes(q) ||
            r.ptname.toLowerCase().includes(q) ||
            r.cid.includes(q)
        )
      }

      const total = filtered.length
      const totalPages = Math.ceil(total / pageSize) || 1
      const startIndex = (page - 1) * pageSize
      const paginatedItems = filtered.slice(startIndex, startIndex + pageSize)

      return NextResponse.json({
        success: true,
        mode: 'details',
        total,
        totalPages,
        page,
        pageSize,
        count: paginatedItems.length,
        data: paginatedItems,
      })
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/ipd-report Error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานผู้ป่วยใน IPD' },
      { status: 500 }
    )
  }
}
