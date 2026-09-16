/**
 * PDPA Data Retention Maintenance Script
 * 
 * Runs as a standalone CLI command or via Windows Task Scheduler.
 * Purges audit log records older than the retention period (default: 730 days / 2 years).
 * 
 * Usage:
 *   npx tsx scripts/purgeOldAuditLogs.ts [--days=730]
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'

async function runCleanup() {
  const args = process.argv.slice(2)
  let retentionDays = 730 // default 2 years

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      const parsed = parseInt(arg.split('=')[1], 10)
      if (!isNaN(parsed)) retentionDays = parsed
    }
  }

  if (retentionDays < 90) {
    console.error('❌ Error: Retention period must be at least 90 days for hospital auditing compliance.')
    process.exit(1)
  }

  console.log(`🧹 Starting PDPA Audit Log Maintenance (Retention: ${retentionDays} days)...`)

  const connection = await mysql.createConnection({
    host: process.env.MEMBER_DB_HOST || 'localhost',
    user: process.env.MEMBER_DB_USER || 'root',
    password: process.env.MEMBER_DB_PASSWORD || '',
    database: process.env.MEMBER_DB_NAME || 'thoen_member',
    port: parseInt(process.env.MEMBER_DB_PORT || '3306', 10),
  })

  try {
    // 1. Count records older than retention threshold
    const [countRows]: any = await connection.execute(
      `SELECT COUNT(*) as expiredCount FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [retentionDays]
    )

    const expiredCount = countRows[0]?.expiredCount || 0
    console.log(`📊 Found ${expiredCount} expired audit log record(s) older than ${retentionDays} days.`)

    if (expiredCount === 0) {
      console.log('✅ No expired records to purge. Database is clean.')
      return
    }

    // 2. Purge in batches of 5000 to prevent locking table
    let totalPurged = 0
    let batches = 0

    while (totalPurged < expiredCount) {
      const [result]: any = await connection.execute(
        `DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000`,
        [retentionDays]
      )

      const affected = result.affectedRows || 0
      if (affected === 0) break

      totalPurged += affected
      batches++
      console.log(`   - Batch ${batches}: Purged ${affected} records (Total: ${totalPurged}/${expiredCount})`)
    }

    // 3. Record audit entry for maintenance
    await connection.execute(
      `INSERT INTO audit_logs (action, resource, details, timestamp, user) VALUES (?, ?, ?, NOW(), ?)`,
      [
        'DELETE',
        'audit_logs',
        `CLI Maintenance: purged ${totalPurged} audit log records older than ${retentionDays} days`,
        'CLI_MAINTENANCE',
      ]
    )

    console.log(`✨ Successfully purged ${totalPurged} expired records in ${batches} batch(es).`)
  } catch (error) {
    console.error('❌ Maintenance job failed:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

runCleanup()
