import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { logAudit } from '@/lib/audit'
import {
  DmRemissionConflictError,
  DmRemissionNotFoundError,
  DmRemissionService,
  DmRemissionValidationError,
  type DmRemissionDbDeps,
} from '../dmRemissionService'

function createMockDeps() {
  return {
    // Mocked query returns heterogeneous row shapes across test cases
    appQuery: vi.fn<(sql: string, params?: unknown[]) => Promise<any[]>>(),
    appTransaction: vi.fn<DmRemissionDbDeps['appTransaction']>().mockResolvedValue({
      count: 2,
      results: [
        { affectedRows: 0, insertId: null },
        { affectedRows: 1, insertId: 1 },
      ],
    }),
    // Mocked HOSxP query returns heterogeneous row shapes across test cases
    clinicalQuery: vi.fn<(sql: string, params?: unknown[]) => Promise<any[]>>(),
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
  let deps: ReturnType<typeof createMockDeps>
  let service: DmRemissionService
  const actor = { username: 'nurse01', email: 'nurse01@thoen.local' }

  beforeEach(() => {
    vi.clearAllMocks()
    deps = createMockDeps()
    service = new DmRemissionService(deps)
  })

  describe('ensureSchema', () => {
    it('creates tables with SET NAMES utf8mb4, seeds remission options once, and caches state', async () => {
      deps.appQuery.mockResolvedValueOnce([{ cnt: 0 }])

      await service.ensureSchema()
      await service.ensureSchema()

      expect(deps.appTransaction).toHaveBeenCalledTimes(2)
      expect(deps.appTransaction.mock.calls[0][0][0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(deps.appTransaction.mock.calls[0][0][1].sql).toContain(
        'CREATE TABLE IF NOT EXISTS dm_remission_cohorts'
      )
      expect(deps.appTransaction.mock.calls[0][0][2].sql).toContain(
        'CREATE TABLE IF NOT EXISTS dm_remission_options'
      )

      const seedCalls = deps.appTransaction.mock.calls[1][0]
      expect(seedCalls[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(seedCalls).toHaveLength(4)
      expect(seedCalls[1].params?.[1]).toBe('Remission')
      expect(seedCalls[2].params?.[1]).toBe('ไม่ Remission')
      expect(seedCalls[3].params?.[1]).toBe('รอ lab A1c')
    })

    it('skips seeding when remission options already exist', async () => {
      deps.appQuery.mockResolvedValueOnce([{ cnt: 3 }])

      await service.ensureSchema()
      expect(deps.appTransaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('lookupPatientByHn', () => {
    it('normalizes HN and queries HOSxP patient table', async () => {
      deps.clinicalQuery.mockResolvedValueOnce([
        { hn: '0001234', cid: '1-5200-00000-00-1', ptname: 'นายใจดี มีสุข', age: '62' },
      ])

      const result = await service.lookupPatientByHn('1234')

      expect(deps.clinicalQuery).toHaveBeenCalledWith(expect.stringContaining('FROM patient pt'), [
        '0001234',
      ])
      expect(result).toEqual({
        hn: '0001234',
        cid: '1520000000001',
        patientName: 'นายใจดี มีสุข',
        age: 62,
      })
    })

    it('returns null for blank HN or missing patient', async () => {
      expect(await service.lookupPatientByHn('   ')).toBeNull()
      expect(deps.clinicalQuery).not.toHaveBeenCalled()

      deps.clinicalQuery.mockResolvedValueOnce([])
      expect(await service.lookupPatientByHn('9999999')).toBeNull()
    })
  })

  describe('listCohorts', () => {
    it('loads options, years, PCUs, scopes stats to fiscalYear+pcuName, and filters items', async () => {
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema count
        .mockResolvedValueOnce([
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
        ])
        .mockResolvedValueOnce([{ fiscalYear: 2569 }, { fiscalYear: 2567 }])
        .mockResolvedValueOnce([{ pcuName: 'รพ.สต.ล้อมแรด' }])
        .mockResolvedValueOnce([
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
        ])

      const result = await service.listCohorts({
        fiscalYear: 2569,
        pcuName: 'รพ.สต.ล้อมแรด',
        remissionStatus: 'ยังไม่ระบุ',
        search: '5678',
      })

      expect(result.fiscalYear).toBe(2569)
      expect(result.availableFiscalYears).toContain(2567)
      expect(result.availablePcus).toEqual(['รพ.สต.แม่วะ', 'รพ.สต.ล้อมแรด'])
      // Stats reflect both records in รพ.สต.ล้อมแรด before remissionStatus/search narrowing
      expect(result.stats.totalPatients).toBe(2)
      expect(result.stats.remissionCount).toBe(1)
      expect(result.stats.remissionRate).toBe(50)
      // Items reflect remissionStatus + search narrowing
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(2)
      expect(result.items[0].bmiBefore).toBe(27.34)
    })
  })

  describe('createCohort / updateCohort / deleteCohort', () => {
    it('creates a cohort with normalized HN/CID and writes non-PHI audit log', async () => {
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema
        .mockResolvedValueOnce([]) // duplicate check
        .mockResolvedValueOnce([makeDbCohortRow({ id: 10, hn: '0001234', cid: '1520000000001' })])

      deps.appTransaction
        .mockResolvedValueOnce({ count: 3, results: [] }) // ensureSchema DDL
        .mockResolvedValueOnce({
          count: 2,
          results: [
            { affectedRows: 0, insertId: null },
            { affectedRows: 1, insertId: 10 },
          ],
        })

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

      const insertCall = deps.appTransaction.mock.calls[1][0]
      expect(insertCall[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(insertCall[1].sql).toContain('INSERT INTO dm_remission_cohorts')
      expect(insertCall[1].params).toContain('0001234')
      expect(insertCall[1].params).toContain('1520000000001')

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

    it('throws DmRemissionConflictError on duplicate HN/CID in the same fiscal year', async () => {
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema
        .mockResolvedValueOnce([{ id: 5 }]) // duplicate check

      await expect(
        service.createCohort(
          { fiscalYear: 2569, patientName: 'นายซ้ำ', hn: '1234' },
          actor
        )
      ).rejects.toBeInstanceOf(DmRemissionConflictError)
    })

    it('throws DmRemissionValidationError when patientName is blank', async () => {
      deps.appQuery.mockResolvedValueOnce([{ cnt: 3 }])

      await expect(
        service.createCohort({ fiscalYear: 2569, patientName: '   ' }, actor)
      ).rejects.toBeInstanceOf(DmRemissionValidationError)
    })

    it('updates a cohort and throws NotFound/Conflict appropriately', async () => {
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema
        .mockResolvedValueOnce([]) // missing record

      await expect(
        service.updateCohort(999, { weightAfterKg: 60 }, actor)
      ).rejects.toBeInstanceOf(DmRemissionNotFoundError)

      // Existing record found, but duplicate HN in same FY
      deps.appQuery
        .mockResolvedValueOnce([makeDbCohortRow({ id: 1, fiscalYear: 2569 })])
        .mockResolvedValueOnce([{ id: 2 }])

      await expect(
        service.updateCohort(1, { hn: '5678' }, actor)
      ).rejects.toBeInstanceOf(DmRemissionConflictError)

      // Successful update
      deps.appQuery
        .mockResolvedValueOnce([makeDbCohortRow({ id: 1, fiscalYear: 2569 })])
        .mockResolvedValueOnce([]) // no duplicate
        .mockResolvedValueOnce([
          makeDbCohortRow({ id: 1, fiscalYear: 2569, weightAfterKg: '60.00' }),
        ])

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

    it('deletes a cohort or throws DmRemissionNotFoundError if missing', async () => {
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema
        .mockResolvedValueOnce([])

      await expect(service.deleteCohort(404, actor)).rejects.toBeInstanceOf(
        DmRemissionNotFoundError
      )

      deps.appQuery.mockResolvedValueOnce([makeDbCohortRow({ id: 7, fiscalYear: 2569 })])

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
      deps.appQuery.mockResolvedValueOnce([{ cnt: 3 }])

      await expect(service.carryoverFromFiscalYear(2569, 2569, actor)).rejects.toBeInstanceOf(
        DmRemissionValidationError
      )
    })

    it('carries over non-remission rows with after->before baselines and skips duplicates', async () => {
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema
        .mockResolvedValueOnce([
          makeDbCohortRow({
            id: 1,
            hn: '0001111',
            cid: '1520000000011',
            weightBeforeKg: '72.00',
            weightAfterKg: '68.00',
            waistBeforeCm: '94.00',
            waistAfterCm: '89.00',
            fpgBefore: '150.00',
            fpgAfter: '115.00',
            a1cBefore: '8.10',
            a1cAfter: '7.10',
            medsBefore: 'Old Med',
            medsAfter: 'Reduced Med',
            summaryRemission: 'ไม่ Remission',
          }),
          makeDbCohortRow({
            id: 2,
            hn: '0002222',
            cid: '1520000000022',
            summaryRemission: null,
          }),
        ])
        .mockResolvedValueOnce([{ hn: '0002222', cid: '1520000000022' }])

      const res = await service.carryoverFromFiscalYear(2569, 2570, actor)

      expect(res).toEqual({ copiedCount: 1, skippedCount: 1 })
      const txStatements = deps.appTransaction.mock.calls[1][0]
      expect(txStatements[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(txStatements).toHaveLength(2)
      const insertParams = txStatements[1].params ?? []
      expect(insertParams[0]).toBe(2570)
      expect(insertParams[8]).toBe(68)
      expect(insertParams[9]).toBe(89)
      expect(insertParams[10]).toBe(115)
      expect(insertParams[11]).toBe(7.1)
      expect(insertParams[12]).toBe('Reduced Med')
      expect(insertParams[13]).toBe('รอ lab A1c')

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
      deps.appQuery
        .mockResolvedValueOnce([{ cnt: 3 }]) // ensureSchema
        .mockResolvedValueOnce([]) // dup check
        .mockResolvedValueOnce([
          {
            id: 12,
            category: 'diet',
            label: 'คาร์บต่ำ',
            sortOrder: 1,
            isActive: 1,
            createdBy: 'nurse01',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ])

      deps.appTransaction
        .mockResolvedValueOnce({ count: 3, results: [] })
        .mockResolvedValueOnce({
          count: 2,
          results: [
            { affectedRows: 0, insertId: null },
            { affectedRows: 1, insertId: 12 },
          ],
        })

      const created = await service.createOption(
        { category: 'diet', label: 'คาร์บต่ำ', sortOrder: 1 },
        actor
      )
      expect(created).toMatchObject({ id: 12, category: 'diet', label: 'คาร์บต่ำ', isActive: true })

      // Duplicate on create
      deps.appQuery.mockResolvedValueOnce([{ id: 12 }])
      await expect(
        service.createOption({ category: 'diet', label: 'คาร์บต่ำ' }, actor)
      ).rejects.toBeInstanceOf(DmRemissionConflictError)

      // Update missing
      deps.appQuery.mockResolvedValueOnce([])
      await expect(service.updateOption(99, { label: 'ใหม่' }, actor)).rejects.toBeInstanceOf(
        DmRemissionNotFoundError
      )

      // Update success
      deps.appQuery
        .mockResolvedValueOnce([
          {
            id: 12,
            category: 'diet',
            label: 'คาร์บต่ำ',
            sortOrder: 1,
            isActive: 1,
            createdBy: 'nurse01',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ])
        .mockResolvedValueOnce([]) // no dup
        .mockResolvedValueOnce([
          {
            id: 12,
            category: 'diet',
            label: 'Low Carb',
            sortOrder: 2,
            isActive: 0,
            createdBy: 'nurse01',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-02',
          },
        ])

      const updated = await service.updateOption(
        12,
        { label: 'Low Carb', sortOrder: 2, isActive: false },
        actor
      )
      expect(updated).toMatchObject({ id: 12, label: 'Low Carb', sortOrder: 2, isActive: false })

      // Delete success
      deps.appQuery.mockResolvedValueOnce([
        {
          id: 12,
          category: 'diet',
          label: 'Low Carb',
          sortOrder: 2,
          isActive: 0,
          createdBy: 'nurse01',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-02',
        },
      ])
      const deleted = await service.deleteOption(12, actor)
      expect(deleted).toEqual({ id: 12, category: 'diet' })

      // List grouped
      deps.appQuery.mockResolvedValueOnce([
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
