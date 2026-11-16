import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { logAudit } from '@/lib/audit'
import { FCT_ALL_OPTION_CATEGORIES, FCT_OPTION_CATEGORY_META } from '../fctHomeVisitTypes'
import {
  FctHomeVisitConflictError,
  FctHomeVisitNotFoundError,
  FctHomeVisitService,
  FctHomeVisitValidationError,
  type FctHomeVisitDbDeps,
} from '../fctHomeVisitService'

function createMockDeps() {
  return {
    // Mocked query returns heterogeneous row shapes across test cases
    appQuery: vi.fn<(sql: string, params?: unknown[]) => Promise<any[]>>(),
    appTransaction: vi.fn<FctHomeVisitDbDeps['appTransaction']>().mockResolvedValue({
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

function makeAllSeededCounts() {
  return FCT_ALL_OPTION_CATEGORIES.map((category) => ({
    category,
    cnt: FCT_OPTION_CATEGORY_META[category].seedLabels.length,
  }))
}

function makeDbVisitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    fiscalYear: 2570,
    visitDate: '2026-10-15',
    pcuName: 'รพ.เถิน',
    patientName: 'นายสมชาย ตัวอย่าง',
    hn: '0001234',
    age: 68,
    address: '99 ม.1 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
    adlScore: 4,
    adlGroup: 'ติดเตียง',
    diagnosis: 'Stroke',
    patientCategory: 'stroke',
    followUpPlan: 'ติดตามกายภาพบำบัด',
    treatmentFacility: 'รพ.เถิน',
    visitOutcome: 'ดีขึ้น',
    overallRiskLevel: 'High',
    riskLevel: 'Moderate',
    dentalNote: 'แปรงฟันวันละ 2 ครั้ง',
    pharmacyNote: null,
    nutritionStatus: 'ปกติ',
    nutritionNote: 'ทานอาหารครบ 5 หมู่',
    ptCategory: 'ฝึกทรงตัว ยืน เดิน',
    ptNote: 'ฝึกเดินทุกวัน',
    thaiMedCategory: null,
    thaiMedNote: null,
    createdBy: 'nurse01',
    updatedBy: 'nurse01',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('FctHomeVisitService', () => {
  let deps: ReturnType<typeof createMockDeps>
  let service: FctHomeVisitService
  const actor = { username: 'nurse01', email: 'nurse01@thoen.local' }

  beforeEach(() => {
    vi.clearAllMocks()
    deps = createMockDeps()
    service = new FctHomeVisitService(deps)
  })

  describe('ensureSchema', () => {
    it('creates tables without cid/unique-hn, seeds empty option categories, and caches state', async () => {
      deps.appQuery.mockResolvedValueOnce([{ category: 'pcu', cnt: 3 }])

      await service.ensureSchema()
      await service.ensureSchema()

      expect(deps.appTransaction).toHaveBeenCalledTimes(2)
      const ddlBatch = deps.appTransaction.mock.calls[0][0]
      expect(ddlBatch[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(ddlBatch[1].sql).toContain('CREATE TABLE IF NOT EXISTS fct_home_visits')
      expect(ddlBatch[1].sql).not.toContain('cid ')
      expect(ddlBatch[1].sql).not.toContain('UNIQUE KEY')
      expect(ddlBatch[2].sql).toContain('CREATE TABLE IF NOT EXISTS fct_home_visit_options')

      const seedBatch = deps.appTransaction.mock.calls[1][0]
      expect(seedBatch[0]).toEqual({ sql: 'SET NAMES utf8mb4' })

      const expectedSeedCount = FCT_ALL_OPTION_CATEGORIES.filter((c) => c !== 'pcu').reduce(
        (sum, c) => sum + FCT_OPTION_CATEGORY_META[c].seedLabels.length,
        0
      )
      expect(seedBatch).toHaveLength(1 + expectedSeedCount)
      const seededCategories = new Set(seedBatch.slice(1).map((s) => s.params?.[0]))
      expect(seededCategories.has('pcu')).toBe(false)
      expect(seededCategories.has('adl_group')).toBe(true)
      expect(seededCategories.has('visit_outcome')).toBe(true)
    })

    it('skips seeding when all categories already have rows', async () => {
      deps.appQuery.mockResolvedValueOnce(makeAllSeededCounts())

      await service.ensureSchema()
      expect(deps.appTransaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('lookupPatientByHn', () => {
    it('normalizes HN and queries patient joined with thaiaddress without returning cid', async () => {
      deps.clinicalQuery.mockResolvedValueOnce([
        {
          hn: '0001234',
          ptname: 'นางสมหญิง ทดสอบ',
          age: '72',
          address: '12 ม.3 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
        },
      ])

      const result = await service.lookupPatientByHn('1234')

      expect(deps.clinicalQuery).toHaveBeenCalledWith(expect.stringContaining('FROM patient pt'), [
        '0001234',
      ])
      const executedSql = deps.clinicalQuery.mock.calls[0][0]
      expect(executedSql).toContain('LEFT JOIN thaiaddress t')
      expect(executedSql).toContain('LEFT JOIN thaiaddress a')
      expect(executedSql).toContain('LEFT JOIN thaiaddress c')
      expect(executedSql).not.toContain('pt.cid')

      expect(result).toEqual({
        hn: '0001234',
        patientName: 'นางสมหญิง ทดสอบ',
        age: 72,
        address: '12 ม.3 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
      })
      expect(result).not.toHaveProperty('cid')
    })

    it('returns null for blank HN or missing patient', async () => {
      expect(await service.lookupPatientByHn('   ')).toBeNull()
      expect(deps.clinicalQuery).not.toHaveBeenCalled()

      deps.clinicalQuery.mockResolvedValueOnce([])
      expect(await service.lookupPatientByHn('9999999')).toBeNull()
    })
  })

  describe('listVisits', () => {
    it('loads options, years, PCUs, scopes stats to fiscalYear+pcuName, and filters items', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts()) // ensureSchema
        .mockResolvedValueOnce([
          {
            id: 1,
            category: 'pcu',
            label: 'แม่วะหลวง',
            sortOrder: 0,
            isActive: 1,
            createdBy: 'system',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
          {
            id: 2,
            category: 'adl_group',
            label: 'ติดเตียง',
            sortOrder: 0,
            isActive: 1,
            createdBy: 'system',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
          {
            id: 3,
            category: 'visit_outcome',
            label: 'ดีขึ้น',
            sortOrder: 0,
            isActive: 1,
            createdBy: 'system',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ])
        .mockResolvedValueOnce([{ fiscalYear: 2570 }, { fiscalYear: 2568 }])
        .mockResolvedValueOnce([{ pcuName: 'รพ.เถิน' }])
        .mockResolvedValueOnce([
          makeDbVisitRow({
            id: 1,
            pcuName: 'รพ.เถิน',
            patientName: 'นาย ก ทดสอบ',
            adlGroup: 'ติดเตียง',
            visitOutcome: 'ดีขึ้น',
            diagnosis: 'Stroke',
          }),
          makeDbVisitRow({
            id: 2,
            pcuName: 'รพ.เถิน',
            patientName: 'นาง ข ตัวอย่าง',
            hn: '0005678',
            adlGroup: 'ติดบ้าน',
            visitOutcome: 'คงเดิม',
            diagnosis: 'COPD exacerbation',
            followUpPlan: 'นัดพ่นยา',
          }),
          makeDbVisitRow({
            id: 3,
            pcuName: 'แม่วะหลวง',
            patientName: 'นาย ค ทดสอบ',
            hn: '0009999',
            adlGroup: 'ติดบ้าน',
            visitOutcome: 'คงเดิม',
          }),
        ])

      const result = await service.listVisits({
        fiscalYear: 2570,
        pcuName: 'รพ.เถิน',
        adlGroup: 'ติดบ้าน',
        visitOutcome: 'คงเดิม',
        search: 'copd',
      })

      expect(result.fiscalYear).toBe(2570)
      expect(result.availableFiscalYears).toContain(2568)
      expect(result.availablePcus).toEqual(['แม่วะหลวง', 'รพ.เถิน'])
      // Stats reflect both records in รพ.เถิน before adlGroup/visitOutcome/search narrowing
      expect(result.stats.totalVisits).toBe(2)
      expect(result.stats.uniquePatients).toBe(2)
      // Items reflect adlGroup + visitOutcome + search narrowing
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(2)
    })

    it('matches search against patientName, hn, diagnosis, address, and followUpPlan', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts())
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ fiscalYear: 2570 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeDbVisitRow({ id: 1, address: 'หมู่ 4 บ้านแม่ปะ', followUpPlan: 'ดูแผลกดทับ' }),
          makeDbVisitRow({
            id: 2,
            patientName: 'นาง ทดสอบ สอง',
            hn: '0008888',
            address: 'หมู่ 9',
            diagnosis: 'DM',
            followUpPlan: 'ตรวจน้ำตาล',
          }),
        ])

      const byAddress = await service.listVisits({ fiscalYear: 2570, search: 'แม่ปะ' })
      expect(byAddress.items.map((r) => r.id)).toEqual([1])

      deps.appQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ fiscalYear: 2570 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeDbVisitRow({ id: 1, address: 'หมู่ 4 บ้านแม่ปะ', followUpPlan: 'ดูแผลกดทับ' }),
          makeDbVisitRow({
            id: 2,
            patientName: 'นาง ทดสอบ สอง',
            hn: '0008888',
            address: 'หมู่ 9',
            diagnosis: 'DM',
            followUpPlan: 'ตรวจน้ำตาล',
          }),
        ])

      const byFollowUp = await service.listVisits({ fiscalYear: 2570, search: 'ตรวจน้ำตาล' })
      expect(byFollowUp.items.map((r) => r.id)).toEqual([2])
    })

    it('resolves omitted fiscalYear to the latest populated DB year and returns only populated years', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts()) // ensureSchema
        .mockResolvedValueOnce([{ fiscalYear: 2569 }, { fiscalYear: 2565 }]) // yearRows
        .mockResolvedValueOnce([]) // options
        .mockResolvedValueOnce([{ pcuName: 'รพ.เถิน' }]) // pcuRows
        .mockResolvedValueOnce([makeDbVisitRow({ id: 10, fiscalYear: 2569, visitDate: '2026-06-11' })])

      const result = await service.listVisits({})

      expect(result.fiscalYear).toBe(2569)
      expect(result.availableFiscalYears).toEqual([2569, 2565])
      expect(result.items).toHaveLength(1)
      expect(deps.appQuery.mock.calls[4][1]).toEqual([2569])
    })
  })

  describe('createVisit / updateVisit / deleteVisit', () => {
    it('creates a visit, auto-derives fiscalYear & adlGroup, normalizes fields, and logs non-PHI audit', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts()) // ensureSchema
        .mockResolvedValueOnce([
          makeDbVisitRow({
            id: 15,
            fiscalYear: 2570,
            visitDate: '2026-10-15',
            pcuName: 'รพ.เถิน',
            hn: '0001234',
            adlScore: 8,
            adlGroup: 'ติดบ้าน',
            overallRiskLevel: 'Moderate',
            nutritionStatus: 'อ้วน BMI เกิน',
          }),
        ])

      deps.appTransaction
        .mockResolvedValueOnce({ count: 3, results: [] }) // ensureSchema DDL
        .mockResolvedValueOnce({
          count: 2,
          results: [
            { affectedRows: 0, insertId: null },
            { affectedRows: 1, insertId: 15 },
          ],
        })

      const created = await service.createVisit(
        {
          visitDate: '2026-10-15',
          pcuName: 'รพ เถิน',
          patientName: 'นายสมชาย ตัวอย่าง',
          hn: '1234',
          adlScore: 8,
          overallRiskLevel: 'moderate risk',
          nutritionStatus: 'อ้วนBMI เกิน',
        },
        actor
      )

      expect(created.id).toBe(15)
      expect(created.fiscalYear).toBe(2570)
      expect(created.adlGroup).toBe('ติดบ้าน')

      const insertCall = deps.appTransaction.mock.calls[1][0]
      expect(insertCall[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(insertCall[1].sql).toContain('INSERT INTO fct_home_visits')
      expect(insertCall[1].params?.[0]).toBe(2570)
      expect(insertCall[1].params).toContain('รพ.เถิน')
      expect(insertCall[1].params).toContain('0001234')
      expect(insertCall[1].params).toContain('ติดบ้าน')
      expect(insertCall[1].params).toContain('Moderate')
      expect(insertCall[1].params).toContain('อ้วน BMI เกิน')

      expect(logAudit).toHaveBeenCalledWith(
        'CREATE',
        'fct_home_visits',
        'Created FCT home visit ID: 15 (FY: 2570)',
        actor
      )
      const auditDetails = vi.mocked(logAudit).mock.calls[0][2]
      expect(auditDetails).not.toContain('นายสมชาย')
      expect(auditDetails).not.toContain('0001234')
    })

    it('throws FctHomeVisitValidationError for blank patientName or invalid visitDate', async () => {
      deps.appQuery.mockResolvedValue(makeAllSeededCounts())

      await expect(
        service.createVisit({ visitDate: '2026-10-15', patientName: '   ' }, actor)
      ).rejects.toBeInstanceOf(FctHomeVisitValidationError)

      await expect(
        service.createVisit({ visitDate: '2026-02-30', patientName: 'นายทดสอบ' }, actor)
      ).rejects.toBeInstanceOf(FctHomeVisitValidationError)
    })

    it('updates visit, recomputes fiscalYear when visitDate changes, and auto-suggests adlGroup when cleared', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts()) // ensureSchema
        .mockResolvedValueOnce([]) // missing

      await expect(service.updateVisit(999, { adlScore: 12 }, actor)).rejects.toBeInstanceOf(
        FctHomeVisitNotFoundError
      )

      deps.appQuery
        .mockResolvedValueOnce([
          makeDbVisitRow({ id: 1, fiscalYear: 2570, visitDate: '2026-10-15', adlScore: 8, adlGroup: 'ติดบ้าน' }),
        ])
        .mockResolvedValueOnce([
          makeDbVisitRow({ id: 1, fiscalYear: 2569, visitDate: '2026-09-20', adlScore: 15, adlGroup: 'ติดสังคม' }),
        ])

      const updated = await service.updateVisit(
        1,
        { visitDate: '2026-09-20', adlScore: 15, adlGroup: null },
        actor
      )

      expect(updated.fiscalYear).toBe(2569)
      expect(updated.adlGroup).toBe('ติดสังคม')

      const updateBatch = deps.appTransaction.mock.calls[1][0]
      expect(updateBatch[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(updateBatch[1].sql).toContain('fiscal_year = ?')
      expect(updateBatch[1].params).toContain(2569)
      expect(updateBatch[1].params).toContain('ติดสังคม')

      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE',
        'fct_home_visits',
        'Updated FCT home visit ID: 1 (FY: 2569)',
        actor
      )
    })

    it('deletes a visit or throws FctHomeVisitNotFoundError if missing', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts())
        .mockResolvedValueOnce([])

      await expect(service.deleteVisit(404, actor)).rejects.toBeInstanceOf(
        FctHomeVisitNotFoundError
      )

      deps.appQuery.mockResolvedValueOnce([makeDbVisitRow({ id: 7, fiscalYear: 2570 })])

      const deleted = await service.deleteVisit(7, actor)
      expect(deleted).toEqual({ id: 7, fiscalYear: 2570 })
      expect(logAudit).toHaveBeenCalledWith(
        'DELETE',
        'fct_home_visits',
        'Deleted FCT home visit ID: 7 (FY: 2570)',
        actor
      )
    })
  })

  describe('batchImportVisits', () => {
    it('skips duplicate (visitDate, hn) from DB and intra-batch while always inserting null HN rows', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts()) // ensureSchema
        .mockResolvedValueOnce([{ visitDate: '2026-10-15', hn: '0001234' }]) // existing DB pairs

      const result = await service.batchImportVisits(
        [
          // Row 1: matches existing DB (2026-10-15, 0001234) -> skip
          { visitDate: '2026-10-15', patientName: 'นายซ้ำ ฐานข้อมูล', hn: '1234' },
          // Row 2: new (2026-10-20, 0001234) -> insert (same HN, different date allowed)
          { visitDate: '2026-10-20', patientName: 'นายสมชาย ตัวอย่าง', hn: '1234', adlScore: 3 },
          // Row 3: intra-batch duplicate of Row 2 -> skip
          { visitDate: '2026-10-20', patientName: 'นายซ้ำ ในชุด', hn: '0001234' },
          // Row 4: null HN -> always insert
          { visitDate: '2026-10-20', patientName: 'นางไม่มี เอชเอ็นหนึ่ง', hn: null },
          // Row 5: second null HN on same date -> always insert
          { visitDate: '2026-10-20', patientName: 'นางไม่มี เอชเอ็นสอง', hn: '' },
          // Row 6: null visitDate with explicit fiscalYear -> always insert
          { visitDate: null, fiscalYear: 2569, patientName: 'นายไม่มี วันที่', hn: '76034' },
        ],
        actor
      )

      expect(result).toEqual({
        insertedCount: 4,
        skippedDuplicateCount: 2,
        errorCount: 0,
        duplicates: [
          { rowNumber: 1, visitDate: '2026-10-15', hn: '0001234', patientName: 'นายซ้ำ ฐานข้อมูล' },
          { rowNumber: 3, visitDate: '2026-10-20', hn: '0001234', patientName: 'นายซ้ำ ในชุด' },
        ],
      })

      expect(deps.appTransaction).toHaveBeenCalledTimes(2)
      const importBatch = deps.appTransaction.mock.calls[1][0]
      expect(importBatch[0]).toEqual({ sql: 'SET NAMES utf8mb4' })
      expect(importBatch).toHaveLength(5) // SET NAMES + 4 INSERT statements
      expect(importBatch[1].params).toContain('ติดเตียง') // adlScore 3 auto-suggested
      expect(importBatch[4].params?.[0]).toBe(2569)
      expect(importBatch[4].params).toContain(null)

      expect(logAudit).toHaveBeenCalledWith(
        'CREATE',
        'fct_home_visits',
        'Batch imported FCT home visits: inserted 4, skipped duplicates 2',
        actor
      )
    })
  })

  describe('options CRUD', () => {
    it('creates, updates, lists, and deletes options with conflict & not-found checks', async () => {
      deps.appQuery
        .mockResolvedValueOnce(makeAllSeededCounts()) // ensureSchema
        .mockResolvedValueOnce([]) // dup check
        .mockResolvedValueOnce([
          {
            id: 21,
            category: 'pcu',
            label: 'รพ.สต.ทดสอบ',
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
            { affectedRows: 1, insertId: 21 },
          ],
        })

      const created = await service.createOption(
        { category: 'pcu', label: 'รพ.สต.ทดสอบ', sortOrder: 1 },
        actor
      )
      expect(created).toMatchObject({ id: 21, category: 'pcu', label: 'รพ.สต.ทดสอบ', isActive: true })

      deps.appQuery.mockResolvedValueOnce([{ id: 21 }])
      await expect(
        service.createOption({ category: 'pcu', label: 'รพ.สต.ทดสอบ' }, actor)
      ).rejects.toBeInstanceOf(FctHomeVisitConflictError)

      deps.appQuery.mockResolvedValueOnce([])
      await expect(service.updateOption(99, { label: 'ใหม่' }, actor)).rejects.toBeInstanceOf(
        FctHomeVisitNotFoundError
      )

      deps.appQuery
        .mockResolvedValueOnce([
          {
            id: 21,
            category: 'pcu',
            label: 'รพ.สต.ทดสอบ',
            sortOrder: 1,
            isActive: 1,
            createdBy: 'nurse01',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-01',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 21,
            category: 'pcu',
            label: 'รพ.สต.ใหม่',
            sortOrder: 2,
            isActive: 0,
            createdBy: 'nurse01',
            createdAt: '2026-10-01',
            updatedAt: '2026-10-02',
          },
        ])

      const updated = await service.updateOption(
        21,
        { label: 'รพ.สต.ใหม่', sortOrder: 2, isActive: false },
        actor
      )
      expect(updated).toMatchObject({ id: 21, label: 'รพ.สต.ใหม่', sortOrder: 2, isActive: false })

      deps.appQuery.mockResolvedValueOnce([
        {
          id: 21,
          category: 'pcu',
          label: 'รพ.สต.ใหม่',
          sortOrder: 2,
          isActive: 0,
          createdBy: 'nurse01',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-02',
        },
      ])
      const deleted = await service.deleteOption(21, actor)
      expect(deleted).toEqual({ id: 21, category: 'pcu' })

      deps.appQuery.mockResolvedValueOnce([
        {
          id: 1,
          category: 'adl_group',
          label: 'ติดเตียง',
          sortOrder: 0,
          isActive: 1,
          createdBy: 'system',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
      ])
      const grouped = await service.listOptions()
      expect(grouped.adl_group).toHaveLength(1)
      expect(grouped.pcu).toEqual([])
      expect(grouped.thai_med_category).toEqual([])
    })
  })
})
