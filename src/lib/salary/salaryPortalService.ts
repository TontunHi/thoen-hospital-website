import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { buildStatementData, StatementRange } from '@/lib/salary/salaryStatementService'

export interface SalaryPortalGatewayAdapter {
  lookupMember: (target: string) => Promise<{
    id: number
    username: string
    email: string | null
    name: string | null
    department: string | null
    position: string | null
    salary_user: string | null
  } | null>
  getMemberCredentials: (
    username: string,
    email: string
  ) => Promise<{ salary_user: string | null; salary_pass: string | null } | null>
  verifyFinanceAccess: (
    username: string,
    email: string
  ) => Promise<{ allowed: boolean; error?: string; status?: number }>
  getFeatureEnabled: () => Promise<{ enabled: boolean }>
  getRecords: (salaryUser: string) => Promise<{
    salary: Array<Record<string, any>>
    ot: Array<Record<string, any>>
  }>
  getCalendar: () => Promise<Array<Record<string, any>>>
}

const defaultSalaryPortalGateway: SalaryPortalGatewayAdapter = {
  lookupMember: (target) => apiGateway.salary.lookupMember(target),
  getMemberCredentials: (username, email) => apiGateway.salary.getMemberCredentials(username, email),
  verifyFinanceAccess: (username, email) => apiGateway.salary.verifyFinanceAccess(username, email),
  getFeatureEnabled: () => apiGateway.salary.getFeatureEnabled(),
  getRecords: (salaryUser) => apiGateway.salary.getRecords(salaryUser),
  getCalendar: () => apiGateway.salary.getCalendar(),
}

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
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ) {
    return gateway.lookupMember(targetUsername)
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
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ) {
    const targetMember = await this.resolveTargetMemberForStatement(
      params.targetUsername,
      gateway
    )
    const salaryLookupId = targetMember?.salary_user || params.targetUsername

    let salaryRows: Record<string, any>[] = []
    let otRows: Record<string, any>[] = []

    try {
      const records = await gateway.getRecords(salaryLookupId)
      salaryRows = records?.salary || []
      otRows = records?.ot || []
    } catch {
      throw new SalaryPortalError('ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้', 500)
    }

    if (salaryRows.length === 0 && otRows.length === 0) {
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
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ): Promise<string | null> {
    const member = await gateway.lookupMember(memberUsername)
    return member?.salary_user ?? null
  },

  async fetchPersonalSalaryPayload(
    params: {
      salaryUsername: string
      salaryDisplayName: string
      selectedYear: string | null
      selectedMonth: string | null
      actor: { username: string; email: string }
    },
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ) {
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
      const records = await gateway.getRecords(params.salaryUsername)
      salaryRows = records?.salary || []
      otRows = records?.ot || []
    } catch {
      throw new SalaryPortalError(
        'ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
        500
      )
    }

    try {
      const calRes = await gateway.getCalendar()
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
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ): Promise<{ salary_user: string | null; salary_pass: string | null } | null> {
    return gateway.getMemberCredentials(memberSession.username, memberSession.email)
  },

  async verifyFinanceUploadAccess(
    session: { username: string; email: string },
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ): Promise<{ allowed: boolean; error?: string; status?: number }> {
    return gateway.verifyFinanceAccess(session.username, session.email)
  },

  async isSalaryFeatureEnabled(
    role: string,
    gateway: SalaryPortalGatewayAdapter = defaultSalaryPortalGateway
  ): Promise<boolean> {
    if (role === 'admin') return true
    const res = await gateway.getFeatureEnabled()
    return res?.enabled !== false
  },
}
