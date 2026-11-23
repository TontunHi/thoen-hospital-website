import { queryMemberDb } from '@/lib/memberDb'
import { logAudit, maskAuditDetails, maskAuditIdentifier } from '@/lib/audit'
import { parseUserAgent } from '@/lib/userAgentParser'

export type AuditQueryExecutor = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<T[]>

export interface AuditLogRow {
  id: number
  timestamp: string
  username: string | null
  email: string | null
  action_type: string
  target_table: string
  action_details: string | null
  ip_address: string | null
  user_agent: string | null
}

export interface AuditLogFilterParams {
  page?: number
  limit?: number
  search?: string
  actionType?: string
  startDate?: string
  endDate?: string
}

function normalizeBangkokIsoTimestamp(ts: unknown): string | null {
  if (!ts) return null
  if (typeof ts === 'string') {
    if (ts.endsWith('Z')) return ts.replace(/Z$/, '+07:00')
    if (!ts.includes('+') && !ts.includes('Z')) return ts.replace(' ', 'T') + '+07:00'
    return ts
  }
  return String(ts)
}

function buildFilterClause(
  filters: AuditLogFilterParams,
  includeDetailsInPrimarySearch: boolean
): { clause: string; params: unknown[] } {
  let clause = ''
  const params: unknown[] = []

  if (filters.search) {
    const searchPattern = `%${filters.search}%`
    const maskedSearch = maskAuditIdentifier(filters.search)
    let searchCond = includeDetailsInPrimarySearch
      ? ' AND (username LIKE ? OR email LIKE ? OR target_table LIKE ? OR action_details LIKE ? OR ip_address LIKE ?'
      : ' AND (username LIKE ? OR email LIKE ? OR target_table LIKE ? OR ip_address LIKE ?'
    const searchParams: unknown[] = includeDetailsInPrimarySearch
      ? [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
      : [searchPattern, searchPattern, searchPattern, searchPattern]

    if (maskedSearch && maskedSearch !== filters.search) {
      searchCond += ' OR username LIKE ? OR action_details LIKE ?'
      searchParams.push(`%${maskedSearch}%`, `%${maskedSearch}%`)
    }
    searchCond += ')'
    clause += searchCond
    params.push(...searchParams)
  }

  if (filters.actionType) {
    clause += ' AND action_type = ?'
    params.push(filters.actionType)
  }

  if (filters.startDate) {
    clause += ' AND timestamp >= ?'
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    clause += ' AND timestamp <= ?'
    params.push(filters.endDate + ' 23:59:59')
  }

  return { clause, params }
}

export const AuditLogService = {
  async listAuditLogs(
    filters: AuditLogFilterParams,
    query: AuditQueryExecutor = queryMemberDb
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 25
    const offset = (page - 1) * limit

    const { clause, params } = buildFilterClause(filters, true)
    const countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1${clause}`
    const dataQuery = `SELECT * FROM audit_logs WHERE 1=1${clause} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`

    const totalRows = await query<{ total?: number }>(countQuery, params)
    const total = Number(totalRows[0]?.total || 0)

    const rawLogs = await query<AuditLogRow>(dataQuery, [...params, limit, offset])
    const logs = (rawLogs || []).map((log) => ({
      ...log,
      username: maskAuditIdentifier(log.username),
      action_details: maskAuditDetails(log.action_details),
      timestamp: normalizeBangkokIsoTimestamp(log.timestamp) ?? log.timestamp,
    }))

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  async getAuditLogStats(query: AuditQueryExecutor = queryMemberDb) {
    const summaryRows = await query<{
      total_logs?: number
      oldest_log?: string | null
      newest_log?: string | null
    }>(`
      SELECT 
        COUNT(*) AS total_logs,
        MIN(timestamp) AS oldest_log,
        MAX(timestamp) AS newest_log
      FROM audit_logs
    `)

    const todayStatsRows = await query<{
      logins_today?: number
      reads_today?: number
      changes_today?: number
    }>(`
      SELECT 
        COUNT(CASE WHEN action_type = 'LOGIN' THEN 1 END) AS logins_today,
        COUNT(CASE WHEN action_type = 'READ' THEN 1 END) AS reads_today,
        COUNT(CASE WHEN action_type IN ('CREATE', 'UPDATE', 'DELETE') THEN 1 END) AS changes_today
      FROM audit_logs
      WHERE timestamp >= CURDATE()
    `)

    const storageRows = await query<{ size_mb?: string | number | null }>(`
      SELECT 
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'
      LIMIT 1
    `)

    const totalLogs = Number(summaryRows[0]?.total_logs || 0)
    const oldestLog = normalizeBangkokIsoTimestamp(summaryRows[0]?.oldest_log)
    const newestLog = normalizeBangkokIsoTimestamp(summaryRows[0]?.newest_log)
    const loginsToday = Number(todayStatsRows[0]?.logins_today || 0)
    const readsToday = Number(todayStatsRows[0]?.reads_today || 0)
    const changesToday = Number(todayStatsRows[0]?.changes_today || 0)
    const rawSize = storageRows[0]?.size_mb
    const sizeMb = rawSize !== null && rawSize !== undefined ? parseFloat(String(rawSize)) : 0

    let retainedDays = 0
    if (oldestLog) {
      const oldestTime = new Date(oldestLog).getTime()
      const now = Date.now()
      retainedDays = Math.max(1, Math.floor((now - oldestTime) / (1000 * 60 * 60 * 24)))
    }

    return {
      totalLogs,
      sizeMb,
      oldestLog,
      newestLog,
      retainedDays,
      policyRetentionDays: 90,
      loginsToday,
      readsToday,
      changesToday,
    }
  },

  async exportAuditLogsCsv(
    filters: AuditLogFilterParams,
    query: AuditQueryExecutor = queryMemberDb
  ): Promise<string> {
    const { clause, params } = buildFilterClause(filters, false)
    const sql = `SELECT id, timestamp, username, email, action_type, target_table, action_details, ip_address, user_agent FROM audit_logs WHERE 1=1${clause} ORDER BY timestamp DESC, id DESC LIMIT 10000`
    const logs = await query<AuditLogRow>(sql, params)

    const escapeCsv = (valInput: unknown): string => {
      if (valInput === null || valInput === undefined) return '""'
      let val = String(valInput).replace(/"/g, '""')
      if (/^[=+\-@\t\r]/.test(val)) {
        val = `'${val}`
      }
      return `"${val}"`
    }

    const headers = [
      'ID',
      'วัน-เวลา',
      'ผู้ใช้งาน (Username)',
      'อีเมล (Email)',
      'ประเภท (Action)',
      'ตาราง/เป้าหมาย (Target)',
      'รายละเอียด (Details)',
      'IP Address',
      'อุปกรณ์ (Device)',
      'ระบบปฏิบัติการ (OS)',
      'เบราว์เซอร์ (Browser)',
      'User Agent แบบเต็ม',
    ]

    const csvRows = [
      headers.join(','),
      ...logs.map((log) => {
        const parsedUa = parseUserAgent(log.user_agent)
        const deviceTypeLabel =
          parsedUa.deviceType === 'desktop'
            ? 'คอมพิวเตอร์ (Desktop)'
            : parsedUa.deviceType === 'mobile'
            ? `มือถือ (${parsedUa.deviceModel || 'Mobile'})`
            : parsedUa.deviceType === 'tablet'
            ? `แท็บเล็ต (${parsedUa.deviceModel || 'Tablet'})`
            : parsedUa.deviceType === 'bot'
            ? 'Bot / Script'
            : 'ไม่ระบุ'

        let formattedTs = log.timestamp
        if (typeof formattedTs === 'string') {
          formattedTs = formattedTs
            .replace('T', ' ')
            .replace(/\.000Z$/, '')
            .replace(/Z$/, '')
            .replace(/\+07:00$/, '')
        }

        return [
          escapeCsv(log.id),
          escapeCsv(formattedTs),
          escapeCsv(maskAuditIdentifier(log.username)),
          escapeCsv(log.email),
          escapeCsv(log.action_type),
          escapeCsv(log.target_table),
          escapeCsv(maskAuditDetails(log.action_details)),
          escapeCsv(log.ip_address),
          escapeCsv(deviceTypeLabel),
          escapeCsv(parsedUa.os),
          escapeCsv(parsedUa.browser),
          escapeCsv(log.user_agent),
        ].join(',')
      }),
    ]

    return '\uFEFF' + csvRows.join('\r\n')
  },

  async countExpiredAuditLogs(
    retentionDays: number,
    query: AuditQueryExecutor = queryMemberDb
  ): Promise<number> {
    const countRows = await query<{ expiredCount?: number }>(
      'SELECT COUNT(*) as expiredCount FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [retentionDays]
    )
    return Number(countRows[0]?.expiredCount || 0)
  },

  async purgeExpiredAuditLogsByAdmin(
    retentionDays: number,
    adminActor: { username: string; email: string },
    query: AuditQueryExecutor = queryMemberDb
  ): Promise<{ expiredCount: number; purgedCount: number }> {
    const expiredCount = await this.countExpiredAuditLogs(retentionDays, query)
    if (expiredCount === 0) {
      return { expiredCount: 0, purgedCount: 0 }
    }

    let totalPurged = 0
    while (totalPurged < expiredCount) {
      const result = (await query(
        'DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000',
        [retentionDays]
      )) as unknown as { affectedRows?: number }
      const affected = Number(result?.affectedRows || 0)
      if (affected === 0) break
      totalPurged += affected
    }

    await query(
      `INSERT INTO audit_logs (username, email, action_type, target_table, action_details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminActor.username,
        adminActor.email,
        'DELETE',
        'audit_logs',
        `PDPA Maintenance: ล้างประวัติการใช้งานที่เก่ากว่า ${retentionDays} วัน จำนวน ${totalPurged} รายการ`,
        '127.0.0.1',
        'Web Admin Portal / PDPA Maintenance',
      ]
    )

    return { expiredCount, purgedCount: totalPurged }
  },

  async purgeExpiredAuditLogsByCron(
    retentionDays: number,
    query: AuditQueryExecutor = queryMemberDb
  ): Promise<{ expiredCount: number; deletedRows: number }> {
    const expiredCount = await this.countExpiredAuditLogs(retentionDays, query)
    let deletedRows = 0

    if (expiredCount > 0) {
      const deleteResult = (await query(
        'DELETE FROM audit_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000',
        [retentionDays]
      )) as unknown as { affectedRows?: number }
      deletedRows = Number(deleteResult?.affectedRows || 0)

      await logAudit(
        'DELETE',
        'audit_logs',
        `PDPA automated cleanup: purged ${deletedRows} logs older than ${retentionDays} days`,
        { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
      )
    }

    return { expiredCount, deletedRows }
  },
}
