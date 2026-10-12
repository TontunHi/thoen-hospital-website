import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getEvents, POST as createEvent } from '../route'
import { GET as getEventDetail, PUT as updateEvent } from '../[id]/route'
import { POST as registerEvent, DELETE as cancelRegister } from '../[id]/register/route'
import { GET as getLeaderboard } from '../leaderboard/route'
import * as memberAuth from '@/lib/memberAuth'

const { mockEventServiceInstance, mockLeaderboardServiceInstance } = vi.hoisted(() => ({
  mockEventServiceInstance: {
    getEvents: vi.fn(),
    createEvent: vi.fn(),
    getEventById: vi.fn(),
    updateEvent: vi.fn(),
    registerForEvent: vi.fn(),
    cancelRegistration: vi.fn(),
  },
  mockLeaderboardServiceInstance: {
    getIndividualLeaderboard: vi.fn(),
    getDepartmentLeaderboard: vi.fn(),
    getDistinctFiscalYears: vi.fn(),
  },
}))

vi.mock('@/lib/events/hospitalEventService', () => {
  return {
    HospitalEventService: class {
      constructor() {
        return mockEventServiceInstance
      }
    },
  }
})

vi.mock('@/lib/events/eventLeaderboardService', () => {
  return {
    EventLeaderboardService: class {
      constructor() {
        return mockLeaderboardServiceInstance
      }
    },
  }
})

describe('Member Events API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/member/events returns 401 when unauthenticated', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      error: {
        status: 401,
        json: async () => ({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }),
      } as any,
    })

    const req = new Request('http://localhost/api/member/events')
    const res = await getEvents(req)

    expect(res.status).toBe(401)
  })

  it('GET /api/member/events returns events list for authenticated member', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 5, name: 'Somchai', username: 'user1' } as any,
    })

    mockEventServiceInstance.getEvents.mockResolvedValue({
      events: [{ id: 1, title: 'กิจกรรมเดิน-วิ่ง', registrationCount: 10, attendanceCount: 5 }],
      total: 1,
    })

    const req = new Request('http://localhost/api/member/events?tab=upcoming')
    const res = await getEvents(req)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.events).toHaveLength(1)
    expect(mockEventServiceInstance.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 5 })
    )
  })

  it('POST /api/member/events validates request and creates event', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 5, name: 'Somchai', username: 'user1', role: 'member', department: 'IT' } as any,
    })

    mockEventServiceInstance.createEvent.mockResolvedValue({
      id: 99,
      title: 'อบรมพัฒนา AI',
    })

    const body = {
      title: 'อบรมพัฒนา AI',
      eventStartDate: '2026-10-25T09:00:00Z',
      eventEndDate: '2026-10-25T12:00:00Z',
    }

    const req = new Request('http://localhost/api/member/events', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const res = await createEvent(req)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.id).toBe(99)
    expect(mockEventServiceInstance.createEvent).toHaveBeenCalled()
  })

  it('POST /api/member/events/[id]/register registers member', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 5 } as any,
    })

    mockEventServiceInstance.registerForEvent.mockResolvedValue({
      success: true,
      message: 'ลงทะเบียนสำเร็จ',
    })

    const req = new Request('http://localhost/api/member/events/10/register', { method: 'POST' })
    const res = await registerEvent(req, { params: Promise.resolve({ id: '10' }) })
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(mockEventServiceInstance.registerForEvent).toHaveBeenCalledWith(10, 5)
  })

  it('GET /api/member/events/leaderboard returns rankings', async () => {
    vi.spyOn(memberAuth, 'requireMemberApi').mockResolvedValue({
      member: { id: 5 } as any,
    })

    mockLeaderboardServiceInstance.getIndividualLeaderboard.mockResolvedValue([
      { rank: 1, name: 'Somchai', totalPoints: 10 },
    ])
    mockLeaderboardServiceInstance.getDepartmentLeaderboard.mockResolvedValue([
      { rank: 1, department: 'IT', totalPoints: 20, avgPointsPerMember: 4 },
    ])
    mockLeaderboardServiceInstance.getDistinctFiscalYears.mockResolvedValue(['2569'])

    const req = new Request('http://localhost/api/member/events/leaderboard?fiscalYear=2569')
    const res = await getLeaderboard(req)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.individual).toHaveLength(1)
    expect(json.data.department).toHaveLength(1)
    expect(json.data.fiscalYears).toEqual(['2569'])
  })
})
