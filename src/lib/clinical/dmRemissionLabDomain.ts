import { getCurrentThaiFiscalYear, normalizeCid, normalizeHn } from './dmRemissionDomain'
import type {
  DmLabA1cBandStat,
  DmLabCohortStatusFilter,
  DmLabDiagScope,
  DmLabDrugScope,
  DmLabTambonStat,
  DmLabTrackingFunnel,
  DmLabTrackingRecord,
  DmLabTrackingSummary,
  DmLabUcScope,
} from './dmRemissionLabTypes'

export const DEFAULT_A1C_MAX = 6.5
export const DEFAULT_PAGE_SIZE = 50
const UNSPECIFIED_TAMBON = 'ไม่ระบุตำบล'

export function getFiscalYearDateRange(fiscalYear: number): {
  startDate: string
  endDate: string
} {
  // Thai fiscal year runs Oct 1 (FY - 544 AD) to Sep 30 (FY - 543 AD).
  const startYearAd = fiscalYear - 544
  const endYearAd = fiscalYear - 543
  return {
    startDate: `${startYearAd}-10-01`,
    endDate: `${endYearAd}-09-30`,
  }
}

export function getAvailableLabTrackingFiscalYears(
  referenceDate: Date = new Date()
): number[] {
  const current = getCurrentThaiFiscalYear(referenceDate)
  return [current, current - 1, current - 2, current - 3]
}

export function matchesUcScope(
  record: Pick<DmLabTrackingRecord, 'isUcVisit' | 'isUcCurrent'>,
  ucScope: DmLabUcScope
): boolean {
  if (ucScope === 'visit') return record.isUcVisit
  if (ucScope === 'current') return record.isUcCurrent
  return record.isUcVisit || record.isUcCurrent
}

export function matchesDiagScope(
  record: Pick<DmLabTrackingRecord, 'lastE11Date' | 'inFyE11Count' | 'sameVnE11'>,
  diagScope: DmLabDiagScope
): boolean {
  if (diagScope === 'same_vn') return record.sameVnE11
  if (diagScope === 'in_fy') return record.inFyE11Count > 0
  return record.lastE11Date !== null
}

export function matchesDrugScope(
  record: Pick<
    DmLabTrackingRecord,
    'hasDmDrugInFy' | 'hasDmDrug90dBeforeLab' | 'hasDmDrugOnLabVisit'
  >,
  drugScope: DmLabDrugScope
): boolean {
  if (drugScope === 'all') return true
  if (drugScope === 'visit_only') return !record.hasDmDrugOnLabVisit
  if (drugScope === '90d_before_lab') return !record.hasDmDrug90dBeforeLab
  return !record.hasDmDrugInFy
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return roundTo(sorted[mid], 2)
  }
  return roundTo((sorted[mid - 1] + sorted[mid]) / 2, 2)
}

function computeA1cBands(records: DmLabTrackingRecord[], a1cMax: number): DmLabA1cBandStat[] {
  const total = records.length
  const pct = (count: number) => (total > 0 ? roundTo((count / total) * 100, 1) : 0)

  const under57 = records.filter((r) => r.latestA1c < 5.7).length
  const mid57to60 = records.filter((r) => r.latestA1c >= 5.7 && r.latestA1c <= 6.0).length
  const high61to65 = records.filter((r) => r.latestA1c > 6.0 && r.latestA1c <= 6.5).length
  const bands: DmLabA1cBandStat[] = [
    {
      key: 'lt_5_7',
      label: '< 5.7% (ช่วงปกติ)',
      count: under57,
      percent: pct(under57),
    },
    {
      key: '5_7_to_6_0',
      label: '5.7 – 6.0%',
      count: mid57to60,
      percent: pct(mid57to60),
    },
    {
      key: '6_1_to_6_5',
      label: '6.1 – 6.5%',
      count: high61to65,
      percent: pct(high61to65),
    },
  ]

  if (a1cMax > 6.5) {
    const above65 = records.filter((r) => r.latestA1c > 6.5 && r.latestA1c <= a1cMax).length
    bands.push({
      key: 'gt_6_5',
      label: `6.6 – ${a1cMax.toFixed(1)}%`,
      count: above65,
      percent: pct(above65),
    })
  }

  return bands
}

