import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

vi.mock('@/lib/memberAuth', () => ({
  verifyMemberSession: vi.fn(),
}))

vi.mock('@/lib/clinical/rcmDashboardService', () => ({
  RcmDashboardService: {
    getVnClinicalDetails: vi.fn(),
  },
}))

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(undefined),
}))

import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

describe('GET /api/service/dashboard-rcm/palliative-care/vn-details', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/vn-details?vn=691021131643')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'guest_user',
      role: 'guest',
    } as any)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/vn-details?vn=691021131643')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
  })

  it('returns 400 when vn query parameter is missing', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff_user',
      role: 'staff',
    } as any)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/vn-details')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toContain('หมายเลข VN')
  })

  it('returns 404 when VN clinical details are not found', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff_user',
      role: 'staff',
    } as any)
    vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/vn-details?vn=999999999999')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
    expect(json.error).toContain('ไม่พบข้อมูล')
  })

  it('returns 200 and data when VN clinical details exist', async () => {
    vi.mocked(verifyMemberSession).mockResolvedValue({
      id: '1',
      username: 'staff_user',
      role: 'staff',
    } as any)

    const mockData: any = {
      header: {
        vn: '691021131643',
        hn: '0000206',
        cid: '3520800269098',
        ptname: 'นางจันทนา ตันมา',
        age: 60,
        sex: 'หญิง',
        vstdate: '2026-10-21',
        vsttime: '13:16:43',
        pttypename: 'บัตรทอง',
        department: 'จุดซักประวัติ Palliative Care',
        clinic: 'อายุรกรรม',
      },
      screen: {
        bw: 52,
        height: 159,
        bmi: 20.57,
        bps: 120,
        bpd: 80,
        pulse: 80,
        rr: 20,
        temperature: 36.5,
        spo2: 98,
        fbs: null,
        cc: 'case CA corpus',
        hpi: 'ติดตามเยี่ยมบ้าน',
        pmh: 'CA corpus uteri',
        pe: 'normal',
        screen_dep: '122',
        screen_dep_name: 'Palliative Care',
        symptom: null,
      },
      diagnoses: [
        {
          icd10: 'C548',
          icd_name: 'Malignant neoplasm of corpus uteri',
          diagtype: '1',
          diagtype_name: 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)',
          doctor_name: 'พญ.สุทธิดา จตุจินดา',
        },
      ],
      orders: {
        items: [],
        categories: [],
        total_price: 1350,
        total_items: 5,
        total_paid: 0,
        total_claim: 1350,
      },
    }

    vi.mocked(RcmDashboardService.getVnClinicalDetails).mockResolvedValue(mockData)

    const req = new Request('http://localhost:3000/api/service/dashboard-rcm/palliative-care/vn-details?vn=691021131643')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.header.vn).toBe('691021131643')
    expect(json.data.diagnoses.length).toBe(1)
  })
})
