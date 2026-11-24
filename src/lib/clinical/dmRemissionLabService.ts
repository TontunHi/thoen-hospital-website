import { apiGateway } from '@/lib/apiGateway'
import { getSwrCachedData } from '@/lib/cache'
import {
  getCurrentThaiFiscalYear,
  normalizeCid,
  normalizeHn,
  toNullableNumber,
} from './dmRemissionDomain'
import {
  DEFAULT_A1C_MAX,
  DEFAULT_PAGE_SIZE,
  getAvailableLabTrackingFiscalYears,
  getFiscalYearDateRange,
  runLabTrackingPipeline,
} from './dmRemissionLabDomain'
import {
  DM_ANTIDIABETIC_DRUGS,
  type DmLabPatientTimeline,
  type DmLabTrackingFilters,
  type DmLabTrackingRecord,
  type DmLabTrackingResult,
} from './dmRemissionLabTypes'

export interface DmRemissionLabGatewayDeps {
  getDmRemissionLabDatasetRaw: typeof apiGateway.clinical.getDmRemissionLabDatasetRaw
  getDmRemissionLabTimelineRaw: typeof apiGateway.clinical.getDmRemissionLabTimelineRaw
}

interface LabBaseSqlRow {
  hn: string
  cid: string | null
  patient_name: string | null
  age_years: number | string | null
  sex_label: string | null
  death_flag: number | string | null
  visit_date: string
  vn: string | null
  lab_order_number: number | string
  latest_a1c: number | string
  a1c_test_count: number | string
  prev_entry: string | null
  visit_pttype_code: string | null
  visit_pttype_name: string | null
  is_uc_visit: number | string | null
  current_pttype_code: string | null
  current_pttype_name: string | null
  is_uc_current: number | string | null
  tambon_name: string | null
  village_name: string | null
  village_moo: string | null
}

interface E11AggSqlRow {
  hn: string
  last_e11_date: string | null
  last_e11_icd10: string | null
  in_fy_e11_count: number | string | null
}

interface SameVnE11SqlRow {
  vn: string
}

interface DmDrugVisitSqlRow {
  hn: string
  vn: string | null
  vstdate: string
  icodes: string | null
}

interface CohortLookupSqlRow {
  hn: string | null
  cid: string | null
  summary_remission: string | null
}

interface T1dmLookupSqlRow {
  pid: string | null
  type: string | null
}

interface CachedFiscalYearDataset {
  totalA1cTested: number
  basePool: DmLabTrackingRecord[]
  fetchedAt: string
}

const DRUG_NAME_BY_ICODE = new Map<string, string>(
  DM_ANTIDIABETIC_DRUGS.map((item) => [item.icode, item.name])
)

function parsePrevEntry(prevEntry: string | null): {
  prevA1c: number | null
  prevA1cDate: string | null
} {
  if (!prevEntry) return { prevA1c: null, prevA1cDate: null }
  const parts = prevEntry.split('|')
  if (parts.length >= 3) {
    return {
      prevA1cDate: parts[0]?.trim() || null,
      prevA1c: toNullableNumber(parts[2]),
    }
  }
  return {
    prevA1cDate: parts[0]?.trim() || null,
    prevA1c: toNullableNumber(parts[1]),
  }
}

function shiftIsoDateDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return dt.toISOString().slice(0, 10)
}

export class DmRemissionLabService {
  private readonly gw: DmRemissionLabGatewayDeps

  constructor(deps?: Partial<DmRemissionLabGatewayDeps>) {
    this.gw = {
      getDmRemissionLabDatasetRaw:
        deps?.getDmRemissionLabDatasetRaw ??
        ((p) => apiGateway.clinical.getDmRemissionLabDatasetRaw(p)),
      getDmRemissionLabTimelineRaw:
        deps?.getDmRemissionLabTimelineRaw ??
        ((hn) => apiGateway.clinical.getDmRemissionLabTimelineRaw(hn)),
    }
  }

