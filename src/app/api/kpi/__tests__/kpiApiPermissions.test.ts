import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks
const mockRequireMemberApi = vi.fn()
vi.mock('@/lib/memberAuth', () => ({
  requireMemberApi: () => mockRequireMemberApi(),
  verifyMemberSession: vi.fn(),
}))

const mockCreateIndicator = vi.fn()
const mockUpdateIndicator = vi.fn()
const mockDeleteIndicator = vi.fn()
const mockGetIndicatorById = vi.fn()
const mockUpdateTarget = vi.fn()
const mockSaveEntry = vi.fn()

vi.mock('@/lib/kpi/kpiService', () => ({
  KpiService: {
    createIndicator: (...args: any[]) => mockCreateIndicator(...args),
    updateIndicator: (...args: any[]) => mockUpdateIndicator(...args),
    deleteIndicator: (...args: any[]) => mockDeleteIndicator(...args),
    getIndicatorById: (...args: any[]) => mockGetIndicatorById(...args),
    updateTarget: (...args: any[]) => mockUpdateTarget(...args),
    saveEntry: (...args: any[]) => mockSaveEntry(...args),
  },
}))

vi.mock('@/lib/memberDb', () => ({
  queryMemberDb: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    app: {
      transaction: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('KPI API Permissions Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMemberMock = (isAdmin: boolean, permissions: string[]) => ({
    id: 145,
    username: '1520800055172',
    name: 'นางสาว ชนิกา ปัญญาสิทธิ์',
    role: isAdmin ? 'admin' : 'member',
    isAdmin,
    permissions: new Set(permissions),
    can: (perm: string) => permissions.includes(perm),
  })

  describe('POST /api/kpi/indicators', () => {
    it('allows member with manage_kpi permission to create an indicator', async () => {
      mockRequireMemberApi.mockResolvedValueOnce({
        member: createMemberMock(false, ['manage_kpi']),
      })
      mockCreateIndicator.mockResolvedValueOnce(99)

      const { POST } = await import('@/app/api/kpi/indicators/route')
      const req = new NextRequest('http://localhost:3000/api/kpi/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: 1,
          category: 'หมวดที่ 1',
          frequency: 'รายเดือน',
          title: 'ทดสอบตัวชี้วัด',
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.id).toBe(99)
    })

    it('denies member without manage_kpi permission', async () => {
      mockRequireMemberApi.mockResolvedValueOnce({
        member: createMemberMock(false, []),
      })

      const { POST } = await import('@/app/api/kpi/indicators/route')
      const req = new NextRequest('http://localhost:3000/api/kpi/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: 1,
          category: 'หมวดที่ 1',
          frequency: 'รายเดือน',
          title: 'ทดสอบตัวชี้วัด',
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('FORBIDDEN')
    })
  })

  describe('PUT /api/kpi/target', () => {
    it('allows member with manage_kpi permission to update target', async () => {
      mockRequireMemberApi.mockResolvedValueOnce({
        member: createMemberMock(false, ['manage_kpi']),
      })
      mockUpdateTarget.mockResolvedValueOnce({ id: 10 })

      const { PUT } = await import('@/app/api/kpi/target/route')
      const req = new NextRequest('http://localhost:3000/api/kpi/target', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicatorId: 10,
          targetOperator: '>=',
          targetValue: 80,
          targetUnit: '%',
        }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
    })

    it('denies member without manage_kpi permission from updating target', async () => {
      mockRequireMemberApi.mockResolvedValueOnce({
        member: createMemberMock(false, []),
      })

      const { PUT } = await import('@/app/api/kpi/target/route')
      const req = new NextRequest('http://localhost:3000/api/kpi/target', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicatorId: 10,
          targetOperator: '>=',
          targetValue: 80,
        }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.success).toBe(false)
    })
  })

  describe('POST /api/kpi/entry', () => {
    it('passes isAdmin=true to KpiService.saveEntry when user has manage_kpi', async () => {
      mockRequireMemberApi.mockResolvedValueOnce({
        member: createMemberMock(false, ['manage_kpi']),
      })
      mockSaveEntry.mockResolvedValueOnce({ id: 50, resultValue: 95 })

      const { POST } = await import('@/app/api/kpi/entry/route')
      const req = new NextRequest('http://localhost:3000/api/kpi/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicatorId: 10,
          fiscalYear: '2568',
          periodKey: 'Q1',
          periodLabel: 'ไตรมาสที่ 1',
          resultValue: 95,
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          isAdmin: true,
        })
      )
    })
  })
})
