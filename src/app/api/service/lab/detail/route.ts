import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'

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
    const vn = searchParams.get('vn')
    const an = searchParams.get('an')

    if (!vn && !an) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมายเลข VN หรือ AN' },
        { status: 400 }
      )
    }

    const details = await ClinicalRecordsService.getVisitClinicalDetails({ vn, an })
    if (!details) {
      return NextResponse.json(
        { error: vn ? 'ไม่พบข้อมูลการตรวจรักษา OPD นี้' : 'ไม่พบข้อมูลการรักษา IPD นี้' },
        { status: 404 }
      )
    }

    await logAudit(
      'READ',
      'patient_lab_history',
      vn
        ? `เข้าดูรายละเอียดเวชระเบียน/ผลแลป OPD VN: ${vn} (HN: ${details.patient.hn})`
        : `เข้าดูรายละเอียดเวชระเบียน/ผลแลป IPD AN: ${an} (HN: ${details.patient.hn})`,
      memberSession
    )

    return NextResponse.json(details)
  } catch (error: any) {
    console.error('Patient detail API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียด' },
      { status: 500 }
    )
  }
}