  private async loadFiscalYearDataset(
    fiscalYear: number,
    a1cMax: number
  ): Promise<CachedFiscalYearDataset> {
    const { startDate, endDate } = getFiscalYearDateRange(fiscalYear)
    const raw = await this.gw.getDmRemissionLabDatasetRaw({
      startDate,
      endDate,
      fiscalYear,
      a1cMax,
    })

    const totalA1cTested = Number(raw.totalA1cTested ?? 0)
    const fetchedAt = new Date().toISOString()
    const baseRows = (raw.baseRows ?? []) as unknown as LabBaseSqlRow[]

    if (baseRows.length === 0) {
      return { totalA1cTested, basePool: [], fetchedAt }
    }

    const e11ByHn = new Map<string, E11AggSqlRow>()
    for (const row of (raw.e11Rows ?? []) as unknown as E11AggSqlRow[]) {
      e11ByHn.set(row.hn, row)
    }

    const sameVnE11Set = new Set<string>()
    for (const row of (raw.sameVnRows ?? []) as unknown as SameVnE11SqlRow[]) {
      if (row.vn) sameVnE11Set.add(row.vn)
    }

    const rxByHn = new Map<string, DmDrugVisitSqlRow[]>()
    for (const row of (raw.rxRows ?? []) as unknown as DmDrugVisitSqlRow[]) {
      const list = rxByHn.get(row.hn) ?? []
      list.push(row)
      rxByHn.set(row.hn, list)
    }

    const cohortByHn = new Map<string, string | null>()
    const cohortByCid = new Map<string, string | null>()
    for (const row of (raw.cohortRows ?? []) as unknown as CohortLookupSqlRow[]) {
      const normHn = normalizeHn(row.hn)
      if (normHn) cohortByHn.set(normHn, row.summary_remission ?? null)
      const normCid = normalizeCid(row.cid)
      if (normCid) cohortByCid.set(normCid, row.summary_remission ?? null)
    }

    // Match the registration source of /service/dashboard-rcm/funds/t1dm-gdm-pdm/2
    // (rcmdb.t1dm + Website DB mirror table t1dm_registries by PID/CID).
    const t1dmByCid = new Map<string, string | null>()
    for (const row of (raw.t1dmRows ?? []) as unknown as T1dmLookupSqlRow[]) {
      const normPid = normalizeCid(row.pid)
      if (normPid) {
        t1dmByCid.set(normPid, row.type?.trim() || null)
      }
    }
    for (const row of (raw.t1dmMirrorRows ?? []) as unknown as T1dmLookupSqlRow[]) {
      const normPid = normalizeCid(row.pid)
      if (normPid) {
        const existing = t1dmByCid.get(normPid) ?? null
        t1dmByCid.set(normPid, row.type?.trim() || existing)
      }
    }

    const basePool: DmLabTrackingRecord[] = baseRows.map((row) => {
      const e11 = e11ByHn.get(row.hn)
      const rxList = rxByHn.get(row.hn) ?? []
      const labVisitDate = row.visit_date
      const labMinus90 = shiftIsoDateDays(labVisitDate, -90)
      const vnStr = row.vn?.trim() || ''

      let hasDmDrugInFy = false
      let hasDmDrug90dBeforeLab = false
      let hasDmDrugOnLabVisit = false
      let lastDmDrugDate: string | null = null
      const fyDrugNames = new Set<string>()

      for (const rx of rxList) {
        if (!lastDmDrugDate || rx.vstdate > lastDmDrugDate) {
          lastDmDrugDate = rx.vstdate
        }
        if (rx.vstdate >= startDate && rx.vstdate <= endDate) {
          hasDmDrugInFy = true
          for (const code of (rx.icodes || '').split(',')) {
            const trimmedCode = code.trim()
            if (trimmedCode) {
              fyDrugNames.add(DRUG_NAME_BY_ICODE.get(trimmedCode) ?? trimmedCode)
            }
          }
        }
        if (rx.vstdate >= labMinus90 && rx.vstdate <= labVisitDate) {
          hasDmDrug90dBeforeLab = true
        }
        if (vnStr && rx.vn && rx.vn.trim() === vnStr) {
          hasDmDrugOnLabVisit = true
        }
      }

      const normHn = normalizeHn(row.hn)
      const normCid = normalizeCid(row.cid)
      const matchedByHn = normHn ? cohortByHn.has(normHn) : false
      const matchedByCid = normCid ? cohortByCid.has(normCid) : false
      const matchedInCohort = matchedByHn || matchedByCid
      const matchedInT1dm = normCid ? t1dmByCid.has(normCid) : false
      const inCohortRegistry = matchedInCohort || matchedInT1dm
      const cohortStatus = matchedByHn
        ? (cohortByHn.get(normHn!) ?? null)
        : matchedByCid
          ? (cohortByCid.get(normCid!) ?? null)
          : null
      const t1dmType = matchedInT1dm ? (t1dmByCid.get(normCid!) ?? null) : null
      const cohortRemissionStatus = matchedInCohort
        ? cohortStatus
        : matchedInT1dm
          ? t1dmType || 'ลงทะเบียนแล้ว'
          : null

      const { prevA1c, prevA1cDate } = parsePrevEntry(row.prev_entry)

      return {
        hn: row.hn,
        cid: row.cid?.trim() || null,
        patientName: (row.patient_name || '').trim() || `HN ${row.hn}`,
        ageYears: toNullableNumber(row.age_years),
        sexLabel: row.sex_label ?? null,
        deathFlag: Number(row.death_flag ?? 0) === 1,
        visitDate: labVisitDate,
        vn: vnStr,
        labOrderNumber: Number(row.lab_order_number),
        latestA1c: Number(row.latest_a1c),
        a1cTestCount: Number(row.a1c_test_count ?? 1),
        prevA1c,
        prevA1cDate,
        visitPttypeCode: row.visit_pttype_code ?? null,
        visitPttypeName: row.visit_pttype_name ?? null,
        currentPttypeCode: row.current_pttype_code ?? null,
        currentPttypeName: row.current_pttype_name ?? null,
        isUcVisit: Number(row.is_uc_visit ?? 0) === 1,
        isUcCurrent: Number(row.is_uc_current ?? 0) === 1,
        lastE11Date: e11?.last_e11_date ?? null,
        lastE11Icd10: e11?.last_e11_icd10 ?? null,
        inFyE11Count: Number(e11?.in_fy_e11_count ?? 0),
        sameVnE11: vnStr ? sameVnE11Set.has(vnStr) : false,
        hasDmDrugInFy,
        hasDmDrug90dBeforeLab,
        hasDmDrugOnLabVisit,
        lastDmDrugDate,
        dmDrugsInFy: Array.from(fyDrugNames),
        tambonName: row.tambon_name?.trim() || null,
        villageName: row.village_name?.trim() || null,
        villageMoo: row.village_moo?.trim() || null,
        inCohortRegistry,
        cohortRemissionStatus,
        inDmRemissionCohort: matchedInCohort,
        inT1dmRegistry: matchedInT1dm,
        t1dmRegistryType: t1dmType,
      }
    })

    return { totalA1cTested, basePool, fetchedAt }
  }

