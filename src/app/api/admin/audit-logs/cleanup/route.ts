import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { AuditLogService } from '@/lib/auditLogService'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const retentionDays = Math.max(90, parseInt(searchParams.get('days') || '90', 10))
    const expiredCount = await AuditLogService.countExpiredAuditLogs(retentionDays)

    return NextResponse.json({
      success: true,
      retentionDays,
      expiredCount,
      minRetentionDays: 90,
    })
  } catch (error) {
    logger.error({ err: error }, 'Check expired audit logs error')
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถตรวจสอบจำนวนข้อมูลที่หมดอายุได้' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    let retentionDays = 90
    try {
      const body = (await request.json()) as { retentionDays?: unknown }
      if (typeof body.retentionDays === 'number') {
        retentionDays = body.retentionDays
      }
    } catch {
      // Optional JSON body defaults to 90 days
    }

    if (retentionDays < 90) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ระยะเวลาจัดเก็บขั้นต่ำต้องไม่น้อยกว่า 90 วันตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
        },
        { status: 400 }
      )
    }

    const { expiredCount, purgedCount } = await AuditLogService.purgeExpiredAuditLogsByAdmin(
      retentionDays,
      { username: auth.session.username, email: auth.session.email }
    )

    if (expiredCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'ไม่มีรายการประวัติที่เก่าเกินเกณฑ์ที่กำหนด (ฐานข้อมูลสะอาดแล้ว)',
        expiredCount: 0,
        purgedCount: 0,
        retentionDays,
      })
    }

    return NextResponse.json({
      success: true,
      message: `ล้างประวัติการใช้งานที่เก่ากว่า ${retentionDays} วัน สำเร็จแล้วจำนวน ${purgedCount.toLocaleString()} รายการ`,
      expiredCount,
      purgedCount,
      retentionDays,
    })
  } catch (error) {
    logger.error({ err: error }, 'Purge audit logs error')
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการล้างประวัติการใช้งานระบบ' },
      { status: 500 }
    )
  }
}
