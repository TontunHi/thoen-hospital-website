import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMemoryCache } from '@/lib/cache'
import {
  getFiscalYearDateRange,
  runLabTrackingPipeline,
} from '../dmRemissionLabDomain'
import { DmRemissionLabService, type DmRemissionLabGatewayDeps } from '../dmRemissionLabService'
import type { DmLabTrackingRecord } from '../dmRemissionLabTypes'

function makeTrackingRecord(
  overrides: Partial<DmLabTrackingRecord> = {}
): DmLabTrackingRecord {
  return {
    hn: '0001234',
    cid: '1520000000001',
    patientName: 'นายทดสอบ ระบบ',
    ageYears: 58,
    sexLabel: 'ชาย',
    deathFlag: false,
    visitDate: '2026-08-12',
    vn: '690812091234',
    labOrderNumber: 5001,
    latestA1c: 6.1,
    a1cTestCount: 2,
    prevA1c: 6.4,
    prevA1cDate: '2026-02-10',
    visitPttypeCode: '33',
    visitPttypeName: 'บัตรทอง 30บาท ในเขต',
    currentPttypeCode: '33',
    currentPttypeName: 'บัตรทอง 30บาท ในเขต',
    isUcVisit: true,
    isUcCurrent: true,
    lastE11Date: '2026-08-12',
    lastE11Icd10: 'E119',
    inFyE11Count: 2,
    sameVnE11: true,
    hasDmDrugInFy: false,
    hasDmDrug90dBeforeLab: false,
    hasDmDrugOnLabVisit: false,
    lastDmDrugDate: null,
    dmDrugsInFy: [],
    tambonName: 'ล้อมแรด',
    villageName: 'บ้านล้อมแรด',
    villageMoo: '1',
    inCohortRegistry: false,
    cohortRemissionStatus: null,
    ...overrides,
  }
}

