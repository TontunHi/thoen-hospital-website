import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/auditLogService'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const retentionDays = parseInt(searchParams.get('days') || '90', 10)

    if (isNaN(retentionDays) || retentionDays < 90) {
      return NextResponse.json(
        { error: 'Retention period must be at least 90 days for hospital auditing compliance' },
        { status: 400 }
      )
    }

    const { expiredCount, deletedRows } = await AuditLogService.purgeExpiredAuditLogsByCron(
      retentionDays
    )

    if (deletedRows > 0) {
      logger.info(
        { deletedRows, retentionDays },
        'PDPA Data Retention: Purged expired audit log records'
      )
    }

    return NextResponse.json({
      success: true,
      message: `PDPA maintenance completed. Purged ${deletedRows} records.`,
      purged: deletedRows,
      remainingExpired: Math.max(0, expiredCount - deletedRows),
      retentionDays,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error({ error }, 'PDPA Data Retention cleanup job failed')
    return NextResponse.json(
      { error: 'Internal cleanup job error' },
      { status: 500 }
    )
  }
}
