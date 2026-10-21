import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MisHosService,
  MIS_HOS_MENU_CATEGORIES,
  THOEN_HOSPITAL_CODE,
} from '../misHosService'

describe('MisHosService', () => {
  beforeEach(() => {
    MisHosService.clearCache()
    vi.restoreAllMocks()
  })

  it('defines all 10 menu categories with valid submenus and template IDs', () => {
    expect(MIS_HOS_MENU_CATEGORIES.length).toBe(10) // 0, 0-eclaim, 1, 2, 3, 4, 5, 7, 8, 9
    const cat0 = MIS_HOS_MENU_CATEGORIES.find(c => c.id === '0')
    expect(cat0).toBeDefined()
    expect(cat0?.title).toContain('การโอนเงิน')
    expect(cat0?.submenus.some(s => s.id === '0.1' && s.stId === '1843')).toBe(true)
    expect(cat0?.submenus.some(s => s.id === '0.2' && s.stId === '1823')).toBe(true)

    const catEclaim = MIS_HOS_MENU_CATEGORIES.find(c => c.id === '0-eclaim')
    expect(catEclaim).toBeDefined()
    expect(catEclaim?.title).toContain('Eclaim')
  })

  it('fetches and decodes template configuration for a given st_id', async () => {
    const mockTemplateResponse = [
      {
        ST_ID: '1843',
        ST_TEMPLATENAME: 'การโอนเงินชดเชยค่าบริการ',
        ST_CONFIG: Buffer.from(
          JSON.stringify([
            { ssid: '1825', report_name: 'รายรับโอนเงินจาก สปสช.', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
            { ssid: '505', report_name: 'การโอนเงินรายเดือน', chart_type: 'bar', report_width: '6', flag_data: 'Y' }
          ])
        ).toString('base64'),
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockTemplateResponse),
    })

    const result = await MisHosService.getTemplateConfig('1843', {
      year: '2567',
      hcode: THOEN_HOSPITAL_CODE,
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(result).toBeDefined()
    expect(result?.templateName).toBe('การโอนเงินชดเชยค่าบริการ')
    expect(result?.subReports.length).toBe(2)
    expect(result?.subReports[0].ssid).toBe('1825')
  })

  it('fetches table data for an ssid and caches the result', async () => {
    const mockRecords = [
      { YEAR: '2567', BUDGET_UC: '120.02' },
      { YEAR: '2568', BUDGET_UC: '110.31' },
    ]

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockRecords)),
      json: vi.fn().mockResolvedValue(mockRecords),
    })

    // First call (fetches from upstream)
    const result1 = await MisHosService.getTableData('1825', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2567',
      province: '52',
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(result1.source).toBe('upstream')
    expect(result1.records.length).toBe(2)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call with same params (returns from in-memory cache)
    const result2 = await MisHosService.getTableData('1825', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2567',
      province: '52',
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(result2.source).toBe('cache')
    expect(result2.records.length).toBe(2)
    expect(mockFetch).toHaveBeenCalledTimes(1) // No new upstream request
  })

  it('bypasses cache when forceRefresh is true', async () => {
    const mockRecords = [{ YEAR: '2567', BUDGET_UC: '120.02' }]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockRecords)),
      json: vi.fn().mockResolvedValue(mockRecords),
    })

    await MisHosService.getTableData('1825', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2567',
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    // Force refresh
    const result = await MisHosService.getTableData('1825', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2567',
      forceRefresh: true,
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(result.source).toBe('upstream')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('fetches hospital info lookup from l_hospital_see.php', async () => {
    const mockHospitalResponse = [
      {
        HNAME: 'รพ.เถิน',
        PROVINCE_ID: '5200',
        PROVINCE_NAME: 'ลำปาง',
        NHSO_NAME: 'เชียงใหม่',
        NHSO_ZONE: '01',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockHospitalResponse),
    })

    const info = await MisHosService.getHospitalInfo(THOEN_HOSPITAL_CODE, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(info).toBeDefined()
    expect(info?.hname).toBe('รพ.เถิน')
    expect(info?.provinceName).toBe('ลำปาง')
    expect(info?.nhsoZone).toBe('01')
  })
})
