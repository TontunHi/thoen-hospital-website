import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MisHosService,
  MIS_HOS_MENU_CATEGORIES,
  THOEN_HOSPITAL_CODE,
  calculateThaiFiscalYear,
  getAvailableMisHosFiscalYears,
  toMisHosCeYear,
} from '../misHosService'

describe('MisHosService', () => {
  beforeEach(() => {
    MisHosService.clearCache()
    vi.restoreAllMocks()
  })

  it('converts Thai Buddhist year (พ.ศ.) to Christian era (ค.ศ.) for upstream SQL queries', () => {
    expect(toMisHosCeYear('2570')).toBe('2027')
    expect(toMisHosCeYear('2569')).toBe('2026')
    expect(toMisHosCeYear('2568')).toBe('2025')
    expect(toMisHosCeYear('2026')).toBe('2026')
  })

  it('calculates current Thai fiscal year dynamically and lists available fiscal years', () => {
    const currentFY = calculateThaiFiscalYear()
    expect(currentFY).toBeDefined()
    expect(Number(currentFY)).toBeGreaterThanOrEqual(2569)

    const years = getAvailableMisHosFiscalYears(11)
    expect(years.length).toBe(11)
    expect(years[0]).toBe(currentFY)
    expect(Number(years[0])).toBeGreaterThan(Number(years[1]))
    expect(years).toContain('2569')
    expect(years).toContain('2568')
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
    expect(catEclaim?.submenus.some(s => s.id === '0-ec-1' && s.stId === '404' && s.secondaryStId === '945')).toBe(true)
    expect(catEclaim?.submenus.some(s => s.id === '0-ec-2' && s.stId === '424' && s.secondaryStId === '948')).toBe(true)

    const cat7 = MIS_HOS_MENU_CATEGORIES.find(c => c.id === '7')
    expect(cat7).toBeDefined()
    expect(cat7?.submenus.length).toBe(6) // 7.1 to 7.6
    expect(cat7?.submenus.some(s => s.id === '7.4' && s.stId === '503' && s.secondaryStId === '1465')).toBe(true)
    expect(cat7?.submenus.some(s => s.id === '7.5' && s.stId === '1164' && s.secondaryStId === '1525')).toBe(true)
    expect(cat7?.submenus.some(s => s.id === '7.6' && s.stId === '2207')).toBe(true)

    const cat1_3 = MIS_HOS_MENU_CATEGORIES.find(c => c.id === '1')?.submenus.find(s => s.id === '1.3')
    expect(cat1_3?.stId).toBe('1631')
    expect(cat1_3?.secondaryStId).toBe('1483')
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
      text: vi.fn().mockResolvedValue(JSON.stringify(mockTemplateResponse)),
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
    // 2 fetch calls made in parallel: get_tabledata + chart_get
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Second call with same params (returns from in-memory cache)
    const result2 = await MisHosService.getTableData('1825', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2567',
      province: '52',
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(result2.source).toBe('cache')
    expect(result2.records.length).toBe(2)
    expect(mockFetch).toHaveBeenCalledTimes(2) // No new upstream request
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
    // 2 calls initially + 1 new data call on force refresh (chartConfig cache preserved or re-evaluated)
    expect(mockFetch).toHaveBeenCalledTimes(3)
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
      text: vi.fn().mockResolvedValue(JSON.stringify(mockHospitalResponse)),
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

  it('synthesizes sub-reports for High Cost modules and fetches from custom endpoints', async () => {
    // 1. Template config for STEMI (1468)
    const mockEmptyTemplate = [{ ST_ID: '1468', ST_TEMPLATENAME: 'STEMI', ST_CONFIG: '' }]
    const mockTplFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockEmptyTemplate)),
    })

    const tplConfig = await MisHosService.getTemplateConfig('1468', {
      fetchImpl: mockTplFetch as unknown as typeof fetch,
    })

    expect(tplConfig).toBeDefined()
    expect(tplConfig?.subReports.length).toBe(2)
    expect(tplConfig?.subReports[0].ssid).toBe('custom:m0401_stemi_year')

    // 2. Custom Table Data Fetch
    const mockCustomRecords = [
      { YEAR: '2568', NUMPT_STEMI: 14, ACTAMT_STEMI: 140000 },
    ]
    const mockDataFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockCustomRecords)),
    })

    const dataResult = await MisHosService.getTableData('custom:m0401_stemi_year', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2569',
      fetchImpl: mockDataFetch as unknown as typeof fetch,
    })

    expect(dataResult.records.length).toBe(1)
    expect(dataResult.records[0].NUMPT_STEMI).toBe(14)
    expect(dataResult.chartConfig?.yaxis).toBe('บาท')
    // Verify custom URL was called
    expect(mockDataFetch).toHaveBeenCalledWith(
      expect.stringContaining('m0401_stemi_year.php'),
      expect.objectContaining({
        body: JSON.stringify({ data1: THOEN_HOSPITAL_CODE, year: '2026' }),
      })
    )
  })

  it('robustly extracts JSON array even when PHP warnings or HTML prepend the response', async () => {
    const rawPhpWarningOutput =
      '<br /><b>Warning</b>: oci_execute(): ORA-00942 in m_function.php on line 59<br />[{"YEAR":"2567","SUM_AMT":"50000"}]'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(rawPhpWarningOutput),
    })

    const result = await MisHosService.getTableData('946', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2567',
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(result.records.length).toBe(1)
    expect(result.records[0].SUM_AMT).toBe('50000')
  })

  it('falls back to secondaryStId when primary template returns 0 sub-reports', async () => {
    // Primary 1483 returns empty ST_CONFIG
    const mockPrimaryResponse = [
      { ST_ID: '1483', ST_TEMPLATENAME: 'P1.3-ชดเชยกรณีค่าพาหนะ', ST_CONFIG: '' },
    ]
    // Secondary 1631 returns 4 sub-reports
    const mockSecondaryResponse = [
      {
        ST_ID: '1631',
        ST_TEMPLATENAME: 'ชดเชยกรณีค่าพาหนะ (CAR-Refer)',
        ST_CONFIG: Buffer.from(
          JSON.stringify([
            { ssid: '1632', report_name: 'ค่าพาหนะส่งต่อ แยกตามเดือน', chart_type: 'table', report_width: '6', flag_data: 'Y' },
            { ssid: '1648', report_name: 'ค่าพาหนะส่งต่อ แยกตามหน่วยบริการ', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
          ])
        ).toString('base64'),
      },
    ]

    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || '{}')
      if (body.st_id === '1483') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockPrimaryResponse)),
        })
      }
      if (body.st_id === '1631') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockSecondaryResponse)),
        })
      }
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('[]') })
    })

    const config = await MisHosService.getTemplateConfig('1483', {
      secondaryStId: '1631',
      hcode: THOEN_HOSPITAL_CODE,
      year: '2569',
      fetchImpl: mockFetch as unknown as typeof fetch,
    })

    expect(config).toBeDefined()
    expect(config?.subReports.length).toBe(2)
    expect(config?.subReports[0].ssid).toBe('1632')
  })
})
