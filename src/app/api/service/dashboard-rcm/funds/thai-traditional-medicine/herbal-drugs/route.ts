import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmThaiTraditionalMedicineService } from '@/lib/clinical/rcmThaiTraditionalMedicineService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

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
        { success: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const vn = searchParams.get('vn')?.trim()

    if (!vn || !/^[A-Za-z0-9_-]{4,25}$/.test(vn)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_VN', message: 'กรุณาระบุหมายเลข VN ที่ถูกต้อง' } },
        { status: 400 }
      )
    }

    logThrottledAudit(
      'READ',
      'rcm_funds_ttm_herbal_drugs',
      `Viewed herbal drug orders for VN: ${vn}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'TTM Herbal drugs audit log failed'))

    const drugs = await RcmThaiTraditionalMedicineService.getVnHerbalDrugs(vn)

    return NextResponse.json({
      success: true,
      data: drugs,
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'API /api/service/dashboard-rcm/funds/thai-traditional-medicine/herbal-drugs Error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดในการดึงรายการยาสมุนไพร' },
      },
      { status: 500 }
    )
  }
}
