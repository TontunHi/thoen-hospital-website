import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RcmOpdDebtRegistryService } from '../rcmOpdDebtRegistryService'
import { clearMemoryCache } from '@/lib/cache'

describe('RcmOpdDebtRegistryService (2.1.1.3 ทะเบียนตั้งหนี้)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
  })

  it('executes Tier 1 summary/breakdowns and Tier 2 paginated ledger with Two-Source Authen & rcpt_print enrichment', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(DISTINCT o.hn) AS total_cases')) {
        return [
          {
            total_cases: 2,
            total_visits: 3,
            total_income: 4500,
            total_uc_money: 3000,
            total_discount_money: 100,
            total_paid_money: 1400,
            total_rcpt_money: 900,
            total_debit: 3500,
            with_debit_count: 2,
            with_rcpt_count: 1,
            with_authen_count: 2,
          },
        ]
      }
      if (sql.includes('GROUP BY COALESCE(NULLIF(TRIM(ptt.pttype_eclaim_id)')) {
        return [
          {
            code: '01',
            name: 'UC ใน CUP',
            cases: 2,
            visits: 3,
            income: 4500,
            discount_money: 100,
            rcpt_money: 900,
            debit: 3500,
          },
        ]
      }
      if (sql.includes('GROUP BY COALESCE(NULLIF(TRIM(e.ar_opd)')) {
        return [
          {
            code: '1102050101.201',
            name: 'ลูกหนี้ค่ารักษา UC ในเขต',
            gfmis: 'GF-01',
            cases: 2,
            visits: 3,
            income: 4500,
            discount_money: 100,
            rcpt_money: 900,
            debit: 3500,
          },
        ]
      }
      if (sql.includes('GROUP BY COALESCE(NULLIF(TRIM(o.pttype)')) {
        return [
          {
            code: '33',
            name: 'บัตรทอง ในเขต',
            hipdata_code: 'UCS',
            cases: 2,
            visits: 3,
            income: 4500,
            discount_money: 100,
            rcpt_money: 900,
            debit: 3500,
          },
        ]
      }
      if (sql.includes("GROUP BY DATE_FORMAT(o.vstdate, '%Y-%m-%d')")) {
        return [
          {
            code: '2026-10-05',
            name: '2026-10-05',
            cases: 2,
            visits: 3,
            income: 4500,
            discount_money: 100,
            rcpt_money: 900,
            debit: 3500,
          },
        ]
      }
      if (sql.includes('SELECT COUNT(DISTINCT o.vn) AS total')) {
        return [{ total: 2 }]
      }
      if (sql.includes('FROM ovst o') && sql.includes('LIMIT ? OFFSET ?')) {
        return [
          {
            vn: '691005083001',
            an: '',
            hn: '0001111',
            cid: '9999999999999',
            ptname: 'นายทดสอบ ระบบ',
            vstdate: '2026-10-05',
            vsttime: '08:30:00',
            pt_subtype: '0',
            pttype_eclaim_id: '01',
            pttype_eclaim_name: 'UC ใน CUP',
            pttype: '33',
            hipdata_code: 'UCS',
            pttypename: 'บัตรทอง ในเขต',
            gfmis: 'GF-01',
            accountcode: '1102050101.201',
            accountname: 'ลูกหนี้ค่ารักษา UC ในเขต',
            department: 'OPD อายุรกรรม',
            clinic: 'อายุรกรรม',
            pdx: 'E119',
            income: 1500,
            uc_money: 1500,
            discount_money: 0,
            paid_money: 0,
            rcpt_money: 0,
            rcpno_list: '',
            debit: 1500,
          },
          {
            vn: '691005091502',
            an: '',
            hn: '0002222',
            cid: '8888888888888',
            ptname: 'นางตัวอย่าง ทดสอบ',
            vstdate: '2026-10-05',
            vsttime: '09:15:00',
            pt_subtype: '1',
            pttype_eclaim_id: '17',
            pttype_eclaim_name: 'จ่ายตรงกรมบัญชีกลาง',
            pttype: '21',
            hipdata_code: 'OFC',
            pttypename: 'เบิกจ่ายตรง',
            gfmis: 'GF-17',
            accountcode: '1102050101.401',
            accountname: 'ลูกหนี้จ่ายตรง',
            department: 'OPD ทั่วไป',
            clinic: 'ตรวจโรคทั่วไป',
            pdx: 'I10',
            income: 1000,
            uc_money: 0,
            discount_money: 100,
            paid_money: 900,
            rcpt_money: 900,
            rcpno_list: 'RCP-FALLBACK',
            debit: 0,
          },
        ]
      }
      if (sql.includes('FROM rcpt_print b')) {
        return [
          {
            vn: '691005091502',
            rcpno: '"R69/001#900.00"',
            rcpnodate: '2026-10-05 09:45',
          },
        ]
      }
      if (sql.includes('FROM rcmdb.authencode cc')) {
        return [
          {
            vn: '691005083001',
            authencode: 'AUTH-NHSO-01',
            authen_method: 'SMARTCARD',
          },
        ]
      }
      if (sql.includes('FROM visit_pttype vt')) {
        return [
          {
            vn: '691005083001',
            auth_code: 'KIOSK-01',
            claim_code: null,
            max_debt_amount: 3000,
          },
          {
            vn: '691005091502',
            auth_code: 'KIOSK-02',
            claim_code: null,
            max_debt_amount: null,
          },
        ]
      }
      return []
    })

    const res = await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31', page: 1, pageSize: 50 },
      mockExecutor
    )

    expect(res.summary.totalCases).toBe(2)
    expect(res.summary.totalVisits).toBe(3)
    expect(res.summary.totalDebit).toBe(3500)
    expect(res.summary.authenRate).toBe(66.7)
    expect(res.breakdowns.account).toHaveLength(1)
    expect(res.breakdowns.account[0].gfmis).toBe('GF-01')

    expect(res.totalCount).toBe(2)
    expect(res.items).toHaveLength(2)

    // Row 1 uses NHSO AuthenCode and preserves max_debt_amount
    expect(res.items[0].authencode).toBe('AUTH-NHSO-01')
    expect(res.items[0].max_debt_amount).toBe(3000)
    expect(res.items[0].ptsubtype).toBe('ตรวจโรคทั่วไป')

    // Row 2 falls back to visit_pttype.auth_code and sanitizes quotes in rcpt_print rcpno
    expect(res.items[1].authencode).toBe('KIOSK-02')
    expect(res.items[1].rcpno).toBe('R69/001#900.00')
    expect(res.items[1].rcpnodate).toBe('2026-10-05 09:45')
    expect(res.items[1].ptsubtype).toBe('ส่งเสริมสุขภาพ')
  })

  it('excludes admitted visits by default and removes AN filter when includeAdmitted=true', async () => {
    const mockExecutor = vi.fn().mockResolvedValue([])

    await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31', includeAdmitted: false },
      mockExecutor
    )
    const opdOnlyQueries = mockExecutor.mock.calls.map((c) => String(c[0]))
    expect(opdOnlyQueries.some((q) => q.includes("IFNULL(o.an, '') = ''"))).toBe(true)

    mockExecutor.mockClear()

    await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31', includeAdmitted: true },
      mockExecutor
    )
    const allServiceQueries = mockExecutor.mock.calls.map((c) => String(c[0]))
    expect(allServiceQueries.some((q) => q.includes("IFNULL(o.an, '') = ''"))).toBe(false)
  })

  it('handles enrichment query failure gracefully by falling back to vn_stat.rcpno_list', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(DISTINCT o.hn) AS total_cases')) return [{}]
      if (sql.includes('SELECT COUNT(DISTINCT o.vn) AS total')) return [{ total: 1 }]
      if (sql.includes('FROM ovst o') && sql.includes('LIMIT ? OFFSET ?')) {
        return [
          {
            vn: '691005110001',
            an: '',
            hn: '0003333',
            cid: '7777777777777',
            ptname: 'นายสำรอง ข้อมูล',
            vstdate: '2026-10-05',
            vsttime: '11:00:00',
            pt_subtype: '0',
            pttype_eclaim_id: '01',
            pttype_eclaim_name: 'UC',
            pttype: '33',
            hipdata_code: 'UCS',
            pttypename: 'บัตรทอง',
            gfmis: '',
            accountcode: '1102050101.201',
            accountname: 'ลูกหนี้',
            department: 'OPD',
            clinic: 'OPD',
            pdx: 'J00',
            income: 500,
            uc_money: 0,
            discount_money: 0,
            paid_money: 500,
            rcpt_money: 500,
            rcpno_list: 'FALLBACK#500.00',
            debit: 0,
          },
        ]
      }
      if (sql.includes('FROM rcpt_print b')) {
        throw new Error('rcpt_print timeout')
      }
      return []
    })

    const res = await RcmOpdDebtRegistryService.getReportData(
      { ds1: '2026-10-01', ds2: '2026-10-31' },
      mockExecutor
    )

    expect(res.items).toHaveLength(1)
    expect(res.items[0].rcpno).toBe('FALLBACK#500.00')
    expect(res.items[0].authencode).toBeNull()
  })
})
