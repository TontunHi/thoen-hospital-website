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

vi.mock('@/lib/clinical/dmRemissionService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clinical/dmRemissionService')>(
    '@/lib/clinical/dmRemissionService'
  )
  return {
    ...actual,
    dmRemissionService: {
      listCohorts: vi.fn(),
      createCohort: vi.fn(),
      updateCohort: vi.fn(),
      deleteCohort: vi.fn(),
      lookupPatientByHn: vi.fn(),
      carryoverFromFiscalYear: vi.fn(),
      listOptions: vi.fn(),
      createOption: vi.fn(),
      updateOption: vi.fn(),
      deleteOption: vi.fn(),
    },
  }
})

import { GET as getCohorts, POST as createCohort } from '../route'
import { PATCH as patchCohort, DELETE as deleteCohort } from '../[id]/route'
import { GET as lookupHn } from '../lookup-hn/route'
import { POST as carryoverCohorts } from '../carryover/route'
import { GET as getOptions, POST as createOption } from '../options/route'
import { PATCH as patchOption, DELETE as deleteOption } from '../options/[id]/route'
import * as memberAuth from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { GatewayUnavailableError } from '@/lib/apiGateway'
import {
  DmRemissionConflictError,
  DmRemissionNotFoundError,
  DmRemissionValidationError,
  dmRemissionService,
} from '@/lib/clinical/dmRemissionService'

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

const sampleCohort = {
  id: 10,
  fiscalYear: 2569,
  pcuName: 'รพ.สต.ทดสอบ',
  patientName: 'นายสมมติ ทดสอบ',
  cid: '1100000000000',
  hn: '0001234',
  age: 54,
  underlyingDiseases: 'HT',
  heightCm: 165,
  weightBeforeKg: 72,
  weightAfterKg: 66,
  waistBeforeCm: 92,
  waistAfterCm: 86,
  fpgBefore: 145,
  fpgAfter: 110,
  a1cBefore: 7.4,
  a1cAfter: 6.1,
  a1cPostStop3m: 6.0,
  medsBefore: 'Metformin 500mg',
  medsAfter: 'หยุดยา',
  summaryA1c: 'ลด' as const,
  summaryMeds: 'หยุดยา' as const,
  summaryWeight: 'ลด' as const,
  summaryWaist: 'ลด' as const,
  summaryDiet: 'ปรับอาหาร',
  summaryExercise: 'สม่ำเสมอ',
  summaryIf: '16/8',
  summaryRemission: 'Remission',
  createdBy: 'staff_test',
  updatedBy: 'staff_test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  bmiBefore: 26.45,
  bmiAfter: 24.24,
}

const sampleListResult = {
  fiscalYear: 2569,
  availableFiscalYears: [2570, 2569, 2568, 2567],
  availablePcus: ['รพ.สต.ทดสอบ'],
  items: [sampleCohort],
  options: {
    remission: [],
    diet: [],
    exercise: [],
    if_fasting: [],
    pcu: [],
  },
  stats: {
    totalPatients: 1,
    remissionCount: 1,
    remissionRate: 100,
    statusCounts: { Remission: 1 },
    averages: {
      a1cBefore: 7.4,
      a1cAfter: 6.1,
      a1cPostStop3m: 6.0,
      a1cDelta: -1.3,
      weightBeforeKg: 72,
      weightAfterKg: 66,
      weightDelta: -6,
      bmiBefore: 26.45,
      bmiAfter: 24.24,
      waistBeforeCm: 92,
      waistAfterCm: 86,
      fpgBefore: 145,
      fpgAfter: 110,
    },
    byPcu: [],
    breakdowns: {
      summaryA1c: {},
      summaryMeds: {},
      summaryWeight: {},
      summaryWaist: {},
      summaryDiet: {},
      summaryExercise: {},
      summaryIf: {},
    },
  },
}

