import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmThaiTraditionalMedicineService,
  type Ttm3ReportParams,
  type Ttm11ReportParams,
} from '../rcmThaiTraditionalMedicineService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmThaiTraditionalMedicineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-ttm-topic3-2026-10-01-2027-09-30')
    invalidateCacheKey('rcm-ttm-topic11-2026-10-01-2027-09-30')
  })

  describe('getReportTopic3 (หัวข้อที่ 3: รายชื่อผู้รับบริการแพทย์แผนไทยรวม)', () => {
    it('should aggregate Thai traditional medicine visits and treatments correctly', async () => {
      const mockRawRows = [
        {
          vn: '691001111111',
          hn: '0012345',
          cid: '1529900012345',
          ptname: 'นาย สมชาย ใจดี',
          sex_code: '1',
          birthday: '1985-04-12',
          age: 41,
          vstdate: '2026-10-15',
          vsttime: '09:00:00',
          servicedate: '2026-10-15',
          authencode: 'AUTH1234',
          maininscl: 'UCS',
          pttypename: 'ประกันสุขภาพถ้วนหน้า',
          department: 'กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก',
          clinic: 'แพทย์แผนไทย',
          place: 'Y',
          treatment1: 'Y', // ยา
          treatment2: 'Y', // นวด
          treatment3: 'N',
          treatment4: 'N',
          treatment5: 'N',
          treatment6: 'N',
          treatment7: 'N',
          treatment_names: 'การนวดไทย, ยาสมุนไพร',
          herb_drugs: 'ฟ้าทะลายโจร (20 แคปซูล)',
          pdx: 'M545',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          income: 350,
          status: 'Rep :: มี Rep แล้ว',
          rep: 'REP001',
          compensated: 300,
          seamless_payno: 'PAY123',
          seamless_compensated: 300,
        },
        {
          vn: '691002222222',
          hn: '0067890',
          cid: '1529900067890',
          ptname: 'นาง สมศรี มีสุข',
          sex_code: '2',
          birthday: '1970-08-20',
          age: 56,
          vstdate: '2026-11-02',
          vsttime: '13:30:00',
          servicedate: '2026-11-02',
          authencode: null,
          maininscl: 'OFC',
          pttypename: 'ข้าราชการ',
          department: 'กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก',
          clinic: 'แพทย์แผนไทย',
          place: 'N', // นอก รพ.
          treatment1: 'N',
          treatment2: 'N',
          treatment3: 'Y', // ประคบ
          treatment4: 'Y', // อบ
          treatment5: 'N',
          treatment6: 'N',
          treatment7: 'N',
          treatment_names: 'การประคบสมุนไพร, การอบไอน้ำสมุนไพร',
          herb_drugs: null,
          pdx: 'M791',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          income: 400,
          status: 'ยังไม่ได้ส่ง',
          rep: null,
          compensated: 0,
          seamless_payno: null,
          seamless_compensated: null,
        },
      ]

      const mockExecutor = vi.fn().mockResolvedValue(mockRawRows)

      const params: Ttm3ReportParams = {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        page: 1,
        pageSize: 50,
      }

      const res = await RcmThaiTraditionalMedicineService.getReportTopic3(params, mockExecutor)

      expect(res.totalCount).toBe(2)
      expect(res.summary.totalVisits).toBe(2)
      expect(res.summary.uniquePatients).toBe(2)
      expect(res.summary.treatmentDrugCount).toBe(1)
      expect(res.summary.treatmentMassageCount).toBe(1)
      expect(res.summary.treatmentCompressCount).toBe(1)
      expect(res.summary.treatmentOtherCount).toBe(1)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.totalCompensated).toBe(300)
      expect(res.summary.inHospCount).toBe(1)
      expect(res.summary.outHospCount).toBe(1)
      expect(res.summary.withAuthenCount).toBe(1)

      // Test cardFilter: TREATMENT_DRUG
      const drugRes = await RcmThaiTraditionalMedicineService.getReportTopic3(
        { ...params, cardFilter: 'TREATMENT_DRUG' },
        mockExecutor
      )
      expect(drugRes.items.length).toBe(1)
      expect(drugRes.items[0].vn).toBe('691001111111')

      // Test place: OUT_HOSP
      const outHospRes = await RcmThaiTraditionalMedicineService.getReportTopic3(
        { ...params, place: 'OUT_HOSP' },
        mockExecutor
      )
      expect(outHospRes.items.length).toBe(1)
      expect(outHospRes.items[0].vn).toBe('691002222222')
    })
  })

  describe('getReportTopic11 (หัวข้อที่ 11: รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ)', () => {
    it('should aggregate 32 herbal medicine visits and items correctly', async () => {
      const mockRawRows = [
        {
          vn: '691001999999',
          hn: '0012345',
          an: null,
          cid: '1529900012345',
          ptname: 'นาย สมชาย ใจดี',
          sex_code: '1',
          birthday: '1985-04-12',
          age: 41,
          vstdate: '2026-10-20',
          vsttime: '10:00:00',
          auth_code: 'AUTH8888',
          authen_endpoint: 'EP9999',
          hipdata_code: 'UCS',
          pttypename: 'UCS: สิทธิบัตรทอง',
          department: 'ห้องตรวจแพทย์แผนไทย',
          hospmain: '10670 รพ.เถิน',
          hospsub: '10670 รพ.เถิน',
          pdx: 'J029',
          dx0: null,
          dx1: null,
          dx2: null,
          dx3: null,
          dx4: null,
          dx5: null,
          income: 180,
          drug_names: 'ยาฟ้าทะลายโจร (30 แคปซูล), ขมิ้นชัน (20 แคปซูล)',
          ttmt_codes: 'TTMT01, TTMT02',
          total_qty: 50,
          total_drug_amount: 180,
          item_count: 2,
          drug_items_json: JSON.stringify([
            {
              icode: '1500001',
              name: 'ยาฟ้าทะลายโจร',
              strength: '500 mg',
              units: 'แคปซูล',
              ttmt_code: 'TTMT01',
              did: '40001',
              category_id: 4,
              qty: 30,
              unitprice: 3,
              sumprice: 90,
            },
            {
              icode: '1500002',
              name: 'ยาขมิ้นชัน',
              strength: '250 mg',
              units: 'แคปซูล',
              ttmt_code: 'TTMT02',
              did: '40002',
              category_id: 3,
              qty: 20,
              unitprice: 4.5,
              sumprice: 90,
            },
          ]),
          rep: 'REP-HERB-01',
          compensated: 180,
          fund: 'UC',
          subfund: 'HERB',
          errorcode: null,
          rep_invoice: 'INV-001',
          compensated_invoice: 180,
          statusname: 'Rep :: มี Rep แล้ว',
        },
      ]

      const mockExecutor = vi.fn().mockResolvedValue(mockRawRows)

      const params: Ttm11ReportParams = {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        page: 1,
        pageSize: 50,
      }

      const res = await RcmThaiTraditionalMedicineService.getReportTopic11(params, mockExecutor)

      expect(res.title).toBe('รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ')
      expect(res.totalCount).toBe(1)
      expect(res.summary.totalVisits).toBe(1)
      expect(res.summary.totalDispensedUnits).toBe(50)
      expect(res.summary.totalDrugAmount).toBe(180)
      expect(res.summary.compensatedVisits).toBe(1)
      expect(res.summary.ucsCount).toBe(1)
      expect(res.summary.invoiceCount).toBe(1)

      const item = res.items[0]
      expect(item.itemCount).toBe(2)
      expect(item.drugNames).toContain('ยาฟ้าทะลายโจร')
      expect(item.isCompensated).toBe(true)
      expect(item.hasInvoice).toBe(true)
    })
  })

  describe('getVnHerbalDrugs', () => {
    it('should return prescribed herbal medicines for VN', async () => {
      const mockRows = [
        {
          icode: '1500001',
          drug: 'ยาฟ้าทะลายโจร 500 mg',
          name: 'ยาฟ้าทะลายโจร',
          strength: '500 mg',
          units: 'แคปซูล',
          ttmt_code: 'TTMT01',
          did: '40001',
          category_id: 4,
          qty: 30,
          unitprice: 3,
          sumprice: 90,
        },
      ]
      const mockExecutor = vi.fn().mockResolvedValue(mockRows)
      const res = await RcmThaiTraditionalMedicineService.getVnHerbalDrugs('691001111111', mockExecutor)
      expect(res.length).toBe(1)
      expect(res[0].drug).toBe('ยาฟ้าทะลายโจร 500 mg')
      expect(res[0].name).toBe('ยาฟ้าทะลายโจร')
      expect(res[0].qty).toBe(30)
    })
  })
})
