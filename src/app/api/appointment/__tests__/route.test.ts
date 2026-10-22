import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import * as audit from '@/lib/audit'
import * as clinicalDb from '@/lib/clinicalDb'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/clinicalDb', () => ({
  queryClinicalDb: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

describe('GET /api/appointment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid citizen ID length', async () => {
    const req = new Request('http://localhost:3000/api/appointment?q=1234')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/13 หลัก/)
  })

  it('queries appointments, masks patient names, and logs throttled audit', async () => {
    vi.mocked(clinicalDb.queryClinicalDb).mockResolvedValue([
      {
        hn: '0012345',
        ptname: 'นายสมชาย ใจดี',
        appoint_date: '2026-11-01',
        appoint_time: '09:00:00',
        clinic_name: 'คลินิกเบาหวาน',
        doctor_name: 'นพ.ใจดี',
        appoint_note: 'เจาะเลือด',
        app_no: '1',
      },
    ])

    const req = new Request('http://localhost:3000/api/appointment?q=1529900123456')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.appointments[0].hn).toBe('0012345')
    expect(json.appointments[0].ptname).toContain('นาย สม')
    expect(audit.logThrottledAudit).toHaveBeenCalledWith(
      'READ',
      'oapp',
      expect.stringContaining('x-xxxx-xxxxx-3456'),
      expect.objectContaining({ username: 'x-xxxx-xxxxx-3456' })
    )
  })
})
