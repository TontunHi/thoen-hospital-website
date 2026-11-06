import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  classifyPpSpecialCodes,
  RcmCervicalCancerService,
} from '../rcmCervicalCancerService'
import { clearMemoryCache } from '@/lib/cache'

describe('rcmCervicalCancerService (CCS 1. Target Population)', () => {
  beforeEach(() => {
    clearMemoryCache()
    vi.clearAllMocks()
  })

  it('classifies Pap Smear, VIA, HPV, and Other pp_special_code values accurately', () => {
    const normalRes = classifyPpSpecialCodes(['1B004N', '1B004_0N', '1B0046_0', '1B0048'])
    expect(normalRes.papsmear).toBe('1B004N')
    expect(normalRes.papsmear_result).toBe('ปกติ')
    expect(normalRes.via).toBe('1B004_0N')
    expect(normalRes.via_result).toBe('ปกติ')
    expect(normalRes.hpv).toBe('1B0046_0')
    expect(normalRes.hpv_result).toBe('ปกติ')
    expect(normalRes.other).toBe('1B0048')
    expect(normalRes.other_result).toBe('ปกติ')
    expect(normalRes.hasAbnormalResult).toBe(false)

    const abnormalRes = classifyPpSpecialCodes('1B004P,1B004_0P,1B0046_11,0320277_1')
    expect(abnormalRes.papsmear_result).toBe('ผิดปกติ')
    expect(abnormalRes.via_result).toBe('ผิดปกติ')
    expect(abnormalRes.hpv_result).toBe('ผิดปกติ')
    expect(abnormalRes.other_result).toBe('ผิดปกติ')
    expect(abnormalRes.hasAbnormalResult).toBe(true)
  })

  it('reconciles 30-60 target women, seamless Rep comeback, and QueryPerson for outside-target CIDs', async () => {
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('WHERE TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) BETWEEN 30 AND 60')) {
        return [
          {
            person_id: '101',
            hn: '0000101',
            cid: '1000000000101',
            ptname: 'นาง สมมติ หนึ่ง',
            birthdate: '1985-05-10',
            age: 41,
            sex: 'หญิง',
            nation: 'ไทย',
            person_discharge_id: 9,
            typearea: '1',
            address: '12 ม.1 ต.ล้อมแรด',
            person_pttypename: 'บัตรทอง',
          },
          {
            person_id: '102',
            hn: '0000102',
            cid: '1000000000102',
            ptname: 'นาง สมมติ สอง',
            birthdate: '1980-03-15',
            age: 46,
            sex: 'หญิง',
            nation: 'ไทย',
            person_discharge_id: 9,
            typearea: '4',
            address: '99 ม.2 ต.นาโป่ง',
            person_pttypename: 'บัตรทอง',
          },
        ]
      }

      if (sql.includes('FROM ovst o')) {
        return [
          {
            vn: '690101080001',
            hn: '0000101',
            vstdate: '2026-01-15',
            cc: 'ตรวจคัดกรองมะเร็งปากมดลูก',
            icd10: 'Z124',
            hospital: 'รพ.เถิน',
            doctorname: 'พญ.ทดสอบ ระบบ',
            pp_codes: '1B0046_1',
          },
        ]
      }

      if (sql.includes('FROM rcmdb.seamless')) {
        return [
          {
            vn: '690101080001',
            hn: '0000101',
            cid: '1000000000101',
            ptname: 'นาง สมมติ หนึ่ง',
            rep: '6901_CCS_01',
            admdate: '2026-01-15',
            payno: 'P6901',
            status: 'อนุมัติ',
            compensated: 450,
            hsub: '11119',
            note: 'จ่ายตามเกณฑ์',
          },
          {
            vn: '690101089999',
            hn: '0000999',
            cid: '1000000000999',
            ptname: 'นาง นอกเกณฑ์ อายุเกิน',
            rep: '6901_CCS_02',
            admdate: '2026-01-20',
            payno: 'P6901',
            status: 'อนุมัติ',
            compensated: 250,
            hsub: '11119',
            note: 'นอกกลุ่มอายุ',
          },
        ]
      }

      if (sql.includes('FROM rcmdb.repeclaim')) {
        return []
      }

      // QueryPerson lookup for CID 1000000000999
      if (sql.includes('WHERE p.cid IN')) {
        return [
          {
            person_id: '999',
            hn: '0000999',
            cid: '1000000000999',
            ptname: 'นาง นอกเกณฑ์ อายุเกิน',
            birthdate: '1963-01-01',
            age: 63,
            sex: 'หญิง',
            nation: 'ไทย',
            person_discharge_id: 9,
            typearea: '1',
            address: '55 ม.4 ต.แม่ถอด',
            person_pttypename: 'บัตรทอง',
          },
        ]
      }

      return []
    })

    const res = await RcmCervicalCancerService.getTargetPopulationReport(
      { ds1: '2025-10-01', ds2: '2026-09-30' },
      mockExecutor
    )

    expect(res.summary.totalTarget).toBe(3)
    expect(res.summary.screenedCount).toBe(2)
    expect(res.summary.unscreenedCount).toBe(1)
    expect(res.summary.abnormalCount).toBe(1)
    expect(res.summary.matchedSameDayCount).toBe(1)
    expect(res.summary.repOnlyCount).toBe(1)
    expect(res.summary.totalCompensated).toBe(700)

    const p1 = res.items.find((r) => r.hn === '0000101')
    expect(p1?.note).toBe('HOSxP,Rep')
    expect(p1?.matchType).toBe('matched_same_day')
    expect(p1?.hpv_result).toBe('ผิดปกติ')

    const p2 = res.items.find((r) => r.hn === '0000102')
    expect(p2?.note).toBe('HOSxP')
    expect(p2?.matchType).toBe('unscreened')

    const pRepOnly = res.items.find((r) => r.cid === '1000000000999')
    expect(pRepOnly?.note).toBe('Rep')
    expect(pRepOnly?.matchType).toBe('rep_only')
    expect(pRepOnly?.age).toBe(63)
    expect(pRepOnly?.address).toBe('55 ม.4 ต.แม่ถอด')
  })

  it('overlays extraRepRows from Rep_Individual Excel and filters by searchField & sortBy', async () => {
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('WHERE TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) BETWEEN 30 AND 60')) {
        return [
          {
            person_id: '201',
            hn: '0000201',
            cid: '2000000000201',
            ptname: 'นาง ทดสอบ หนึ่ง',
            birthdate: '1986-02-10',
            age: 40,
            sex: 'หญิง',
            nation: 'ไทย',
            person_discharge_id: 9,
            typearea: '1',
            address: '1 ม.1',
            person_pttypename: 'บัตรทอง',
          },
        ]
      }
      if (sql.includes('WHERE p.cid IN')) {
        return []
      }
      return []
    })

    const res = await RcmCervicalCancerService.getTargetPopulationReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
        searchField: 'CID',
        search: '2000000000201',
        sortBy: 'age',
        sortOrder: 'desc',
        extraRepRows: [
          { cid: '2000000000201', comebackDate: '2026-02-14' },
          { cid: '2000000000999', comebackDate: '2026-02-15' },
        ],
      },
      mockExecutor
    )

    // Summary includes both target row and newly appended Excel Rep row
    expect(res.summary.totalTarget).toBe(2)
    expect(res.summary.compensatedCount).toBe(2)
    // Filtered by CID 2000000000201
    expect(res.items).toHaveLength(1)
    expect(res.items[0].note).toBe('HOSxP,Rep')
    expect(res.items[0].comeback).toBe('Y')
    expect(res.items[0].comeback_date).toBe('2026-02-14')
    expect(res.items[0].matchType).toBe('matched_diff_day')
  })

  it('runs getScreenedRecipientsReport, computing KPIs, OK status, and method filters', async () => {
    const mockExecutor = vi.fn(async () => [
      {
        vn: '671001001',
        an: null,
        cid: '3520900015321',
        hn: '0100001',
        ptname: 'นาง ทดสอบ หนึ่ง',
        age: 42,
        nation: 'ไทย',
        vstdate: '2024-10-01',
        vsttime: '08:30:00',
        authencode: 'AUTH123',
        pttypename_patient: 'บัตรทอง',
        pttypename_visit: 'บัตรทอง',
        department: 'กลุ่มงานเวชปฏิบัติครอบครัว',
        clinic: 'เวชกรรม',
        pdx: 'Z124',
        ok: 'Y',
        papsmear: '1B004N',
        papsmear_result: 'ปกติ',
        via: null,
        via_result: null,
        hpv: null,
        hpv_result: null,
        other: null,
        other_result: null,
        colposcopy: null,
        type: 'OP',
        rep: 'REP01',
        compensated: 450,
        note: 'จ่ายแล้ว',
        paydate: '2024-11-01',
        listname: '1B004N',
        status: 'NHSO :: มี Invoice แล้ว',
        rep_nhso: 'NHSO01',
        nhso: 450,
      },
      {
        vn: '671001002',
        an: null,
        cid: '3520900015322',
        hn: '0100002',
        ptname: 'นาง ทดสอบ สอง',
        age: 48,
        nation: 'ไทย',
        vstdate: '2024-10-02',
        vsttime: '09:15:00',
        authencode: null,
        pttypename_patient: 'ประกันสังคม',
        pttypename_visit: 'ประกันสังคม',
        department: 'ห้องตรวจสูติ',
        clinic: 'สูตินรีเวช',
        pdx: 'N879',
        ok: 'Y',
        papsmear: null,
        papsmear_result: null,
        via: null,
        via_result: null,
        hpv: '1B0046_1',
        hpv_result: 'ผิดปกติ',
        other: null,
        other_result: null,
        colposcopy: 'Y',
        type: null,
        rep: null,
        compensated: 0,
        note: null,
        paydate: null,
        listname: '1B005',
        status: null,
        rep_nhso: null,
        nhso: 0,
      },
      {
        vn: '671001003',
        an: null,
        cid: '3520900015323',
        hn: '0100003',
        ptname: 'นาง ทดสอบ สาม',
        age: 35,
        nation: 'ไทย',
        vstdate: '2024-10-03',
        vsttime: '10:00:00',
        authencode: null,
        pttypename_patient: 'บัตรทอง',
        pttypename_visit: 'บัตรทอง',
        department: 'ห้องตรวจเวช',
        clinic: 'เวชกรรม',
        pdx: 'Z124',
        ok: null, // lacks valid screening code
        papsmear: null,
        papsmear_result: null,
        via: null,
        via_result: null,
        hpv: null,
        hpv_result: null,
        other: null,
        other_result: null,
        colposcopy: null,
        type: null,
        rep: null,
        compensated: 0,
        note: null,
        paydate: null,
        listname: null,
        status: null,
        rep_nhso: null,
        nhso: 0,
      },
    ])

    const res = await RcmCervicalCancerService.getScreenedRecipientsReport(
      {
        ds1: '2024-10-01',
        ds2: '2025-09-30',
        methodFilter: 'ALL',
        okFilter: 'ALL',
      },
      mockExecutor
    )

    expect(res.totalCount).toBe(3)
    expect(res.summary.totalVisits).toBe(3)
    expect(res.summary.uniquePatients).toBe(3)
    expect(res.summary.okCount).toBe(2)
    expect(res.summary.notOkCount).toBe(1)
    expect(res.summary.papCount).toBe(1)
    expect(res.summary.hpvCount).toBe(1)
    expect(res.summary.colposcopyCount).toBe(1)
    expect(res.summary.abnormalCount).toBe(1)
    expect(res.summary.totalSeamlessCompensated).toBe(450)
    expect(res.summary.totalNhsoCompensated).toBe(450)

    // Test methodFilter='PapSmear'
    const papRes = await RcmCervicalCancerService.getScreenedRecipientsReport(
      {
        ds1: '2024-10-01',
        ds2: '2025-09-30',
        methodFilter: 'PapSmear',
      },
      mockExecutor
    )
    expect(papRes.items).toHaveLength(1)
    expect(papRes.items[0].vn).toBe('671001001')

    // Test okFilter='NOT_OK'
    const notOkRes = await RcmCervicalCancerService.getScreenedRecipientsReport(
      {
        ds1: '2024-10-01',
        ds2: '2025-09-30',
        okFilter: 'NOT_OK',
      },
      mockExecutor
    )
    expect(notOkRes.items).toHaveLength(1)
    expect(notOkRes.items[0].vn).toBe('671001003')

    // Test resultStatusFilter='ABNORMAL'
    const abnRes = await RcmCervicalCancerService.getScreenedRecipientsReport(
      {
        ds1: '2024-10-01',
        ds2: '2025-09-30',
        resultStatusFilter: 'ABNORMAL',
      },
      mockExecutor
    )
    expect(abnRes.items).toHaveLength(1)
    expect(abnRes.items[0].vn).toBe('671001002')
  })

  it('checks 1B004N ADP mapping in s_drugitems and queries 1.3 service report with summary and filters', async () => {
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('FROM s_drugitems d') && sql.includes('WHERE TRIM(d.nhso_adp_code) IN')) {
        return [
          {
            icode: '3001234',
            name: 'ตรวจ HPV DNA (1B004N)',
            strength: '1 test',
            nhso_adp_code: '1B004N',
          },
        ]
      }

      if (sql.includes('FROM ovst o') && sql.includes('JOIN (') && sql.includes('1B004N')) {
        return [
          {
            vn: '680101080001',
            cid: '1000000000201',
            hn: '0000201',
            ptname: 'นาง สมพร ศรีสุข',
            age: 38,
            nation: 'ไทย',
            vstdate: '2025-11-10',
            vsttime: '09:30:00',
            authencode: 'AUTH6801',
            pttypename: 'บัตรทอง',
            department: 'แผนกสูตินรีเวช',
            clinic: 'คลินิกคัดกรอง',
            pdx: 'Z124',
            dx0: null,
            dx1: null,
            dx2: null,
            dx3: null,
            dx4: null,
            dx5: null,
            op0: '8926',
            op1: null,
            op2: null,
            op3: null,
            op4: null,
            op5: null,
            listname: 'ตรวจ HPV DNA (1B004N)',
            status: 'Rep :: มี Rep แล้ว',
            rep: 'REP_HPV_6801',
            compensated: 800,
          },
          {
            vn: '680101080002',
            cid: '1000000000202',
            hn: '0000202',
            ptname: 'นาง จิตรา งามตา',
            age: 44,
            nation: 'ไทย',
            vstdate: '2025-11-12',
            vsttime: '10:15:00',
            authencode: null,
            pttypename: 'ข้าราชการ',
            department: 'ตรวจโรคทั่วไป',
            clinic: 'เวชปฏิบัติทั่วไป',
            pdx: 'Z124',
            dx0: 'E119',
            dx1: null,
            dx2: null,
            dx3: null,
            dx4: null,
            dx5: null,
            op0: null,
            op1: null,
            op2: null,
            op3: null,
            op4: null,
            op5: null,
            listname: 'ตรวจ HPV DNA (1B004N)',
            status: null,
            rep: null,
            compensated: 0,
          },
        ]
      }

      return []
    })

    // Test check1B004NAdpMapping
    const mapRes = await RcmCervicalCancerService.check1B004NAdpMapping(mockExecutor)
    expect(mapRes.isMapped).toBe(true)
    expect(mapRes.mappedCount).toBe(1)
    expect(mapRes.items[0].nhso_adp_code).toBe('1B004N')

    // Test getService1B004NReport
    const repRes = await RcmCervicalCancerService.getService1B004NReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
      },
      mockExecutor
    )

    expect(repRes.summary.totalVisits).toBe(2)
    expect(repRes.summary.uniquePatients).toBe(2)
    expect(repRes.summary.compensatedVisits).toBe(1)
    expect(repRes.summary.uncompensatedVisits).toBe(1)
    expect(repRes.summary.totalCompensated).toBe(800)
    expect(repRes.summary.averageCompensated).toBe(800)
    expect(repRes.summary.withAuthenCount).toBe(1)
    expect(repRes.summary.withoutAuthenCount).toBe(1)
    expect(repRes.summary.withPdxCount).toBe(2)
    expect(repRes.summary.withOpCount).toBe(1)
    expect(repRes.items).toHaveLength(2)

    // Test compensationFilter='COMPENSATED'
    const compOnly = await RcmCervicalCancerService.getService1B004NReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
        compensationFilter: 'COMPENSATED',
      },
      mockExecutor
    )
    expect(compOnly.items).toHaveLength(1)
    expect(compOnly.items[0].hn).toBe('0000201')

    // Test search='จิตรา'
    const searchRes = await RcmCervicalCancerService.getService1B004NReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
        search: 'จิตรา',
      },
      mockExecutor
    )
    expect(searchRes.items).toHaveLength(1)
    expect(searchRes.items[0].hn).toBe('0000202')
  })

  it('runs check1B004_0NAdpMapping and getService1B004_0NReport, computing KPIs and filters', async () => {
    const mockExecutor = vi.fn(async (sql: string) => {
      if (sql.includes('FROM s_drugitems d') && sql.includes('WHERE TRIM(d.nhso_adp_code) IN')) {
        return [
          {
            icode: '1590002',
            name: 'ตรวจคัดกรองมะเร็งปากมดลูก (1B004_0N)',
            strength: '1 ครั้ง',
            nhso_adp_code: '1B004_0N',
          },
        ]
      }

      if (sql.includes('FROM ovst o')) {
        return [
          {
            vn: '671001003',
            cid: '3520900015555',
            hn: '0000301',
            ptname: 'นาง วิไลพร ใจกล้า',
            age: 38,
            nation: 'ไทย',
            vstdate: '2024-10-02',
            vsttime: '09:00:00',
            authencode: 'AUTH301',
            pttypename: 'ประกันสังคม',
            department: 'สูตินรีเวชกรรม',
            clinic: 'นรีเวชกรรม',
            pdx: 'Z124',
            dx0: null,
            dx1: null,
            dx2: null,
            dx3: null,
            dx4: null,
            dx5: null,
            op0: '6712',
            op1: null,
            op2: null,
            op3: null,
            op4: null,
            op5: null,
            listname: 'ตรวจคัดกรองมะเร็งปากมดลูก (1B004_0N)',
            status: 'Rep :: มี Rep แล้ว',
            rep: 'REP2024-003',
            compensated: 600,
          },
          {
            vn: '671001004',
            cid: '3520900015666',
            hn: '0000302',
            ptname: 'นาง กัญญารัตน์ ทองทิพย์',
            age: 45,
            nation: 'ไทย',
            vstdate: '2024-10-03',
            vsttime: '10:30:00',
            authencode: null,
            pttypename: 'บัตรทอง',
            department: 'ตรวจโรคทั่วไป',
            clinic: 'เวชปฏิบัติทั่วไป',
            pdx: 'Z124',
            dx0: null,
            dx1: null,
            dx2: null,
            dx3: null,
            dx4: null,
            dx5: null,
            op0: null,
            op1: null,
            op2: null,
            op3: null,
            op4: null,
            op5: null,
            listname: 'ตรวจคัดกรองมะเร็งปากมดลูก (1B004_0N)',
            status: null,
            rep: null,
            compensated: 0,
          },
        ]
      }

      return []
    })

    // Test check1B004_0NAdpMapping
    const mapRes = await RcmCervicalCancerService.check1B004_0NAdpMapping(mockExecutor)
    expect(mapRes.isMapped).toBe(true)
    expect(mapRes.mappedCount).toBe(1)
    expect(mapRes.items[0].nhso_adp_code).toBe('1B004_0N')

    // Test getService1B004_0NReport
    const repRes = await RcmCervicalCancerService.getService1B004_0NReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
      },
      mockExecutor
    )

    expect(repRes.summary.totalVisits).toBe(2)
    expect(repRes.summary.uniquePatients).toBe(2)
    expect(repRes.summary.compensatedVisits).toBe(1)
    expect(repRes.summary.uncompensatedVisits).toBe(1)
    expect(repRes.summary.totalCompensated).toBe(600)
    expect(repRes.summary.averageCompensated).toBe(600)
    expect(repRes.summary.withAuthenCount).toBe(1)
    expect(repRes.summary.withoutAuthenCount).toBe(1)
    expect(repRes.summary.withPdxCount).toBe(2)
    expect(repRes.summary.withOpCount).toBe(1)
    expect(repRes.items).toHaveLength(2)

    // Test compensationFilter='COMPENSATED'
    const compOnly = await RcmCervicalCancerService.getService1B004_0NReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
        compensationFilter: 'COMPENSATED',
      },
      mockExecutor
    )
    expect(compOnly.items).toHaveLength(1)
    expect(compOnly.items[0].hn).toBe('0000301')

    // Test search='กัญญารัตน์'
    const searchRes = await RcmCervicalCancerService.getService1B004_0NReport(
      {
        ds1: '2025-10-01',
        ds2: '2026-09-30',
        search: 'กัญญารัตน์',
      },
      mockExecutor
    )
    expect(searchRes.items).toHaveLength(1)
    expect(searchRes.items[0].hn).toBe('0000302')
  })
})


