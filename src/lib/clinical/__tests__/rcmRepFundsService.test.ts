import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmRepFundsService,
  formatThaiDate,
  formatDateYMD,
  maskHn,
  resolveMainInscl,
  formatFundLabel,
} from '../rcmRepFundsService'
import { apiGateway } from '@/lib/apiGateway'

vi.mock('@/lib/apiGateway', () => ({
  apiGateway: {
    clinical: {
      query: vi.fn(),
    },
  },
}))

describe('RcmRepFundsService helpers', () => {
  it('formats Thai date correctly with Buddhist Era', () => {
    const formatted = formatThaiDate('2026-10-25T12:00:00.000Z')
    expect(formatted).toContain('2569') // depending on local/UTC date
    expect(formatted).toMatch(/\d{1,2} [^\s]+ 2569/)
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
  })

  it('formats fund labels', () => {
    expect(formatFundLabel('UCS')).toBe('บัตรทอง (UCS)')
    expect(formatFundLabel('OFC')).toBe('ข้าราชการ (OFC)')
    expect(formatFundLabel('OPCS,OTCS')).toContain('ข้าราชการ')
    expect(formatFundLabel('IPLG,OTLG')).toContain('อปท.')
    expect(formatFundLabel(null)).toBe('ไม่ระบุกองทุน')
  })
})

describe('RcmRepFundsService queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches available fiscal years', async () => {
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      { YearBudget: '2570' },
      { YearBudget: '2569' },
    ])

    const years = await RcmRepFundsService.getAvailableYears()
    expect(years).toEqual(['2570', '2569'])
    expect(apiGateway.clinical.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT YearBudget')
    )
  })

  it('aggregates summary metrics, fund groups, and rep list', async () => {
    // 1. Available years
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      { YearBudget: '2570' },
    ])
    // 2. Metrics
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      {
        totalCases: 14,
        totalReps: 1,
        totalIncome: 166938.75,
        totalCompensated: 146984.16,
        totalDiff: -19954.59,
        pendingAppeals: 0,
        errorCount: 0,
      },
    ])
    // 3. Fund groups
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      {
        fundKey: 'IPCS,OTCS',
        subFundKey: '-',
        department: 'IP',
        caseCount: 14,
        totalIncome: 166938.75,
        totalCompensated: 146984.16,
        netDiff: -19954.59,
        appealCount: 0,
        errorCount: 0,
      },
    ])
    // 4. Rep list
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      {
        rep: '691000204',
        yearBudget: '2570',
        department: 'IP',
        fund: 'IPCS,OTCS',
        caseCount: 14,
        totalIncome: 166938.75,
        totalCompensated: 146984.16,
        netDiff: -19954.59,
        minDate: '2026-10-08T09:40:00.000Z',
        maxDate: '2026-10-25T12:00:00.000Z',
        appealCount: 0,
        errorCount: 0,
      },
    ])
    // 5. Available funds
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      {
        fundKey: 'IPCS,OTCS',
        cnt: 14,
      },
    ])

    const res = await RcmRepFundsService.getRepFundsSummary({ fiscalYear: '2570' })

    expect(res.metrics.totalCases).toBe(14)
    expect(res.metrics.totalIncome).toBe(166938.75)
    expect(res.metrics.totalCompensated).toBe(146984.16)
    expect(res.fundGroups).toHaveLength(1)
    expect(res.fundGroups[0].fundKey).toBe('IPCS,OTCS')
    expect(res.repList).toHaveLength(1)
    expect(res.repList[0].rep).toBe('691000204')
  })

  it('fetches patient cases by Rep', async () => {
    vi.mocked(apiGateway.clinical.query).mockResolvedValueOnce([
      {
        ID: '832703707',
        Rep: '691000204',
        HN: '0142232',
        PtName: 'นาย กฤษฎา สาริวงค์',
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
    ])

    const cases = await RcmRepFundsService.getRepCases({ rep: '691000204' })

    expect(cases).toHaveLength(1)
    expect(cases[0].rep).toBe('691000204')
    expect(cases[0].ptName).toBe('นาย กฤษฎา สาริวงค์')
    expect(cases[0].hn).toBe('0142232')
    expect(cases[0].income).toBe(3090)
    expect(cases[0].compensated).toBe(3621.62)
    expect(cases[0].status).toBe('paid')
  })
})
