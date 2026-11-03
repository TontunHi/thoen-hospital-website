import { describe, it, expect, vi } from 'vitest'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'

describe('RcmDashboardService.getVnClinicalDetails', () => {
  it('returns null if vn is empty or blank', async () => {
    const mockExecutor = vi.fn()
    const result = await RcmDashboardService.getVnClinicalDetails('', mockExecutor)
    expect(result).toBeNull()
    expect(mockExecutor).not.toHaveBeenCalled()
  })

  it('returns null if header row is not found in database', async () => {
    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM ovst o')) return []
      return []
    })

    const result = await RcmDashboardService.getVnClinicalDetails('999999999999', mockExecutor)
    expect(result).toBeNull()
  })

  it('correctly parses header, screening, diagnoses, and categorizes orders with financial totals', async () => {
    const mockHeader = [
      {
        vn: '691021131643',
        hn: '0000206',
        cid: '3520800269098',
        ptname: 'นางจันทนา ตันมา',
        sex: 'หญิง',
        age: 60,
        vstdate: '2026-10-21',
        vsttime: '13:16:43',
        pttypename: 'บัตรทอง',
        department: '117 จุดซักประวัติ Palliative Care',
        clinic: 'อายุรกรรม',
      },
    ]

    const mockScreen = [
      {
        bw: 52,
        height: 159,
        bmi: 20.57,
        bps: 120,
        bpd: 80,
        pulse: 80,
        rr: 20,
        temperature: 36.5,
        spo2: null,
        fbs: 0,
        cc: 'case CA corpus',
        hpi: 'โทรติดตามเยี่ยมบ้าน',
        pmh: 'CA corpus uteri',
        pe: '',
        screen_dep: '122',
        screen_dep_name: 'จุดซักประวัติ Palliative Care',
        symptom: 'case CA corpus',
      },
    ]

    const mockDiag = [
      {
        icd10: 'C548',
        icd_name: 'Malignant neoplasm of corpus uteri',
        diagtype: '1',
        diagtype_name: 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)',
        doctor_name: 'พญ.สุทธิดา จตุจินดา',
      },
      {
        icd10: 'Z515',
        icd_name: 'Palliative care',
        diagtype: '2',
        diagtype_name: 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)',
        doctor_name: 'พญ.สุทธิดา จตุจินดา',
      },
    ]

    const mockOrders = [
      {
        icode: '1500001',
        item_name: 'Morphine syrup 10 mg/5 mL',
        strength: '10 mg/5 mL',
        units: 'ขวด',
        qty: 2,
        unitprice: 150,
        sum_price: 300,
        paidst: '02',
        paidst_name: 'ลูกหนี้สิทธิ',
        income_code: '03',
        income_name: 'ค่ายาในบัญชียาหลักแห่งชาติ',
        drugusage_text: 'รับประทานครั้งละ 1 ช้อนชา ทุก 4 ชม.',
        is_drug: 1,
      },
      {
        icode: '3002602',
        item_name: 'ค่าเยี่ยมบ้าน Palliative care',
        strength: null,
        units: null,
        qty: 1,
        unitprice: 200,
        sum_price: 200,
        paidst: '02',
        paidst_name: 'ลูกหนี้สิทธิ',
        income_code: '36',
        income_name: 'บริการอื่นๆ และส่งเสริมป้องกันโรค',
        drugusage_text: '',
        is_drug: 0,
      },
      {
        icode: '3000700',
        item_name: 'o2 sat',
        strength: null,
        units: null,
        qty: 1,
        unitprice: 100,
        sum_price: 100,
        paidst: '01',
        paidst_name: 'ชำระเองเบิกได้',
        income_code: '97',
        income_name: 'อุปกรณ์ของใช้และเครื่องมือทางการแพทย์',
        drugusage_text: '',
        is_drug: 0,
      },
    ]

    const mockExecutor = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM ovst o')) return mockHeader
      if (sql.includes('FROM opdscreen s')) return mockScreen
      if (sql.includes('FROM ovstdiag d')) return mockDiag
      if (sql.includes('FROM opitemrece o')) return mockOrders
      return []
    })

    const result = await RcmDashboardService.getVnClinicalDetails('691021131643', mockExecutor)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.header.vn).toBe('691021131643')
    expect(result.header.ptname).toBe('นางจันทนา ตันมา')
    expect(result.screen?.bps).toBe(120)
    expect(result.screen?.bpd).toBe(80)
    expect(result.diagnoses.length).toBe(2)
    expect(result.diagnoses[0].icd10).toBe('C548')

    // Orders checking
    expect(result.orders.items.length).toBe(3)
    expect(result.orders.total_price).toBe(600)
    expect(result.orders.total_items).toBe(4)
    expect(result.orders.total_paid).toBe(100) // paidst 01
    expect(result.orders.total_claim).toBe(500) // paidst 02

    // Categories checking
    const drugCat = result.orders.categories.find((c) => c.category_group === 'DRUG')
    expect(drugCat).toBeDefined()
    expect(drugCat?.items.length).toBe(1)
    expect(drugCat?.total_price).toBe(300)

    const procedureCat = result.orders.categories.find((c) => c.category_group === 'PROCEDURE_SERVICE')
    expect(procedureCat).toBeDefined()
    expect(procedureCat?.items.length).toBe(1)
    expect(procedureCat?.total_price).toBe(200)

    const supplyCat = result.orders.categories.find((c) => c.category_group === 'SUPPLY')
    expect(supplyCat).toBeDefined()
    expect(supplyCat?.items.length).toBe(1)
    expect(supplyCat?.total_price).toBe(100)
  })
})
