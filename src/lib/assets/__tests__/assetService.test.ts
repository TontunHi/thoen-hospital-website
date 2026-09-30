import { describe, it, expect, vi, beforeEach } from 'vitest'
import { inferAssetCategory } from '../gtwAssetSyncAdapter'
import { HospitalAssetService } from '../assetService'

describe('inferAssetCategory', () => {
  it('identifies IT equipment from 7440, 7430 or keywords', () => {
    expect(inferAssetCategory('7440-013-0007', 'เครื่องคอมพิวเตอร์')).toBe('IT')
    expect(inferAssetCategory('7430-001-0012', 'เครื่องปริ้นเตอร์')).toBe('IT')
    expect(inferAssetCategory(null, 'Server Dell PowerEdge')).toBe('IT')
    expect(inferAssetCategory(null, 'เครื่องสำรองไฟ 800VA')).toBe('IT')
  })

  it('identifies Medical equipment from 6515, 6520, 6530 or keywords', () => {
    expect(inferAssetCategory('6515-003-2101', 'เครื่องช่วยหายใจ')).toBe('MEDICAL')
    expect(inferAssetCategory('6520-023-0001', 'ยูนิตทันตกรรม')).toBe('MEDICAL')
    expect(inferAssetCategory('6530-001-0003', 'รถเข็นนอน')).toBe('MEDICAL')
    expect(inferAssetCategory(null, 'เครื่องวัดความดันโลหิต')).toBe('MEDICAL')
  })

  it('falls back to GENERAL for other FSN and items', () => {
    expect(inferAssetCategory('7110-007-0019', 'โต๊ะทำงาน')).toBe('GENERAL')
    expect(inferAssetCategory('4110-002-0001', 'ตู้ทำน้ำเย็น')).toBe('GENERAL')
  })
})

describe('HospitalAssetService', () => {
  let mockDb: any
  let service: HospitalAssetService

  beforeEach(() => {
    mockDb = {
      hospitalAsset: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }
    service = new HospitalAssetService(mockDb)
  })

  it('calculates asset statistics correctly', async () => {
    mockDb.hospitalAsset.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(30)  // IT
      .mockResolvedValueOnce(40)  // Medical
      .mockResolvedValueOnce(30)  // General
      .mockResolvedValueOnce(5)   // In Repair
      .mockResolvedValueOnce(25)  // Active warranty

    const stats = await service.getAssetStats()

    expect(stats.totalAssets).toBe(100)
    expect(stats.itCount).toBe(30)
    expect(stats.medicalCount).toBe(40)
    expect(stats.generalCount).toBe(30)
    expect(stats.inRepairCount).toBe(5)
    expect(stats.activeWarrantyCount).toBe(25)
    expect(stats.expiredWarrantyCount).toBe(75)
  })

  it('creates asset with category auto-inference if omitted', async () => {
    mockDb.hospitalAsset.create.mockResolvedValue({ id: 1, name: 'PC', category: 'IT' })

    await service.createAsset({
      articleNum: '7440-001-0001/1/69',
      name: 'เครื่องคอมพิวเตอร์',
      fsnNum: '7440-001-0001',
    })

    expect(mockDb.hospitalAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          articleNum: '7440-001-0001/1/69',
          category: 'IT',
          name: 'เครื่องคอมพิวเตอร์',
        }),
      })
    )
  })

  it('creates asset with locationId and locationFullName', async () => {
    mockDb.hospitalAsset.create.mockResolvedValue({ id: 2, name: 'Printer', locationId: 5 })

    await service.createAsset({
      articleNum: '7430-001-0002/1/69',
      name: 'เครื่องพิมพ์เลเซอร์',
      locationId: 5,
      locationFullName: 'อาคารผู้ป่วยนอก ชั้น 1 (ห้องจ่ายยา)',
    })

    expect(mockDb.hospitalAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          articleNum: '7430-001-0002/1/69',
          locationId: 5,
          locationFullName: 'อาคารผู้ป่วยนอก ชั้น 1 (ห้องจ่ายยา)',
        }),
      })
    )
  })

  it('orders by receivedDate desc with id desc tie-breaker', async () => {
    mockDb.hospitalAsset.count.mockResolvedValue(10)
    mockDb.hospitalAsset.findMany.mockResolvedValue([])

    await service.getAssets({ sortBy: 'receivedDate', sortOrder: 'desc' })

    expect(mockDb.hospitalAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ receivedDate: 'desc' }, { id: 'desc' }],
      })
    )
  })
})
