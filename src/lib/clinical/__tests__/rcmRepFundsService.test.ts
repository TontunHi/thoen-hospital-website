import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmRepFundsService,
  formatThaiDate,
  formatDateYMD,
  maskHn,
  resolveMainInscl,
  formatFundLabel,
  normalizeRepSource,
} from '../rcmRepFundsService'
import { apiGateway } from '@/lib/apiGateway'
import { clearMemoryCache } from '@/lib/cache'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    clinical: {
      getRepFundsYears: vi.fn(),
      getRepFundsSummary: vi.fn(),
      getRepFundsCases: vi.fn(),
      lookupPatientClaims: vi.fn(),
    },
  },
}))

describe('RcmRepFundsService helpers', () => {
  it('normalizes rep data sources safely', () => {
    expect(normalizeRepSource(undefined)).toBe('repdata')
    expect(normalizeRepSource('REPDATA')).toBe('repdata')
    expect(normalizeRepSource('repeclaim')).toBe('repeclaim')
    expect(normalizeRepSource('Seamless')).toBe('seamless')
    expect(normalizeRepSource('unknown_table')).toBe('repdata')
  })

  it('formats Thai date correctly with Buddhist Era', () => {
    const formatted = formatThaiDate('2026-10-25T12:00:00.000Z')
    expect(formatted).toContain('2569')
    expect(formatted).toMatch(/\d{1,2} [^\s]+ 2569/)
    expect(formatDateYMD('2026-10-25T12:00:00.000Z')).toMatch(/2026-10-25/)
  })

  it('masks HN protecting PDPA', () => {
    expect(maskHn('0142232')).toBe('xx-xxx32')
    expect(maskHn('0012345')).toBe('xx-xxx45')
    expect(maskHn('12')).toBe('xx-12')
    expect(maskHn(null)).toBe('xx-xxxxx')
  })

  it('resolves main fund category', () => {
    expect(resolveMainInscl('OPCS,OTCS')).toBe('OFC')
    expect(resolveMainInscl('IPLG,OTLG')).toBe('LGO')
    expect(resolveMainInscl('SSS')).toBe('SSS')
    expect(resolveMainInscl('STP')).toBe('STP')
    expect(resolveMainInscl('IP01')).toBe('UCS')
    expect(resolveMainInscl('WEL')).toBe('UCS')
  })

  it('formats fund labels', () => {
    expect(formatFundLabel('UCS')).toBe('บัตรทอง (UCS)')
    expect(formatFundLabel('OFC')).toBe('ข้าราชการ (OFC)')
    expect(formatFundLabel('OPCS,OTCS')).toContain('ข้าราชการ')
    expect(formatFundLabel('IPLG,OTLG')).toContain('อปท.')
    expect(formatFundLabel('ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ')).toBe(
      'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ'
    )
    expect(formatFundLabel(null)).toBe('ไม่ระบุกองทุน')
  })
})

