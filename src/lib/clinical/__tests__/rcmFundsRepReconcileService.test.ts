import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  RcmFundsRepReconcileService,
  classifyStatementFund,
  extractRepPrefixCode,
  type FundsReconcileGatewayAdapter,
} from '../rcmFundsRepReconcileService'
import type { RepReconcileResult, VnReconcileDetails } from '../funds-reconcile/types'

const createMockReport = (overrides: Partial<RepReconcileResult> = {}): RepReconcileResult => ({
  range: { startDate: '2026-10-01', endDate: '2026-10-31' },
  summary: {
    totalLines: 3,
    uniqueRepCount: 3,
    uniqueVisitCount: 3,
    totalIncome: 2050,
    totalCompensated: 1800,
    totalDiff: -250,
    reimbursementRate: 87.8,
    seamlessCompensated: 350,
    eclaimCompensated: 1450,
    errorCount: 0,
    appealCount: 0,
    pendingRepCount: 0,
    dedupRemovedCount: 1,
    sourceBreakdown: [
      {
        source: 'repdata',
        label: 'REP หลัก (repdata)',
        lineCount: 1,
        uniqueRepCount: 1,
        totalIncome: 1200,
        totalCompensated: 1000,
      },
      {
        source: 'repeclaim',
        label: 'REP e-Claim (repeclaim)',
        lineCount: 1,
        uniqueRepCount: 1,
        totalIncome: 500,
        totalCompensated: 450,
      },
      {
        source: 'seamless',
        label: 'Seamless / DMIS (seamless)',
        lineCount: 1,
        uniqueRepCount: 1,
        totalIncome: 350,
        totalCompensated: 350,
      },
    ],
    fundCards: [
      {
        fundId: 'clopidogrel',
        code: 'CLOP',
        label: 'กองทุนยา Clopidogrel',
        shortLabel: 'Clopidogrel',
        category: 'disease_drug',
        href: '/service/dashboard-rcm/funds/clopidogrel/usage',
        repLineCount: 1,
        uniqueRepCount: 1,
        uniqueVisitCount: 1,
        totalIncome: 1200,
        totalCompensated: 1000,
        totalDiff: -200,
        reimbursementRate: 83.3,
        seamlessCompensated: 0,
        eclaimCompensated: 1000,
        seamlessLineCount: 0,
        eclaimLineCount: 1,
        errorCount: 0,
      },
      {
        fundId: 'ccs',
        code: 'CCS',
        label: 'คัดกรองมะเร็งปากมดลูก (CCS)',
        shortLabel: 'มะเร็งปากมดลูก',
        category: 'pp',
        href: '/service/dashboard-rcm/funds/ccs/2',
        repLineCount: 1,
        uniqueRepCount: 1,
        uniqueVisitCount: 1,
        totalIncome: 350,
        totalCompensated: 350,
        totalDiff: 0,
        reimbursementRate: 100,
        seamlessCompensated: 350,
        eclaimCompensated: 0,
        seamlessLineCount: 1,
        eclaimLineCount: 0,
        errorCount: 0,
      },
    ],
    repTypeBreakdown: [],
  },
  items: [
    {
      id: 'repdata:RD1:691000204:6901010002',
      visitKey: '6901010002',
      vn: '6901010002',
      an: null,
      hn: '000002',
      cid: '1100000000002',
      ptname: 'นาย ทดสอบ ยาหัวใจ',
      admdate: '2026-10-16',
      admdateThai: '16 ต.ค. 2569',
      department: 'OP',
      mainInscl: 'UCS',
      pttypeName: 'บัตรทอง UC',
      rep: '691000204',
      repPrefix: null,
      source: 'repdata',
      matchedSources: ['repdata', 'repeclaim'],
      repFund: 'UCS',
      repSubFund: 'OP',
      projectCode: null,
      primaryFundId: 'clopidogrel',
      primaryFundCode: 'CLOP',
      primaryFundLabel: 'Clopidogrel',
      matchedFundIds: ['clopidogrel'],
      matchedFundLabels: ['Clopidogrel'],
      matchReason: 'ADP 37999771001',
      adpCodes: ['37999771001'],
      income: 1200,
      compensated: 1000,
      diff: -200,
      percentPay: 83,
      errorCode: null,
      appeal: 'N',
      status: 'paid',
      eclaimNo: 'EC1002',
      eclaimStatus: null,
      eclaimIncome: 0,
      payNo: null,
      payDate: null,
      payDateThai: null,
      stmid: null,
      fileName: 'REP6910.xls',
    },
  ],
  totalCount: 3,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  availableFundCatalog: [],
  availableRepPrefixes: ['DCCS'],
  ...overrides,
})

