import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { logAudit } from '@/lib/audit'
import { GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import {
  FctHomeVisitConflictError,
  FctHomeVisitNotFoundError,
  FctHomeVisitService,
  FctHomeVisitValidationError,
  type FctHomeVisitGatewayDeps,
} from '../fctHomeVisitService'

function createMockGw() {
  return {
    ensureFctHomeVisitSchema: vi.fn<FctHomeVisitGatewayDeps['ensureFctHomeVisitSchema']>().mockResolvedValue({ ensured: true }),
    lookupFctHomeVisitPatientByHn: vi.fn<FctHomeVisitGatewayDeps['lookupFctHomeVisitPatientByHn']>(),
    listFctHomeVisitOptionsRaw: vi.fn<FctHomeVisitGatewayDeps['listFctHomeVisitOptionsRaw']>(),
    createFctHomeVisitOption: vi.fn<FctHomeVisitGatewayDeps['createFctHomeVisitOption']>(),
    updateFctHomeVisitOption: vi.fn<FctHomeVisitGatewayDeps['updateFctHomeVisitOption']>(),
    deleteFctHomeVisitOption: vi.fn<FctHomeVisitGatewayDeps['deleteFctHomeVisitOption']>(),
    getFctHomeVisitsBundle: vi.fn<FctHomeVisitGatewayDeps['getFctHomeVisitsBundle']>(),
    getFctHomeVisitByIdRaw: vi.fn<FctHomeVisitGatewayDeps['getFctHomeVisitByIdRaw']>(),
    createFctHomeVisit: vi.fn<FctHomeVisitGatewayDeps['createFctHomeVisit']>(),
    updateFctHomeVisit: vi.fn<FctHomeVisitGatewayDeps['updateFctHomeVisit']>(),
    deleteFctHomeVisit: vi.fn<FctHomeVisitGatewayDeps['deleteFctHomeVisit']>(),
    batchImportFctHomeVisits: vi.fn<FctHomeVisitGatewayDeps['batchImportFctHomeVisits']>(),
  }
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
  let gw: ReturnType<typeof createMockGw>
  let service: FctHomeVisitService
  const actor = { username: 'nurse01', email: 'nurse01@thoen.local' }

  beforeEach(() => {
    vi.clearAllMocks()
    gw = createMockGw()
    service = new FctHomeVisitService(gw)
  })

  describe('ensureSchema', () => {
    it('ensures schema via Gateway once and caches state', async () => {
      await service.ensureSchema()
      await service.ensureSchema()
      expect(gw.ensureFctHomeVisitSchema).toHaveBeenCalledTimes(1)
    })
  })

  describe('lookupPatientByHn', () => {
    it('normalizes HN and returns patient address without cid', async () => {
      gw.lookupFctHomeVisitPatientByHn.mockResolvedValueOnce({
        hn: '0001234',
        ptname: 'นางสมหญิง ทดสอบ',
        age: '72',
        address: '12 ม.3 ต.ล้อมแรด อ.เถิน จ.ลำปาง',
      })

      const result = await service.lookupPatientByHn('1234')

      expect(gw.lookupFctHomeVisitPatientByHn).toHaveBeenCalledWith('0001234')
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
      expect(gw.lookupFctHomeVisitPatientByHn).not.toHaveBeenCalled()

      gw.lookupFctHomeVisitPatientByHn.mockResolvedValueOnce(null)
      expect(await service.lookupPatientByHn('9999999')).toBeNull()
    })
  })

  describe('listVisits', () => {
    it('loads bundle, scopes stats to fiscalYear+pcuName, and filters items', async () => {
      gw.getFctHomeVisitsBundle.mockResolvedValueOnce({
        targetFiscalYear: 2570,
        optionRows: [
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
        ],
        yearRows: [{ fiscalYear: 2570 }, { fiscalYear: 2568 }],
        pcuRows: [{ pcuName: 'รพ.เถิน' }],
        visitRows: [
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
        ],
      })

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
      expect(result.stats.totalVisits).toBe(2)
      expect(result.stats.uniquePatients).toBe(2)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe(2)
    })

    it('matches search against patientName, hn, diagnosis, address, and followUpPlan', async () => {
      const bundle = {
        targetFiscalYear: 2570,
        optionRows: [],
        yearRows: [{ fiscalYear: 2570 }],
        pcuRows: [],
        visitRows: [
          makeDbVisitRow({ id: 1, address: 'หมู่ 4 บ้านแม่ปะ', followUpPlan: 'ดูแผลกดทับ' }),
          makeDbVisitRow({
            id: 2,
            patientName: 'นาง ทดสอบ สอง',
            hn: '0008888',
            address: 'หมู่ 9',
            diagnosis: 'DM',
            followUpPlan: 'ตรวจน้ำตาล',
          }),
        ],
      }

      gw.getFctHomeVisitsBundle.mockResolvedValueOnce(bundle)
      const byAddress = await service.listVisits({ fiscalYear: 2570, search: 'แม่ปะ' })
      expect(byAddress.items.map((r) => r.id)).toEqual([1])

      gw.getFctHomeVisitsBundle.mockResolvedValueOnce(bundle)
      const byFollowUp = await service.listVisits({ fiscalYear: 2570, search: 'ตรวจน้ำตาล' })
      expect(byFollowUp.items.map((r) => r.id)).toEqual([2])
    })

    it('resolves omitted fiscalYear to the latest populated DB year', async () => {
      gw.getFctHomeVisitsBundle.mockResolvedValueOnce({
        targetFiscalYear: 2569,
        optionRows: [],
        yearRows: [{ fiscalYear: 2569 }, { fiscalYear: 2565 }],
        pcuRows: [{ pcuName: 'รพ.เถิน' }],
        visitRows: [makeDbVisitRow({ id: 10, fiscalYear: 2569, visitDate: '2026-06-11' })],
      })

      const result = await service.listVisits({})

      expect(result.fiscalYear).toBe(2569)
      expect(result.availableFiscalYears).toEqual([2569, 2565])
      expect(result.items).toHaveLength(1)
      expect(gw.getFctHomeVisitsBundle).toHaveBeenCalledWith(undefined)
    })
  })

  describe('createVisit / updateVisit / deleteVisit', () => {
    it('creates a visit, auto-derives fiscalYear & adlGroup, normalizes fields, and logs non-PHI audit', async () => {
      gw.createFctHomeVisit.mockResolvedValueOnce(
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
        })
      )

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
      expect(gw.createFctHomeVisit).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          fiscalYear: 2570,
          pcuName: 'รพ.เถิน',
          hn: '0001234',
          adlGroup: 'ติดบ้าน',
          overallRiskLevel: 'Moderate',
          nutritionStatus: 'อ้วน BMI เกิน',
        }),
        actorName: 'nurse01',
      })

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
      await expect(
        service.createVisit({ visitDate: '2026-10-15', patientName: '   ' }, actor)
      ).rejects.toBeInstanceOf(FctHomeVisitValidationError)

      await expect(
        service.createVisit({ visitDate: '2026-02-30', patientName: 'นายทดสอบ' }, actor)
      ).rejects.toBeInstanceOf(FctHomeVisitValidationError)
    })

    it('updates visit, recomputes fiscalYear when visitDate changes, and auto-suggests adlGroup when cleared', async () => {
      gw.getFctHomeVisitByIdRaw.mockResolvedValueOnce(null)
      await expect(service.updateVisit(999, { adlScore: 12 }, actor)).rejects.toBeInstanceOf(
        FctHomeVisitNotFoundError
      )

      gw.getFctHomeVisitByIdRaw.mockResolvedValueOnce(
        makeDbVisitRow({ id: 1, fiscalYear: 2570, visitDate: '2026-10-15', adlScore: 8, adlGroup: 'ติดบ้าน' })
      )
      gw.updateFctHomeVisit.mockResolvedValueOnce(
        makeDbVisitRow({ id: 1, fiscalYear: 2569, visitDate: '2026-09-20', adlScore: 15, adlGroup: 'ติดสังคม' })
      )

      const updated = await service.updateVisit(
        1,
        { visitDate: '2026-09-20', adlScore: 15, adlGroup: null },
        actor
      )

      expect(updated.fiscalYear).toBe(2569)
      expect(updated.adlGroup).toBe('ติดสังคม')
      expect(gw.updateFctHomeVisit).toHaveBeenCalledWith(1, {
        fields: expect.objectContaining({
          fiscalYear: 2569,
          visitDate: '2026-09-20',
          adlScore: 15,
          adlGroup: 'ติดสังคม',
        }),
        actorName: 'nurse01',
      })

      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE',
        'fct_home_visits',
        'Updated FCT home visit ID: 1 (FY: 2569)',
        actor
      )
    })

    it('deletes a visit or throws FctHomeVisitNotFoundError if missing', async () => {
      gw.deleteFctHomeVisit.mockRejectedValueOnce(new GatewayNotFoundError('Missing'))
      await expect(service.deleteVisit(404, actor)).rejects.toBeInstanceOf(
        FctHomeVisitNotFoundError
      )

      gw.deleteFctHomeVisit.mockResolvedValueOnce({ id: 7, fiscalYear: 2570 })
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
    it('normalizes rows, forwards to Gateway batch-import, and logs non-PHI audit', async () => {
      gw.batchImportFctHomeVisits.mockResolvedValueOnce({
        insertedCount: 4,
        skippedDuplicateCount: 2,
        errorCount: 0,
        duplicates: [
          { rowNumber: 1, visitDate: '2026-10-15', hn: '0001234', patientName: 'นายซ้ำ ฐานข้อมูล' },
          { rowNumber: 3, visitDate: '2026-10-20', hn: '0001234', patientName: 'นายซ้ำ ในชุด' },
        ],
      })

      const result = await service.batchImportVisits(
        [
          { visitDate: '2026-10-15', patientName: 'นายซ้ำ ฐานข้อมูล', hn: '1234' },
          { visitDate: '2026-10-20', patientName: 'นายสมชาย ตัวอย่าง', hn: '1234', adlScore: 3 },
          { visitDate: '2026-10-20', patientName: 'นายซ้ำ ในชุด', hn: '0001234' },
          { visitDate: '2026-10-20', patientName: 'นางไม่มี เอชเอ็นหนึ่ง', hn: null },
          { visitDate: '2026-10-20', patientName: 'นางไม่มี เอชเอ็นสอง', hn: '' },
          { visitDate: null, fiscalYear: 2569, patientName: 'นายไม่มี วันที่', hn: '76034' },
        ],
        actor
      )

      expect(result.insertedCount).toBe(4)
      expect(result.skippedDuplicateCount).toBe(2)
      const sentItems = gw.batchImportFctHomeVisits.mock.calls[0][0].items
      expect(sentItems).toHaveLength(6)
      expect(sentItems[1]).toMatchObject({ hn: '0001234', adlGroup: 'ติดเตียง' })
      expect(sentItems[5]).toMatchObject({ fiscalYear: 2569, visitDate: null, hn: '0076034' })

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
      gw.createFctHomeVisitOption.mockResolvedValueOnce({
        id: 21,
        category: 'pcu',
        label: 'รพ.สต.ทดสอบ',
        sortOrder: 1,
        isActive: 1,
        createdBy: 'nurse01',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      })

      const created = await service.createOption(
        { category: 'pcu', label: 'รพ.สต.ทดสอบ', sortOrder: 1 },
        actor
      )
      expect(created).toMatchObject({ id: 21, category: 'pcu', label: 'รพ.สต.ทดสอบ', isActive: true })

      gw.createFctHomeVisitOption.mockRejectedValueOnce(new GatewayError('Dup', { status: 409 }))
      await expect(
        service.createOption({ category: 'pcu', label: 'รพ.สต.ทดสอบ' }, actor)
      ).rejects.toBeInstanceOf(FctHomeVisitConflictError)

      gw.updateFctHomeVisitOption.mockRejectedValueOnce(new GatewayNotFoundError('Missing'))
      await expect(service.updateOption(99, { label: 'ใหม่' }, actor)).rejects.toBeInstanceOf(
        FctHomeVisitNotFoundError
      )

      gw.updateFctHomeVisitOption.mockResolvedValueOnce({
        id: 21,
        category: 'pcu',
        label: 'รพ.สต.ใหม่',
        sortOrder: 2,
        isActive: 0,
        createdBy: 'nurse01',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-02',
      })
      const updated = await service.updateOption(
        21,
        { label: 'รพ.สต.ใหม่', sortOrder: 2, isActive: false },
        actor
      )
      expect(updated).toMatchObject({ id: 21, label: 'รพ.สต.ใหม่', sortOrder: 2, isActive: false })

      gw.deleteFctHomeVisitOption.mockResolvedValueOnce({ id: 21, category: 'pcu' })
      const deleted = await service.deleteOption(21, actor)
      expect(deleted).toEqual({ id: 21, category: 'pcu' })

      gw.listFctHomeVisitOptionsRaw.mockResolvedValueOnce([
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