describe('dmRemissionLabDomain & DmRemissionLabService', () => {
  beforeEach(() => {
    clearMemoryCache()
    vi.clearAllMocks()
  })

  it('computes Thai fiscal year date range accurately', () => {
    expect(getFiscalYearDateRange(2569)).toEqual({
      startDate: '2025-10-01',
      endDate: '2026-09-30',
    })
    expect(getFiscalYearDateRange(2570)).toEqual({
      startDate: '2026-10-01',
      endDate: '2027-09-30',
    })
  })

  it('runs screening funnel, excludes deceased by default, and respects rule scopes', () => {
    const pool: DmLabTrackingRecord[] = [
      makeTrackingRecord({ hn: '0000001', latestA1c: 5.5, inCohortRegistry: true, cohortRemissionStatus: 'Remission' }),
      makeTrackingRecord({ hn: '0000002', latestA1c: 6.3, hasDmDrugInFy: true, hasDmDrugOnLabVisit: false, dmDrugsInFy: ['METFORMIN 500 mg'] }),
      makeTrackingRecord({ hn: '0000003', latestA1c: 6.2, isUcVisit: false, isUcCurrent: true }),
      makeTrackingRecord({ hn: '0000004', latestA1c: 6.0, lastE11Date: null, inFyE11Count: 0, sameVnE11: false }),
      makeTrackingRecord({ hn: '0000005', latestA1c: 5.9, deathFlag: true }),
    ]

    const defaultResult = runLabTrackingPipeline({
      totalA1cTested: 100,
      basePool: pool,
      a1cMax: 6.5,
      ucScope: 'visit',
      diagScope: 'ever',
      drugScope: 'fy',
      cohortStatus: 'all',
      includeDeceased: false,
      page: 1,
      pageSize: 50,
      exportAll: false,
    })

    expect(defaultResult.summary.funnel).toEqual({
      totalA1cTested: 100,
      a1cUnderLimit: 4,
      ucEligible: 3,
      e11Diagnosed: 2,
      noDmDrugs: 1,
      registeredInCohort: 1,
      unregisteredCandidates: 0,
    })
    expect(defaultResult.items.map((r) => r.hn)).toEqual(['0000001'])

    const visitOnlyResult = runLabTrackingPipeline({
      totalA1cTested: 100,
      basePool: pool,
      a1cMax: 6.5,
      ucScope: 'either',
      diagScope: 'ever',
      drugScope: 'visit_only',
      cohortStatus: 'all',
      includeDeceased: true,
      page: 1,
      pageSize: 50,
      exportAll: false,
    })
    expect(visitOnlyResult.items.map((r) => r.hn).sort()).toEqual([
      '0000001',
      '0000002',
      '0000003',
      '0000005',
    ])
  })

  it('loads fiscal year dataset via Gateway Named API, caches SWR, and invalidates on refresh', async () => {
    const getDmRemissionLabDatasetRaw = vi.fn<DmRemissionLabGatewayDeps['getDmRemissionLabDatasetRaw']>()
    const getDmRemissionLabTimelineRaw = vi.fn<DmRemissionLabGatewayDeps['getDmRemissionLabTimelineRaw']>()

    getDmRemissionLabDatasetRaw.mockResolvedValueOnce({
      totalA1cTested: 120,
      baseRows: [
        {
          hn: '0001234',
          cid: '1520000000001',
          patient_name: 'นายสมชาย ทดสอบ',
          age_years: 61,
          sex_label: 'ชาย',
          death_flag: 0,
          visit_date: '2026-08-15',
          vn: '6908150001',
          lab_order_number: 991,
          latest_a1c: '6.20',
          a1c_test_count: 2,
          prev_entry: '2026-02-01|6.70',
          visit_pttype_code: '33',
          visit_pttype_name: 'บัตรทอง 30บาท ในเขต',
          is_uc_visit: 1,
          current_pttype_code: '33',
          current_pttype_name: 'บัตรทอง 30บาท ในเขต',
          is_uc_current: 1,
          tambon_name: 'ล้อมแรด',
          village_name: 'บ้านล้อมแรด',
          village_moo: '2',
        },
        {
          hn: '0005678',
          cid: '1520000000002',
          patient_name: 'นางสมหญิง ทดสอบ',
          age_years: 55,
          sex_label: 'หญิง',
          death_flag: 0,
          visit_date: '2026-07-10',
          vn: '6907100002',
          lab_order_number: 992,
          latest_a1c: '5.80',
          a1c_test_count: 1,
          prev_entry: null,
          visit_pttype_code: '33',
          visit_pttype_name: 'บัตรทอง 30บาท ในเขต',
          is_uc_visit: 1,
          current_pttype_code: '33',
          current_pttype_name: 'บัตรทอง 30บาท ในเขต',
          is_uc_current: 1,
          tambon_name: 'เถินบุรี',
          village_name: 'บ้านท่า',
          village_moo: '4',
        },
      ],
      e11Rows: [
        { hn: '0001234', last_e11_date: '2026-08-15', last_e11_icd10: 'E119', in_fy_e11_count: 2 },
        { hn: '0005678', last_e11_date: '2025-04-01', last_e11_icd10: 'E119', in_fy_e11_count: 0 },
      ],
      sameVnRows: [{ vn: '6908150001' }],
      rxRows: [{ hn: '0005678', vn: '6907100002', vstdate: '2026-07-10', icodes: '1000184' }],
      cohortRows: [{ hn: '0001234', cid: '1520000000001', summary_remission: 'Remission' }],
      t1dmRows: [],
      t1dmMirrorRows: [],
    })

    const service = new DmRemissionLabService({
      getDmRemissionLabDatasetRaw,
      getDmRemissionLabTimelineRaw,
    })

    const first = await service.getLabTracking({ fiscalYear: 2569 })
    expect(first.fiscalYear).toBe(2569)
    expect(first.summary.totalEligible).toBe(1)
    expect(first.items[0].hn).toBe('0001234')
    expect(first.items[0].inCohortRegistry).toBe(true)
    expect(first.items[0].cohortRemissionStatus).toBe('Remission')
    expect(first.items[0].prevA1c).toBe(6.7)
    expect(getDmRemissionLabDatasetRaw).toHaveBeenCalledTimes(1)

    const second = await service.getLabTracking({ fiscalYear: 2569, drugScope: 'all', a1cMax: 7.0 })
    expect(second.summary.totalEligible).toBe(2)
    expect(getDmRemissionLabDatasetRaw).toHaveBeenCalledTimes(1)

    getDmRemissionLabDatasetRaw.mockResolvedValueOnce({
      totalA1cTested: 121,
      baseRows: [],
      e11Rows: [],
      sameVnRows: [],
      rxRows: [],
      cohortRows: [],
      t1dmRows: [],
      t1dmMirrorRows: [],
    })
    await service.getLabTracking({ fiscalYear: 2569, refresh: true })
    expect(getDmRemissionLabDatasetRaw).toHaveBeenCalledTimes(2)
  })

  it('marks patients found in rcmdb.t1dm or t1dm_registries as registered in DM registry', async () => {
    const getDmRemissionLabDatasetRaw = vi.fn<DmRemissionLabGatewayDeps['getDmRemissionLabDatasetRaw']>()
    getDmRemissionLabDatasetRaw.mockResolvedValueOnce({
      totalA1cTested: 2,
      baseRows: [
        {
          hn: '0002001',
          cid: '1520000002001',
          patient_name: 'นายหนึ่ง ในt1dm',
          age_years: 45,
          sex_label: 'ชาย',
          death_flag: 0,
          visit_date: '2026-08-10',
          vn: '6908100001',
          lab_order_number: 1001,
          latest_a1c: '6.10',
          a1c_test_count: 1,
          prev_entry: null,
          visit_pttype_code: '33',
          visit_pttype_name: 'บัตรทอง',
          is_uc_visit: 1,
          current_pttype_code: '33',
          current_pttype_name: 'บัตรทอง',
          is_uc_current: 1,
          tambon_name: 'ล้อมแรด',
          village_name: 'บ้านล้อมแรด',
          village_moo: '1',
        },
        {
          hn: '0002002',
          cid: '1520000002002',
          patient_name: 'นางสอง ในmirror',
          age_years: 32,
          sex_label: 'หญิง',
          death_flag: 0,
          visit_date: '2026-08-11',
          vn: '6908110002',
          lab_order_number: 1002,
          latest_a1c: '5.90',
          a1c_test_count: 1,
          prev_entry: null,
          visit_pttype_code: '33',
          visit_pttype_name: 'บัตรทอง',
          is_uc_visit: 1,
          current_pttype_code: '33',
          current_pttype_name: 'บัตรทอง',
          is_uc_current: 1,
          tambon_name: 'ล้อมแรด',
          village_name: 'บ้านล้อมแรด',
          village_moo: '1',
        },
      ],
      e11Rows: [
        { hn: '0002001', last_e11_date: '2026-08-10', last_e11_icd10: 'E119', in_fy_e11_count: 1 },
        { hn: '0002002', last_e11_date: '2026-08-11', last_e11_icd10: 'E119', in_fy_e11_count: 1 },
      ],
      sameVnRows: [{ vn: '6908100001' }, { vn: '6908110002' }],
      rxRows: [],
      t1dmRows: [{ pid: '1520000002001', type: 'T1DM' }],
      cohortRows: [{ hn: '0002002', cid: '1520000002002', summary_remission: 'ไม่ Remission' }],
      t1dmMirrorRows: [{ pid: '1520000002002', type: 'GDM' }],
    })

    const service = new DmRemissionLabService({ getDmRemissionLabDatasetRaw })
    const result = await service.getLabTracking({ fiscalYear: 2569 })

    expect(result.summary.registeredCount).toBe(2)
    expect(result.summary.unregisteredCount).toBe(0)
    expect(result.summary.funnel.registeredInCohort).toBe(2)

    const byHn = new Map(result.items.map((item) => [item.hn, item]))
    expect(byHn.get('0002001')).toMatchObject({
      inCohortRegistry: true,
      cohortRemissionStatus: 'T1DM',
      inDmRemissionCohort: false,
      inT1dmRegistry: true,
      t1dmRegistryType: 'T1DM',
    })
    expect(byHn.get('0002002')).toMatchObject({
      inCohortRegistry: true,
      cohortRemissionStatus: 'ไม่ Remission',
      inDmRemissionCohort: true,
      inT1dmRegistry: true,
      t1dmRegistryType: 'GDM',
    })
    expect(result.summary.dmRemissionCount).toBe(1)
    expect(result.summary.t1dmRegistryCount).toBe(2)
    expect(result.summary.bothRegistriesCount).toBe(1)

    const bothOnly = await service.getLabTracking({ fiscalYear: 2569, cohortStatus: 'both' })
    expect(bothOnly.items.map((item) => item.hn)).toEqual(['0002002'])

    const dmOnly = await service.getLabTracking({ fiscalYear: 2569, cohortStatus: 'dm_remission' })
    expect(dmOnly.items.map((item) => item.hn)).toEqual(['0002002'])

    const t1dmOnly = await service.getLabTracking({ fiscalYear: 2569, cohortStatus: 't1dm' })
    expect(t1dmOnly.items.map((item) => item.hn)).toEqual(['0002002', '0002001'])
  })

  it('fetches patient lab, E11, and DM drug timeline or returns null if HN not found', async () => {
    const getDmRemissionLabTimelineRaw = vi.fn<DmRemissionLabGatewayDeps['getDmRemissionLabTimelineRaw']>()
    const service = new DmRemissionLabService({ getDmRemissionLabTimelineRaw })

    getDmRemissionLabTimelineRaw.mockResolvedValueOnce({
      patientRows: [],
      labRows: [],
      diagRows: [],
      rxRows: [],
    })
    const missing = await service.getPatientLabTimeline('9999999')
    expect(missing).toBeNull()
    expect(getDmRemissionLabTimelineRaw).toHaveBeenCalledWith('9999999')

    getDmRemissionLabTimelineRaw.mockResolvedValueOnce({
      patientRows: [
        {
          hn: '0001234',
          cid: '1520000000001',
          patient_name: 'นายสมชาย ทดสอบ',
          age_years: 61,
          pttype_name: 'บัตรทอง 30บาท ในเขต',
        },
      ],
      labRows: [
        { lab_order_number: 5001, order_date: '2026-08-15', vn: '6908150001', a1c_result: '6.1', fpg_result: '108' },
      ],
      diagRows: [
        { vstdate: '2026-08-15', vn: '6908150001', icd10: 'E119', diagtype: '1' },
      ],
      rxRows: [],
    })

    const timeline = await service.getPatientLabTimeline('1234')
    expect(timeline).not.toBeNull()
    expect(timeline?.hn).toBe('0001234')
    expect(timeline?.labHistory[0]).toMatchObject({ a1c: 6.1, fpg: 108 })
    expect(timeline?.e11Diagnoses[0].icd10).toBe('E119')
    expect(timeline?.dmPrescriptions).toEqual([])
  })
})
