import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { AuditLogService } from '@/lib/auditLogService'
import { logger } from '@/lib/logger'

export async function GET() {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const stats = await AuditLogService.getAuditLogStats()
    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    logger.error({ err: error }, 'Fetch audit log stats error')
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสถิติประวัติการใช้งานได้' },
      { status: 500 }
    )
  }
}
