import { queryMemberDb } from '@/lib/memberDb'
import { calculateCurrentFiscalYear } from './hospitalEventService'

export interface LeaderboardFilterOptions {
  fiscalYear?: string
  timeframe?: 'fiscal_year' | 'monthly' | 'all'
  month?: number // 1-12
  year?: number // CE Year
  search?: string
}

export interface IndividualRankItem {
  rank: number
  memberId: number
  name: string
  department: string | null
  position: string | null
  profilePath: string | null
  totalPoints: number
  eventCount: number
  latestCheckinAt: Date
}

export interface DepartmentRankItem {
  rank: number
  department: string
  totalPoints: number
  memberCount: number
  avgPointsPerMember: number
}

export class EventLeaderboardService {
  constructor(
    private db: any = null,
    private readonly queryExecutor: (sql: string, params?: any[]) => Promise<any[]> = queryMemberDb
  ) {}

  async getIndividualLeaderboard(options: LeaderboardFilterOptions = {}): Promise<IndividualRankItem[]> {
    const fiscalYear = options.fiscalYear || calculateCurrentFiscalYear()

    let attendances: any[] = []

    if (this.db?.eventAttendance) {
      const where: any = {}
      if (options.timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
        where.event = { fiscalYear }
      }

      attendances = await this.db.eventAttendance.findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
              profilePath: true,
            },
          },
        },
        orderBy: { checkedInAt: 'desc' },
      })
    } else {
      const whereClauses: string[] = []
      const params: any[] = []

      if (options.timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
        whereClauses.push('e.fiscal_year = ?')
        params.push(fiscalYear)
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const rows = await this.queryExecutor(`
        SELECT 
          a.id, a.event_id, a.member_id, a.points_awarded AS pointsAwarded, a.checked_in_at AS checkedInAt,
          m.id AS m_id, m.name AS m_name, m.department AS m_department, m.position AS m_position, m.profile_path AS m_profile_path
        FROM event_attendances a
        LEFT JOIN members m ON a.member_id = m.id
        LEFT JOIN hospital_events e ON a.event_id = e.id
        ${whereSql}
        ORDER BY a.checked_in_at DESC
      `, params)

      attendances = rows.map((r: any) => ({
        id: r.id,
        memberId: r.member_id,
        pointsAwarded: r.pointsAwarded,
        checkedInAt: r.checkedInAt,
        member: r.m_id
          ? {
              id: r.m_id,
              name: r.m_name,
              department: r.m_department,
              position: r.m_position,
              profilePath: r.m_profile_path,
            }
          : null,
      }))
    }

    // Group by memberId
    const scoreMap = new Map<number, {
      member: any
      points: number
      count: number
      latestCheckinAt: Date
    }>()

    for (const att of attendances) {
      if (!att.member) continue
      const existing = scoreMap.get(att.member.id)
      const points = att.pointsAwarded || 1

      if (!existing) {
        scoreMap.set(att.member.id, {
          member: att.member,
          points,
          count: 1,
          latestCheckinAt: att.checkedInAt,
        })
      } else {
        existing.points += points
        existing.count += 1
        if (att.checkedInAt > existing.latestCheckinAt) {
          existing.latestCheckinAt = att.checkedInAt
        }
      }
    }

    let items = Array.from(scoreMap.values()).map((val) => ({
      memberId: val.member.id,
      name: val.member.name || 'ไม่ระบุชื่อ',
      department: val.member.department || 'ไม่ระบุแผนก',
      position: val.member.position || null,
      profilePath: val.member.profilePath || null,
      totalPoints: val.points,
      eventCount: val.count,
      latestCheckinAt: val.latestCheckinAt,
    }))

    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase()
      items = items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.department && it.department.toLowerCase().includes(q))
      )
    }

    // Sort descending by totalPoints, then by latestCheckinAt
    items.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      return new Date(b.latestCheckinAt).getTime() - new Date(a.latestCheckinAt).getTime()
    })

    // Compute Dense Rank (Tied ranks: 1, 2, 2, 3)
    let currentRank = 0
    let lastPoints = -1

    return items.map((it) => {
      if (it.totalPoints !== lastPoints) {
        currentRank++
        lastPoints = it.totalPoints
      }
      return {
        ...it,
        rank: currentRank,
      }
    })
  }

  async getDepartmentLeaderboard(options: LeaderboardFilterOptions = {}): Promise<DepartmentRankItem[]> {
    const fiscalYear = options.fiscalYear || calculateCurrentFiscalYear()

    let members: any[] = []
    let attendances: any[] = []

    if (this.db?.eventAttendance && this.db?.member) {
      const where: any = {}
      if (options.timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
        where.event = { fiscalYear }
      }

      const results = await Promise.all([
        this.db.member.findMany({
          select: { id: true, department: true },
        }),
        this.db.eventAttendance.findMany({
          where,
          include: {
            member: {
              select: { id: true, department: true },
            },
          },
        }),
      ])
      members = results[0]
      attendances = results[1]
    } else {
      const whereClauses: string[] = []
      const params: any[] = []

      if (options.timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
        whereClauses.push('e.fiscal_year = ?')
        params.push(fiscalYear)
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const [memberRows, attRows] = await Promise.all([
        this.queryExecutor('SELECT id, department FROM members'),
        this.queryExecutor(`
          SELECT 
            a.id, a.points_awarded AS pointsAwarded,
            m.id AS m_id, m.department AS m_department
          FROM event_attendances a
          LEFT JOIN members m ON a.member_id = m.id
          LEFT JOIN hospital_events e ON a.event_id = e.id
          ${whereSql}
        `, params),
      ])

      members = memberRows
      attendances = attRows.map((r: any) => ({
        id: r.id,
        pointsAwarded: r.pointsAwarded,
        member: r.m_id ? { id: r.m_id, department: r.m_department } : null,
      }))
    }

    // Count members per department
    const deptMemberCountMap = new Map<string, number>()
    for (const m of members) {
      const dept = m.department?.trim() || 'ไม่ระบุแผนก'
      deptMemberCountMap.set(dept, (deptMemberCountMap.get(dept) || 0) + 1)
    }

    // Sum points per department
    const deptPointsMap = new Map<string, number>()
    for (const att of attendances) {
      const dept = att.member?.department?.trim() || 'ไม่ระบุแผนก'
      const pts = att.pointsAwarded || 1
      deptPointsMap.set(dept, (deptPointsMap.get(dept) || 0) + pts)
    }

    // Build department summary
    const deptList: DepartmentRankItem[] = []

    for (const [dept, totalPoints] of deptPointsMap.entries()) {
      const memberCount = deptMemberCountMap.get(dept) || 1
      const avg = Number((totalPoints / memberCount).toFixed(2))

      deptList.push({
        rank: 0,
        department: dept,
        totalPoints,
        memberCount,
        avgPointsPerMember: avg,
      })
    }

    // Sort descending by totalPoints, then by avgPointsPerMember
    deptList.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      return b.avgPointsPerMember - a.avgPointsPerMember
    })

    // Compute Dense Rank
    let currentRank = 0
    let lastPoints = -1

    return deptList.map((item) => {
      if (item.totalPoints !== lastPoints) {
        currentRank++
        lastPoints = item.totalPoints
      }
      return {
        ...item,
        rank: currentRank,
      }
    })
  }

  async getDistinctFiscalYears(): Promise<string[]> {
    if (this.db?.hospitalEvent) {
      const events = await this.db.hospitalEvent.findMany({
        select: { fiscalYear: true },
        distinct: ['fiscalYear'],
        orderBy: { fiscalYear: 'desc' },
      })
      const years = events.map((e: any) => e.fiscalYear).filter(Boolean)
      const currentYear = calculateCurrentFiscalYear()
      if (!years.includes(currentYear)) {
        years.unshift(currentYear)
      }
      return years
    }

    const rows = await this.queryExecutor('SELECT DISTINCT fiscal_year AS fiscalYear FROM hospital_events WHERE fiscal_year IS NOT NULL ORDER BY fiscal_year DESC')
    const years = rows.map((r: any) => r.fiscalYear).filter(Boolean)
    const currentYear = calculateCurrentFiscalYear()
    if (!years.includes(currentYear)) {
      years.unshift(currentYear)
    }
    return years
  }
}