describe('RcmRepFundsService multi-source queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('fetches available fiscal years scoped to source table', async () => {
    vi.mocked(apiGateway.clinical.getRepFundsYears).mockResolvedValueOnce({
      success: true,
      data: ['2570', '2569'],
    })

    const years = await RcmRepFundsService.getAvailableYears('repeclaim')
    expect(years).toEqual(['2570', '2569'])
    expect(apiGateway.clinical.getRepFundsYears).toHaveBeenCalledWith('repeclaim')
  })

  it('aggregates summary metrics and available funds for repdata', async () => {
    vi.mocked(apiGateway.clinical.getRepFundsYears).mockResolvedValueOnce({
      success: true,
      data: ['2570'],
    })
    vi.mocked(apiGateway.clinical.getRepFundsSummary).mockResolvedValueOnce({
      success: true,
      data: {
        metrics: {
          totalCases: 14,
          totalReps: 1,
          totalIncome: 166938.75,
          totalCompensated: 146984.16,
          totalDiff: -19954.59,
          pendingAppeals: 0,
          errorCount: 0,
        },
        availableFunds: [{ fundKey: 'IPCS,OTCS', cnt: 14 }],
      },
    })

    const res = await RcmRepFundsService.getRepFundsSummary({
      source: 'repdata',
      fiscalYear: '2570',
    })

    expect(res.source).toBe('repdata')
    expect(res.metrics.totalCases).toBe(14)
    expect(res.metrics.totalIncome).toBe(166938.75)
    expect(res.metrics.totalCompensated).toBe(146984.16)
    expect(res.availableFunds).toHaveLength(1)
    expect(res.availableFunds[0].key).toBe('IPCS,OTCS')
  })

  it('queries summary and cases from rcmdb.seamless using Collected, Note, and AdmDate', async () => {
    vi.mocked(apiGateway.clinical.getRepFundsYears).mockResolvedValueOnce({
      success: true,
      data: ['2569'],
    })
    vi.mocked(apiGateway.clinical.getRepFundsSummary).mockResolvedValueOnce({
      success: true,
      data: {
        metrics: {
          totalCases: 20,
          totalReps: 2,
          totalIncome: 12000,
          totalCompensated: 9500,
          totalDiff: -2500,
          pendingAppeals: 3,
          errorCount: 4,
        },
        availableFunds: [{ fundKey: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ', cnt: 20 }],
      },
    })

    const summary = await RcmRepFundsService.getRepFundsSummary({
      source: 'seamless',
      ds1: '2026-10-01',
      ds2: '2026-10-31',
      status: 'has_error',
    })

    expect(summary.source).toBe('seamless')
    expect(summary.metrics.totalCases).toBe(20)
    expect(summary.metrics.errorCount).toBe(4)
    expect(apiGateway.clinical.getRepFundsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'seamless',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
      })
    )

    vi.mocked(apiGateway.clinical.getRepFundsCases).mockResolvedValueOnce({
      success: true,
      data: [
        {
          ID: 'SM_001',
          Rep: 'DDSA69093000090',
          HN: '0000001',
          PtName: 'นาย ทดสอบ ระบบ',
          AdmDate: '2026-10-15',
          Department: 'OP',
          Income: 500,
          Compensated: 350,
          Diff: -150,
          Fund: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
          SubFund: 'บริการคนพิการ',
          ErrorCode: 'DS305',
          MainInscl: 'WEL',
          PayNo: 'DDSA6941090041',
          PayDate: '2026-10-25',
          SeamlessStatus: 'ชดเชย',
        },
      ],
    })

    const cases = await RcmRepFundsService.getRepCases({
      source: 'seamless',
      fiscalYear: '2570',
    })

    expect(cases).toHaveLength(1)
    expect(cases[0].source).toBe('seamless')
    expect(cases[0].rep).toBe('DDSA69093000090')
    expect(cases[0].mainInscl).toBe('UCS')
    expect(cases[0].payNo).toBe('DDSA6941090041')
    expect(cases[0].errorCode).toBe('DS305')
  })

  it('fetches patient cases from rcmdb.repeclaim by Rep and custom date range', async () => {
    vi.mocked(apiGateway.clinical.getRepFundsCases).mockResolvedValueOnce({
      success: true,
      data: [
        {
          ID: '832703707',
          Rep: '691000204',
          HN: '0000002',
          PtName: 'นาง ตัวอย่าง ทดสอบ',
          AdmDate: '2026-10-24T22:01:00.000Z',
          DchDate: '2026-10-25T12:00:00.000Z',
          Department: 'IP',
          Income: 3090,
          Compensated: 3621.62,
          Diff: 531.62,
          Fund: 'IPCS,OTCS',
          SubFund: null,
          ErrorCode: null,
          Appeal: null,
          YearBudget: '2570',
        },
      ],
    })

    const cases = await RcmRepFundsService.getRepCases({
      source: 'repeclaim',
      rep: '691000204',
      ds1: '2026-10-01',
      ds2: '2026-10-31',
    })

    expect(cases).toHaveLength(1)
    expect(cases[0].source).toBe('repeclaim')
    expect(cases[0].rep).toBe('691000204')
    expect(cases[0].status).toBe('paid')
    expect(apiGateway.clinical.getRepFundsCases).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'repeclaim',
        rep: '691000204',
        ds1: '2026-10-01',
        ds2: '2026-10-31',
      })
    )
  })
})
