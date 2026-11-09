import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmAmedHomewardService,
  type HomewardReportParams,
} from '../rcmAmedHomewardService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmAmedHomewardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-homeward-report-2026-10-01-2027-09-30')
  })

  const mockRows = [
    {
      rep: 'REP1001',
      rep_remark: 'ผ่านการตรวจสอบ',
      invoice: 'INV2001',
      onweb_cid: '1520800099251',
      anonweb: '690006884',
      an: '690006884',
      hn: '0048017',
      cid: '1520800099251',
      ptname: 'นาย ประสิทธิ์ แสนสุข',
      sex_code: '1',
      birthday: '1970-05-12',
      age: 56,
      nation: '99:ไทย',
      admdate: '2026-10-01',
      dchdate: '2026-10-05',
      los: 4,
      editdate: '2026-10-06 10:00',
      day_diff: 1,
      ward: '04 ห้องพิเศษ',
      bedno: 'V01',
      clinic: 'อายุรกรรม',
      prediag: 'Pneumonia',
      pdx: 'J189',
      pdxname: 'Pneumonia, unspecified',
      sdx: 'I10, E119',
      proc_code: '9604',
      adjrw: 1.5432,
      admdoctor: 'นพ.สมชาย',
      dchdoctor: 'นพ.สมชาย',
      authencode: 'AUTH1111',
      pttype_eclaim_id: '01',
      pttype_eclaim_name: 'UC ใน CUP',
      pttype: '77',
      pttypename: 'บัตรทอง ผู้สูงอายุ ในเขต',
      copttype: '77',
      gfmis: '80074',
      accountcode: '1102050101.202',
      pttypeno: 'ท7721768054',
      hospmain: '11152:โรงพยาบาลเถิน',
      hospsub: '06195:รพ.สต.บ้านเด่นแก้ว',
      dchstts: 'Improved',
      dchtype: 'With Approval',
      summary_status: 'สรุปแล้ว',
      income: 12500,
      uc_money: 12000,
      discount_money: 0,
      paid_money: 500,
      rcpt_money: 500,
      rcpno: '500:001',
      debit: 12000,
      max_debt_amount: 12000,
      follow_money: 0,
      bill: 'BILL01#0',
      billdate: '2026-10-05',
      staff: 'เจ้าหน้าที่ ก',
      address: '123 หมู่ 1 ต.ล้อมแรด',
      mobile: '0812345678',
      tel: '054123456',
    },
    {
      rep: null,
      rep_remark: null,
      invoice: null,
      onweb_cid: null,
      anonweb: null,
      an: '690006933',
      hn: '0016208',
      cid: '3520800038894',
      ptname: 'นาง สมศรี มีโชค',
      sex_code: '2',
      birthday: '1985-08-20',
      age: 41,
      nation: '99:ไทย',
      admdate: '2026-10-02',
      dchdate: '2026-10-06',
      los: 4,
      editdate: null,
      day_diff: 0,
      ward: '06 หอผู้ป่วยสามัญ',
      bedno: '05',
      clinic: 'ศัลยกรรม',
      prediag: 'Appendicitis',
      pdx: 'K358',
      pdxname: 'Acute appendicitis',
      sdx: null,
      proc_code: '4709',
      adjrw: 0.9854,
      admdoctor: 'พญ.วันดี',
      dchdoctor: 'พญ.วันดี',
      authencode: '',
      pttype_eclaim_id: '01',
      pttype_eclaim_name: 'UC ใน CUP',
      pttype: '71',
      pttypename: 'บัตรทอง นอกเขต',
      copttype: '71',
      gfmis: '80074',
      accountcode: '1102050101.202',
      pttypeno: 'ท7123456',
      hospmain: '11152:โรงพยาบาลเถิน',
      hospsub: '11152:โรงพยาบาลเถิน',
      dchstts: 'Recovered',
      dchtype: 'With Approval',
      summary_status: 'รอสรุป',
      income: 8000,
      uc_money: 8000,
      discount_money: 0,
      paid_money: 0,
      rcpt_money: 0,
      rcpno: '',
      debit: 0,
      max_debt_amount: null,
      follow_money: 0,
      bill: null,
      billdate: null,
      staff: 'เจ้าหน้าที่ ข',
      address: '456 หมู่ 2 ต.เถินบุรี',
      mobile: '0898765432',
      tel: '',
    },
    {
      rep: 'REP1002',
      rep_remark: null,
      invoice: null,
      onweb_cid: null,
      anonweb: null,
      an: '690006941',
      hn: '0145521',
      cid: '5341100001849',
      ptname: 'นาย มงคล ร่ำรวย',
      sex_code: '1',
      birthday: '1960-12-01',
      age: 65,
      nation: '99:ไทย',
      admdate: '2026-10-03',
      dchdate: '2026-10-08',
      los: 5,
      editdate: '2026-10-09 14:00',
      day_diff: 1,
      ward: '04 ห้องพิเศษ',
      bedno: 'V02',
      clinic: 'อายุรกรรม',
      prediag: 'Heart Failure',
      pdx: 'I500',
      pdxname: 'Congestive heart failure',
      sdx: 'I10',
      proc_code: null,
      adjrw: 2.1005,
      admdoctor: 'นพ.สมชาย',
      dchdoctor: 'นพ.สมชาย',
      authencode: 'AUTH2222',
      pttype_eclaim_id: '02',
      pttype_eclaim_name: 'UC นอก CUP ในจังหวัด',
      pttype: '72',
      pttypename: 'บัตรทอง ต่างจังหวัด',
      copttype: '72',
      gfmis: '80074',
      accountcode: '1102050101.202',
      pttypeno: 'ท7299999',
      hospmain: '10700:รพ.ลำปาง',
      hospsub: '10700:รพ.ลำปาง',
      dchstts: 'Improved',
      dchtype: 'With Approval',
      summary_status: 'สรุปแล้ว',
      income: 25000,
      uc_money: 20000,
      discount_money: 0,
      paid_money: 5000,
      rcpt_money: 5000,
      rcpno: '500:002',
      debit: 5000,
      max_debt_amount: 5000,
      follow_money: 5000,
      bill: 'BILL02#5000',
      billdate: '2026-10-08',
      staff: 'เจ้าหน้าที่ ค',
      address: '789 หมู่ 3 ต.แม่ปะ',
      mobile: '0855555555',
      tel: '054999999',
    },
  ]

  const mockExecutor = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes("SHOW TABLES IN rcmdb LIKE 'amed'")) {
      return Promise.resolve([{ Tables_in_rcmdb_like_amed: 'amed' }])
    }
    return Promise.resolve(mockRows)
  })

  it('calculates Tier 1 KPI summary metrics correctly', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      { startDate: '2026-10-01', endDate: '2027-09-30' },
      mockExecutor
    )

    expect(res.summary.totalCases).toBe(3)
    expect(res.summary.onAmedCases).toBe(1)
    expect(res.summary.notOnAmedCases).toBe(2)
    expect(res.summary.withAuthenCases).toBe(2)
    expect(res.summary.noAuthenCases).toBe(1)
    expect(res.summary.withRepCases).toBe(2)
    expect(res.summary.noRepCases).toBe(1)
    expect(res.summary.withDebitCases).toBe(2)
    expect(res.summary.totalIncome).toBe(45500)
    expect(res.summary.totalDebit).toBe(17000)
    expect(res.summary.avgLos).toBe(4.33)
  })

  it('filters by ON_AMED cardFilter', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      { startDate: '2026-10-01', endDate: '2027-09-30', cardFilter: 'ON_AMED' },
      mockExecutor
    )

    expect(res.items.length).toBe(1)
    expect(res.items[0].an).toBe('690006884')
    expect(res.items[0].isOnAmed).toBe(true)
  })

  it('filters by WITH_AUTHEN cardFilter', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      { startDate: '2026-10-01', endDate: '2027-09-30', cardFilter: 'WITH_AUTHEN' },
      mockExecutor
    )

    expect(res.items.length).toBe(2)
    expect(res.items.every((i) => i.hasAuthen)).toBe(true)
  })

  it('searches correctly across unified search terms', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      { startDate: '2026-10-01', endDate: '2027-09-30', search: 'สมศรี' },
      mockExecutor
    )

    expect(res.items.length).toBe(1)
    expect(res.items[0].ptname).toBe('นาง สมศรี มีโชค')
  })

  it('sorts records and applies server pagination', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        sortBy: 'income',
        sortOrder: 'asc',
        page: 1,
        pageSize: 2,
      },
      mockExecutor
    )

    expect(res.items.length).toBe(2)
    expect(res.totalCount).toBe(3)
    expect(res.totalPages).toBe(2)
    expect(res.items[0].income).toBe(8000)
    expect(res.items[1].income).toBe(12500)
  })

  it('filters correctly by pttypes and recalculates summary', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        pttypes: '01',
      },
      mockExecutor
    )

    // Items with pttype_eclaim_id '01' only
    expect(res.items.every((i) => i.pttype_eclaim_id === '01')).toBe(true)
    expect(res.summary.totalCases).toBe(res.items.length)
  })

  it('falls back to ucOnly when pttypes is omitted', async () => {
    const res = await RcmAmedHomewardService.getHomewardReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        ucOnly: true,
      },
      mockExecutor
    )

    expect(res.items.every((i) => i.isUc)).toBe(true)
    expect(res.summary.totalCases).toBe(res.items.length)
  })
})
