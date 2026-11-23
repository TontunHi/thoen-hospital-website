import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { AuditLogService } from '@/lib/auditLogService'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const csvContent = await AuditLogService.exportAuditLogsCsv({
      search: searchParams.get('search') || '',
      actionType: searchParams.get('actionType') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
    })

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit_logs_${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Export audit logs error')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งออกรายงาน' },
      { status: 500 }
    )
  }
}