  async getLabTracking(filters: DmLabTrackingFilters = {}): Promise<DmLabTrackingResult> {
    const fiscalYear = filters.fiscalYear ?? getCurrentThaiFiscalYear()
    const a1cMax = filters.a1cMax ?? DEFAULT_A1C_MAX
    const ucScope = filters.ucScope ?? 'visit'
    const diagScope = filters.diagScope ?? 'ever'
    const drugScope = filters.drugScope ?? 'fy'
    const cohortStatus = filters.cohortStatus ?? 'all'
    const includeDeceased = filters.includeDeceased ?? false
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
    const exportAll = filters.exportAll ?? false

    const cacheCeiling = Math.max(7.0, a1cMax)
    const cacheKey = `dm_remission_lab:fy:${fiscalYear}:a1c:${cacheCeiling.toFixed(2)}`

    const dataset = await getSwrCachedData(
      cacheKey,
      () => this.loadFiscalYearDataset(fiscalYear, cacheCeiling),
      {
        staleTtlMs: 120_000,
        maxTtlMs: 600_000,
        forceRefresh: filters.refresh,
      }
    )

    const pipelineResult = runLabTrackingPipeline({
      totalA1cTested: dataset.totalA1cTested,
      basePool: dataset.basePool,
      a1cMax,
      ucScope,
      diagScope,
      drugScope,
      cohortStatus,
      tambon: filters.tambon,
      search: filters.search,
      includeDeceased,
      page,
      pageSize,
      exportAll,
    })

    return {
      fiscalYear,
      fiscalYearRange: getFiscalYearDateRange(fiscalYear),
      availableFiscalYears: getAvailableLabTrackingFiscalYears(),
      availableTambons: pipelineResult.availableTambons,
      appliedFilters: {
        fiscalYear,
        a1cMax,
        ucScope,
        diagScope,
        drugScope,
        cohortStatus,
        tambon: filters.tambon?.trim() || null,
        search: filters.search?.trim() || null,
        includeDeceased,
      },
      summary: pipelineResult.summary,
      items: pipelineResult.items,
      pagination: pipelineResult.pagination,
      fetchedAt: dataset.fetchedAt,
    }
  }

