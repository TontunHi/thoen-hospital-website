import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      palliativeCareRegistry: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

describe('PalliativeRegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists registries with filters and computes correct stats', async () => {
    const mockItems = [
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
    ]

    vi.mocked((prisma as any).palliativeCareRegistry.findMany)
      .mockResolvedValueOnce(mockItems as any) // items
      .mockResolvedValueOnce(mockItems as any) // allStats
    vi.mocked((prisma as any).palliativeCareRegistry.count).mockResolvedValue(2)

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
  })

  it('creates registry record and logs audit', async () => {
    const mockCreated = {
      id: 10,
      hn: '000206',
      patientName: 'นางจันทนา ตันมา',
      address: '205/1 ม.4 ต.เถินบุรี',
      phone: '065-2488015',
      icd10Principal: 'C548 CA corpus',
      registrationStatus: 'ดำเนินการเรียบร้อย',
    }

    vi.mocked((prisma as any).palliativeCareRegistry.create).mockResolvedValue(mockCreated as any)

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
    expect(logAudit).toHaveBeenCalledWith(
      'CREATE',
      'palliative_care_registries',
      expect.stringContaining('000206')
    )
  })

  it('updates registry record and logs audit', async () => {
    const mockUpdated = {
      id: 10,
      hn: '000206',
      patientName: 'นางจันทนา ตันมา',
      visit1Date: '2/11/2026',
      visit1Status: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
    }

    vi.mocked((prisma as any).palliativeCareRegistry.update).mockResolvedValue(mockUpdated as any)

    const result = await PalliativeRegistryService.updateRegistry(
      10,
      {
        visit1Date: '2/11/2026',
        visit1Status: 'เยี่ยมแล้ว+ลงข้อมูลเสร็จ',
      },
      'nurse_user'
    )

    expect(result.visit1Status).toBe('เยี่ยมแล้ว+ลงข้อมูลเสร็จ')
    expect(logAudit).toHaveBeenCalledWith(
      'UPDATE',
      'palliative_care_registries',
      expect.stringContaining('10')
    )
  })

  it('deletes registry record and logs audit', async () => {
    vi.mocked((prisma as any).palliativeCareRegistry.findUnique).mockResolvedValue({
      hn: '000206',
    } as any)
    vi.mocked((prisma as any).palliativeCareRegistry.delete).mockResolvedValue({ id: 10 } as any)

    const result = await PalliativeRegistryService.deleteRegistry(10, 'admin_user')

    expect(result.success).toBe(true)
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'palliative_care_registries',
      expect.stringContaining('10')
    )
  })
})
