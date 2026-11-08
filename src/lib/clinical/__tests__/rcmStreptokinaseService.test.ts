import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmStreptokinaseService,
  type StreptokinaseReportParams,
} from '../rcmStreptokinaseService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmStreptokinaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-adp-mapping-check-stemi')
  })

  describe('checkAdpMapping', () => {
    it('returns isMapped = true when STEMI ADP codes are mapped', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([
        {
          icode: '1560001',
          name: 'Streptokinase inj 1.5 MU',
          strength: '1.5 MU',
          nhso_adp_code: 'STEMI01',
        },
      ])

      const result = await RcmStreptokinaseService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(true)
      expect(result.mappedCount).toBe(1)
      expect(result.items[0].name).toBe('Streptokinase inj 1.5 MU')
    })

    it('returns isMapped = false when no matching items found', async () => {
      const mockExecutor = vi.fn().mockResolvedValue([])

      const result = await RcmStreptokinaseService.checkAdpMapping(mockExecutor, true)
      expect(result.isMapped).toBe(false)
      expect(result.mappedCount).toBe(0)
    })
  })

  describe('getStreptokinaseReport - OPD', () => {
    it('calculates audit rules, compensation and summary correctly for OPD', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT icode, name, strength, nhso_adp_code FROM s_drugitems')) {
          return [
            {
              icode: '1560001',
              name: 'Streptokinase inj 1.5 MU',
              strength: '1.5 MU',
              nhso_adp_code: 'STEMI01',
            },
          ]
        }
        // OPD Mock Rows
        return [
          {
            vn: '690101111111',
            hn: '0012345',
            cid: '1529900011111',
            ptname: 'นาย สมชาย ใจดี',
            sex_code: '1',
            birthday: '1970-01-01',
            age: 56,
            vstdate: '2026-10-15',
            vsttime: '08:30:00',
            pttypename: '10:บัตรทอง',
            department: 'ห้องอุบัติเหตุ-ฉุกเฉิน',
            clinic: 'อุบัติเหตุและฉุกเฉิน',
            drugname: 'Streptokinase inj 1.5 MU #1',
            money_hosxp: 12500,
            discount_money: 0,
            rcpt_money: 0,
            debit: 12500,
            rcpno: '',
            dx: 'I210, I10',
            op: '9910',
            money_eclaim: 12000,
            money_rep: 12000,
            money_invoice: 12000,
            rep: 'REP69001',
            status: 'NHSO :: ได้รับ Invoice',
          },
          {
            vn: '690101222222',
            hn: '0023456',
            cid: '1529900022222',
            ptname: 'นาง สมศรี ดวงดี',
            sex_code: '2',
            birthday: '1965-05-12',
            age: 61,
            vstdate: '2026-10-20',
            vsttime: '14:15:00',
            pttypename: '10:บัตรทอง',
            department: 'ห้องตรวจอายุรกรรม',
            clinic: 'อายุรกรรม',
            drugname: 'Streptokinase inj 1.5 MU #1',
            money_hosxp: 12500,
            discount_money: 0,
            rcpt_money: 0,
            debit: 12500,
            rcpno: '',
            dx: 'I200, I10', // Missing I210-I213 or I22 -> ErrorDx
            op: '', // Missing 9910 -> ErrorOp
            money_eclaim: 0,
            money_rep: 0,
            money_invoice: 0,
            rep: '',
            status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
          },
        ]
      })

      const params: StreptokinaseReportParams = {
        patientType: 'OPD',
        ds1: '2026-10-01',
        ds2: '2027-09-30',
        refresh: true,
      }

      const report = await RcmStreptokinaseService.getStreptokinaseReport(params, mockExecutor)

      expect(report.patientType).toBe('OPD')
      expect(report.totalCount).toBe(2)
      expect(report.summary.totalCases).toBe(2)
      expect(report.summary.uniquePatients).toBe(2)
      expect(report.summary.auditPassCases).toBe(1)
      expect(report.summary.auditErrorCases).toBe(1)
      expect(report.summary.compensatedCases).toBe(1)
      expect(report.summary.uncompensatedCases).toBe(1)
      expect(report.summary.totalCompensated).toBe(12000)

      // In descending date order: 2026-10-20 (p1: 0023456) comes before 2026-10-15 (p2: 0012345)
      const p1 = report.items[0]
      expect(p1.hn).toBe('0023456')
      expect(p1.errorDx).toBe('ไม่พบ Dx I210-I213 หรือ I22x')
      expect(p1.errorOp).toBe('ไม่พบ Op 9910')
      expect(p1.hasError).toBe(true)
      expect(p1.isCompensated).toBe(false)

      const p2 = report.items[1]
      expect(p2.hn).toBe('0012345')
      expect(p2.errorDx).toBeNull()
      expect(p2.errorOp).toBeNull()
      expect(p2.hasError).toBe(false)
      expect(p2.isCompensated).toBe(true)
    })

    it('filters by cardFilter correctly', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT icode, name, strength, nhso_adp_code FROM s_drugitems')) {
          return []
        }
        return [
          {
            vn: '690101111111',
            hn: '0012345',
            cid: '1529900011111',
            ptname: 'นาย สมชาย ใจดี',
            sex_code: '1',
            age: 56,
            vstdate: '2026-10-15',
            vsttime: '08:30:00',
            pttypename: '10:บัตรทอง',
            drugname: 'Streptokinase',
            money_hosxp: 12500,
            debit: 12500,
            dx: 'I210',
            op: '9910',
            money_invoice: 12000,
            rep: 'REP69001',
            status: 'NHSO :: ได้รับ Invoice',
          },
          {
            vn: '690101222222',
            hn: '0023456',
            cid: '1529900022222',
            ptname: 'นาง สมศรี ดวงดี',
            sex_code: '2',
            age: 61,
            vstdate: '2026-10-20',
            vsttime: '14:15:00',
            pttypename: '10:บัตรทอง',
            drugname: 'Streptokinase',
            money_hosxp: 12500,
            debit: 12500,
            dx: 'I10',
            op: '',
            money_invoice: 0,
            rep: '',
            status: '- :: ยังไม่ส่งเข้าโปรแกรม E-Claim',
          },
        ]
      })

      // AUDIT_ERROR card
      const errRes = await RcmStreptokinaseService.getStreptokinaseReport(
        { patientType: 'OPD', ds1: '2026-10-01', ds2: '2027-09-30', cardFilter: 'AUDIT_ERROR', refresh: true },
        mockExecutor
      )
      expect(errRes.totalCount).toBe(1)
      expect(errRes.items[0].hn).toBe('0023456')

      // AUDIT_PASS card
      const passRes = await RcmStreptokinaseService.getStreptokinaseReport(
        { patientType: 'OPD', ds1: '2026-10-01', ds2: '2027-09-30', cardFilter: 'AUDIT_PASS', refresh: true },
        mockExecutor
      )
      expect(passRes.totalCount).toBe(1)
      expect(passRes.items[0].hn).toBe('0012345')
    })
  })

  describe('getStreptokinaseReport - IPD', () => {
    it('executes IPD data retrieval and parses admission details', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT icode, name, strength, nhso_adp_code FROM s_drugitems')) {
          return []
        }
        return [
          {
            an: '690001234',
            hn: '0034567',
            cid: '1529900033333',
            ptname: 'นาย วิชัย ยอดเยี่ยม',
            sex_code: '1',
            birthday: '1955-08-20',
            age: 71,
            admdate: '2026-11-01',
            dchdate: '2026-11-05',
            pttypename: '10:บัตรทอง',
            ward: 'ตึกผู้ป่วยในชาย',
            drugname: 'Streptokinase inj 1.5 MU #1',
            money_hosxp: 18500,
            discount_money: 0,
            rcpt_money: 0,
            debit: 18500,
            rcpno: '',
            dx: 'I211, I10',
            op: '9910',
            money_eclaim: 16000,
            money_rep: 16000,
            money_invoice: 16000,
            rep: 'IPDREP01',
            status: 'Rep :: ได้รับ Rep แล้ว',
          },
        ]
      })

      const report = await RcmStreptokinaseService.getStreptokinaseReport(
        { patientType: 'IPD', ds1: '2026-10-01', ds2: '2027-09-30', refresh: true },
        mockExecutor
      )

      expect(report.patientType).toBe('IPD')
      expect(report.totalCount).toBe(1)
      expect(report.items[0].an).toBe('690001234')
      expect(report.items[0].ward).toBe('ตึกผู้ป่วยในชาย')
      expect(report.items[0].errorDx).toBeNull()
      expect(report.items[0].errorOp).toBeNull()
      expect(report.items[0].isCompensated).toBe(true)
    })
  })

  describe('getAnClinicalDetails', () => {
    it('fetches and structures IPD clinical admission details for detail modal', async () => {
      const mockExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM ipt i')) {
          return [
            {
              an: '690001234',
              hn: '0034567',
              cid: '1529900033333',
              ptname: 'นาย วิชัย ยอดเยี่ยม',
              sex: 'ชาย',
              age: 71,
              admdate: '2026-11-01',
              dchdate: '2026-11-05',
              pttypename: 'บัตรทอง',
              ward: 'ตึกผู้ป่วยในชาย',
            },
          ]
        }
        if (sql.includes('FROM iptdiag d')) {
          return [
            {
              icd10: 'I211',
              icd_name: 'Acute transmural myocardial infarction of inferior wall',
              diagtype: '1',
              diagtype_name: 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)',
              doctor_name: 'นพ. วินัย ชำนาญการ',
            },
          ]
        }
        if (sql.includes('FROM iptoprt op')) {
          return [
            {
              icd9: '9910',
              icd9_name: 'Injection or infusion of thrombolytic agent',
              opdate: '2026-11-01',
              doctor_name: 'นพ. วินัย ชำนาญการ',
            },
          ]
        }
        if (sql.includes('FROM opitemrece o')) {
          return [
            {
              icode: '1560001',
              item_name: 'Streptokinase inj 1.5 MU',
              strength: '1.5 MU',
              units: 'vial',
              qty: 1,
              unitprice: 12500,
              sum_price: 12500,
              paidst_name: 'เบิกได้',
              income_name: 'ค่ายา',
              is_drug: 1,
            },
          ]
        }
        return []
      })

      const details = await RcmStreptokinaseService.getAnClinicalDetails('690001234', mockExecutor)
      expect(details).not.toBeNull()
      expect(details?.header.an).toBe('690001234')
      expect(details?.header.ptname).toBe('นาย วิชัย ยอดเยี่ยม')
      expect(details?.diagnoses[0].icd10).toBe('I211')
      expect(details?.procedures[0].icd9).toBe('9910')
      expect(details?.orders[0].itemName).toBe('Streptokinase inj 1.5 MU')
    })
  })
})
