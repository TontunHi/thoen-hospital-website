import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmThalassemiaFundService,
  type ThalassemiaFundReportParams,
  type ThalassemiaFundGatewayAdapter,
} from '../rcmThalassemiaFundService'
import { clearMemoryCache, invalidateCacheKey } from '@/lib/cache'

describe('RcmThalassemiaFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearMemoryCache()
    invalidateCacheKey('rcm-thalassemia-fund-opd-2026-10-01-2027-09-30')
    invalidateCacheKey('rcm-thalassemia-fund-ipd-2026-10-01-2027-09-30')
  })

  describe('getOpdReport', () => {
    it('should aggregate OPD thalassemia visits correctly', async () => {
      const mockRawRows = [
        {
          vn: '691001123456',
          hn: '0012345',
          cid: '1529900012345',
          ptname: 'นาย สมชาย ใจดี',
          sex_code: '1',
          birthday: '1995-05-15',
          age: 31,
          vstdate: '2026-10-15',
          vsttime: '09:30:00',
          maininscl: 'UCS',
          pttypename: 'ประกันสุขภาพถ้วนหน้า',
          department: 'ห้องตรวจอายุรกรรม',
          clinic: 'อายุรกรรม',
          icd10: 'D561',
          icd9: null,
          drugname: 'Deferasirox 250 mg #30',
          blood: 'Packed Red Cells',
          blood_date: '2026-10-15',
          blood_qty: 2,
          ferritin_result: '1250',
          ferritin_date: '2026-10-15',
          hb_result: '8.5',
          hb_date: '2026-10-15',
          hct_result: '26',
          hct_date: '2026-10-15',
          authencode: 'AUTH1234',
          seamless: 'REP001',
          rep: 'REP001',
          status: 'มี Rep แล้ว',
          compensated: 3500,
        },
        {
          vn: '691002654321',
          hn: '0067890',
          cid: '1529900067890',
          ptname: 'นางสาว สมศรี รักดี',
          sex_code: '2',
          birthday: '2000-08-20',
          age: 26,
          vstdate: '2026-11-05',
          vsttime: '10:15:00',
          maininscl: 'OFC',
          pttypename: 'ข้าราชการ',
          department: 'ห้องตรวจกุมารเวชกรรม',
          clinic: 'กุมารเวชกรรม',
          icd10: 'D582',
          icd9: null,
          drugname: null,
          blood: 'LPRC',
          blood_date: '2026-11-05',
          blood_qty: 1,
          ferritin_result: null,
          ferritin_date: null,
          hb_result: '7.8',
          hb_date: '2026-11-05',
          hct_result: '23.5',
          hct_date: '2026-11-05',
          authencode: null,
          seamless: null,
          rep: null,
          status: 'รอส่งเบิก',
          compensated: 0,
        },
      ]

      const mockGateway: Partial<ThalassemiaFundGatewayAdapter> = {
        getRcmExtraThalassemiaFundOpdRaw: vi.fn().mockResolvedValue(mockRawRows),
        seamlessFetcher: vi.fn().mockResolvedValue(new Map()),
      }

      const params: ThalassemiaFundReportParams = {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        page: 1,
        pageSize: 50,
      }

      const res = await RcmThalassemiaFundService.getOpdReport(params, mockGateway)

      expect(res.totalCount).toBe(2)
      expect(res.summary.totalCases).toBe(2)
      expect(res.summary.uniquePatients).toBe(2)
      expect(res.summary.drugCases).toBe(1)
      expect(res.summary.bloodCases).toBe(2)
      expect(res.summary.totalBloodUnits).toBe(3)
      expect(res.summary.ferritinCases).toBe(1)
      expect(res.summary.hbHctCases).toBe(2)
      expect(res.summary.compensatedCases).toBe(1)
      expect(res.summary.uncompensatedCases).toBe(1)
      expect(res.summary.totalCompensated).toBe(3500)
      expect(res.items[0].ptname).toBe('นางสาว สมศรี รักดี')
      expect(res.items[0].sex).toBe('หญิง')
      expect(res.items[0].hasDrug).toBe(false)
      expect(res.items[0].hasBlood).toBe(true)
      expect(res.items[1].ptname).toBe('นาย สมชาย ใจดี')
      expect(res.items[1].sex).toBe('ชาย')
      expect(res.items[1].hasDrug).toBe(true)
      expect(res.items[1].hasBlood).toBe(true)
    })

    it('should filter by cardFilter WITH_DRUG', async () => {
      const mockRawRows = [
        {
          vn: '691001123456',
          hn: '0012345',
          cid: '1529900012345',
          ptname: 'นาย สมชาย',
          sex_code: '1',
          age: 31,
          vstdate: '2026-10-15',
          vsttime: '09:30:00',
          drugname: 'Deferasirox 250 mg #30',
          blood: null,
          blood_qty: 0,
          compensated: 1000,
        },
        {
          vn: '691002654321',
          hn: '0067890',
          cid: '1529900067890',
          ptname: 'นาง สมหญิง',
          sex_code: '2',
          age: 26,
          vstdate: '2026-11-05',
          vsttime: '10:15:00',
          drugname: null,
          blood: 'Packed Red Cells',
          blood_qty: 1,
          compensated: 0,
        },
      ]

      const mockGateway: Partial<ThalassemiaFundGatewayAdapter> = {
        getRcmExtraThalassemiaFundOpdRaw: vi.fn().mockResolvedValue(mockRawRows),
        seamlessFetcher: vi.fn().mockResolvedValue(new Map()),
      }
      const res = await RcmThalassemiaFundService.getOpdReport(
        {
          startDate: '2026-10-01',
          endDate: '2027-09-30',
          cardFilter: 'WITH_DRUG',
        },
        mockGateway
      )

      expect(res.totalCount).toBe(1)
      expect(res.items[0].vn).toBe('691001123456')
    })
  })

  describe('getIpdReport', () => {
    it('should aggregate IPD thalassemia admissions correctly', async () => {
      const mockRawRows = [
        {
          an: '690001234',
          hn: '0012345',
          cid: '1529900012345',
          ptname: 'นาย ผู้ป่วยใน ใจสู้',
          sex_code: '1',
          birthday: '1990-01-01',
          age: 36,
          admdate: '2026-10-10',
          dchdate: '2026-10-14',
          maininscl: 'UCS',
          pttypename: 'ประกันสุขภาพถ้วนหน้า',
          ward: 'สามัญชาย',
          icd10: 'D561',
          icd9: '9904',
          drugname: 'Desferrioxamin 500 mg #10',
          blood: 'Packed Red Cells',
          blood_date: '2026-10-11',
          blood_qty: 2,
          ferritin_result: '2400',
          ferritin_date: '2026-10-11',
          hb_result: '6.5',
          hb_date: '2026-10-10',
          hct_result: '19',
          hct_date: '2026-10-10',
          seamless: 'REP_IPD01',
          rep: 'REP_IPD01',
          status: 'ชดเชยแล้ว',
          compensated: 12500,
        },
      ]

      const mockGateway: Partial<ThalassemiaFundGatewayAdapter> = {
        getRcmExtraThalassemiaFundIpdRaw: vi.fn().mockResolvedValue(mockRawRows),
        seamlessFetcher: vi.fn().mockResolvedValue(new Map()),
      }
      const res = await RcmThalassemiaFundService.getIpdReport(
        {
          startDate: '2026-10-01',
          endDate: '2027-09-30',
        },
        mockGateway
      )

      expect(res.totalCount).toBe(1)
      expect(res.summary.totalCases).toBe(1)
      expect(res.summary.drugCases).toBe(1)
      expect(res.summary.bloodCases).toBe(1)
      expect(res.summary.totalBloodUnits).toBe(2)
      expect(res.summary.ferritinCases).toBe(1)
      expect(res.summary.compensatedCases).toBe(1)
      expect(res.summary.totalCompensated).toBe(12500)
      expect(res.items[0].an).toBe('690001234')
      expect(res.items[0].icd9).toBe('9904')
      expect(res.items[0].hasBlood).toBe(true)
    })
  })

  describe('getAnClinicalDetails', () => {
    it('should return admission clinical details including orders and procedures', async () => {
      const mockGateway: Partial<ThalassemiaFundGatewayAdapter> = {
        getRcmExtraThalassemiaAnDetailsRaw: vi.fn().mockResolvedValue({
          headerRows: [
            {
              an: '690001234',
              hn: '0012345',
              cid: '1529900012345',
              ptname: 'นาย สมชาย ใจดี',
              sex: 'ชาย',
              age: 36,
              admdate: '2026-10-10',
              dchdate: '2026-10-14',
              pttypename: 'ประกันสุขภาพถ้วนหน้า',
              ward: 'สามัญชาย',
            },
          ],
          diagRows: [
            {
              icd10: 'D561',
              icd_name: 'Beta thalassaemia',
              diagtype: '1',
              diagtype_name: 'PRINCIPLE DX',
              doctor_name: 'นพ. ตรวจดี มีสุข',
            },
          ],
          oprtRows: [
            {
              icd9: '9904',
              icd9_name: 'Transfusion of packed cells',
              opdate: '2026-10-11',
              doctor_name: 'นพ. ตรวจดี มีสุข',
            },
          ],
          orderRows: [
            {
              icode: '1000001',
              item_name: 'Packed Red Cells (PRC)',
              strength: null,
              units: 'Unit',
              qty: 2,
              unitprice: 700,
              sum_price: 1400,
              paidst_name: 'ลูกหนี้สิทธิ',
              income_name: 'ค่าบริการโลหิตและส่วนประกอบโลหิต',
              is_drug: 0,
            },
            {
              icode: '1500002',
              item_name: 'Desferrioxamin',
              strength: '500 mg',
              units: 'Vial',
              qty: 5,
              unitprice: 180,
              sum_price: 900,
              paidst_name: 'ลูกหนี้สิทธิ',
              income_name: 'ค่ายาและสารอาหารทางเส้นเลือด',
              is_drug: 1,
            },
          ],
        }),
      }

      const details = await RcmThalassemiaFundService.getAnClinicalDetails('690001234', mockGateway)

      expect(details).not.toBeNull()
      expect(details?.header.an).toBe('690001234')
      expect(details?.diagnoses.length).toBe(1)
      expect(details?.procedures.length).toBe(1)
      expect(details?.orders.length).toBe(2)
      expect(details?.orders[0].itemName).toBe('Packed Red Cells (PRC)')
      expect(details?.orders[1].isDrug).toBe(true)
    })

    it('should return null when AN is empty or not found', async () => {
      const mockGateway: Partial<ThalassemiaFundGatewayAdapter> = {
        getRcmExtraThalassemiaAnDetailsRaw: vi.fn().mockResolvedValue({
          headerRows: [],
          diagRows: [],
          oprtRows: [],
          orderRows: [],
        }),
      }
      const resEmpty = await RcmThalassemiaFundService.getAnClinicalDetails('', mockGateway)
      expect(resEmpty).toBeNull()

      const resNotFound = await RcmThalassemiaFundService.getAnClinicalDetails('999999', mockGateway)
      expect(resNotFound).toBeNull()
    })
  })

  describe('Primary REP filtering via Gateway Named API', () => {
    it('filters OPD report by selected reps and computes repBreakdown', async () => {
      const mockRawRows = [
        {
          vn: '691001123456',
          hn: '0012345',
          cid: '1529900012345',
          ptname: 'นาย สมชาย ใจดี',
          sex_code: '1',
          birthday: '1995-05-15',
          age: 31,
          vstdate: '2026-10-15',
          vsttime: '09:30:00',
          maininscl: 'UCS',
          pttypename: 'ประกันสุขภาพถ้วนหน้า',
          department: 'ห้องตรวจอายุรกรรม',
          clinic: 'อายุรกรรม',
          icd10: 'D561',
          icd9: null,
          drugname: null,
          blood: null,
          blood_date: null,
          blood_qty: 0,
          ferritin_result: null,
          ferritin_date: null,
          hb_result: null,
          hb_date: null,
          hct_result: null,
          hct_date: null,
          authencode: 'AUTH1234',
          seamless: null,
          rep: 'OP_11111',
          status: 'มี Rep แล้ว',
          compensated: 3500,
        },
        {
          vn: '691002654321',
          hn: '0067890',
          cid: '1529900067890',
          ptname: 'นางสาว สมศรี รักดี',
          sex_code: '2',
          birthday: '2000-08-20',
          age: 26,
          vstdate: '2026-11-05',
          vsttime: '10:15:00',
          maininscl: 'OFC',
          pttypename: 'ข้าราชการ',
          department: 'ห้องตรวจกุมารเวชกรรม',
          clinic: 'กุมารเวชกรรม',
          icd10: 'D582',
          icd9: null,
          drugname: null,
          blood: null,
          blood_date: null,
          blood_qty: 0,
          ferritin_result: null,
          ferritin_date: null,
          hb_result: null,
          hb_date: null,
          hct_result: null,
          hct_date: null,
          authencode: 'AUTH5678',
          seamless: null,
          rep: 'OP_22222',
          status: 'มี Rep แล้ว',
          compensated: 1200,
        },
      ]

      const mockGateway: Partial<ThalassemiaFundGatewayAdapter> = {
        getRcmExtraThalassemiaFundOpdRaw: vi.fn().mockResolvedValue(mockRawRows),
        seamlessFetcher: vi.fn().mockResolvedValue(new Map()),
      }

      const res = await RcmThalassemiaFundService.getOpdReport(
        {
          startDate: '2026-10-01',
          endDate: '2027-09-30',
          reps: 'OP_11111',
        },
        mockGateway
      )

      expect(res.items).toHaveLength(1)
      expect(res.items[0].vn).toBe('691001123456')
      expect(res.repBreakdown?.repItems).toHaveLength(2)
    })
  })
})
