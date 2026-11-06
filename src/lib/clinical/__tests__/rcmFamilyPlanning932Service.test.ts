import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmFamilyPlanningService } from '../rcmFamilyPlanningService'

describe('RcmFamilyPlanningService - 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks ADP mapping for format 1 (FP001, FP002) and format 2 (20003, 20004)', async () => {
    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM s_drugitems')) {
        return Promise.resolve([
          { icode: '3000798', name: 'ห่วงอนามัย', strength: null, nhso_adp_code: 'FP001' },
          { icode: '3000799', name: 'ยาฝังคุมกำเนิด', strength: null, nhso_adp_code: 'FP002' },
        ])
      }
      return Promise.resolve([])
    })

    const result = await RcmFamilyPlanningService.checkFamilyPlanning932AdpMapping(
      'NEW_ECLAIM',
      mockExecutor
    )

    expect(result.isMapped).toBe(true)
    expect(result.mappedCount).toBe(2)
    expect(result.adpCodes).toEqual(['FP001', 'FP002'])
  })

  it('executes getFamilyPlanning932Report and aggregates data properly for women >= 20', async () => {
    const mockRows = [
      {
        vn: '6911060001',
        an: null,
        cid: '1509900111111',
        hn: '0000001',
        ptname: 'นาง สมใจ ดีงาม',
        sex: '2',
        age: 25,
        vstdate: '2026-11-06',
        vsttime: '09:00:00',
        pttypename: 'UCS:สิทธิบัตรทอง',
        authencode: 'AUTH001',
        department: 'แผนกสูติฯ',
        clinic: 'คลินิกวางแผนครอบครัว',
        income: 2500,
        drugname: 'ยาฝังคุมกำเนิด Implanon',
        drug_adp: 'FP002',
        listname: 'บริการฝังยาคุมกำเนิด',
        fp_adp: 'FP002',
        adpcode: 'FP002',
        dx: 'Z308',
        op: '992',
        compensated_eclaim: 2000,
        compensated_rep: 2000,
        compensated_nhso: 2000,
        rep_eclaim: 'E69001',
        rep_rep: 'REP69001',
        rep_nhso: 'INV69001',
        status: 'Rep :: ได้รับ Rep แล้ว',
      },
      {
        vn: '6911060002',
        an: null,
        cid: '1509900222222',
        hn: '0000002',
        ptname: 'นางสาว สมศรี รักเรียน',
        sex: 'หญิง',
        age: 22,
        vstdate: '2026-11-06',
        vsttime: '10:30:00',
        pttypename: 'UCS:สิทธิบัตรทอง',
        authencode: null,
        department: 'แผนกสูติฯ',
        clinic: 'คลินิกวางแผนครอบครัว',
        income: 1800,
        drugname: 'Norplant 6 หลอด',
        drug_adp: null,
        listname: 'บริการคุมกำเนิด',
        fp_adp: 'FP001',
        adpcode: 'FP001',
        dx: null, // Missing Dx
        op: null,
        compensated_eclaim: 0,
        compensated_rep: 0,
        compensated_nhso: 0,
        rep_eclaim: null,
        rep_rep: null,
        rep_nhso: null,
        status: '- :: ยังไม่ได้ส่ง',
      },
    ]

    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM s_drugitems') || sql.includes('FROM nondrugitems')) {
        return Promise.resolve([
          { icode: '3000798', name: 'ห่วงอนามัย', strength: null, nhso_adp_code: 'FP001' },
          { icode: '3000799', name: 'ยาฝังคุมกำเนิด', strength: null, nhso_adp_code: 'FP002' },
        ])
      }
      return Promise.resolve(mockRows)
    })

    const report = await RcmFamilyPlanningService.getFamilyPlanning932Report(
      {
        startDate: '2026-11-01',
        endDate: '2026-11-06',
        format: 'NEW_ECLAIM',
      },
      mockExecutor
    )

    expect(report.summary.totalCases).toBe(2)
    expect(report.summary.uniquePatients).toBe(2)
    expect(report.summary.totalIncome).toBe(4300)
    expect(report.summary.totalCompensated).toBe(2000)
    expect(report.summary.compensatedCount).toBe(1)
    expect(report.summary.uncompensatedCount).toBe(1)
    expect(report.summary.withAuthenCount).toBe(1)
    expect(report.summary.noAuthenCount).toBe(1)
    expect(report.summary.hasErrorCount).toBe(1)
    expect(report.items.length).toBe(2)

    // Check row 1 details
    expect(report.items[0].isCompensated).toBe(true)
    expect(report.items[0].hasAuthen).toBe(true)
    expect(report.items[0].hasError).toBe(false)

    // Check row 2 details
    expect(report.items[1].isCompensated).toBe(false)
    expect(report.items[1].hasAuthen).toBe(false)
    expect(report.items[1].hasError).toBe(true)
    expect(report.items[1].errorDetail).toContain('ไม่พบการลงรหัส Dx')
  })

  it('filters by cardFilter COMPENSATED and search keyword', async () => {
    const mockRows = [
      {
        vn: '6911060001',
        cid: '1509900111111',
        hn: '0000001',
        ptname: 'นาง สมใจ ดีงาม',
        sex: '2',
        age: 25,
        vstdate: '2026-11-06',
        pttypename: 'UCS',
        income: 2500,
        compensated_nhso: 2000,
        status: 'NHSO :: ได้รับ Invoice',
      },
      {
        vn: '6911060002',
        cid: '1509900222222',
        hn: '0000002',
        ptname: 'นางสาว สมศรี รักเรียน',
        sex: '2',
        age: 22,
        vstdate: '2026-11-06',
        pttypename: 'UCS',
        income: 1800,
        compensated_nhso: 0,
        status: '- :: ยังไม่ได้ส่ง',
      },
    ]

    const mockExecutor = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM s_drugitems') || sql.includes('FROM nondrugitems')) {
        return Promise.resolve([])
      }
      return Promise.resolve(mockRows)
    })

    const resultCompensated = await RcmFamilyPlanningService.getFamilyPlanning932Report(
      {
        startDate: '2026-11-01',
        endDate: '2026-11-06',
        cardFilter: 'COMPENSATED',
      },
      mockExecutor
    )

    expect(resultCompensated.items.length).toBe(1)
    expect(resultCompensated.items[0].vn).toBe('6911060001')

    const resultSearch = await RcmFamilyPlanningService.getFamilyPlanning932Report(
      {
        startDate: '2026-11-01',
        endDate: '2026-11-06',
        search: 'สมศรี',
      },
      mockExecutor
    )

    expect(resultSearch.items.length).toBe(1)
    expect(resultSearch.items[0].ptname).toBe('นางสาว สมศรี รักเรียน')
  })
})
