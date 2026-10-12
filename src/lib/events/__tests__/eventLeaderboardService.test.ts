import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventLeaderboardService } from '../eventLeaderboardService'

describe('EventLeaderboardService', () => {
  let mockDb: any
  let service: EventLeaderboardService

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = {
      eventAttendance: {
        findMany: vi.fn(),
      },
      member: {
        findMany: vi.fn(),
      },
      hospitalEvent: {
        findMany: vi.fn(),
      },
    }
    service = new EventLeaderboardService(mockDb)
  })

  describe('getIndividualLeaderboard', () => {
    it('calculates dense rank correctly when members have equal scores', async () => {
      // 4 members with attendances
      // Somchai: 3 attendances (3 pts)
      // Somsri: 2 attendances (2 pts)
      // Mana: 2 attendances (2 pts)
      // Manee: 1 attendance (1 pt)
      mockDb.eventAttendance.findMany.mockResolvedValue([
        { memberId: 1, event: { fiscalYear: '2569' }, member: { id: 1, name: 'สมชาย', department: 'ไอที' } },
        { memberId: 1, event: { fiscalYear: '2569' }, member: { id: 1, name: 'สมชาย', department: 'ไอที' } },
        { memberId: 1, event: { fiscalYear: '2569' }, member: { id: 1, name: 'สมชาย', department: 'ไอที' } },
        { memberId: 2, event: { fiscalYear: '2569' }, member: { id: 2, name: 'สมศรี', department: 'พยาบาล' } },
        { memberId: 2, event: { fiscalYear: '2569' }, member: { id: 2, name: 'สมศรี', department: 'พยาบาล' } },
        { memberId: 3, event: { fiscalYear: '2569' }, member: { id: 3, name: 'มานะ', department: 'ทันตกรรม' } },
        { memberId: 3, event: { fiscalYear: '2569' }, member: { id: 3, name: 'มานะ', department: 'ทันตกรรม' } },
        { memberId: 4, event: { fiscalYear: '2569' }, member: { id: 4, name: 'มานี', department: 'การเงิน' } },
      ])

      const result = await service.getIndividualLeaderboard({ fiscalYear: '2569' })

      expect(result).toHaveLength(4)
      // Somchai: rank 1, 3 pts
      expect(result[0]).toMatchObject({ memberId: 1, totalPoints: 3, rank: 1 })
      // Somsri: rank 2, 2 pts
      expect(result[1]).toMatchObject({ memberId: 2, totalPoints: 2, rank: 2 })
      // Mana: rank 2, 2 pts (tied rank)
      expect(result[2]).toMatchObject({ memberId: 3, totalPoints: 2, rank: 2 })
      // Manee: rank 3, 1 pt (dense rank next rank is 3)
      expect(result[3]).toMatchObject({ memberId: 4, totalPoints: 1, rank: 3 })
    })
  })

  describe('getDepartmentLeaderboard', () => {
    it('calculates total points and average points per department member with dense rank', async () => {
      // Members in departments:
      // IT: 2 members (id: 1, 2)
      // Nursing: 4 members (id: 3, 4, 5, 6)
      mockDb.member.findMany.mockResolvedValue([
        { id: 1, department: 'กลุ่มงานสารสนเทศ' },
        { id: 2, department: 'กลุ่มงานสารสนเทศ' },
        { id: 3, department: 'กลุ่มงานการพยาบาล' },
        { id: 4, department: 'กลุ่มงานการพยาบาล' },
        { id: 5, department: 'กลุ่มงานการพยาบาล' },
        { id: 6, department: 'กลุ่มงานการพยาบาล' },
      ])

      // Attendances:
      // IT: 4 points total -> Avg = 4 / 2 = 2.00
      // Nursing: 4 points total -> Avg = 4 / 4 = 1.00
      mockDb.eventAttendance.findMany.mockResolvedValue([
        { memberId: 1, member: { department: 'กลุ่มงานสารสนเทศ' } },
        { memberId: 1, member: { department: 'กลุ่มงานสารสนเทศ' } },
        { memberId: 2, member: { department: 'กลุ่มงานสารสนเทศ' } },
        { memberId: 2, member: { department: 'กลุ่มงานสารสนเทศ' } },
        { memberId: 3, member: { department: 'กลุ่มงานการพยาบาล' } },
        { memberId: 4, member: { department: 'กลุ่มงานการพยาบาล' } },
        { memberId: 5, member: { department: 'กลุ่มงานการพยาบาล' } },
        { memberId: 6, member: { department: 'กลุ่มงานการพยาบาล' } },
      ])

      const result = await service.getDepartmentLeaderboard({ fiscalYear: '2569' })

      expect(result).toHaveLength(2)
      // Both have 4 total points, but IT has higher average (2.0 vs 1.0)
      const itDept = result.find((d: any) => d.department === 'กลุ่มงานสารสนเทศ')
      const nurseDept = result.find((d: any) => d.department === 'กลุ่มงานการพยาบาล')

      expect(itDept).toMatchObject({
        totalPoints: 4,
        memberCount: 2,
        avgPointsPerMember: 2,
      })
      expect(nurseDept).toMatchObject({
        totalPoints: 4,
        memberCount: 4,
        avgPointsPerMember: 1,
      })
    })
  })
})
