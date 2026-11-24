import { apiGateway } from '@/lib/apiGateway'
import { logAudit, maskAuditDetails, maskAuditIdentifier } from '@/lib/audit'
import { parseUserAgent } from '@/lib/userAgentParser'

export interface AuditLogGatewayDeps {
  listAuditLogsAdmin: typeof apiGateway.app.listAuditLogsAdmin
  exportAuditLogsAdminRaw: typeof apiGateway.app.exportAuditLogsAdminRaw
  getAuditLogStatsRaw: typeof apiGateway.app.getAuditLogStatsRaw
  getExpiredAuditLogsCount: typeof apiGateway.app.getExpiredAuditLogsCount
  purgeExpiredAuditLogs: typeof apiGateway.app.purgeExpiredAuditLogs
}

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

function getDefaultGateway(): AuditLogGatewayDeps {
  return apiGateway.app
}

export const AuditLogService = {
  async listAuditLogs(
    filters: AuditLogFilterParams,
    gw: Pick<AuditLogGatewayDeps, 'listAuditLogsAdmin'> = getDefaultGateway()
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 25
    const maskedSearch = filters.search ? maskAuditIdentifier(filters.search) ?? undefined : undefined

    const { total, logs: rawLogs } = await gw.listAuditLogsAdmin({
      page,
      limit,
      search: filters.search,
      maskedSearch: maskedSearch && maskedSearch !== filters.search ? maskedSearch : undefined,
      actionType: filters.actionType,
      startDate: filters.startDate,
      endDate: filters.endDate,
    })

    const logs = ((rawLogs || []) as AuditLogRow[]).map((log) => ({
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

  async getAuditLogStats(
    gw: Pick<AuditLogGatewayDeps, 'getAuditLogStatsRaw'> = getDefaultGateway()
  ) {
    const { summary, today, storage } = await gw.getAuditLogStatsRaw()

    const totalLogs = Number(summary?.total_logs || 0)
    const oldestLog = normalizeBangkokIsoTimestamp(summary?.oldest_log)
    const newestLog = normalizeBangkokIsoTimestamp(summary?.newest_log)
    const loginsToday = Number(today?.logins_today || 0)
    const readsToday = Number(today?.reads_today || 0)
    const changesToday = Number(today?.changes_today || 0)
    const rawSize = storage?.size_mb
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
    gw: Pick<AuditLogGatewayDeps, 'exportAuditLogsAdminRaw'> = getDefaultGateway()
  ): Promise<string> {
    const maskedSearch = filters.search ? maskAuditIdentifier(filters.search) ?? undefined : undefined
    const logs = (await gw.exportAuditLogsAdminRaw({
      search: filters.search,
      maskedSearch: maskedSearch && maskedSearch !== filters.search ? maskedSearch : undefined,
      actionType: filters.actionType,
      startDate: filters.startDate,
      endDate: filters.endDate,
    })) as AuditLogRow[]

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
      ...(logs || []).map((log) => {
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
    gw: Pick<AuditLogGatewayDeps, 'getExpiredAuditLogsCount'> = getDefaultGateway()
  ): Promise<number> {
    const res = await gw.getExpiredAuditLogsCount(retentionDays)
    return Number(res?.expiredCount || 0)
  },

  async purgeExpiredAuditLogsByAdmin(
    retentionDays: number,
    adminActor: { username: string; email: string },
    gw: Pick<AuditLogGatewayDeps, 'purgeExpiredAuditLogs'> = getDefaultGateway()
  ): Promise<{ expiredCount: number; purgedCount: number }> {
    return gw.purgeExpiredAuditLogs({
      retentionDays,
      mode: 'admin',
      adminActor,
    })
  },

  async purgeExpiredAuditLogsByCron(
    retentionDays: number,
    gw: Pick<AuditLogGatewayDeps, 'purgeExpiredAuditLogs'> = getDefaultGateway()
  ): Promise<{ expiredCount: number; deletedRows: number }> {
    const res = await gw.purgeExpiredAuditLogs({
      retentionDays,
      mode: 'cron',
    })
    const deletedRows = Number(res?.purgedCount || 0)

    if (res.expiredCount > 0) {
      await logAudit(
        'DELETE',
        'audit_logs',
        `PDPA automated cleanup: purged ${deletedRows} logs older than ${retentionDays} days`,
        { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
      )
    }

    return { expiredCount: res.expiredCount, deletedRows }
  },
}
