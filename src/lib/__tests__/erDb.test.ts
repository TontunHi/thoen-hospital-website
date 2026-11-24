import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  summarizeErActiveLevels,
  fetchErLiveStatusData,
  formatErStatusForViewer,
  type ErPatientRow,
} from '../erDb'

const mockGetErLiveDashboard = vi.fn()

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    clinical: {
      getErLiveDashboard: (...args: unknown[]) => mockGetErLiveDashboard(...args),
    },
  },
}))

describe('erDb module', () => {
  beforeEach(() => {
    clearMemoryCache()
    vi.clearAllMocks()
  })

  it('summarizes active ER patients across triage levels 1 to 5', () => {
    const patients: ErPatientRow[] = [
      { vn: '0001', er_emergency_level_id: 1 },
      { vn: '0002', er_emergency_level_id: '2' },
      { vn: '0003', er_emergency_level_id: 3 },
      { vn: '0004', er_emergency_level_id: '4' },
      { vn: '0005', er_emergency_level_id: 5 },
      { vn: '0006', er_emergency_level_id: 4 },
    ]

    expect(summarizeErActiveLevels(patients)).toEqual({
      totalActive: 6,
      critical: 1,
      emergency: 1,
      urgency: 1,
      semiUrgency: 2,
      nonUrgency: 1,
    })
  })

  it('derives summary from activePatients even when Gateway returns stale summary counts', async () => {
    mockGetErLiveDashboard.mockResolvedValueOnce({
      activePatients: [
        { hn: '0000101', vn: '990001', ptname: 'นายสมมติ ทดสอบ', er_emergency_level_id: 2 },
        { hn: '0000102', vn: '990002', ptname: 'นางตัวอย่าง ทดสอบ', er_emergency_level_id: 3 },
        { hn: '0000103', vn: '990003', ptname: 'นายจำลอง ทดสอบ', er_emergency_level_id: 4 },
        { hn: '0000104', vn: '990004', ptname: 'นางสาวทดสอบ ระบบ', er_emergency_level_id: 5 },
      ],
      errorStatusList: { total: 0, list: [] },
      summary: { totalActive: 50, critical: 3, emergency: 14, urgency: 12, semiUrgency: 15, nonUrgency: 6 },
      stats: { ptTypes: [], emergencyLevels: [], dischargeTypes: [] },
    })

    const result = await fetchErLiveStatusData()

    expect(mockGetErLiveDashboard).toHaveBeenCalledTimes(1)
    expect(result.summary).toEqual({
      totalActive: 4,
      critical: 0,
      emergency: 1,
      urgency: 1,
      semiUrgency: 1,
      nonUrgency: 1,
    })
  })

  it('applies TV-mode PDPA masking and hides PHI from public non-TV viewers', () => {
    const raw = {
      activePatients: [
        { hn: '0012345', vn: '6911240099', ptname: 'นายสมมติ นามสกุลทดสอบ', er_emergency_level_id: 1 },
      ],
      errorStatusList: { total: 1, list: [{ hn: '0012345', vn: '6911240099' }] },
      summary: { totalActive: 1, critical: 1, emergency: 0, urgency: 0, semiUrgency: 0, nonUrgency: 0 },
      stats: { ptTypes: [], emergencyLevels: [], dischargeTypes: [] },
    }

    const tvView = formatErStatusForViewer(raw, { isStaff: false, isTvMode: true })
    expect(tvView.activePatients[0]).toMatchObject({
      hn: 'xxxx2345',
      vn: 'xxxx0099',
      ptname: 'นายสมมติ',
    })
    expect(tvView.errorStatusList).toEqual({ total: 1, list: [] })

    const publicView = formatErStatusForViewer(raw, { isStaff: false, isTvMode: false })
    expect(publicView.activePatients).toEqual([])
    expect(publicView.errorStatusList).toEqual({ total: 1, list: [] })

    const staffView = formatErStatusForViewer(raw, { isStaff: true, isTvMode: false })
    expect(staffView.activePatients[0].ptname).toBe('นายสมมติ นามสกุลทดสอบ')
    expect(staffView.errorStatusList.list).toHaveLength(1)
  })
})
