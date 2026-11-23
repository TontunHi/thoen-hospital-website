import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { buildStatementData, StatementRange } from '@/lib/salary/salaryStatementService'

export type SalaryPortalQueryExecutor = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<T[]>

export class SalaryPortalError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message)
    this.name = 'SalaryPortalError'
  }
}

const THAI_MONTH_ORDER = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

export const SalaryPortalService = {
  async resolveTargetMemberForStatement(
    targetUsername: string,
    query: SalaryPortalQueryExecutor = queryMemberDb
  ) {
    const memberRows = await query<{
      id: number
      username: string
      email: string | null
      name: string | null
      department: string | null
      position: string | null
      salary_user: string | null
    }>(
      'SELECT id, username, email, name, department, position, salary_user FROM members WHERE username = ? OR salary_user = ? LIMIT 1',
      [targetUsername, targetUsername]
    )
    return memberRows && memberRows.length > 0 ? memberRows[0] : null
  },

  async buildEmployeeSalaryStatement(
    params: {
      targetUsername: string
      range: StatementRange
      fromPeriod: string
      toPeriod: string
      format: string
      actor: { username: string; email: string }
    },
    query: SalaryPortalQueryExecutor = queryMemberDb
  ) {
    const targetMember = await this.resolveTargetMemberForStatement(
      params.targetUsername,
      query
    )
    const salaryLookupId = targetMember?.salary_user || params.targetUsername

    let salaryRows: Record<string, any>[] = []
    let otRows: Record<string, any>[] = []

    try {
      const records = await apiGateway.salary.getRecords(salaryLookupId)
      salaryRows = records?.salary || []
      otRows = records?.ot || []
    } catch {
      throw new SalaryPortalError('ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้', 500)
    }

    if (
      (!salaryRows || salaryRows.length === 0) &&
      (!otRows || otRows.length === 0)
    ) {
      throw new SalaryPortalError(
        `ไม่พบข้อมูลเงินเดือนสำหรับรหัส "${params.targetUsername}"`,
        404
      )
    }

    const resolvedMember = {
      id: targetMember?.id || 0,
      username: targetMember?.username || params.targetUsername,
      name:
        targetMember?.name ||
        salaryRows[0]?.c4?.trim() ||
        otRows[0]?.c4?.trim() ||
        params.targetUsername,
      department: targetMember?.department || '-',
      position: targetMember?.position || '-',
      salary_user: targetMember?.salary_user || params.targetUsername,
    }

    const statementData = buildStatementData(
      resolvedMember,
      salaryRows as any,
      otRows as any,
      {
        range: params.range,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
      }
    )

    logAudit(
      'READ',
      'salary',
      `Exported salary statement (${statementData.rangeLabel}, format: ${params.format}) for employee: ${resolvedMember.username}`,
      { username: params.actor.username, email: params.actor.email }
    ).catch((err) => logger.error({ err }, 'Salary statement audit log failed'))

    return { resolvedMember, statementData }
  },

  async getExpectedSalaryUserForMember(
    memberUsername: string,
    query: SalaryPortalQueryExecutor = queryMemberDb
  ): Promise<string | null> {
    const memberRows = await query<{ salary_user: string | null }>(
      'SELECT salary_user FROM members WHERE username = ? LIMIT 1',
      [memberUsername]
    )
    return memberRows[0]?.salary_user ?? null
  },

  async fetchPersonalSalaryPayload(params: {
    salaryUsername: string
    salaryDisplayName: string
    selectedYear: string | null
    selectedMonth: string | null
    actor: { username: string; email: string }
  }) {
    logAudit(
      'READ',
      'salary',
      'Viewed personal salary and payslip records',
      { username: params.actor.username, email: params.actor.email }
    ).catch((err) => logger.error({ err }, 'Salary data audit log failed'))

    let salaryRows: Record<string, any>[] = []
    let otRows: Record<string, any>[] = []
    let calendarRows: unknown[] = []

    try {
      const records = await apiGateway.salary.getRecords(params.salaryUsername)
      salaryRows = records?.salary || []
      otRows = records?.ot || []
    } catch {
      throw new SalaryPortalError(
        'ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
        500
      )
    }

    try {
      const calRes = await apiGateway.salary.getCalendar()
      calendarRows = calRes || []
    } catch (calErr) {
      logger.warn(
        { err: calErr },
        'Calendar schedule fetch failed, continuing without calendar'
      )
    }

    const periods = new Set<string>()

    const mappedSalaries = salaryRows.map((row) => {
      const cleanedPeriod = row.c8 ? String(row.c8).replace(/\s+/g, ' ').trim() : ''
      if (cleanedPeriod) {
        periods.add(cleanedPeriod)
      }
      return {
        ...row,
        computedPeriod: cleanedPeriod,
      }
    })

    const mappedOts = otRows.map((row) => {
      if (!row.c10 || !row.c1) return { ...row, computedPeriod: '' }

      const otMonth = String(row.c10).trim()
      const payDate = new Date(row.c1)
      const payYear = payDate.getFullYear() + 543
      const payMonth = payDate.getMonth()

      let otYear = payYear
      if (payMonth === 0 && otMonth === 'ธันวาคม') {
        otYear = payYear - 1
      }

      const computedPeriod = `${otMonth} ${otYear}`
      periods.add(computedPeriod)
      return {
        ...row,
        computedPeriod,
      }
    })

    const parsedPeriods = Array.from(periods)
      .map((p) => {
        const parts = p.split(/\s+/)
        return {
          month: parts[0],
          year: parts[1],
          original: p,
        }
      })
      .filter((p) => p.month && p.year)

    parsedPeriods.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year.localeCompare(a.year)
      }
      return (
        THAI_MONTH_ORDER.indexOf(b.month) - THAI_MONTH_ORDER.indexOf(a.month)
      )
    })

    const years = Array.from(new Set(parsedPeriods.map((p) => p.year))).sort(
      (a, b) => b.localeCompare(a)
    )

    let targetYear = params.selectedYear
    let targetMonth = params.selectedMonth

    if (!targetYear && years.length > 0) {
      targetYear = years[0]
    }

    if (!targetMonth && targetYear) {
      const monthsForYear = parsedPeriods
        .filter((p) => p.year === targetYear)
        .map((p) => p.month)
      monthsForYear.sort(
        (a, b) => THAI_MONTH_ORDER.indexOf(b) - THAI_MONTH_ORDER.indexOf(a)
      )
      if (monthsForYear.length > 0) {
        targetMonth = monthsForYear[0]
      }
    }

    let salaryData = null
    let otData = null

    if (targetYear && targetMonth) {
      const searchPattern = `${targetMonth} ${targetYear}`
      const matchedSalary = mappedSalaries.find(
        (r) => r.computedPeriod === searchPattern
      )
      const matchedOt = mappedOts.find(
        (r) => r.computedPeriod === searchPattern
      )
      if (matchedSalary) salaryData = matchedSalary
      if (matchedOt) otData = matchedOt
    }

    return {
      years,
      selectedYear: targetYear,
      selectedMonth: targetMonth,
      salary: salaryData,
      ot: otData,
      calendar: calendarRows,
      userName: params.salaryDisplayName,
    }
  },

  async getStoredMemberSalaryCredentials(
    memberSession: { username: string; email: string },
    query: SalaryPortalQueryExecutor = queryMemberDb
  ): Promise<{ salary_user: string | null; salary_pass: string | null } | null> {
    const users = await query<{
      salary_user: string | null
      salary_pass: string | null
    }>(
      'SELECT salary_user, salary_pass FROM members WHERE username = ? AND email = ? LIMIT 1',
      [memberSession.username, memberSession.email]
    )
    if (!users || users.length === 0) return null
    return users[0]
  },

  async verifyFinanceUploadAccess(
    session: { username: string; email: string },
    query: SalaryPortalQueryExecutor = queryMemberDb
  ): Promise<{ allowed: boolean; error?: string; status?: number }> {
    const users = await query<{ role: string; position: string | null }>(
      'SELECT role, position FROM members WHERE username = ? AND email = ?',
      [session.username, session.email]
    )

    if (!users || users.length === 0) {
      return { allowed: false, error: 'ไม่พบข้อมูลสมาชิกในระบบ', status: 403 }
    }

    const member = users[0]
    let isFinance =
      member.role === 'admin' ||
      Boolean(member.position && member.position.includes('เจ้าพนักงานการเงินและบัญชี'))

    if (!isFinance && member.position) {
      const finPerms = await query<{ count?: number }>(
        "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'upload_salary' AND TRIM(position_name) = TRIM(?)",
        [member.position]
      )
      isFinance = Number(finPerms[0]?.count || 0) > 0
    }

    if (!isFinance) {
      return { allowed: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้', status: 403 }
    }

    return { allowed: true }
  },

  async isSalaryFeatureEnabled(
    role: string,
    query: SalaryPortalQueryExecutor = queryMemberDb
  ): Promise<boolean> {
    if (role === 'admin') return true
    const settingsRows = await query<{ config_value: string | null }>(
      "SELECT config_value FROM member_system_settings WHERE config_key = 'feature_salary'"
    )
    return settingsRows.length === 0 || settingsRows[0].config_value !== '0'
  },
}
