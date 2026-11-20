import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiGateway', () => {
  return {
    apiGateway: {
      app: {
        query: vi.fn(),
        transaction: vi.fn(),
        getPalliativeRegistries: vi.fn(),
        getPalliativeRegistryById: vi.fn(),
        getPalliativeRegistryByHn: vi.fn(),
        createPalliativeRegistry: vi.fn(),
        updatePalliativeRegistry: vi.fn(),
        deletePalliativeRegistry: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

import { PalliativeRegistryService } from '../palliativeRegistryService'
import { LtcRegistryService } from '../ltcRegistryService'
import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'

describe('PalliativeRegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    PalliativeRegistryService.invalidateCache()
    PalliativeRegistryService.resetSyncState()
    LtcRegistryService.invalidateCache()
  })

  it('lists registries with filters and returns stats from gateway', async () => {
    const mockResponse = {
      items: [
        {
          id: 1,
          hn: '000206',
          patientName: 'นางจันทนา ตันมา',
          registrationStatus: 'ดำเนินการเรียบร้อย',
          claimStatus: 'ลงข้อมูล',
          claimResult: 'ได้เงิน',
        },
        {
          id: 2,
          hn: '000555',
          patientName: 'นายสมคิด ใจดี',
          registrationStatus: 'ยังไม่ได้ดำเนินการ',
          claimStatus: 'ยังไม่ได้ลงข้อมูล',
          claimResult: 'ติด C / Deny',
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      stats: {
        total: 2,
        registered: 1,
        pendingRegistration: 1,
        claimed: 1,
        paid: 1,
        deny: 1,
      },
    }

    vi.mocked(apiGateway.app.getPalliativeRegistries).mockResolvedValue(mockResponse as any)

    const result = await PalliativeRegistryService.listRegistries({
      search: 'จันทนา',
      page: 1,
      limit: 10,
    })

    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.stats.registered).toBe(1)
    expect(result.stats.pendingRegistration).toBe(1)
    expect(result.stats.paid).toBe(1)
    expect(result.stats.deny).toBe(1)
    expect(apiGateway.app.getPalliativeRegistries).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'จันทนา',
        page: 1,
        limit: 10,
      })
    )
  })

  it('matches multiple Reps from repeclaim and falls back to repdata with separated amounts', async () => {
    const mockResponse = {
      items: [
        {
          id: 1,
          hn: '0028792',
          patientName: 'ผู้ป่วยทดสอบ เคส Rep ซ้อน',
          registrationStatus: 'ยังไม่ได้ดำเนินการ',
          visit1Date: '20/07/2026',
        },
        {
          id: 2,
          hn: '0001894',
          patientName: 'ผู้ป่วยทดสอบ เคส Fallback repdata',
          registrationStatus: 'ยังไม่ได้ดำเนินการ',
          visit1Date: '2026-10-21',
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      stats: { total: 2, registered: 0, pendingRegistration: 2, claimed: 0, paid: 0, deny: 0 },
    }

    vi.mocked(apiGateway.app.getPalliativeRegistries).mockResolvedValue(mockResponse as any)

    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM clinicmember')) {
        return Promise.resolve([{ hn: '0028792', regdate: '2026-03-01' }])
      }
      if (sql.includes('FROM rcmdb.repeclaim')) {
        return Promise.resolve([
          { hn: '0028792', admdate: '2026-07-20', rep: '690700296', compensated: 0 },
          { hn: '0028792', admdate: '2026-07-20', rep: '690900231', compensated: 822 },
        ])
      }
      if (sql.includes('FROM rcmdb.repdata')) {
        return Promise.resolve([
          { hn: '0001894', admdate: '2026-10-21', rep: '691000217', compensated: 1000, errorcode: null, remark: null },
        ])
      }
      return Promise.resolve([])
    })

    const result = await PalliativeRegistryService.listRegistries({}, mockExecutor)

    expect(result.items).toHaveLength(2)

    // Patient 1: 0028792 with 2 separate Reps from repeclaim -> selects latest Rep (690900231)
    const pt1 = result.items[0]
    expect(pt1.registrationStatus).toBe('ดำเนินการเรียบร้อย')
    expect(pt1.registeredDate).toBe('2026-03-01')
    expect(pt1.visit1RepItems).toHaveLength(1)
    expect(pt1.visit1RepItems![0]).toEqual({
      rep: '690900231',
      compensated: 822,
      source: 'repeclaim',
    })
    expect(pt1.visit1Rep).toBe('690900231')
    expect(pt1.visit1Compensated).toBe(822)

    // Patient 2: 0001894 with fallback from repdata
    const pt2 = result.items[1]
    expect(pt2.visit1RepItems).toHaveLength(1)
    expect(pt2.visit1RepItems![0]).toEqual({
      rep: '691000217',
      compensated: 1000,
      reason: null,
      source: 'repdata',
    })
    expect(pt2.visit1Rep).toBe('691000217')
    expect(pt2.visit1Compensated).toBe(1000)
  })

  it('creates registry record via gateway and logs audit', async () => {
    const mockCreated = {
      id: 10,
      hn: '000206',
      patientName: 'นางจันทนา ตันมา',
      address: '205/1 ม.4 ต.เถินบุรี',
      phone: '065-2488015',
      icd10Principal: 'C548 CA corpus',
      registrationStatus: 'ดำเนินการเรียบร้อย',
    }

    vi.mocked(apiGateway.app.createPalliativeRegistry).mockResolvedValue({ insertId: 10 } as any)
    vi.mocked(apiGateway.app.getPalliativeRegistryById).mockResolvedValue({ data: mockCreated } as any)

    const result = await PalliativeRegistryService.createRegistry(
      {
        hn: '000206',
        patientName: 'นางจันทนา ตันมา',
        address: '205/1 ม.4 ต.เถินบุรี',
        phone: '065-2488015',
        icd10Principal: 'C548 CA corpus',
        registrationStatus: 'ดำเนินการเรียบร้อย',
      },
      'admin_user'
    )

    expect(result.id).toBe(10)
    expect(result.hn).toBe('000206')
    expect(apiGateway.app.createPalliativeRegistry).toHaveBeenCalled()
    expect(logAudit).toHaveBeenCalledWith(
      'CREATE',
      'palliative_care_registries',
      expect.stringContaining('000206')
    )
  })

  it('updates registry record via gateway and logs audit', async () => {
    const mockUpdated = {
      id: 10,
      hn: '000206',
      patientName: 'นางจันทนา ตันมา',
      visit1Date: '2/11/2026',
    }

    vi.mocked(apiGateway.app.updatePalliativeRegistry).mockResolvedValue({ affectedRows: 1 } as any)
    vi.mocked(apiGateway.app.getPalliativeRegistryById).mockResolvedValue({ data: mockUpdated } as any)

    const result = await PalliativeRegistryService.updateRegistry(
      10,
      {
        visit1Date: '2/11/2026',
      },
      'nurse_user'
    )

    expect(result.visit1Date).toBe('2/11/2026')
    expect(apiGateway.app.updatePalliativeRegistry).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        visit1Date: '2/11/2026',
        updatedBy: 'nurse_user',
      })
    )
    expect(logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'palliative_care_registries',
      expect.stringContaining('10')
    )
  })

  it('deletes registry record via gateway and logs audit', async () => {
    vi.mocked(apiGateway.app.getPalliativeRegistryById).mockResolvedValue({
      data: { id: 10, hn: '000206' },
    } as any)
    vi.mocked(apiGateway.app.deletePalliativeRegistry).mockResolvedValue({ message: 'Deleted' } as any)

    const result = await PalliativeRegistryService.deleteRegistry(10, 'admin_user')

    expect(result.success).toBe(true)
    expect(apiGateway.app.deletePalliativeRegistry).toHaveBeenCalledWith(10)
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'palliative_care_registries',
      expect.stringContaining('10')
    )
  })

  it('looks up patient demographics, Clinic 2423 status and ICD10 principal diagnosis from AN', async () => {
    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patient pt')) {
        return Promise.resolve([
          {
            hn: '0000206',
            ptname: 'นางจันทนา ตันมา',
            address: '205/1 ม.04 ต.เถินบุรี',
            phone: '0801209257',
            death: 'N',
            death_date: null,
          },
        ])
      }
      if (sql.includes('FROM clinicmember')) {
        return Promise.resolve([
          {
            hn: '0000206',
            clinic: '47',
            regdate: '2026-11-02',
            note: 'CA corpus',
          },
        ])
      }
      if (sql.includes('FROM an_stat a')) {
        return Promise.resolve([
          {
            an: '670005964',
            pdx: 'C541',
            pdx_name: 'Malignant neoplasm of endometrium',
            regdate: '2024-08-19',
            all_dx: 'C541,I898',
          },
        ])
      }
      return Promise.resolve([])
    })

    const patient = await PalliativeRegistryService.lookupPatientByHn('0000206', mockExecutor)

    expect(patient).not.toBeNull()
    expect(patient?.hn).toBe('0000206')
    expect(patient?.patientName).toBe('นางจันทนา ตันมา')
    expect(patient?.isRegistered).toBe(true)
    expect(patient?.registeredDate).toBe('2026-11-02')
    expect(patient?.icd10Principal).toBe('C541')
    expect(patient?.an).toBe('670005964')
  })

  it('throws error when creating duplicate patient in registry', async () => {
    vi.mocked(apiGateway.app.getPalliativeRegistryByHn).mockResolvedValueOnce({
      exists: true,
      data: { id: 15, hn: '0000034', patientName: 'นายธนวัตน์ จักรบุตร' },
    } as any)

    await expect(
      PalliativeRegistryService.createRegistry({
        hn: '0000034',
        patientName: 'นายธนวัตน์ จักรบุตร',
      })
    ).rejects.toThrow('ห้ามลงข้อมูลซ้ำ')
  })

  it('filters by compAmount and compVisits in test fallback branch', async () => {
    const mockResponse = {
      items: [
        {
          id: 1,
          hn: '0001',
          patientName: 'นายหนึ่ง ได้เงิน',
          visits: [
            { visitNo: 1, visitDate: '2026-01-10', compensated: 1000 },
            { visitNo: 2, visitDate: '2026-02-10', compensated: 500 },
          ],
        },
        {
          id: 2,
          hn: '0002',
          patientName: 'นายสอง ยังไม่ได้เงิน',
          visits: [{ visitNo: 1, visitDate: '2026-01-15', compensated: 0 }],
        },
        {
          id: 3,
          hn: '0003',
          patientName: 'นายสาม ได้เงินเยอะ',
          visits: [
            { visitNo: 1, visitDate: '2026-01-10', compensated: 2000 },
            { visitNo: 2, visitDate: '2026-02-10', compensated: 2000 },
          ],
        },
      ],
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
      stats: { total: 3, registered: 3, pendingRegistration: 0, claimed: 2, paid: 2, deny: 0 },
    }

    vi.mocked(apiGateway.app.getPalliativeRegistries).mockResolvedValue(mockResponse as any)

    // Filter by PAID
    const paidResult = await PalliativeRegistryService.listRegistries({ compAmount: 'PAID' })
    expect(paidResult.items).toHaveLength(2)
    expect(paidResult.items.map((i) => i.hn)).toEqual(['0001', '0003'])

    // Filter by specific amount range 1001-3000
    const rangeResult = await PalliativeRegistryService.listRegistries({ compAmount: '1001_3000' })
    expect(rangeResult.items).toHaveLength(1)
    expect(rangeResult.items[0].hn).toBe('0001') // 1500 total

    // Filter by compVisits = 2
    const visitsResult = await PalliativeRegistryService.listRegistries({ compVisits: '2' })
    expect(visitsResult.items).toHaveLength(2)
    expect(visitsResult.items.map((i) => i.hn)).toEqual(['0001', '0003'])

    // Filter by compVisits = 0
    const zeroVisitsResult = await PalliativeRegistryService.listRegistries({ compVisits: '0' })
    expect(zeroVisitsResult.items).toHaveLength(1)
    expect(zeroVisitsResult.items[0].hn).toBe('0002')
  })

  it('rejects adding patient to Palliative Care registry if they are in LTC', async () => {
    // Mock LTC query returning patient's HN
    vi.mocked(apiGateway.app.query).mockResolvedValueOnce([{ hn: '0008888' }] as any)

    await expect(
      PalliativeRegistryService.createRegistry({
        hn: '0008888',
        patientName: 'นายคนไข้ แอลทีซี',
      })
    ).rejects.toThrow('มีรายชื่อในทะเบียน Long Term Care (LTC) แล้ว ไม่สามารถลงทะเบียน Palliative Care ได้')
  })

  it('syncFromHosxp imports new Clinic 47 patients, excludes LTC patients, and updates existing status/regdate without touching visits', async () => {
    vi.mocked(apiGateway.app.query).mockImplementation((sql: string) => {
      if (sql.includes('FROM palliative_care_registries')) {
        return Promise.resolve([
          {
            id: 1,
            hn: '0000100',
            registration_status: 'ยังไม่ได้ดำเนินการ',
            registered_date: null,
            death_date: null,
          },
        ] as any)
      }
      if (sql.includes('FROM long_term_care_registries')) {
        return Promise.resolve([{ hn: '0000999' }] as any)
      }
      return Promise.resolve([] as any)
    })
    vi.mocked(apiGateway.app.transaction).mockResolvedValue([] as any)

    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM clinicmember cm')) {
        return Promise.resolve([
          // Existing website record missing regdate & status
          {
            hn: '0000100',
            regdate: '2026-10-15',
            note: 'CA lung',
            ptname: 'นายเก่า รออัปเดต',
            address: '1 ม.1',
            phone: '0800000001',
            death: 'N',
            death_date: null,
          },
          // LTC patient -> MUST be skipped
          {
            hn: '0000999',
            regdate: '2026-11-01',
            note: 'Stroke',
            ptname: 'นางแอลทีซี ข้ามเลย',
            address: '2 ม.2',
            phone: '0800000002',
            death: 'N',
            death_date: null,
          },
          // New non-LTC patient -> MUST be inserted with resolved ICD-10
          {
            hn: '0054921',
            regdate: '2026-11-01',
            note: null,
            ptname: 'นายใหม่ พัลลิเอทีฟ',
            address: '3 ม.3 ต.ล้อมแรด',
            phone: '0811111111',
            death: 'N',
            death_date: null,
          },
        ])
      }
      if (sql.includes('FROM an_stat a')) {
        return Promise.resolve([
          { hn: '0054921', an: '690005467', pdx: 'C349', regdate: '2026-07-27', icd10: 'C349', diagtype: 1 },
        ])
      }
      if (sql.includes('FROM vn_stat v')) {
        return Promise.resolve([])
      }
      return Promise.resolve([])
    })

    const summary = await PalliativeRegistryService.syncFromHosxp({ actor: 'hosxp_autosync' }, mockExecutor)

    expect(summary.totalClinicMembers).toBe(3)
    expect(summary.insertedCount).toBe(1)
    expect(summary.updatedCount).toBe(1)
    expect(summary.visitsAddedCount).toBe(0)
    expect(summary.skippedLtcCount).toBe(1)
    expect(summary.insertedItems).toEqual([
      {
        hn: '0054921',
        patientName: 'นายใหม่ พัลลิเอทีฟ',
        icd10Principal: 'C349',
        registeredDate: '2026-11-01',
      },
    ])
    expect(summary.updatedItems).toEqual([
      {
        hn: '0000100',
        patientName: 'นายเก่า รออัปเดต',
        updatedFields: ['status', 'registeredDate'],
        registeredDate: '2026-10-15',
      },
    ])
    expect(summary.skippedLtcItems).toEqual([
      {
        hn: '0000999',
        patientName: 'นางแอลทีซี ข้ามเลย',
      },
    ])
    expect(summary.visitsAddedItems).toEqual([])

    expect(apiGateway.app.transaction).toHaveBeenCalledTimes(1)
    const txCalls = vi.mocked(apiGateway.app.transaction).mock.calls[0][0] as Array<{ sql: string; params: unknown[] }>
    expect(txCalls).toHaveLength(2)

    const insertCall = txCalls.find((c) => c.sql.includes('INSERT INTO palliative_care_registries'))
    expect(insertCall).toBeDefined()
    expect(insertCall!.params[0]).toBe('0054921')
    expect(insertCall!.params[4]).toBe('C349') // resolved icd10Principal
    expect(insertCall!.params[7]).toBe('2026-11-01') // registered_date

    // LTC patient 0000999 must never be inserted
    expect(txCalls.some((c) => c.params.includes('0000999'))).toBe(false)

    const updateCall = txCalls.find((c) => c.sql.includes('UPDATE palliative_care_registries'))
    expect(updateCall).toBeDefined()
    expect(updateCall!.params[3]).toBe(1) // existing id

    expect(logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'palliative_care_registries',
      expect.stringContaining('inserted: 1, updated: 1, visitsAdded: 0, skippedLtc: 1')
    )
  })

  it('syncFromHosxp appends missing ADP 30001 home visits across all history without overwriting existing visits', async () => {
    let regQueryCalls = 0
    vi.mocked(apiGateway.app.query).mockImplementation((sql: string) => {
      if (sql.includes('FROM palliative_care_registries')) {
        regQueryCalls++
        if (regQueryCalls === 1) {
          return Promise.resolve([
            {
              id: 1,
              hn: '0000100',
              registration_status: 'ดำเนินการเรียบร้อย',
              registered_date: '2024-06-01',
              death_date: null,
              visit_1_date: '15/10/2026',
            },
          ] as any)
        }
        return Promise.resolve([
          {
            id: 1,
            hn: '0000100',
            visit_1_date: '15/10/2026',
          },
          {
            id: 2,
            hn: '0054921',
            visit_1_date: null,
          },
        ] as any)
      }
      if (sql.includes('FROM palliative_care_registry_visits')) {
        return Promise.resolve([
          { registry_id: 1, visit_no: 1, visit_date: '15/10/2026' },
        ] as any)
      }
      if (sql.includes('FROM long_term_care_registries')) {
        return Promise.resolve([] as any)
      }
      return Promise.resolve([] as any)
    })
    vi.mocked(apiGateway.app.transaction).mockResolvedValue([] as any)

    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM clinicmember cm')) {
        return Promise.resolve([
          {
            hn: '0054921',
            regdate: '2026-11-01',
            note: 'CA',
            ptname: 'นายใหม่ พัลลิเอทีฟ',
            address: '3 ม.3',
            phone: '0811111111',
            death: 'N',
            death_date: null,
          },
        ])
      }
      if (sql.includes("d.nhso_adp_code = '30001'")) {
        return Promise.resolve([
          // Existing patient: 2026-10-15 already recorded -> skip; 2024-06-10 and 2026-11-19 -> append!
          { hn: '0000100', vstdate: '2024-06-10' },
          { hn: '0000100', vstdate: '2026-10-15' },
          { hn: '0000100', vstdate: '2026-11-19' },
          // Newly inserted patient: 2026-09-09 and 2026-11-19 -> visit 1 and visit 2!
          { hn: '0054921', vstdate: '2026-09-09' },
          { hn: '0054921', vstdate: '2026-11-19' },
        ])
      }
      return Promise.resolve([])
    })

    const summary = await PalliativeRegistryService.syncFromHosxp({ actor: 'hosxp_autosync' }, mockExecutor)

    expect(summary.insertedCount).toBe(1)
    expect(summary.visitsAddedCount).toBe(4)
    expect(summary.visitsAddedItems).toEqual([
      {
        hn: '0000100',
        patientName: 'HN 0000100',
        addedVisits: [
          { visitNo: 2, visitDate: '10/06/2024' },
          { visitNo: 3, visitDate: '19/11/2026' },
        ],
      },
      {
        hn: '0054921',
        patientName: 'นายใหม่ พัลลิเอทีฟ',
        addedVisits: [
          { visitNo: 1, visitDate: '09/09/2026' },
          { visitNo: 2, visitDate: '19/11/2026' },
        ],
      },
    ])

    // Transaction 1: patient insert; Transaction 2: visit inserts & slot updates
    expect(apiGateway.app.transaction).toHaveBeenCalledTimes(2)
    const visitTxCalls = vi.mocked(apiGateway.app.transaction).mock.calls[1][0] as Array<{
      sql: string
      params: unknown[]
    }>

    const visitInserts = visitTxCalls.filter((c) =>
      c.sql.includes('INSERT IGNORE INTO palliative_care_registry_visits')
    )
    expect(visitInserts).toHaveLength(4)
    expect(visitInserts.map((c) => c.params)).toEqual([
      [1, 2, '10/06/2024'],
      [1, 3, '19/11/2026'],
      [2, 1, '09/09/2026'],
      [2, 2, '19/11/2026'],
    ])

    const regSlotUpdates = visitTxCalls.filter((c) =>
      c.sql.includes('UPDATE palliative_care_registries')
    )
    expect(regSlotUpdates).toHaveLength(2)
    expect(regSlotUpdates[0].sql).toContain('visit_2_date = COALESCE')
    expect(regSlotUpdates[0].sql).toContain('visit_3_date = COALESCE')
    expect(regSlotUpdates[1].sql).toContain('visit_1_date = COALESCE')
    expect(regSlotUpdates[1].sql).toContain('visit_2_date = COALESCE')
  })

  it('ensureAutoSynced respects cooldown unless force=true', async () => {
    vi.mocked(apiGateway.app.query).mockResolvedValue([] as any)
    const mockExecutor = vi.fn().mockResolvedValue([])

    const first = await PalliativeRegistryService.ensureAutoSynced({}, mockExecutor)
    const firstCallCount = mockExecutor.mock.calls.length
    const second = await PalliativeRegistryService.ensureAutoSynced({}, mockExecutor)
    expect(first).toEqual(second)
    expect(mockExecutor).toHaveBeenCalledTimes(firstCallCount) // 2nd call hit cooldown

    await PalliativeRegistryService.ensureAutoSynced({ force: true }, mockExecutor)
    expect(mockExecutor).toHaveBeenCalledTimes(firstCallCount * 2) // forced re-sync ran
  })
})

