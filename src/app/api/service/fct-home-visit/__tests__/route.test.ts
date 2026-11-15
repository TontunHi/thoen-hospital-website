import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/audit', () => ({
  logThrottledAudit: vi.fn().mockResolvedValue(true),
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/clinical/fctHomeVisitService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clinical/fctHomeVisitService')>(
    '@/lib/clinical/fctHomeVisitService'
  )
  return {
    ...actual,
    fctHomeVisitService: {
      listVisits: vi.fn(),
      createVisit: vi.fn(),
      updateVisit: vi.fn(),
      deleteVisit: vi.fn(),
      lookupPatientByHn: vi.fn(),
      batchImportVisits: vi.fn(),
      listOptions: vi.fn(),
      createOption: vi.fn(),
      updateOption: vi.fn(),
      deleteOption: vi.fn(),
    },
  }
})

import { GET as getVisits, POST as createVisit } from '../route'
import { PATCH as patchVisit, DELETE as deleteVisit } from '../[id]/route'
import { GET as lookupHn } from '../lookup-hn/route'
import { POST as importVisits } from '../import/route'
import { GET as getOptions, POST as createOption } from '../options/route'
import { PATCH as patchOption, DELETE as deleteOption } from '../options/[id]/route'
import * as memberAuth from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import {
  FctHomeVisitConflictError,
  FctHomeVisitNotFoundError,
  FctHomeVisitValidationError,
  fctHomeVisitService,
} from '@/lib/clinical/fctHomeVisitService'

function makeSession(role: string, username = 'staff_test') {
  const now = Date.now()
  return {
    username,
    email: `${username}@thoen.local`,
    role,
    aud: 'member' as const,
    iat: now,
    exp: now + 1800 * 1000,
  }
}

const sampleVisit = {
  id: 10,
  fiscalYear: 2570,
  visitDate: '2026-10-15',
  pcuName: 'รพ.เถิน',
  patientName: 'นายสมมติ ทดสอบ',
  hn: '0001234',
  age: 64,
  address: '99 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
  adlScore: 10,
  adlGroup: 'ติดบ้าน',
  diagnosis: 'HT, Stroke',
  patientCategory: 'stroke',
  followUpPlan: 'ฝึกเดิน',
  treatmentFacility: 'รพ.เถิน',
  visitOutcome: 'ดีขึ้น',
  overallRiskLevel: 'Moderate',
  riskLevel: 'Low',
  dentalNote: null,
  pharmacyNote: null,
  nutritionStatus: 'ปกติ',
  nutritionNote: null,
  ptCategory: 'ฝึกทรงตัว ยืน เดิน',
  ptNote: null,
  thaiMedCategory: null,
  thaiMedNote: null,
  createdBy: 'staff_test',
  updatedBy: 'staff_test',
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
}

const emptyOptions = {
  pcu: [],
  patient_category: [],
  adl_group: [],
  visit_outcome: [],
  overall_risk: [],
  risk_level: [],
  treatment_facility: [],
  nutrition_status: [],
  pt_category: [],
  thai_med_category: [],
}

const sampleListResult = {
  fiscalYear: 2570,
  availableFiscalYears: [2571, 2570, 2569, 2568],
  availablePcus: ['รพ.เถิน'],
  items: [sampleVisit],
  options: emptyOptions,
  stats: {
    totalVisits: 1,
    uniquePatients: 1,
    unidentifiedHnVisits: 0,
    highRiskOrSevereCount: 0,
    adlGroupCounts: { ติดบ้าน: 1 },
    outcomeCounts: { ดีขึ้น: 1 },
    overallRiskCounts: { Moderate: 1 },
    riskLevelCounts: { Low: 1 },
    nutritionStatusCounts: { ปกติ: 1 },
    byPcu: [],
    patientCategoryBreakdown: [{ label: 'stroke', count: 1 }],
    monthlyTrend: [],
    disciplineEngagement: [],
  },
}

