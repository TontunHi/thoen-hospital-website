import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET() {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const summaryRows = await queryMemberDb(`
      SELECT 
        COUNT(*) AS total_logs,
        MIN(timestamp) AS oldest_log,
        MAX(timestamp) AS newest_log
      FROM audit_logs
    `)

    const todayStatsRows = await queryMemberDb(`
      SELECT 
        COUNT(CASE WHEN action_type = 'LOGIN' THEN 1 END) AS logins_today,
        COUNT(CASE WHEN action_type = 'READ' THEN 1 END) AS reads_today,
        COUNT(CASE WHEN action_type IN ('CREATE', 'UPDATE', 'DELETE') THEN 1 END) AS changes_today
      FROM audit_logs
      WHERE timestamp >= CURDATE()
    `)

    const storageRows = await queryMemberDb(`
      SELECT 
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'
      LIMIT 1
    `)

    const totalLogs = summaryRows[0]?.total_logs || 0
    const oldestLog = summaryRows[0]?.oldest_log || null
    const newestLog = summaryRows[0]?.newest_log || null
    const loginsToday = todayStatsRows[0]?.logins_today || 0
    const readsToday = todayStatsRows[0]?.reads_today || 0
    const changesToday = todayStatsRows[0]?.changes_today || 0
    const sizeMb = storageRows[0]?.size_mb ? parseFloat(storageRows[0]?.size_mb) : 0

    let retainedDays = 0
    if (oldestLog) {
      const oldestTime = new Date(oldestLog).getTime()
      const now = Date.now()
      retainedDays = Math.max(1, Math.floor((now - oldestTime) / (1000 * 60 * 60 * 24)))
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalLogs,
        sizeMb,
        oldestLog,
        newestLog,
        retainedDays,
        policyRetentionDays: 90,
        loginsToday,
        readsToday,
        changesToday,
      },
    })
  } catch (error) {
    console.error('Fetch audit log stats error:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสถิติประวัติการใช้งานได้' },
      { status: 500 }
    )
  }
}