describe('RcmFundsRepReconcileService & Fund Catalog (Zero-SQL Gateway Adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  describe('extractRepPrefixCode & classifyStatementFund', () => {
    it('extracts uppercase prefix from Seamless REP codes', () => {
      expect(extractRepPrefixCode('DCCS69010001')).toBe('DCCS')
      expect(extractRepPrefixCode('DDSA69093000090')).toBe('DDSA')
      expect(extractRepPrefixCode('691000204')).toBeNull()
    })

    it('prioritizes explicit Seamless prefix over secondary clinical ADP codes (Q11=A)', () => {
      const result = classifyStatementFund({
        rep: 'DCCS69010001',
        repFund: 'ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก',
        adpCodes: ['14001', '1B005'],
      })
      expect(result.primaryFundId).toBe('ccs')
      expect(result.matchedFundIds).toContain('ccs')
      expect(result.matchedFundIds).toContain('iron-supplements')
    })

    it('classifies generic UCS/PP repdata lines using HOSxP ADP codes', () => {
      const result = classifyStatementFund({
        rep: '691000204',
        repFund: 'UCS',
        adpCodes: ['37999771001'],
      })
      expect(result.primaryFundId).toBe('clopidogrel')
    })

    it('falls back to general when no specific fund matches', () => {
      const result = classifyStatementFund({
        rep: '691000204',
        repFund: 'OFC',
        adpCodes: [],
      })
      expect(result.primaryFundId).toBe('general')
    })
  })

  describe('getReconcileReport (API Gateway delegation & SWR caching)', () => {
    it('forwards normalized query params to Gateway adapter and caches response via SWR', async () => {
      const mockGateway: FundsReconcileGatewayAdapter = {
        getReconcileReport: vi.fn().mockResolvedValue(createMockReport()),
        getVnReconcileDetails: vi.fn().mockResolvedValue(null),
      }

      const first = await RcmFundsRepReconcileService.getReconcileReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          fundIds: ['ccs', 'anc'],
          sources: ['repdata', 'seamless'],
          repPrefixes: ['dccs'],
          page: 1,
          pageSize: 50,
        },
        mockGateway
      )

      expect(first.totalCount).toBe(3)
      expect(mockGateway.getReconcileReport).toHaveBeenCalledTimes(1)
      expect(mockGateway.getReconcileReport).toHaveBeenCalledWith(
        expect.objectContaining({
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          funds: 'anc,ccs',
          sources: 'repdata,seamless',
          repPrefixes: 'DCCS',
          page: 1,
          pageSize: 50,
        })
      )

      // Second identical call hits Next.js SWR cache -> zero additional Gateway calls
      const second = await RcmFundsRepReconcileService.getReconcileReport(
        {
          ds1: '2026-10-01',
          ds2: '2026-10-31',
          fundIds: ['anc', 'ccs'],
          sources: ['seamless', 'repdata'],
          repPrefixes: ['DCCS'],
          page: 1,
          pageSize: 50,
        },
        mockGateway
      )
      expect(second.totalCount).toBe(3)
      expect(mockGateway.getReconcileReport).toHaveBeenCalledTimes(1)
    })

    it('bypasses Next.js cache when refresh=true or exportAll=true', async () => {
      const mockGateway: FundsReconcileGatewayAdapter = {
        getReconcileReport: vi.fn().mockResolvedValue(createMockReport()),
        getVnReconcileDetails: vi.fn().mockResolvedValue(null),
      }

      await RcmFundsRepReconcileService.getReconcileReport(
        { ds1: '2026-10-01', ds2: '2026-10-31' },
        mockGateway
      )
      await RcmFundsRepReconcileService.getReconcileReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', refresh: true },
        mockGateway
      )
      await RcmFundsRepReconcileService.getReconcileReport(
        { ds1: '2026-10-01', ds2: '2026-10-31', exportAll: true },
        mockGateway
      )

      expect(mockGateway.getReconcileReport).toHaveBeenCalledTimes(3)
    })
  })

  describe('getVnReconcileDetails (API Gateway delegation)', () => {
    it('loads visit clinical metadata and REP lines across active sources via Gateway', async () => {
      const mockDetails: VnReconcileDetails = {
        visitKey: '6901010002',
        vn: '6901010002',
        an: null,
        hn: '000002',
        cid: '1100000000002',
        ptname: 'นาย ทดสอบ ยาหัวใจ',
        admdate: '2026-10-16',
        admdateThai: '16 ต.ค. 2569',
        department: 'OP',
        pttypeName: 'บัตรทอง UC',
        pdx: 'I251',
        dxList: ['I251'],
        adpItems: [],
        allRepLines: [
          {
            source: 'repdata',
            rep: '691000204',
            fund: 'UCS',
            subFund: 'OP',
            income: 1200,
            compensated: 1000,
            errorCode: null,
            appeal: 'N',
            eclaimNo: null,
            eclaimStatus: null,
            payNo: null,
            payDateThai: null,
            fileName: 'REP.xls',
          },
        ],
      }

      const mockGateway: FundsReconcileGatewayAdapter = {
        getReconcileReport: vi.fn(),
        getVnReconcileDetails: vi.fn().mockResolvedValue(mockDetails),
      }

      const details = await RcmFundsRepReconcileService.getVnReconcileDetails('6901010002', mockGateway)
      expect(details?.cid).toBe('1100000000002')
      expect(details?.allRepLines).toHaveLength(1)
      expect(details?.allRepLines[0].rep).toBe('691000204')
      expect(mockGateway.getVnReconcileDetails).toHaveBeenCalledWith('6901010002')
    })
  })
})