describe('FCT Home Visit API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(memberAuth, 'attachRenewedMemberSessionCookie').mockImplementation(
      async (res) => res
    )
    vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)
  })

  describe('Authentication (401)', () => {
    it('returns 401 across all endpoints when unauthenticated', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

      const responses = await Promise.all([
        getVisits(new NextRequest('http://localhost/api/service/fct-home-visit')),
        createVisit(
          new NextRequest('http://localhost/api/service/fct-home-visit', {
            method: 'POST',
            body: JSON.stringify({ visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ' }),
          })
        ),
        patchVisit(
          new NextRequest('http://localhost/api/service/fct-home-visit/1', {
            method: 'PATCH',
            body: JSON.stringify({ age: 65 }),
          }),
          { params: Promise.resolve({ id: '1' }) }
        ),
        deleteVisit(
          new NextRequest('http://localhost/api/service/fct-home-visit/1', { method: 'DELETE' }),
          { params: Promise.resolve({ id: '1' }) }
        ),
        lookupHn(
          new NextRequest('http://localhost/api/service/fct-home-visit/lookup-hn?hn=0001234')
        ),
        importVisits(
          new NextRequest('http://localhost/api/service/fct-home-visit/import', {
            method: 'POST',
            body: JSON.stringify({
              rows: [{ visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ' }],
            }),
          })
        ),
        getOptions(),
        createOption(
          new NextRequest('http://localhost/api/service/fct-home-visit/options', {
            method: 'POST',
            body: JSON.stringify({ category: 'pcu', label: 'รพ.สต.ทดสอบ' }),
          })
        ),
        patchOption(
          new NextRequest('http://localhost/api/service/fct-home-visit/options/1', {
            method: 'PATCH',
            body: JSON.stringify({ label: 'รพ.สต.ใหม่' }),
          }),
          { params: Promise.resolve({ id: '1' }) }
        ),
        deleteOption(
          new NextRequest('http://localhost/api/service/fct-home-visit/options/1', {
            method: 'DELETE',
          }),
          { params: Promise.resolve({ id: '1' }) }
        ),
      ])

      for (const res of responses) {
        expect(res.status).toBe(401)
        const json = await res.json()
        expect(json.success).toBe(false)
        expect(json.error).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน')
      }
    })
  })

  describe('Manage RBAC (403 without manage_fct_home_visit permission)', () => {
    it('returns 403 on write, delete, import, and lookup-hn when user lacks manage_fct_home_visit', async () => {
      for (const role of ['member', 'subdistrict']) {
        vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(
          makeSession(role, `${role}_viewer`)
        )
        vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)

        const responses = await Promise.all([
          createVisit(
            new NextRequest('http://localhost/api/service/fct-home-visit', {
              method: 'POST',
              body: JSON.stringify({ visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ' }),
            })
          ),
          patchVisit(
            new NextRequest('http://localhost/api/service/fct-home-visit/1', {
              method: 'PATCH',
              body: JSON.stringify({ age: 65 }),
            }),
            { params: Promise.resolve({ id: '1' }) }
          ),
          deleteVisit(
            new NextRequest('http://localhost/api/service/fct-home-visit/1', { method: 'DELETE' }),
            { params: Promise.resolve({ id: '1' }) }
          ),
          importVisits(
            new NextRequest('http://localhost/api/service/fct-home-visit/import', {
              method: 'POST',
              body: JSON.stringify({
                rows: [{ visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ' }],
              }),
            })
          ),
          lookupHn(
            new NextRequest('http://localhost/api/service/fct-home-visit/lookup-hn?hn=0001234')
          ),
        ])

        for (const res of responses) {
          expect(res.status).toBe(403)
          const json = await res.json()
          expect(json.success).toBe(false)
          expect(json.error).toBe('ไม่มีสิทธิ์เพิ่ม แก้ไข หรือลบข้อมูลเยี่ยมบ้านทีม FCT')
        }
      }

      expect(fctHomeVisitService.createVisit).not.toHaveBeenCalled()
      expect(fctHomeVisitService.updateVisit).not.toHaveBeenCalled()
      expect(fctHomeVisitService.deleteVisit).not.toHaveBeenCalled()
      expect(fctHomeVisitService.batchImportVisits).not.toHaveBeenCalled()
      expect(fctHomeVisitService.lookupPatientByHn).not.toHaveBeenCalled()
    })

    it('allows admin on mutating endpoints without checkPositionPermission lookup', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin', 'admin_user'))
      vi.mocked(fctHomeVisitService.createVisit).mockResolvedValue(sampleVisit)

      const res = await createVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit', {
          method: 'POST',
          body: JSON.stringify({ visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ' }),
        })
      )

      expect(res.status).toBe(201)
      expect(memberAuth.checkPositionPermission).not.toHaveBeenCalled()
    })
  })

  describe('GET & POST /api/service/fct-home-visit', () => {
    it('returns 200 with visit list for member/subdistrict and writes throttled audit', async () => {
      const session = makeSession('member', 'nurse_a')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.mocked(fctHomeVisitService.listVisits).mockResolvedValue(sampleListResult)

      const res = await getVisits(
        new NextRequest(
          'http://localhost/api/service/fct-home-visit?fiscalYear=2570&pcuName=รพ.เถิน&adlGroup=ติดบ้าน&visitOutcome=ดีขึ้น&search=1234'
        )
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
      expect(fctHomeVisitService.listVisits).toHaveBeenCalledWith({
        fiscalYear: 2570,
        pcuName: 'รพ.เถิน',
        adlGroup: 'ติดบ้าน',
        visitOutcome: 'ดีขึ้น',
        search: '1234',
      })
      expect(logThrottledAudit).toHaveBeenCalledWith(
        'READ',
        'fct_home_visits',
        'Viewed FCT Home Visit registry FY 2570 (count: 1)',
        session
      )
      expect(memberAuth.attachRenewedMemberSessionCookie).toHaveBeenCalledTimes(1)
    })

    it('returns 400 on invalid GET query params or invalid POST payload', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const resGetBad = await getVisits(
        new NextRequest('http://localhost/api/service/fct-home-visit?fiscalYear=invalid')
      )
      expect(resGetBad.status).toBe(400)
      expect(fctHomeVisitService.listVisits).not.toHaveBeenCalled()

      const resPostBad = await createVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit', {
          method: 'POST',
          body: JSON.stringify({ visitDate: '15/10/2569', patientName: 'นายสมมติ ทดสอบ' }),
        })
      )
      expect(resPostBad.status).toBe(400)
      expect(fctHomeVisitService.createVisit).not.toHaveBeenCalled()
    })

    it('returns 201 when creating a valid visit record', async () => {
      const session = makeSession('subdistrict', 'pcu_staff')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(fctHomeVisitService.createVisit).mockResolvedValue(sampleVisit)

      const res = await createVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit', {
          method: 'POST',
          body: JSON.stringify({
            visitDate: '2026-10-15',
            patientName: 'นายสมมติ ทดสอบ',
            hn: '0001234',
            adlScore: '10',
          }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.id).toBe(10)
      expect(fctHomeVisitService.createVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          visitDate: '2026-10-15',
          patientName: 'นายสมมติ ทดสอบ',
          hn: '0001234',
          adlScore: 10,
        }),
        { username: 'pcu_staff', email: 'pcu_staff@thoen.local' }
      )
      expect(memberAuth.attachRenewedMemberSessionCookie).toHaveBeenCalledTimes(1)
    })

    it('returns 503 when GatewayUnavailableError is thrown', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.mocked(fctHomeVisitService.listVisits).mockRejectedValue(
        new GatewayUnavailableError('Gateway offline')
      )

      const res = await getVisits(new NextRequest('http://localhost/api/service/fct-home-visit'))
      expect(res.status).toBe(503)
    })
  })

  describe('PATCH & DELETE /api/service/fct-home-visit/[id]', () => {
    it('returns 400 when [id] is not a positive integer', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const resBad = await patchVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit/abc', {
          method: 'PATCH',
          body: JSON.stringify({ age: 60 }),
        }),
        { params: Promise.resolve({ id: 'abc' }) }
      )
      const resZero = await deleteVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit/0', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '0' }) }
      )

      expect(resBad.status).toBe(400)
      expect(resZero.status).toBe(400)
    })

    it('returns 200 on PATCH/DELETE and 404 when visit record is missing', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member', 'nurse_b'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(fctHomeVisitService.updateVisit).mockResolvedValue({ ...sampleVisit, age: 70 })
      vi.mocked(fctHomeVisitService.deleteVisit).mockResolvedValue({ id: 10, fiscalYear: 2570 })

      const patchRes = await patchVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit/10', {
          method: 'PATCH',
          body: JSON.stringify({ age: 70 }),
        }),
        { params: Promise.resolve({ id: '10' }) }
      )
      const patchJson = await patchRes.json()
      expect(patchRes.status).toBe(200)
      expect(patchJson.data.age).toBe(70)

      const delRes = await deleteVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit/10', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '10' }) }
      )
      expect(delRes.status).toBe(200)

      vi.mocked(fctHomeVisitService.deleteVisit).mockRejectedValueOnce(
        new FctHomeVisitNotFoundError('ไม่พบข้อมูลการเยี่ยมบ้าน ID: 999')
      )
      const notFoundRes = await deleteVisit(
        new NextRequest('http://localhost/api/service/fct-home-visit/999', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '999' }) }
      )
      expect(notFoundRes.status).toBe(404)
    })
  })

  describe('GET /api/service/fct-home-visit/lookup-hn', () => {
    it('returns 400 when hn is missing and 404 when patient is missing', async () => {
      const session = makeSession('member')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const resMissing = await lookupHn(
        new NextRequest('http://localhost/api/service/fct-home-visit/lookup-hn')
      )
      expect(resMissing.status).toBe(400)

      vi.mocked(fctHomeVisitService.lookupPatientByHn).mockResolvedValue(null)
      const resNotFound = await lookupHn(
        new NextRequest('http://localhost/api/service/fct-home-visit/lookup-hn?hn=9999999')
      )
      expect(resNotFound.status).toBe(404)
      expect(logThrottledAudit).toHaveBeenCalledWith(
        'READ',
        'fct_home_visit_patient_lookup',
        'Looked up patient demographics for FCT Home Visit',
        session
      )
    })

    it('returns 200 with { hn, patientName, age, address } without cid', async () => {
      const session = makeSession('subdistrict', 'pcu_a')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(fctHomeVisitService.lookupPatientByHn).mockResolvedValue({
        hn: '0001234',
        patientName: 'นายสมมติ ทดสอบ',
        age: 64,
        address: '99 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
      })

      const res = await lookupHn(
        new NextRequest('http://localhost/api/service/fct-home-visit/lookup-hn?hn=1234')
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual({
        hn: '0001234',
        patientName: 'นายสมมติ ทดสอบ',
        age: 64,
        address: '99 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
      })
      expect(json.data).not.toHaveProperty('cid')
    })
  })

  describe('POST /api/service/fct-home-visit/import', () => {
    it('returns 400 when rows are empty or invalid', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const res = await importVisits(
        new NextRequest('http://localhost/api/service/fct-home-visit/import', {
          method: 'POST',
          body: JSON.stringify({ rows: [] }),
        })
      )
      expect(res.status).toBe(400)
      expect(fctHomeVisitService.batchImportVisits).not.toHaveBeenCalled()
    })

    it('returns 200 with batch import summary when rows are valid', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member', 'nurse_c'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(fctHomeVisitService.batchImportVisits).mockResolvedValue({
        insertedCount: 2,
        skippedDuplicateCount: 1,
        errorCount: 0,
        duplicates: [
          {
            rowNumber: 3,
            visitDate: '2026-10-15',
            hn: '0001234',
            patientName: 'นายสมมติ ทดสอบ',
          },
        ],
      })

      const res = await importVisits(
        new NextRequest('http://localhost/api/service/fct-home-visit/import', {
          method: 'POST',
          body: JSON.stringify({
            rows: [
              { visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ', hn: '0001234' },
              { visitDate: '2026-10-16', patientName: 'นางทดสอบ สอง', hn: null },
            ],
          }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.insertedCount).toBe(2)
      expect(json.data.skippedDuplicateCount).toBe(1)
      expect(fctHomeVisitService.batchImportVisits).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ visitDate: '2026-10-15', patientName: 'นายสมมติ ทดสอบ' }),
        ]),
        { username: 'nurse_c', email: 'nurse_c@thoen.local' }
      )
    })
  })

  describe('Options endpoints (/options and /options/[id])', () => {
    it('allows member/subdistrict to GET /options and rejects non-admin mutations with 403', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('subdistrict'))
      vi.mocked(fctHomeVisitService.listOptions).mockResolvedValue(emptyOptions)

      const getRes = await getOptions()
      expect(getRes.status).toBe(200)

      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      const postRes = await createOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'pcu', label: 'รพ.สต.ทดสอบ' }),
        })
      )
      const patchRes = await patchOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options/1', {
          method: 'PATCH',
          body: JSON.stringify({ label: 'ใหม่' }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      )
      const delRes = await deleteOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options/1', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: '1' }) }
      )

      for (const res of [postRes, patchRes, delRes]) {
        expect(res.status).toBe(403)
      }
    })

    it('allows admin to POST, PATCH, DELETE options and maps 409/400/503 errors', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin', 'admin_a'))

      const createdOpt = {
        id: 7,
        category: 'pcu' as const,
        label: 'รพ.สต.ทดสอบ',
        sortOrder: 1,
        isActive: true,
        createdBy: 'admin_a',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      }

      vi.mocked(fctHomeVisitService.createOption).mockResolvedValueOnce(createdOpt)
      vi.mocked(fctHomeVisitService.updateOption).mockResolvedValueOnce({
        ...createdOpt,
        sortOrder: 2,
      })
      vi.mocked(fctHomeVisitService.deleteOption).mockResolvedValueOnce({ id: 7, category: 'pcu' })

      const postRes = await createOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'pcu', label: 'รพ.สต.ทดสอบ', sortOrder: 1 }),
        })
      )
      expect(postRes.status).toBe(201)

      const patchRes = await patchOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options/7', {
          method: 'PATCH',
          body: JSON.stringify({ sortOrder: 2 }),
        }),
        { params: Promise.resolve({ id: '7' }) }
      )
      expect(patchRes.status).toBe(200)

      const delRes = await deleteOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options/7', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: '7' }) }
      )
      expect(delRes.status).toBe(200)

      vi.mocked(fctHomeVisitService.createOption).mockRejectedValueOnce(
        new FctHomeVisitConflictError('มีตัวเลือกนี้อยู่แล้ว')
      )
      const conflictRes = await createOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'pcu', label: 'รพ.สต.ทดสอบ' }),
        })
      )
      expect(conflictRes.status).toBe(409)

      vi.mocked(fctHomeVisitService.createOption).mockRejectedValueOnce(
        new FctHomeVisitValidationError('กรุณาระบุชื่อตัวเลือก')
      )
      const valRes = await createOption(
        new NextRequest('http://localhost/api/service/fct-home-visit/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'pcu', label: 'รพ.สต.ทดสอบ' }),
        })
      )
      expect(valRes.status).toBe(400)

      vi.mocked(fctHomeVisitService.listOptions).mockRejectedValueOnce(
        new GatewayUnavailableError('Gateway offline')
      )
      const gwRes = await getOptions()
      expect(gwRes.status).toBe(503)
    })
  })
})
