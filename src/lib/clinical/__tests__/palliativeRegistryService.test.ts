import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiGateway', () => {
  return {
    apiGateway: {
      app: {
        query: vi.fn(),
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
import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'

describe('PalliativeRegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

