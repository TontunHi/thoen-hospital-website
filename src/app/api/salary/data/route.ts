import { NextResponse } from 'next/server'
import { verifySalarySession, destroySalarySession } from '@/lib/salaryAuth'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logger } from '@/lib/logger'
import {
  SalaryPortalError,
  SalaryPortalService,
} from '@/lib/salary/salaryPortalService'

export async function GET(request: Request) {
  try {
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    const user = await verifySalarySession()
    const expectedSalaryUser =
      await SalaryPortalService.getExpectedSalaryUserForMember(
        memberSession.username
      )

    if (
      !user ||
      !user.username ||
      (expectedSalaryUser && user.username !== expectedSalaryUser)
    ) {
      await destroySalarySession()
      return NextResponse.json(
        {
          error:
            'เซสชันระบบเงินเดือนไม่ตรงกับผู้ใช้งานปัจจุบัน กรุณาเข้าสู่ระบบใหม่',
        },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const payload = await SalaryPortalService.fetchPersonalSalaryPayload({
      salaryUsername: user.username,
      salaryDisplayName: user.name,
      selectedYear: searchParams.get('year'),
      selectedMonth: searchParams.get('month'),
      actor: { username: memberSession.username, email: memberSession.email },
    })

    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof SalaryPortalError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ error }, 'Failed to fetch salary data')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    )
  }
}
