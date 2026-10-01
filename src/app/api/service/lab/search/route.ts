import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const rateCheck = await checkRateLimit({
      key: 'lab-search',
      identifier: memberSession.username,
      maxAttempts: 20,
      windowSeconds: 60,
    })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const { query } = await request.json()
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json(
        { error: 'กรุณากรอกหมายเลขบัตรประชาชน หรือ HN' },
        { status: 400 }
      )
    }

    const searchQuery = query.trim()
    const patients = await ClinicalRecordsService.searchPatientVisits(searchQuery)

    if (patients.length === 0) {
      return NextResponse.json({
        success: true,
        patients: [],
        message: 'ไม่พบประวัติการรักษาของผู้ป่วยรายนี้',
      })
    }

    await logAudit(
      'READ',
      'patient_lab_history',
      `ค้นหาประวัติการรักษาและผลแลปสำหรับ: ${searchQuery} (พบ ${patients.length} รายการ)`,
      memberSession
    )

    return NextResponse.json({
      success: true,
      patients,
    })
  } catch (error: any) {
    console.error('Patient search API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบหลัก' },
      { status: 500 }
    )
  }
}
