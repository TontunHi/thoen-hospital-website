import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiGateway', () => {
  return {
    apiGateway: {
      app: {
        query: vi.fn(),
        execute: vi.fn(),
        transaction: vi.fn().mockResolvedValue({ count: 1, results: [] }),
      },
      clinical: {
        query: vi.fn(),
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

import { LtcRegistryService } from '../ltcRegistryService'
import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'

describe('LtcRegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    LtcRegistryService.invalidateCache()
  })

  it('lists LTC registries with search and areaZone filtering and computes stats', async () => {
    const mockRows = [
      {
        id: 1,
        hn: '0001234',
        cid: '1520000000001',
        patientName: 'นายใจดี ล้อมแรด',
        address: '12',
        moo: '1',
        tambon: 'ล้อมแรด',
        age: 72,
        adlScore: 8,
        areaZone: 'รพ.สต.ล้อมแรด',
        createdBy: 'admin',
        updatedBy: 'admin',
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01',
      },
      {
        id: 2,
        hn: '0005678',
        cid: '1520000000002',
        patientName: 'นางสมศรี แม่วะ',
        address: '34',
        moo: '2',
        tambon: 'แม่วะ',
        age: 80,
        adlScore: 4,
        areaZone: 'รพ.สต.แม่วะ',
        createdBy: 'admin',
        updatedBy: 'admin',
        createdAt: '2026-11-02',
        updatedAt: '2026-11-02',
      },
    ]

    vi.mocked(apiGateway.app.query).mockResolvedValue(mockRows as any)

    const result = await LtcRegistryService.listRegistries({ search: 'ใจดี' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].hn).toBe('0001234')
    expect(result.stats.total).toBe(1)
    expect(result.stats.avgAdl).toBe(8)
    expect(result.availableAreaZones).toEqual(['รพ.สต.ล้อมแรด', 'รพ.สต.แม่วะ'])
  })

  it('looks up patient from HOSxP and flags existing LTC status', async () => {
    vi.mocked(apiGateway.clinical.query).mockResolvedValue([
      {
        hn: '0001234',
        cid: '1520000000001',
        ptname: 'นายใจดี ล้อมแรด',
        address: '12',
        moo: '1',
        tambon: 'ล้อมแรด',
        age: 72,
      },
    ] as any)

    vi.mocked(apiGateway.app.query).mockResolvedValueOnce([
      {
        id: 1,
        hn: '0001234',
        patientName: 'นายใจดี ล้อมแรด',
      },
    ] as any) // for existing LTC check

    const lookup = await LtcRegistryService.lookupPatientByHn('1234')
    expect(lookup).not.toBeNull()
    expect(lookup?.hn).toBe('0001234')
    expect(lookup?.isAlreadyInLtc).toBe(true)
    expect(lookup?.existingLtcId).toBe(1)
  })

  it('creates LTC registry and writes audit log', async () => {
    vi.mocked(apiGateway.app.query)
      .mockResolvedValueOnce([]) // duplicate check
      .mockResolvedValueOnce([
        {
          id: 10,
          hn: '0009999',
          patientName: 'นายทดสอบ บันทึก',
          adlScore: 12,
        },
      ] as any) // getById after insert

    vi.mocked(apiGateway.app.execute).mockResolvedValue({ affectedRows: 1, insertId: 10 })

    const res = await LtcRegistryService.createRegistry(
      {
        hn: '9999',
        patientName: 'นายทดสอบ บันทึก',
        adlScore: 12,
        areaZone: 'รพ.เถิน',
      },
      { username: 'nurse_joy', email: 'joy@thoen.go.th' }
    )

    expect(res.id).toBe(10)
    expect(apiGateway.app.execute).toHaveBeenCalled()
    expect(logAudit).toHaveBeenCalledWith(
      'CREATE',
      'long_term_care_registries',
      expect.stringContaining('0009999'),
      { username: 'nurse_joy', email: 'joy@thoen.go.th' }
    )
  })

  it('rejects duplicate LTC registration for same HN', async () => {
    vi.mocked(apiGateway.app.query).mockResolvedValueOnce([
      { id: 1, hn: '0001234', patientName: 'มีอยู่แล้ว' },
    ] as any)

    await expect(
      LtcRegistryService.createRegistry({
        hn: '0001234',
        patientName: 'คนใหม่',
      })
    ).rejects.toThrow('มีรายชื่อในทะเบียน Long Term Care (LTC) อยู่แล้ว')
  })

  it('updates LTC registry and invalidates cache', async () => {
    vi.mocked(apiGateway.app.query)
      .mockResolvedValueOnce([{ id: 1, hn: '0001234', patientName: 'ชื่อเดิม' }] as any) // getById
      .mockResolvedValueOnce([{ id: 1, hn: '0001234', patientName: 'ชื่อใหม่', adlScore: 15 }] as any) // getById after update

    vi.mocked(apiGateway.app.execute).mockResolvedValue({ affectedRows: 1, insertId: null })

    const updated = await LtcRegistryService.updateRegistry(1, { adlScore: 15 })
    expect(updated.adlScore).toBe(15)
    expect(apiGateway.app.execute).toHaveBeenCalled()
  })

  it('deletes LTC registry and writes audit log', async () => {
    vi.mocked(apiGateway.app.query).mockResolvedValueOnce([
      { id: 1, hn: '0001234', patientName: 'คนไข้ทดสอบ' },
    ] as any)

    vi.mocked(apiGateway.app.execute).mockResolvedValue({ affectedRows: 1, insertId: null })

    await LtcRegistryService.deleteRegistry(1, { username: 'admin' })
    expect(apiGateway.app.execute).toHaveBeenCalledWith(
      'DELETE FROM long_term_care_registries WHERE id = ?',
      [1]
    )
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'long_term_care_registries',
      expect.stringContaining('1'),
      { username: 'admin', email: undefined }
    )
  })

  it('checks isPatientInLtc using fast cache set', async () => {
    vi.mocked(apiGateway.app.query).mockResolvedValueOnce([
      { hn: '0001111' },
      { hn: '0002222' },
    ] as any)

    const is1 = await LtcRegistryService.isPatientInLtc('1111')
    expect(is1).toBe(true)

    const is2 = await LtcRegistryService.isPatientInLtc('0002222')
    expect(is2).toBe(true)

    const is3 = await LtcRegistryService.isPatientInLtc('9999')
    expect(is3).toBe(false)
  })

  it('syncWithHosxp verifies names and updates CID from HOSxP', async () => {
    vi.mocked(apiGateway.app.query).mockResolvedValueOnce([
      { id: 1, hn: '0001234', cid: null, patientName: 'นายใจดี ล้อมแรด' },
      { id: 2, hn: '0005678', cid: '1111111111111', patientName: 'นางชื่อผิด' },
    ] as any)

    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      {
        hn: '0001234',
        cid: '1520000000001',
        fname: 'ใจดี',
        lname: 'ล้อมแรด',
        pname: 'นาย',
        ptname: 'นายใจดี ล้อมแรด',
        age: 72,
      },
      {
        hn: '0005678',
        cid: '1520000000002',
        fname: 'สมศรี',
        lname: 'แม่วะ',
        pname: 'นาง',
        ptname: 'นางสมศรี แม่วะ',
        age: 80,
      },
    ] as any)

    const syncRes = await LtcRegistryService.syncWithHosxp(undefined, { username: 'testuser' })
    expect(syncRes.totalChecked).toBe(2)
    expect(syncRes.updatedCount).toBe(2)
    expect(syncRes.mismatches).toHaveLength(1)
    expect(syncRes.mismatches[0].hn).toBe('0005678')
    expect(apiGateway.app.transaction).toHaveBeenCalled()
  })

  describe('LtcRegistryService with Named APIs', () => {
    it('uses getLtcHns Named API when available', async () => {
      ;(apiGateway.app as any).getLtcHns = vi.fn().mockResolvedValueOnce({
        success: true,
        count: 2,
        data: ['0001234', '0005678'],
      })

      const set = await LtcRegistryService.getAllLtcHnSet()
      expect(set.has('0001234')).toBe(true)
      expect(set.has('0005678')).toBe(true)
      expect((apiGateway.app as any).getLtcHns).toHaveBeenCalled()
    })

    it('uses getLtcRegistries Named API when available', async () => {
      ;(apiGateway.app as any).getLtcRegistries = vi.fn().mockResolvedValueOnce({
        success: true,
        items: [{ id: 1, hn: '0001234', patientName: 'ใจดี' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        availableAreaZones: ['รพ.สต.ล้อมแรด'],
        stats: { total: 1, avgAdl: 10, zoneCounts: { 'รพ.สต.ล้อมแรด': 1 } },
      })

      const res = await LtcRegistryService.listRegistries({ search: 'ใจดี' })
      expect(res.items).toHaveLength(1)
      expect(res.stats.avgAdl).toBe(10)
      expect((apiGateway.app as any).getLtcRegistries).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ใจดี' })
      )
    })

    it('uses getLtcRegistryByHn Named API when available', async () => {
      ;(apiGateway.app as any).getLtcRegistryByHn = vi.fn().mockResolvedValueOnce({
        success: true,
        exists: true,
        data: { id: 5, hn: '0005555', patientName: 'นายทดสอบ' },
      })

      const rec = await LtcRegistryService.getRegistryByHn('5555')
      expect(rec).not.toBeNull()
      expect(rec?.id).toBe(5)
      expect((apiGateway.app as any).getLtcRegistryByHn).toHaveBeenCalledWith('0005555')
    })

    it('uses createLtcRegistry, updateLtcRegistry, and deleteLtcRegistry Named APIs when available', async () => {
      ;(apiGateway.app as any).getLtcRegistryByHn = vi.fn().mockResolvedValueOnce({
        success: true,
        exists: false,
        data: null,
      })
      ;(apiGateway.app as any).createLtcRegistry = vi.fn().mockResolvedValueOnce({
        success: true,
        insertId: 99,
      })
      ;(apiGateway.app as any).getLtcRegistryById = vi.fn().mockResolvedValue({
        success: true,
        data: { id: 99, hn: '0009999', patientName: 'คนใหม่' },
      })

      const created = await LtcRegistryService.createRegistry({
        hn: '9999',
        patientName: 'คนใหม่',
      })
      expect(created.id).toBe(99)
      expect((apiGateway.app as any).createLtcRegistry).toHaveBeenCalled()

      ;(apiGateway.app as any).updateLtcRegistry = vi.fn().mockResolvedValueOnce({
        success: true,
        affectedRows: 1,
      })
      const updated = await LtcRegistryService.updateRegistry(99, { patientName: 'คนใหม่ แก้ไข' })
      expect(updated.id).toBe(99)
      expect((apiGateway.app as any).updateLtcRegistry).toHaveBeenCalled()

      ;(apiGateway.app as any).deleteLtcRegistry = vi.fn().mockResolvedValueOnce({
        success: true,
        message: 'Deleted',
      })
      await LtcRegistryService.deleteRegistry(99)
      expect((apiGateway.app as any).deleteLtcRegistry).toHaveBeenCalledWith(99)
    })
  })
})

