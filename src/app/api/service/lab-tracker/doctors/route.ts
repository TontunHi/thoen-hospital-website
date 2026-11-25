import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      )
    }

    const data = await ClinicalRecordsService.getLabTrackerDoctors()

    return NextResponse.json({
      success: true,
      ...data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'HPH Lab Tracker Doctors API error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายชื่อผู้สั่งตรวจ LAB' },
      { status: 500 }
    )
  }
}
