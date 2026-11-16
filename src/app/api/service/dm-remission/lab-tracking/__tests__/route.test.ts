import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
  checkPositionPermission: vi.fn().mockResolvedValue(false),
  attachRenewedMemberSessionCookie: vi.fn(async (res) => res),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  logThrottledAudit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/clinical/dmRemissionLabService', () => ({
  dmRemissionLabService: {
    getLabTracking: vi.fn(),
    getPatientLabTimeline: vi.fn(),
  },
}))

import { GatewayTimeoutError, GatewayUnavailableError } from '@/lib/apiGateway'
import { logAudit, logThrottledAudit } from '@/lib/audit'
import { dmRemissionLabService } from '@/lib/clinical/dmRemissionLabService'
import { verifyMemberSession } from '@/lib/memberAuth'
import { GET as getLabTracking } from '../route'
import { GET as getPatientTimeline } from '../[hn]/route'

const mockSession = {
  username: 'staff01',
  email: 'staff01@thoen.local',
  role: 'staff',
  name: 'เจ้าหน้าที่ ทดสอบ',
  position: 'พยาบาลวิชาชีพ',
}

describe('/api/service/dm-remission/lab-tracking routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET lab-tracking returns 401 when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(null)
    const req = new NextRequest('http://localhost/api/service/dm-remission/lab-tracking')
    const res = await getLabTracking(req)
    expect(res.status).toBe(401)
  })

  it('GET lab-tracking validates query params with Zod and returns 400 on invalid values', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(mockSession as any)
    const req = new NextRequest(
      'http://localhost/api/service/dm-remission/lab-tracking?a1cMax=99'
    )
    const res = await getLabTracking(req)
    expect(res.status).toBe(400)
  })

  it('GET lab-tracking returns 200 with Cache-Control: no-store and logs throttled audit on success', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(mockSession as any)
    vi.mocked(dmRemissionLabService.getLabTracking).mockResolvedValueOnce({
      fiscalYear: 2569,
      fiscalYearRange: { startDate: '2025-10-01', endDate: '2026-09-30' },
      availableFiscalYears: [2570, 2569, 2568, 2567],
      availableTambons: ['ล้อมแรด'],
      appliedFilters: {
        fiscalYear: 2569,
        a1cMax: 6.5,
        ucScope: 'visit',
        diagScope: 'ever',
        drugScope: 'fy',
        cohortStatus: 'all',
        tambon: null,
        search: null,
        includeDeceased: false,
      },
      summary: {
        totalEligible: 12,
        registeredCount: 3,
        unregisteredCount: 9,
        avgLatestA1c: 5.95,
        medianLatestA1c: 6.0,
        repeatTestedCount: 4,
        a1cBands: [],
        byTambon: [],
        funnel: {
          totalA1cTested: 100,
          a1cUnderLimit: 40,
          ucEligible: 30,
          e11Diagnosed: 25,
          noDmDrugs: 12,
          registeredInCohort: 3,
          unregisteredCandidates: 9,
        },
      },
      items: [],
      pagination: { page: 1, pageSize: 50, totalItems: 12, totalPages: 1 },
      fetchedAt: '2026-11-16T10:00:00.000Z',
    })

    const req = new NextRequest(
      'http://localhost/api/service/dm-remission/lab-tracking?fiscalYear=2569&drugScope=fy'
    )
    const res = await getLabTracking(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(body.success).toBe(true)
    expect(body.data.fiscalYear).toBe(2569)
    expect(logThrottledAudit).toHaveBeenCalledTimes(1)
  })

  it('GET lab-tracking returns 503 when Gateway is unavailable and 504 on timeout', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(mockSession as any)
    vi.mocked(dmRemissionLabService.getLabTracking).mockRejectedValueOnce(
      new GatewayUnavailableError()
    )

    const req = new NextRequest('http://localhost/api/service/dm-remission/lab-tracking')
    const res = await getLabTracking(req)
    expect(res.status).toBe(503)

    vi.mocked(verifyMemberSession).mockResolvedValueOnce(mockSession as any)
    vi.mocked(dmRemissionLabService.getLabTracking).mockRejectedValueOnce(
      new GatewayTimeoutError()
    )
    const res504 = await getLabTracking(req)
    expect(res504.status).toBe(504)
  })

  it('GET [hn] returns 404 when not found and 200 with no-store & masked audit when found', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValueOnce(mockSession as any)
    vi.mocked(dmRemissionLabService.getPatientLabTimeline).mockResolvedValueOnce(null)

    const res404 = await getPatientTimeline(
      new NextRequest('http://localhost/api/service/dm-remission/lab-tracking/9999999'),
      { params: Promise.resolve({ hn: '9999999' }) }
    )
    expect(res404.status).toBe(404)

    vi.mocked(verifyMemberSession).mockResolvedValueOnce(mockSession as any)
    vi.mocked(dmRemissionLabService.getPatientLabTimeline).mockResolvedValueOnce({
      hn: '0001234',
      patientName: 'นายทดสอบ',
      cid: null,
      ageYears: 60,
      currentPttypeName: 'บัตรทอง',
      labHistory: [],
      e11Diagnoses: [],
      dmPrescriptions: [],
    })

    const res200 = await getPatientTimeline(
      new NextRequest('http://localhost/api/service/dm-remission/lab-tracking/0001234'),
      { params: Promise.resolve({ hn: '0001234' }) }
    )
    expect(res200.status).toBe(200)
    expect(res200.headers.get('Cache-Control')).toBe('no-store')
    expect(logAudit).toHaveBeenCalledWith(
      'READ',
      'dm_remission_lab_timeline',
      expect.stringContaining('xxxx1234'),
      mockSession
    )
  })
})
