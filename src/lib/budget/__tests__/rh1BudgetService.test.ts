import { describe, it, expect } from 'vitest'
import { Rh1BudgetService, THOEN_HOSPITAL_CODE, Rh1Dataset } from '../rh1BudgetService'

describe('Rh1BudgetService', () => {
  it('returns available fiscal years sorted descending', () => {
    const years = Rh1BudgetService.getAvailableFiscalYears()
    expect(years).toContain('2570')
    expect(years).toContain('2569')
    expect(Number(years[0])).toBeGreaterThanOrEqual(Number(years[1]))
  })

  it('correctly retrieves Thoen Hospital details', () => {
    const { hospital, index } = Rh1BudgetService.getHospitalByCode('2569', THOEN_HOSPITAL_CODE)
    expect(hospital.c).toBe(11152)
    expect(hospital.n).toBe('รพ.เถิน')
    expect(hospital.p).toBe('ลำปาง')
    expect(hospital.l).toBe('M2')
    expect(hospital.g).toBe('รพช.M2 B<=100')
    expect(hospital.u).toBe(39341)
    expect(index).toBeGreaterThanOrEqual(0)
  })

  it('retrieves peer hospitals in the same service group', () => {
    const peers = Rh1BudgetService.getPeerHospitals('2569', 'รพช.M2 B<=100')
    expect(peers.length).toBe(5)
    const names = peers.map(p => p.hospital.n)
    expect(names).toContain('รพ.เถิน')
    expect(names).toContain('รพ.หางดง')
    expect(names).toContain('รพ.ป่าซาง')
  })

  it('calculates Executive Summary for Thoen Hospital in FY 2569', () => {
    const summary = Rh1BudgetService.getExecutiveSummary('2569', THOEN_HOSPITAL_CODE)
    expect(summary.hospital.c).toBe(THOEN_HOSPITAL_CODE)
    expect(summary.peerGroupLabel).toBe('รพช.M2 B<=100')
    expect(summary.peers.length).toBe(5)
    expect(summary.stats.totalCompensation).toBeGreaterThan(0)
    expect(summary.stats.ucPopulation).toBe(39341)
    expect(summary.stats.rankInGroup).toBeGreaterThanOrEqual(1)
    expect(summary.stats.rankInGroup).toBeLessThanOrEqual(5)

    // Check classification lists
    expect(Array.isArray(summary.goodItems)).toBe(true)
    expect(Array.isArray(summary.opportunityItems)).toBe(true)
    expect(Array.isArray(summary.zeroActionableItems)).toBe(true)

    // Verify opportunity items have positive potential revenue gain
    summary.opportunityItems.forEach(opp => {
      expect(opp.status).toBe('opp')
      expect(opp.upHigh).toBeGreaterThanOrEqual(0)
    })
  })

  it('calculates L1 Fund Overview for Thoen Hospital', () => {
    const l1 = Rh1BudgetService.getFundOverviewL1('2569', THOEN_HOSPITAL_CODE)
    expect(l1.length).toBeGreaterThan(0)
    const opFund = l1.find(f => f.name.includes('ผู้ป่วยนอก') || f.name.includes('ค่าบริการ'))
    expect(opFund).toBeDefined()
    if (opFund) {
      expect(opFund.peerValues.length).toBe(5)
      expect(opFund.hospitalAmount).toBeGreaterThan(0)
    }
  })

  it('allows dynamic registration of a new fiscal year dataset (Plug-and-Play)', () => {
    const mockDataset: Rh1Dataset = {
      H: [
        { c: 11152, n: 'รพ.เถิน', p: 'ลำปาง', t: 'รพช.', l: 'M2', b: 81, u: 40000, g: 'รพช.M2 B<=100' },
        { c: 99999, n: 'รพ.ทดสอบ', p: 'ลำปาง', t: 'รพช.', l: 'M2', b: 80, u: 30000, g: 'รพช.M2 B<=100' },
      ],
      S: {
        L1: {
          keys: [{ id: '1|1', m: '1', name: 'กองทุนทดสอบ' }],
          mains: [{ id: '1', name: 'กองทุนทดสอบหลัก' }],
          parts: ['—'],
          allLabel: 'รวม',
          flat: false,
          ordered: false,
          recs: [[0, 0, 500000], [1, 0, 300000]],
        },
      },
      asof: 'Mock 2568',
    }

    Rh1BudgetService.registerFiscalYear('2568', mockDataset)
    expect(Rh1BudgetService.getAvailableFiscalYears()).toContain('2568')

    const thoen2568 = Rh1BudgetService.getHospitalByCode('2568', 11152)
    expect(thoen2568.hospital.u).toBe(40000)

    const l1 = Rh1BudgetService.getFundOverviewL1('2568', 11152)
    expect(l1.length).toBe(1)
    expect(l1[0].hospitalAmount).toBe(500000)
  })
})
