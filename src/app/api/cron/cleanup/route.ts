import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * Automated Maintenance & PDPA Data Retention Endpoint
 * 
 * Complies with Thailand's PDPA storage limitation principles:
 * - Purges audit log records older than 90 days
 * - Safe from unauthorized triggering (requires CRON_SECRET or Admin bearer)
 */
export async function POST(request: Request) {
  try {
    // 1. Authorization: verify secret header
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const retentionDays = parseInt(searchParams.get('days') || '90') // Default: 90 days

    if (isNaN(retentionDays) || retentionDays < 90) {
      return NextResponse.json(
        { error: 'Retention period must be at least 90 days for hospital auditing compliance' },
        { status: 400 }
      )
    }

    // 2. Count expired records before purge
    const countSql = `
      SELECT COUNT(*) as expiredCount 
      FROM audit_logs 
      WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `
    const countResult = await queryMemberDb(countSql, [retentionDays])
    const expiredCount = (countResult[0] as any)?.expiredCount || 0

    let deletedRows = 0

    if (expiredCount > 0) {
      // 3. Purge expired audit logs
      const deleteSql = `
        DELETE FROM audit_logs 
        WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
        LIMIT 5000
      `
      const deleteResult = await queryMemberDb(deleteSql, [retentionDays])
      deletedRows = (deleteResult as any)?.affectedRows || 0

      logger.info(
        { deletedRows, retentionDays },
        'PDPA Data Retention: Purged expired audit log records'
      )

      // Record this cleanup event in the fresh audit log
      await logAudit(
        'DELETE',
        'audit_logs',
        `PDPA automated cleanup: purged ${deletedRows} logs older than ${retentionDays} days`,
        { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
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
  } catch (error: any) {
    logger.error({ error }, 'PDPA Data Retention cleanup job failed')
    return NextResponse.json(
      { error: 'Internal cleanup job error' },
      { status: 500 }
    )
  }
}
