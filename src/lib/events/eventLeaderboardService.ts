import { prisma } from '@/lib/prisma'
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
  constructor(private db: any = prisma) {}

  async getIndividualLeaderboard(options: LeaderboardFilterOptions = {}): Promise<IndividualRankItem[]> {
    const fiscalYear = options.fiscalYear || calculateCurrentFiscalYear()
    const where: any = {}

    if (options.timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
      where.event = { fiscalYear }
    }

    const attendances = await this.db.eventAttendance.findMany({
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
    const where: any = {}

    if (options.timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
      where.event = { fiscalYear }
    }

    const [members, attendances] = await Promise.all([
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
}