export interface LabTrackingPipelineParams {
  totalA1cTested: number
  basePool: DmLabTrackingRecord[]
  a1cMax: number
  ucScope: DmLabUcScope
  diagScope: DmLabDiagScope
  drugScope: DmLabDrugScope
  cohortStatus: DmLabCohortStatusFilter
  tambon?: string
  search?: string
  includeDeceased: boolean
  page: number
  pageSize: number
  exportAll: boolean
}

export function runLabTrackingPipeline(params: LabTrackingPipelineParams): {
  summary: DmLabTrackingSummary
  items: DmLabTrackingRecord[]
  availableTambons: string[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
} {
  const {
    totalA1cTested,
    basePool,
    a1cMax,
    ucScope,
    diagScope,
    drugScope,
    cohortStatus,
    tambon,
    search,
    includeDeceased,
    page,
    pageSize,
    exportAll,
  } = params

  const alivePool = includeDeceased ? basePool : basePool.filter((r) => !r.deathFlag)
  const stepA1c = alivePool.filter((r) => r.latestA1c <= a1cMax)
  const stepUc = stepA1c.filter((r) => matchesUcScope(r, ucScope))
  const stepE11 = stepUc.filter((r) => matchesDiagScope(r, diagScope))
  const stepNoDrug = stepE11.filter((r) => matchesDrugScope(r, drugScope))

  const registeredInEligible = stepNoDrug.filter((r) => r.inCohortRegistry).length
  const funnel: DmLabTrackingFunnel = {
    totalA1cTested,
    a1cUnderLimit: stepA1c.length,
    ucEligible: stepUc.length,
    e11Diagnosed: stepE11.length,
    noDmDrugs: stepNoDrug.length,
    registeredInCohort: registeredInEligible,
    unregisteredCandidates: stepNoDrug.length - registeredInEligible,
  }

  // Collect available tambons and tambon breakdown from all clinical-criteria eligible patients
  const tambonMap = new Map<string, { count: number; registeredCount: number }>()
  for (const row of stepNoDrug) {
    const key = row.tambonName?.trim() || UNSPECIFIED_TAMBON
    const current = tambonMap.get(key) ?? { count: 0, registeredCount: 0 }
    current.count += 1
    if (row.inCohortRegistry) {
      current.registeredCount += 1
    }
    tambonMap.set(key, current)
  }

  const byTambon: DmLabTambonStat[] = Array.from(tambonMap.entries())
    .map(([tambonName, stats]) => ({
      tambonName,
      count: stats.count,
      registeredCount: stats.registeredCount,
    }))
    .sort((a, b) => b.count - a.count || a.tambonName.localeCompare(b.tambonName, 'th'))

  const availableTambons = byTambon
    .map((item) => item.tambonName)
    .filter((name) => name !== UNSPECIFIED_TAMBON)
    .sort((a, b) => a.localeCompare(b, 'th'))

  // Apply user-facing list filters (cohort status, tambon, text search)
  const isInDmRemissionCohort = (r: DmLabTrackingRecord): boolean =>
    r.inDmRemissionCohort ?? (r.inCohortRegistry && !r.inT1dmRegistry)
  const isInT1dmRegistry = (r: DmLabTrackingRecord): boolean => Boolean(r.inT1dmRegistry)

  let filtered = stepNoDrug

  if (cohortStatus === 'registered') {
    filtered = filtered.filter((r) => r.inCohortRegistry)
  } else if (cohortStatus === 'unregistered') {
    filtered = filtered.filter((r) => !r.inCohortRegistry)
  } else if (cohortStatus === 'dm_remission') {
    filtered = filtered.filter(isInDmRemissionCohort)
  } else if (cohortStatus === 't1dm') {
    filtered = filtered.filter(isInT1dmRegistry)
  } else if (cohortStatus === 'both') {
    filtered = filtered.filter((r) => isInDmRemissionCohort(r) && isInT1dmRegistry(r))
  }

  const trimmedTambon = tambon?.trim()
  if (trimmedTambon) {
    filtered = filtered.filter(
      (r) => (r.tambonName?.trim() || UNSPECIFIED_TAMBON) === trimmedTambon
    )
  }

  const trimmedSearch = search?.trim().toLowerCase()
  if (trimmedSearch) {
    const normalizedSearchHn = normalizeHn(trimmedSearch)?.toLowerCase()
    const normalizedSearchCid = normalizeCid(trimmedSearch)?.toLowerCase()

    filtered = filtered.filter((r) => {
      const hnMatch =
        r.hn.toLowerCase().includes(trimmedSearch) ||
        (normalizedSearchHn ? r.hn.toLowerCase() === normalizedSearchHn : false)
      const cidMatch =
        (r.cid?.toLowerCase().includes(trimmedSearch) ?? false) ||
        (normalizedSearchCid ? (r.cid?.toLowerCase().includes(normalizedSearchCid) ?? false) : false)
      const nameMatch = r.patientName.toLowerCase().includes(trimmedSearch)
      const villageMatch = r.villageName?.toLowerCase().includes(trimmedSearch) ?? false
      const tambonMatch = r.tambonName?.toLowerCase().includes(trimmedSearch) ?? false
      return hnMatch || cidMatch || nameMatch || villageMatch || tambonMatch
    })
  }

  // Sort by latest visitDate DESC, then lowest latestA1c ASC, then HN ASC
  const sorted = [...filtered].sort((a, b) => {
    const dateDiff = b.visitDate.localeCompare(a.visitDate)
    if (dateDiff !== 0) return dateDiff
    if (a.latestA1c !== b.latestA1c) return a.latestA1c - b.latestA1c
    return a.hn.localeCompare(b.hn)
  })

  const a1cValues = sorted.map((r) => r.latestA1c)
  const avgLatestA1c =
    a1cValues.length > 0
      ? roundTo(a1cValues.reduce((acc, v) => acc + v, 0) / a1cValues.length, 2)
      : null
  const medianLatestA1c = computeMedian(a1cValues)
  const repeatTestedCount = sorted.filter((r) => r.a1cTestCount >= 2).length
  const filteredRegistered = sorted.filter((r) => r.inCohortRegistry).length
  const dmRemissionCount = sorted.filter(isInDmRemissionCohort).length
  const t1dmRegistryCount = sorted.filter(isInT1dmRegistry).length
  const bothRegistriesCount = sorted.filter(
    (r) => isInDmRemissionCohort(r) && isInT1dmRegistry(r)
  ).length

  const summary: DmLabTrackingSummary = {
    totalEligible: sorted.length,
    registeredCount: filteredRegistered,
    unregisteredCount: sorted.length - filteredRegistered,
    dmRemissionCount,
    t1dmRegistryCount,
    bothRegistriesCount,
    avgLatestA1c,
    medianLatestA1c,
    repeatTestedCount,
    a1cBands: computeA1cBands(sorted, a1cMax),
    byTambon,
    funnel,
  }

  const totalItems = sorted.length
  if (exportAll) {
    return {
      summary,
      items: sorted,
      availableTambons,
      pagination: {
        page: 1,
        pageSize: Math.max(totalItems, 1),
        totalItems,
        totalPages: 1,
      },
    }
  }

  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIdx = (safePage - 1) * safePageSize

  return {
    summary,
    items: sorted.slice(startIdx, startIdx + safePageSize),
    availableTambons,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
    },
  }
}
