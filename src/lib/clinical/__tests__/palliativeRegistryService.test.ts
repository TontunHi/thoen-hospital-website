import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiGateway', () => {
  return {
    apiGateway: {
      app: {
        getPalliativeRegistries: vi.fn(),
        getPalliativeRegistryById: vi.fn(),
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
      visit1Status: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
    }

    vi.mocked(apiGateway.app.updatePalliativeRegistry).mockResolvedValue({ affectedRows: 1 } as any)
    vi.mocked(apiGateway.app.getPalliativeRegistryById).mockResolvedValue({ data: mockUpdated } as any)

    const result = await PalliativeRegistryService.updateRegistry(
      10,
      {
        visit1Date: '2/11/2026',
        visit1Status: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
      },
      'nurse_user'
    )

    expect(result.visit1Status).toBe('เยี่ยมแล้ว+ลงข้อมูลเสร็จ')
    expect(apiGateway.app.updatePalliativeRegistry).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        visit1Date: '2/11/2026',
        visit1Status: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
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
})
