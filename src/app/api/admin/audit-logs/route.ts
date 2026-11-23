import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { AuditLogService } from '@/lib/auditLogService'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const result = await AuditLogService.listAuditLogs({
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '25', 10),
      search: searchParams.get('search') || '',
      actionType: searchParams.get('actionType') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.error({ err: error }, 'Fetch audit logs error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการใช้งาน' },
      { status: 500 }
    )
  }
}
