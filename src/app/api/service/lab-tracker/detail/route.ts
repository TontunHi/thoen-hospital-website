import { NextResponse } from 'next/server'
import { ClinicalRecordsService } from '@/lib/clinical/clinicalRecordsService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

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
    const hn = searchParams.get('hn')

    if (!hn) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมายเลข HN' },
        { status: 400 }
      )
    }

    logAudit(
      'READ',
      'lab_order',
      `Viewed lab results detail for HN: ${hn}`,
      { username: memberSession.username, email: memberSession.email }
    ).catch((err) => logger.error({ err }, 'Lab detail audit log failed'))

    const details = await ClinicalRecordsService.getLabTrackerDetails(hn)
    if (!details) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผลแลปของผู้ป่วย' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ...details,
    })
  } catch (error: any) {
    logger.error({ error }, 'HPH Lab Tracker Detail API error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดผล LAB' },
      { status: 500 }
    )
  }
}