  async getPatientLabTimeline(rawHn: string): Promise<DmLabPatientTimeline | null> {
    const hn = normalizeHn(rawHn) ?? rawHn.trim()
    const raw = await this.gw.getDmRemissionLabTimelineRaw(hn)
    const patientRows = (raw.patientRows ?? []) as Array<{
      hn: string
      cid: string | null
      patient_name: string | null
      age_years: number | string | null
      pttype_name: string | null
    }>

    if (patientRows.length === 0) {
      return null
    }

    const patient = patientRows[0]
    const labRows = (raw.labRows ?? []) as Array<{
      lab_order_number: number | string
      order_date: string
      vn: string | null
      a1c_result: string | null
      fpg_result: string | null
    }>
    const diagRows = (raw.diagRows ?? []) as Array<{
      vstdate: string
      vn: string
      icd10: string
      diagtype: string | null
    }>
    const rxRows = (raw.rxRows ?? []) as Array<{
      vstdate: string
      vn: string
      icode: string
      drug_name: string | null
      qty: number | string | null
    }>

    return {
      hn: patient.hn,
      patientName: (patient.patient_name || '').trim() || `HN ${patient.hn}`,
      cid: patient.cid?.trim() || null,
      ageYears: toNullableNumber(patient.age_years),
      currentPttypeName: patient.pttype_name ?? null,
      labHistory: labRows.map((r) => ({
        labOrderNumber: Number(r.lab_order_number),
        orderDate: r.order_date,
        vn: r.vn ?? '',
        a1c: toNullableNumber(r.a1c_result),
        fpg: toNullableNumber(r.fpg_result),
      })),
      e11Diagnoses: diagRows.map((r) => ({
        vstdate: r.vstdate,
        vn: r.vn,
        icd10: r.icd10,
        diagType: r.diagtype ?? null,
      })),
      dmPrescriptions: rxRows.map((r) => ({
        vstdate: r.vstdate,
        vn: r.vn,
        icode: r.icode,
        drugName: r.drug_name?.trim() || DRUG_NAME_BY_ICODE.get(r.icode) || r.icode,
        qty: toNullableNumber(r.qty),
      })),
    }
  }
}

export const dmRemissionLabService = new DmRemissionLabService()
