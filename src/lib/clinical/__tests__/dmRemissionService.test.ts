import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { logAudit } from '@/lib/audit'
import { GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import {
  DmRemissionConflictError,
  DmRemissionNotFoundError,
  DmRemissionService,
  DmRemissionValidationError,
  type DmRemissionGatewayDeps,
} from '../dmRemissionService'

function createMockGw() {
  return {
    ensureDmRemissionSchema: vi.fn<DmRemissionGatewayDeps['ensureDmRemissionSchema']>().mockResolvedValue({ ensured: true }),
    lookupDmRemissionPatientByHn: vi.fn<DmRemissionGatewayDeps['lookupDmRemissionPatientByHn']>(),
    listDmRemissionOptionsRaw: vi.fn<DmRemissionGatewayDeps['listDmRemissionOptionsRaw']>(),
    createDmRemissionOption: vi.fn<DmRemissionGatewayDeps['createDmRemissionOption']>(),
    updateDmRemissionOption: vi.fn<DmRemissionGatewayDeps['updateDmRemissionOption']>(),
    deleteDmRemissionOption: vi.fn<DmRemissionGatewayDeps['deleteDmRemissionOption']>(),
    getDmRemissionCohortsBundle: vi.fn<DmRemissionGatewayDeps['getDmRemissionCohortsBundle']>(),
    createDmRemissionCohort: vi.fn<DmRemissionGatewayDeps['createDmRemissionCohort']>(),
    updateDmRemissionCohort: vi.fn<DmRemissionGatewayDeps['updateDmRemissionCohort']>(),
    deleteDmRemissionCohort: vi.fn<DmRemissionGatewayDeps['deleteDmRemissionCohort']>(),
    carryoverDmRemissionCohorts: vi.fn<DmRemissionGatewayDeps['carryoverDmRemissionCohorts']>(),
  }
}

function makeDbCohortRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    fiscalYear: 2569,
    pcuName: 'รพ.สต.ล้อมแรด',
    patientName: 'นายทดสอบ ระบบ',
    cid: '1520000000001',
    hn: '0001234',
    age: 58,
    underlyingDiseases: 'HT',
    heightCm: '160.00',
    weightBeforeKg: '70.00',
    weightAfterKg: '64.00',
    waistBeforeCm: '90.00',
    waistAfterCm: '85.00',
    fpgBefore: '140.00',
    fpgAfter: '108.00',
    a1cBefore: '7.60',
    a1cAfter: '6.20',
    a1cPostStop3m: null,
    medsBefore: 'Metformin',
    medsAfter: 'หยุดยา',
    summaryA1c: 'ลด',
    summaryMeds: 'หยุดยา',
    summaryWeight: 'ลด',
    summaryWaist: 'ลด',
    summaryDiet: 'ดีมาก',
    summaryExercise: 'สม่ำเสมอ',
    summaryIf: 'IF 16/8',
    summaryRemission: 'Remission',
    createdBy: 'nurse01',
    updatedBy: 'nurse01',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('DmRemissionService', () => {
  let gw: ReturnType<typeof createMockGw>
  let service: DmRemissionService
  const actor = { username: 'nurse01', email: 'nurse01@thoen.local' }

  beforeEach(() => {
    vi.clearAllMocks()
    gw = createMockGw()
    service = new DmRemissionService(gw)
  })

  describe('ensureSchema', () => {
    it('ensures schema via Gateway once and caches state', async () => {
      await service.ensureSchema()
      await service.ensureSchema()
      expect(gw.ensureDmRemissionSchema).toHaveBeenCalledTimes(1)
    })
  })

  describe('lookupPatientByHn', () => {
    it('normalizes HN and queries Gateway lookup endpoint', async () => {
      gw.lookupDmRemissionPatientByHn.mockResolvedValueOnce({
        hn: '0001234',
        cid: '1-5200-00000-00-1',
        ptname: 'นายใจดี มีสุข',
        age: '62',
      })

      const result = await service.lookupPatientByHn('1234')

      expect(gw.lookupDmRemissionPatientByHn).toHaveBeenCalledWith('0001234')
      expect(result).toEqual({
        hn: '0001234',
        cid: '1520000000001',
        patientName: 'นายใจดี มีสุข',
        age: 62,
      })
    })

    it('returns null for blank HN or missing patient', async () => {
      expect(await service.lookupPatientByHn('   ')).toBeNull()
      expect(gw.lookupDmRemissionPatientByHn).not.toHaveBeenCalled()

      gw.lookupDmRemissionPatientByHn.mockResolvedValueOnce(null)
      expect(await service.lookupPatientByHn('9999999')).toBeNull()
    })
  })

  describe('listCohorts', () => {
    it('loads bundle, scopes stats to fiscalYear+pcuName, and filters items', async () => {
      gw.getDmRemissionCohortsBundle.mockResolvedValueOnce({
        targetFiscalYear: 2569,
        optionRows: [
          {
            id: 1,
            category: 'remission',
            label: 'Remission',
            sortOrder: 0,
            isActive: 1,
            createdBy: 'system',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
          {
            id: 2,
            category: 'pcu',
            label: 'รพ.สต.แม่วะ',
            sortOrder: 0,
            isActive: 1,
            createdBy: 'admin',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
          {
            id: 3,
            category: 'pcu',
            label: 'รพ.สต.ปิดปรับปรุง',
            sortOrder: 1,
            isActive: 0,
            createdBy: 'admin',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ],
        yearRows: [{ fiscalYear: 2569 }, { fiscalYear: 2567 }],
        pcuRows: [{ pcuName: 'รพ.สต.ล้อมแรด' }],
        cohortRows: [
          makeDbCohortRow({
            id: 1,
            pcuName: 'รพ.สต.ล้อมแรด',
            patientName: 'นาย ก',
            summaryRemission: 'Remission',
          }),
          makeDbCohortRow({
            id: 2,
            pcuName: 'รพ.สต.ล้อมแรด',
            patientName: 'นาง ข',
            hn: '0005678',
            cid: '1520000000002',
            summaryRemission: null,
          }),
          makeDbCohortRow({
            id: 3,
            pcuName: 'รพ.สต.แม่วะ',
            patientName: 'นาย ค',
            hn: '0009999',
            cid: '1520000000003',
            summaryRemission: null,
          }),
        ],
      })

      const result = await service.listCohorts({
        fiscalYear: 2569,
        pcuName: 'รพ.สต.ล้อมแรด',
        remissionStatus: 'ยังไม่ระบุ',
        search: '5678',
      })

      expect(result.fiscalYear).toBe(2569)
      expect(result.availableFiscalYears).toContain(2567)
      expect(result.availablePcus).toEqual(['รพ.สต.แม่วะ', 'รพ.สต.ล้อมแรด'])
      expect(result.stats.totalPatients).toBe(2)
      expect(result.stats.remissionCount).toBe(1)
      expect(result.stats.remissionRate).toBe(50)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(2)
      expect(result.items[0].bmiBefore).toBe(27.34)
    })

    it('resolves omitted fiscalYear to the latest populated DB year', async () => {
      gw.getDmRemissionCohortsBundle.mockResolvedValueOnce({
        targetFiscalYear: 2569,
        optionRows: [],
        yearRows: [{ fiscalYear: 2569 }, { fiscalYear: 2565 }],
        pcuRows: [{ pcuName: 'รพ.สต.ล้อมแรด' }],
        cohortRows: [makeDbCohortRow({ id: 20, fiscalYear: 2569 })],
      })

      const result = await service.listCohorts({})

      expect(result.fiscalYear).toBe(2569)
      expect(result.availableFiscalYears).toEqual([2569, 2565])
      expect(result.items).toHaveLength(1)
      expect(gw.getDmRemissionCohortsBundle).toHaveBeenCalledWith(undefined)
    })
  })

  describe('createCohort / updateCohort / deleteCohort', () => {
    it('creates a cohort with normalized HN/CID and writes non-PHI audit log', async () => {
      gw.createDmRemissionCohort.mockResolvedValueOnce(
        makeDbCohortRow({ id: 10, hn: '0001234', cid: '1520000000001' })
      )

      const created = await service.createCohort(
        {
          fiscalYear: 2569,
          patientName: 'นายทดสอบ ระบบ',
          hn: '1234',
          cid: '1-5200-00000-00-1',
          heightCm: 160,
          weightBeforeKg: 70,
        },
        actor
      )

      expect(created.id).toBe(10)
      expect(created.bmiBefore).toBe(27.34)
      expect(gw.createDmRemissionCohort).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          fiscalYear: 2569,
          hn: '0001234',
          cid: '1520000000001',
        }),
        actorName: 'nurse01',
      })

      expect(logAudit).toHaveBeenCalledWith(
        'CREATE',
        'dm_remission_cohorts',
        'Created DM Remission cohort ID: 10 (FY: 2569)',
        actor
      )
      const auditDetails = vi.mocked(logAudit).mock.calls[0][2]
      expect(auditDetails).not.toContain('นายทดสอบ')
      expect(auditDetails).not.toContain('1520000000001')
    })

    it('maps Gateway 409 conflict to DmRemissionConflictError', async () => {
      gw.createDmRemissionCohort.mockRejectedValueOnce(
        new GatewayError('Duplicate cohort', { status: 409 })
      )

      await expect(
        service.createCohort({ fiscalYear: 2569, patientName: 'นายซ้ำ', hn: '1234' }, actor)
      ).rejects.toBeInstanceOf(DmRemissionConflictError)
    })

    it('throws DmRemissionValidationError when patientName is blank', async () => {
      await expect(
        service.createCohort({ fiscalYear: 2569, patientName: '   ' }, actor)
      ).rejects.toBeInstanceOf(DmRemissionValidationError)
    })

    it('updates a cohort and maps NotFound/Conflict appropriately', async () => {
      gw.updateDmRemissionCohort.mockRejectedValueOnce(new GatewayNotFoundError('Not found'))
      await expect(
        service.updateCohort(999, { weightAfterKg: 60 }, actor)
      ).rejects.toBeInstanceOf(DmRemissionNotFoundError)

      gw.updateDmRemissionCohort.mockRejectedValueOnce(
        new GatewayError('Conflict', { status: 409 })
      )
      await expect(service.updateCohort(1, { hn: '5678' }, actor)).rejects.toBeInstanceOf(
        DmRemissionConflictError
      )

      gw.updateDmRemissionCohort.mockResolvedValueOnce(
        makeDbCohortRow({ id: 1, fiscalYear: 2569, weightAfterKg: '60.00' })
      )
      const updated = await service.updateCohort(1, { weightAfterKg: 60 }, actor)
      expect(updated.weightAfterKg).toBe(60)
      expect(updated.bmiAfter).toBe(23.44)
      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE',
        'dm_remission_cohorts',
        'Updated DM Remission cohort ID: 1 (FY: 2569)',
        actor
      )
    })

    it('deletes a cohort or maps GatewayNotFoundError', async () => {
      gw.deleteDmRemissionCohort.mockRejectedValueOnce(new GatewayNotFoundError('Not found'))
      await expect(service.deleteCohort(404, actor)).rejects.toBeInstanceOf(
        DmRemissionNotFoundError
      )

      gw.deleteDmRemissionCohort.mockResolvedValueOnce({ id: 7, fiscalYear: 2569 })
      const deleted = await service.deleteCohort(7, actor)
      expect(deleted).toEqual({ id: 7, fiscalYear: 2569 })
      expect(logAudit).toHaveBeenCalledWith(
        'DELETE',
        'dm_remission_cohorts',
        'Deleted DM Remission cohort ID: 7 (FY: 2569)',
        actor
      )
    })
  })

  describe('carryoverFromFiscalYear', () => {
    it('rejects target year <= source year', async () => {
      await expect(service.carryoverFromFiscalYear(2569, 2569, actor)).rejects.toBeInstanceOf(
        DmRemissionValidationError
      )
    })

    it('carries over non-remission rows via Gateway and writes audit log', async () => {
      gw.carryoverDmRemissionCohorts.mockResolvedValueOnce({ copiedCount: 1, skippedCount: 1 })

      const res = await service.carryoverFromFiscalYear(2569, 2570, actor)

      expect(res).toEqual({ copiedCount: 1, skippedCount: 1 })
      expect(gw.carryoverDmRemissionCohorts).toHaveBeenCalledWith({
        fromFiscalYear: 2569,
        toFiscalYear: 2570,
        actorName: 'nurse01',
        defaultRemissionStatus: 'รอ lab A1c',
      })
      expect(logAudit).toHaveBeenCalledWith(
        'CREATE',
        'dm_remission_cohorts',
        'Carryover DM Remission cohorts from FY 2569 to FY 2570: copied 1, skipped 1',
        actor
      )
    })
  })

  describe('options CRUD', () => {
    it('creates, updates, lists, and deletes options with conflict & not-found checks', async () => {
      gw.createDmRemissionOption.mockResolvedValueOnce({
        id: 12,
        category: 'diet',
        label: 'คาร์บต่ำ',
        sortOrder: 1,
        isActive: 1,
        createdBy: 'nurse01',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      })

      const created = await service.createOption(
        { category: 'diet', label: 'คาร์บต่ำ', sortOrder: 1 },
        actor
      )
      expect(created).toMatchObject({ id: 12, category: 'diet', label: 'คาร์บต่ำ', isActive: true })

      gw.createDmRemissionOption.mockRejectedValueOnce(new GatewayError('Dup', { status: 409 }))
      await expect(
        service.createOption({ category: 'diet', label: 'คาร์บต่ำ' }, actor)
      ).rejects.toBeInstanceOf(DmRemissionConflictError)

      gw.updateDmRemissionOption.mockRejectedValueOnce(new GatewayNotFoundError('Missing'))
      await expect(service.updateOption(99, { label: 'ใหม่' }, actor)).rejects.toBeInstanceOf(
        DmRemissionNotFoundError
      )

      gw.updateDmRemissionOption.mockResolvedValueOnce({
        id: 12,
        category: 'diet',
        label: 'Low Carb',
        sortOrder: 2,
        isActive: 0,
        createdBy: 'nurse01',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-02',
      })
      const updated = await service.updateOption(
        12,
        { label: 'Low Carb', sortOrder: 2, isActive: false },
        actor
      )
      expect(updated).toMatchObject({ id: 12, label: 'Low Carb', sortOrder: 2, isActive: false })

      gw.deleteDmRemissionOption.mockResolvedValueOnce({ id: 12, category: 'diet' })
      const deleted = await service.deleteOption(12, actor)
      expect(deleted).toEqual({ id: 12, category: 'diet' })

      gw.listDmRemissionOptionsRaw.mockResolvedValueOnce([
        {
          id: 1,
          category: 'remission',
          label: 'Remission',
          sortOrder: 0,
          isActive: 1,
          createdBy: 'system',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
      ])
      const grouped = await service.listOptions()
      expect(grouped.remission).toHaveLength(1)
      expect(grouped.diet).toEqual([])
      expect(grouped.pcu).toEqual([])
    })
  })
})
