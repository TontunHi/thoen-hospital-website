import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/apiGateway', () => {
  return {
    apiGateway: {
      app: {
        getLtcHns: vi.fn(),
        getLtcRegistries: vi.fn(),
        getLtcRegistryById: vi.fn(),
        getLtcRegistryByHn: vi.fn(),
        createLtcRegistry: vi.fn(),
        updateLtcRegistry: vi.fn(),
        deleteLtcRegistry: vi.fn(),
        lookupLtcPatientByHn: vi.fn(),
        syncLtcWithHosxp: vi.fn(),
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

  it('lists LTC registries via Gateway Named API', async () => {
    vi.mocked(apiGateway.app.getLtcRegistries).mockResolvedValueOnce({
      success: true,
      items: [{ id: 1, hn: '0001234', patientName: 'นายใจดี ล้อมแรด', adlScore: 8 }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      availableAreaZones: ['รพ.สต.ล้อมแรด', 'รพ.สต.แม่วะ'],
      stats: { total: 1, avgAdl: 8, zoneCounts: { 'รพ.สต.ล้อมแรด': 1 } },
    })

    const result = await LtcRegistryService.listRegistries({ search: 'ใจดี' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].hn).toBe('0001234')
    expect(result.stats.total).toBe(1)
    expect(result.stats.avgAdl).toBe(8)
    expect(result.availableAreaZones).toEqual(['รพ.สต.ล้อมแรด', 'รพ.สต.แม่วะ'])
    expect(apiGateway.app.getLtcRegistries).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ใจดี' })
    )
  })

  it('looks up patient from HOSxP via Gateway Named API and flags existing LTC status', async () => {
    vi.mocked(apiGateway.app.lookupLtcPatientByHn).mockResolvedValueOnce({
      hn: '0001234',
      cid: '1520000000001',
      patientName: 'นายใจดี ล้อมแรด',
      address: '12',
      moo: '1',
      tambon: 'ล้อมแรด',
      age: 72,
      isAlreadyInLtc: true,
      existingLtcId: 1,
      isPalliative: false,
    })

    const lookup = await LtcRegistryService.lookupPatientByHn('1234')
    expect(lookup).not.toBeNull()
    expect(lookup?.hn).toBe('0001234')
    expect(lookup?.isAlreadyInLtc).toBe(true)
    expect(lookup?.existingLtcId).toBe(1)
  })

  it('creates LTC registry via Gateway Named API and writes audit log', async () => {
    vi.mocked(apiGateway.app.getLtcRegistryByHn).mockResolvedValueOnce({
      success: true,
      exists: false,
      data: null,
    })
    vi.mocked(apiGateway.app.createLtcRegistry).mockResolvedValueOnce({
      success: true,
      insertId: 10,
    })
    vi.mocked(apiGateway.app.getLtcRegistryById).mockResolvedValueOnce({
      success: true,
      data: {
        id: 10,
        hn: '0009999',
        patientName: 'นายทดสอบ บันทึก',
        adlScore: 12,
      },
    })

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
    expect(apiGateway.app.createLtcRegistry).toHaveBeenCalled()
    expect(logAudit).toHaveBeenCalledWith(
      'CREATE',
      'long_term_care_registries',
      expect.stringContaining('0009999'),
      { username: 'nurse_joy', email: 'joy@thoen.go.th' }
    )
  })

  it('rejects duplicate LTC registration for same HN', async () => {
    vi.mocked(apiGateway.app.getLtcRegistryByHn).mockResolvedValueOnce({
      success: true,
      exists: true,
      data: { id: 1, hn: '0001234', patientName: 'มีอยู่แล้ว' },
    })

    await expect(
      LtcRegistryService.createRegistry({
        hn: '0001234',
        patientName: 'คนใหม่',
      })
    ).rejects.toThrow('มีรายชื่อในทะเบียน Long Term Care (LTC) อยู่แล้ว')
  })

  it('updates LTC registry via Gateway Named API and invalidates cache', async () => {
    vi.mocked(apiGateway.app.getLtcRegistryById)
      .mockResolvedValueOnce({ success: true, data: { id: 1, hn: '0001234', patientName: 'ชื่อเดิม' } })
      .mockResolvedValueOnce({ success: true, data: { id: 1, hn: '0001234', patientName: 'ชื่อใหม่', adlScore: 15 } })
    vi.mocked(apiGateway.app.updateLtcRegistry).mockResolvedValueOnce({ success: true, affectedRows: 1 })

    const updated = await LtcRegistryService.updateRegistry(1, { adlScore: 15 })
    expect(updated.adlScore).toBe(15)
    expect(apiGateway.app.updateLtcRegistry).toHaveBeenCalled()
  })

  it('deletes LTC registry via Gateway Named API and writes audit log', async () => {
    vi.mocked(apiGateway.app.getLtcRegistryById).mockResolvedValueOnce({
      success: true,
      data: { id: 1, hn: '0001234', patientName: 'คนไข้ทดสอบ' },
    })
    vi.mocked(apiGateway.app.deleteLtcRegistry).mockResolvedValueOnce({ success: true, message: 'Deleted' })

    await LtcRegistryService.deleteRegistry(1, { username: 'admin' })
    expect(apiGateway.app.deleteLtcRegistry).toHaveBeenCalledWith(1)
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'long_term_care_registries',
      expect.stringContaining('1'),
      { username: 'admin', email: undefined }
    )
  })

  it('checks isPatientInLtc using fast cache set from getLtcHns', async () => {
    vi.mocked(apiGateway.app.getLtcHns).mockResolvedValueOnce({
      success: true,
      count: 2,
      data: ['0001111', '0002222'],
    })

    expect(await LtcRegistryService.isPatientInLtc('1111')).toBe(true)
    expect(await LtcRegistryService.isPatientInLtc('0002222')).toBe(true)
    expect(await LtcRegistryService.isPatientInLtc('9999')).toBe(false)
    expect(apiGateway.app.getLtcHns).toHaveBeenCalledTimes(1)
  })

  it('syncWithHosxp delegates to Gateway Named API and writes audit log', async () => {
    vi.mocked(apiGateway.app.syncLtcWithHosxp).mockResolvedValueOnce({
      totalChecked: 2,
      updatedCount: 2,
      mismatches: [
        {
          hn: '0005678',
          currentName: 'นางชื่อผิด',
          hosName: 'นางสมศรี แม่วะ',
          cid: '1520000000002',
        },
      ],
    })

    const syncRes = await LtcRegistryService.syncWithHosxp(undefined, { username: 'testuser' })
    expect(syncRes.totalChecked).toBe(2)
    expect(syncRes.updatedCount).toBe(2)
    expect(syncRes.mismatches).toHaveLength(1)
    expect(syncRes.mismatches[0].hn).toBe('0005678')
    expect(logAudit).toHaveBeenCalled()
  })
})
