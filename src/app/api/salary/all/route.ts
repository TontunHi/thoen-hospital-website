import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { salaryLedgerService } from '@/lib/salary/salaryLedgerService'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    const isAuthorized = session.role === 'admin' || (await checkPositionPermission(session.username, 'view_all_salary'))
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลสลิปเงินเดือนของบุคลากรท่านอื่น' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetUsername = searchParams.get('username')?.trim()
    const selectedYear = searchParams.get('year')?.trim()
    const selectedMonth = searchParams.get('month')?.trim()

    if (!targetUsername) {
      return NextResponse.json({
        success: true,
        member: null,
        message: 'กรุณาระบุ Username ของบุคลากร',
      })
    }

    const maskedTarget = targetUsername.length > 4 ? `x-xxxx-xxxxx-${targetUsername.slice(-4)}` : targetUsername
    logAudit(
      'READ',
      'salary',
      `Viewed employee salary records for: ${maskedTarget}`,
      { username: session.username, email: session.email }
    ).catch((err) => logger.error({ err }, 'Salary all audit log failed'))

    const result = await salaryLedgerService.getEmployeeSalaryLedger({
      targetUsername,
      selectedYear,
      selectedMonth,
    })

    if (!result.success && result.notFound) {
      return NextResponse.json(result, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error({ error }, 'All salary API error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสลิปเงินเดือน' },
      { status: 500 }
    )
  }
}