describe('DM Remission API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(memberAuth, 'attachRenewedMemberSessionCookie').mockImplementation(
      async (res) => res
    )
    vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)
  })

  describe('Authentication (401)', () => {
    it('returns 401 across endpoints when unauthenticated', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

      const resList = await getCohorts(new NextRequest('http://localhost/api/service/dm-remission'))
      const resCreate = await createCohort(
        new NextRequest('http://localhost/api/service/dm-remission', {
          method: 'POST',
          body: JSON.stringify({ fiscalYear: 2569, patientName: 'นายสมมติ ทดสอบ' }),
        })
      )
      const resPatch = await patchCohort(
        new NextRequest('http://localhost/api/service/dm-remission/1', {
          method: 'PATCH',
          body: JSON.stringify({ age: 50 }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      )
      const resDelete = await deleteCohort(
        new NextRequest('http://localhost/api/service/dm-remission/1', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '1' }) }
      )
      const resLookup = await lookupHn(
        new NextRequest('http://localhost/api/service/dm-remission/lookup-hn?hn=0001234')
      )
      const resCarryover = await carryoverCohorts(
        new NextRequest('http://localhost/api/service/dm-remission/carryover', {
          method: 'POST',
          body: JSON.stringify({ fromFiscalYear: 2568, toFiscalYear: 2569 }),
        })
      )
      const resOptGet = await getOptions()
      const resOptPost = await createOption(
        new NextRequest('http://localhost/api/service/dm-remission/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'diet', label: 'คีโต' }),
        })
      )
      const resOptPatch = await patchOption(
        new NextRequest('http://localhost/api/service/dm-remission/options/1', {
          method: 'PATCH',
          body: JSON.stringify({ label: 'โลว์คาร์บ' }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      )
      const resOptDelete = await deleteOption(
        new NextRequest('http://localhost/api/service/dm-remission/options/1', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: '1' }) }
      )

      for (const res of [
        resList,
        resCreate,
        resPatch,
        resDelete,
        resLookup,
        resCarryover,
        resOptGet,
        resOptPost,
        resOptPatch,
        resOptDelete,
      ]) {
        expect(res.status).toBe(401)
        const json = await res.json()
        expect(json.success).toBe(false)
        expect(json.error).toBe('กรุณาเข้าสู่ระบบก่อนใช้งาน')
      }
    })
  })

  describe('Manage RBAC (403 without manage_dm_remission permission)', () => {
    it('returns 403 on write, delete, carryover, and lookup-hn when user lacks manage_dm_remission', async () => {
      for (const role of ['member', 'subdistrict']) {
        vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession(role, `${role}_viewer`))
        vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(false)

        const resCreate = await createCohort(
          new NextRequest('http://localhost/api/service/dm-remission', {
            method: 'POST',
            body: JSON.stringify({ fiscalYear: 2569, patientName: 'นายสมมติ ทดสอบ' }),
          })
        )
        const resPatch = await patchCohort(
          new NextRequest('http://localhost/api/service/dm-remission/1', {
            method: 'PATCH',
            body: JSON.stringify({ age: 50 }),
          }),
          { params: Promise.resolve({ id: '1' }) }
        )
        const resDelete = await deleteCohort(
          new NextRequest('http://localhost/api/service/dm-remission/1', { method: 'DELETE' }),
          { params: Promise.resolve({ id: '1' }) }
        )
        const resCarryover = await carryoverCohorts(
          new NextRequest('http://localhost/api/service/dm-remission/carryover', {
            method: 'POST',
            body: JSON.stringify({ fromFiscalYear: 2568, toFiscalYear: 2569 }),
          })
        )
        const resLookup = await lookupHn(
          new NextRequest('http://localhost/api/service/dm-remission/lookup-hn?hn=0001234')
        )

        for (const res of [resCreate, resPatch, resDelete, resCarryover, resLookup]) {
          expect(res.status).toBe(403)
          const json = await res.json()
          expect(json.success).toBe(false)
          expect(json.error).toBe('ไม่มีสิทธิ์เพิ่ม แก้ไข หรือลบข้อมูลทะเบียน DM Remission')
        }
      }

      expect(dmRemissionService.createCohort).not.toHaveBeenCalled()
      expect(dmRemissionService.updateCohort).not.toHaveBeenCalled()
      expect(dmRemissionService.deleteCohort).not.toHaveBeenCalled()
      expect(dmRemissionService.carryoverFromFiscalYear).not.toHaveBeenCalled()
      expect(dmRemissionService.lookupPatientByHn).not.toHaveBeenCalled()
    })

    it('allows admin on mutating endpoints without needing checkPositionPermission lookup', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin', 'admin_user'))
      vi.mocked(dmRemissionService.createCohort).mockResolvedValue(sampleCohort)

      const resCreate = await createCohort(
        new NextRequest('http://localhost/api/service/dm-remission', {
          method: 'POST',
          body: JSON.stringify({ fiscalYear: 2569, patientName: 'นายสมมติ ทดสอบ' }),
        })
      )

      expect(resCreate.status).toBe(201)
      expect(memberAuth.checkPositionPermission).not.toHaveBeenCalled()
    })
  })

  describe('GET & POST /api/service/dm-remission', () => {
    it('returns 200 with cohort list for member role and writes throttled audit', async () => {
      const session = makeSession('member', 'nurse_a')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.mocked(dmRemissionService.listCohorts).mockResolvedValue(sampleListResult)

      const req = new NextRequest(
        'http://localhost/api/service/dm-remission?fiscalYear=2569&pcuName=รพ.สต.ทดสอบ&search=1234'
      )
      const res = await getCohorts(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
      expect(dmRemissionService.listCohorts).toHaveBeenCalledWith({
        fiscalYear: 2569,
        pcuName: 'รพ.สต.ทดสอบ',
        remissionStatus: undefined,
        search: '1234',
      })
      expect(logThrottledAudit).toHaveBeenCalledWith(
        'READ',
        'dm_remission_cohorts',
        'Viewed DM Remission cohort FY 2569 (count: 1)',
        session
      )
      expect(memberAuth.attachRenewedMemberSessionCookie).toHaveBeenCalledTimes(1)
    })

    it('returns 200 with cohort list for subdistrict role', async () => {
      const session = makeSession('subdistrict', 'pcu_user')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.mocked(dmRemissionService.listCohorts).mockResolvedValue(sampleListResult)

      const res = await getCohorts(new NextRequest('http://localhost/api/service/dm-remission'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.fiscalYear).toBe(2569)
    })

    it('returns 400 on invalid GET query params', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))

      const res = await getCohorts(
        new NextRequest('http://localhost/api/service/dm-remission?fiscalYear=invalid')
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(dmRemissionService.listCohorts).not.toHaveBeenCalled()
    })

    it('returns 400 on invalid POST payload', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const res = await createCohort(
        new NextRequest('http://localhost/api/service/dm-remission', {
          method: 'POST',
          body: JSON.stringify({ fiscalYear: 2569, patientName: '   ' }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(dmRemissionService.createCohort).not.toHaveBeenCalled()
    })

    it('returns 409 on duplicate HN/CID conflict during POST', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.createCohort).mockRejectedValue(
        new DmRemissionConflictError('ผู้ป่วยนี้มีอยู่ในทะเบียนปีงบประมาณ 2569 แล้ว')
      )

      const res = await createCohort(
        new NextRequest('http://localhost/api/service/dm-remission', {
          method: 'POST',
          body: JSON.stringify({
            fiscalYear: 2569,
            patientName: 'นายสมมติ ทดสอบ',
            hn: '0001234',
          }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json.success).toBe(false)
      expect(json.error).toContain('2569')
    })

    it('returns 201 when creating a valid cohort row', async () => {
      const session = makeSession('subdistrict', 'pcu_staff')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.createCohort).mockResolvedValue(sampleCohort)

      const res = await createCohort(
        new NextRequest('http://localhost/api/service/dm-remission', {
          method: 'POST',
          body: JSON.stringify({
            fiscalYear: 2569,
            patientName: 'นายสมมติ ทดสอบ',
            hn: '0001234',
            a1cBefore: '7.4',
          }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.id).toBe(10)
      expect(dmRemissionService.createCohort).toHaveBeenCalledWith(
        expect.objectContaining({
          fiscalYear: 2569,
          patientName: 'นายสมมติ ทดสอบ',
          hn: '0001234',
          a1cBefore: 7.4,
        }),
        { username: 'pcu_staff', email: 'pcu_staff@thoen.local' }
      )
      expect(memberAuth.attachRenewedMemberSessionCookie).toHaveBeenCalledTimes(1)
    })

    it('returns 503 when GatewayUnavailableError is thrown', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.mocked(dmRemissionService.listCohorts).mockRejectedValue(
        new GatewayUnavailableError('Gateway offline')
      )

      const res = await getCohorts(new NextRequest('http://localhost/api/service/dm-remission'))
      const json = await res.json()

      expect(res.status).toBe(503)
      expect(json.success).toBe(false)
    })
  })

  describe('PATCH & DELETE /api/service/dm-remission/[id]', () => {
    it('returns 400 when [id] is not a positive integer', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const resBad = await patchCohort(
        new NextRequest('http://localhost/api/service/dm-remission/12abc', {
          method: 'PATCH',
          body: JSON.stringify({ age: 55 }),
        }),
        { params: Promise.resolve({ id: '12abc' }) }
      )
      const resZero = await deleteCohort(
        new NextRequest('http://localhost/api/service/dm-remission/0', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '0' }) }
      )

      expect(resBad.status).toBe(400)
      expect(resZero.status).toBe(400)
      expect(dmRemissionService.updateCohort).not.toHaveBeenCalled()
      expect(dmRemissionService.deleteCohort).not.toHaveBeenCalled()
    })

    it('returns 200 on PATCH and DELETE for valid id', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member', 'nurse_b'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.updateCohort).mockResolvedValue({ ...sampleCohort, age: 55 })
      vi.mocked(dmRemissionService.deleteCohort).mockResolvedValue({ id: 10, fiscalYear: 2569 })

      const patchRes = await patchCohort(
        new NextRequest('http://localhost/api/service/dm-remission/10', {
          method: 'PATCH',
          body: JSON.stringify({ age: 55 }),
        }),
        { params: Promise.resolve({ id: '10' }) }
      )
      const patchJson = await patchRes.json()
      expect(patchRes.status).toBe(200)
      expect(patchJson.success).toBe(true)
      expect(patchJson.data.age).toBe(55)
      expect(dmRemissionService.updateCohort).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ age: 55 }),
        { username: 'nurse_b', email: 'nurse_b@thoen.local' }
      )

      const delRes = await deleteCohort(
        new NextRequest('http://localhost/api/service/dm-remission/10', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '10' }) }
      )
      const delJson = await delRes.json()
      expect(delRes.status).toBe(200)
      expect(delJson.success).toBe(true)
      expect(delJson.data).toEqual({ id: 10, fiscalYear: 2569 })
    })

    it('returns 404 when cohort record is not found', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.deleteCohort).mockRejectedValue(
        new DmRemissionNotFoundError('ไม่พบข้อมูล DM Remission ID: 999')
      )

      const res = await deleteCohort(
        new NextRequest('http://localhost/api/service/dm-remission/999', { method: 'DELETE' }),
        { params: Promise.resolve({ id: '999' }) }
      )

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/service/dm-remission/lookup-hn', () => {
    it('returns 400 when hn query param is missing', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const res = await lookupHn(
        new NextRequest('http://localhost/api/service/dm-remission/lookup-hn')
      )
      expect(res.status).toBe(400)
      expect(dmRemissionService.lookupPatientByHn).not.toHaveBeenCalled()
    })

    it('returns 404 when patient is not found in HOSxP', async () => {
      const session = makeSession('member')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.lookupPatientByHn).mockResolvedValue(null)

      const res = await lookupHn(
        new NextRequest('http://localhost/api/service/dm-remission/lookup-hn?hn=9999999')
      )
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.success).toBe(false)
      expect(logThrottledAudit).toHaveBeenCalledWith(
        'READ',
        'dm_remission_patient_lookup',
        'Looked up patient demographics for DM Remission',
        session
      )
    })

    it('returns 200 with patient demographics when found and logs non-PHI audit', async () => {
      const session = makeSession('subdistrict', 'pcu_a')
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(session)
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.lookupPatientByHn).mockResolvedValue({
        hn: '0001234',
        cid: '1100000000000',
        patientName: 'นายสมมติ ทดสอบ',
        age: 54,
      })

      const res = await lookupHn(
        new NextRequest('http://localhost/api/service/dm-remission/lookup-hn?hn=1234')
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual({
        hn: '0001234',
        cid: '1100000000000',
        patientName: 'นายสมมติ ทดสอบ',
        age: 54,
      })
      expect(logThrottledAudit).toHaveBeenCalledWith(
        'READ',
        'dm_remission_patient_lookup',
        'Looked up patient demographics for DM Remission',
        session
      )
      expect(memberAuth.attachRenewedMemberSessionCookie).toHaveBeenCalledTimes(1)
    })

    it('returns 503 on GatewayUnavailableError', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.lookupPatientByHn).mockRejectedValue(
        new GatewayUnavailableError('Gateway offline')
      )

      const res = await lookupHn(
        new NextRequest('http://localhost/api/service/dm-remission/lookup-hn?hn=1234')
      )
      expect(res.status).toBe(503)
    })
  })

  describe('POST /api/service/dm-remission/carryover', () => {
    it('returns 400 when toFiscalYear is not greater than fromFiscalYear', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

      const res = await carryoverCohorts(
        new NextRequest('http://localhost/api/service/dm-remission/carryover', {
          method: 'POST',
          body: JSON.stringify({ fromFiscalYear: 2569, toFiscalYear: 2569 }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(dmRemissionService.carryoverFromFiscalYear).not.toHaveBeenCalled()
    })

    it('returns 200 on valid carryover', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('member', 'nurse_c'))
      vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)
      vi.mocked(dmRemissionService.carryoverFromFiscalYear).mockResolvedValue({
        copiedCount: 5,
        skippedCount: 1,
      })

      const res = await carryoverCohorts(
        new NextRequest('http://localhost/api/service/dm-remission/carryover', {
          method: 'POST',
          body: JSON.stringify({ fromFiscalYear: 2568, toFiscalYear: 2569 }),
        })
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual({ copiedCount: 5, skippedCount: 1 })
      expect(dmRemissionService.carryoverFromFiscalYear).toHaveBeenCalledWith(2568, 2569, {
        username: 'nurse_c',
        email: 'nurse_c@thoen.local',
      })
    })
  })

  describe('Options endpoints (/options and /options/[id])', () => {
    it('allows member and subdistrict to GET /options', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('subdistrict'))
      vi.mocked(dmRemissionService.listOptions).mockResolvedValue({
        remission: [],
        diet: [],
        exercise: [],
        if_fasting: [],
        pcu: [],
      })

      const res = await getOptions()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(dmRemissionService.listOptions).toHaveBeenCalledTimes(1)
    })

    it('returns 403 for member and subdistrict on options POST, PATCH, DELETE even with manage_dm_remission', async () => {
      for (const role of ['member', 'subdistrict']) {
        vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession(role))
        vi.spyOn(memberAuth, 'checkPositionPermission').mockResolvedValue(true)

        const postRes = await createOption(
          new NextRequest('http://localhost/api/service/dm-remission/options', {
            method: 'POST',
            body: JSON.stringify({ category: 'diet', label: 'คีโต' }),
          })
        )
        const patchRes = await patchOption(
          new NextRequest('http://localhost/api/service/dm-remission/options/1', {
            method: 'PATCH',
            body: JSON.stringify({ label: 'โลว์คาร์บ' }),
          }),
          { params: Promise.resolve({ id: '1' }) }
        )
        const deleteRes = await deleteOption(
          new NextRequest('http://localhost/api/service/dm-remission/options/1', {
            method: 'DELETE',
          }),
          { params: Promise.resolve({ id: '1' }) }
        )

        for (const res of [postRes, patchRes, deleteRes]) {
          expect(res.status).toBe(403)
          const json = await res.json()
          expect(json.success).toBe(false)
          expect(json.error).toBe('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการตัวเลือกได้')
        }
      }

      expect(dmRemissionService.createOption).not.toHaveBeenCalled()
      expect(dmRemissionService.updateOption).not.toHaveBeenCalled()
      expect(dmRemissionService.deleteOption).not.toHaveBeenCalled()
    })

    it('allows admin to POST, PATCH, DELETE options', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin', 'admin_a'))

      const createdOpt = {
        id: 7,
        category: 'diet' as const,
        label: 'โลว์คาร์บ',
        sortOrder: 1,
        isActive: true,
        createdBy: 'admin_a',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }

      vi.mocked(dmRemissionService.createOption).mockResolvedValue(createdOpt)
      vi.mocked(dmRemissionService.updateOption).mockResolvedValue({ ...createdOpt, sortOrder: 2 })
      vi.mocked(dmRemissionService.deleteOption).mockResolvedValue({ id: 7, category: 'diet' })

      const postRes = await createOption(
        new NextRequest('http://localhost/api/service/dm-remission/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'diet', label: 'โลว์คาร์บ', sortOrder: 1 }),
        })
      )
      const postJson = await postRes.json()
      expect(postRes.status).toBe(201)
      expect(postJson.success).toBe(true)
      expect(postJson.data.id).toBe(7)

      const patchRes = await patchOption(
        new NextRequest('http://localhost/api/service/dm-remission/options/7', {
          method: 'PATCH',
          body: JSON.stringify({ sortOrder: 2 }),
        }),
        { params: Promise.resolve({ id: '7' }) }
      )
      const patchJson = await patchRes.json()
      expect(patchRes.status).toBe(200)
      expect(patchJson.success).toBe(true)
      expect(patchJson.data.sortOrder).toBe(2)

      const delRes = await deleteOption(
        new NextRequest('http://localhost/api/service/dm-remission/options/7', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: '7' }) }
      )
      const delJson = await delRes.json()
      expect(delRes.status).toBe(200)
      expect(delJson.success).toBe(true)
      expect(delJson.data).toEqual({ id: 7, category: 'diet' })
    })

    it('maps DmRemissionValidationError and GatewayUnavailableError on options routes', async () => {
      vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(makeSession('admin'))
      vi.mocked(dmRemissionService.createOption).mockRejectedValueOnce(
        new DmRemissionValidationError('กรุณาระบุชื่อตัวเลือก')
      )
      vi.mocked(dmRemissionService.listOptions).mockRejectedValueOnce(
        new GatewayUnavailableError('Gateway offline')
      )

      const valRes = await createOption(
        new NextRequest('http://localhost/api/service/dm-remission/options', {
          method: 'POST',
          body: JSON.stringify({ category: 'diet', label: 'โลว์คาร์บ' }),
        })
      )
      expect(valRes.status).toBe(400)

      const gwRes = await getOptions()
      expect(gwRes.status).toBe(503)
    })
  })
})
