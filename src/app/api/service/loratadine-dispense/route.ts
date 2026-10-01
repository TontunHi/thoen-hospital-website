import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession, attachRenewedMemberSessionCookie } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ageFilter = searchParams.get('age') || 'adult'

    const result = await ClinicalRecordsService.getLoratadineDispenseSummary(ageFilter)

    await logThrottledAudit(
      'READ',
      'loratadine_dispense_log',
      `เข้าดูรายการจ่ายยาลอราทาดีน (พบ ${result.summary.totalCount} รายการ, เงื่อนไขอายุ: ${ageFilter})`,
      memberSession
    )

    const response = NextResponse.json({
      success: true,
      items: result.items,
      summary: result.summary,
    })

    return attachRenewedMemberSessionCookie(response, memberSession)
  } catch (error: any) {
    console.error('Loratadine Dispense API Error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจ่ายยาจากระบบหลัก' },
      { status: 500 }
    )
  }
}
