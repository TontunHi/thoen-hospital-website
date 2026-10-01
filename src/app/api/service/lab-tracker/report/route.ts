import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession } from '@/lib/memberAuth'

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
    const doctorCode = searchParams.get('id')

    const report = await ClinicalRecordsService.getLabTrackerReport(doctorCode)

    return NextResponse.json({
      success: true,
      ...report,
    })
  } catch (error: any) {
    console.error('HPH Lab Tracker Report API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงรายการความคืบหน้าของ LAB' },
      { status: 500 }
    )
  }
}
