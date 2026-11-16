export type DmLabUcScope = 'visit' | 'current' | 'either'

export type DmLabDiagScope = 'ever' | 'in_fy' | 'same_vn'

export type DmLabDrugScope = 'fy' | '90d_before_lab' | 'visit_only' | 'all'

export type DmLabCohortStatusFilter = 'all' | 'registered' | 'unregistered'

export interface DmAntidiabeticDrugDef {
  icode: string
  name: string
  category: 'biguanide' | 'sulfonylurea' | 'tzd' | 'insulin' | 'dpp4' | 'sglt2'
  isActive: boolean
}

/**
 * Antidiabetic drug icodes verified against Thoen Hospital HOSxP `drugitems`.
 * Excludes non-drug items such as patient advice leaflets (1690002) and syringes (1480078).
 */
export const DM_ANTIDIABETIC_DRUGS: readonly DmAntidiabeticDrugDef[] = [
  { icode: '1000184', name: 'METFORMIN 500 mg', category: 'biguanide', isActive: true },
  { icode: '1019001', name: 'GLIPIZIDE 5 mg', category: 'sulfonylurea', isActive: true },
  { icode: '1000142', name: 'GLIBENCLAMIDE 5 mg', category: 'sulfonylurea', isActive: false },
  { icode: '1570045', name: 'Pioglitazone 15 mg', category: 'tzd', isActive: true },
  { icode: '1460026', name: 'MIXED INSULIN (Mixtard 30 HM)', category: 'insulin', isActive: true },
  { icode: '1630034', name: 'Penfill MIXED INSULIN (H)', category: 'insulin', isActive: true },
  { icode: '1670019', name: 'Mixtard 30 HM (ใช้ในรพ.)', category: 'insulin', isActive: false },
  { icode: '1480043', name: 'NPH insulin (H) 100 iu/ml', category: 'insulin', isActive: true },
  { icode: '1680002', name: 'NPH insulin (Insulatard HM)', category: 'insulin', isActive: false },
  { icode: '1510019', name: 'Insulin RI dose', category: 'insulin', isActive: true },
  { icode: '1480075', name: 'REGULAR INSULIN (HAD)', category: 'insulin', isActive: true },
  { icode: '1460189', name: 'HUMULIN N UNIT', category: 'insulin', isActive: false },
  { icode: '1460190', name: 'HUMULIN R', category: 'insulin', isActive: false },
  { icode: '1460191', name: 'HUMULIN-N', category: 'insulin', isActive: false },
  { icode: '1460192', name: 'HUMULIN-R (คิดราคา)', category: 'insulin', isActive: false },
  { icode: '1630033', name: 'Sitagliptin phosphate 100 mg', category: 'dpp4', isActive: true },
  { icode: '1680023', name: 'Dapagliflozin (Forxiga) 10 mg', category: 'sglt2', isActive: true },
] as const

export const DM_ANTIDIABETIC_ICODES: readonly string[] = DM_ANTIDIABETIC_DRUGS.map(
  (item) => item.icode
)

export interface DmLabTrackingRecord {
  hn: string
  cid: string | null
  patientName: string
  ageYears: number | null
  sexLabel: string | null
  deathFlag: boolean
  visitDate: string
  vn: string
  labOrderNumber: number
  latestA1c: number
  a1cTestCount: number
  prevA1c: number | null
  prevA1cDate: string | null
  visitPttypeCode: string | null
  visitPttypeName: string | null
  currentPttypeCode: string | null
  currentPttypeName: string | null
  isUcVisit: boolean
  isUcCurrent: boolean
  lastE11Date: string | null
  lastE11Icd10: string | null
  inFyE11Count: number
  sameVnE11: boolean
  hasDmDrugInFy: boolean
  hasDmDrug90dBeforeLab: boolean
  hasDmDrugOnLabVisit: boolean
  lastDmDrugDate: string | null
  dmDrugsInFy: string[]
  tambonName: string | null
  villageName: string | null
  villageMoo: string | null
  inCohortRegistry: boolean
  cohortRemissionStatus: string | null
}

export interface DmLabTrackingFunnel {
  totalA1cTested: number
  a1cUnderLimit: number
  ucEligible: number
  e11Diagnosed: number
  noDmDrugs: number
  registeredInCohort: number
  unregisteredCandidates: number
}

export interface DmLabA1cBandStat {
  key: string
  label: string
  count: number
  percent: number
}

export interface DmLabTambonStat {
  tambonName: string
  count: number
  registeredCount: number
}

export interface DmLabTrackingSummary {
  totalEligible: number
  registeredCount: number
  unregisteredCount: number
  avgLatestA1c: number | null
  medianLatestA1c: number | null
  repeatTestedCount: number
  a1cBands: DmLabA1cBandStat[]
  byTambon: DmLabTambonStat[]
  funnel: DmLabTrackingFunnel
}

export interface DmLabTrackingFilters {
  fiscalYear?: number
  a1cMax?: number
  ucScope?: DmLabUcScope
  diagScope?: DmLabDiagScope
  drugScope?: DmLabDrugScope
  cohortStatus?: DmLabCohortStatusFilter
  tambon?: string
  search?: string
  includeDeceased?: boolean
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface DmLabTrackingResult {
  fiscalYear: number
  fiscalYearRange: {
    startDate: string
    endDate: string
  }
  availableFiscalYears: number[]
  availableTambons: string[]
  appliedFilters: {
    fiscalYear: number
    a1cMax: number
    ucScope: DmLabUcScope
    diagScope: DmLabDiagScope
    drugScope: DmLabDrugScope
    cohortStatus: DmLabCohortStatusFilter
    tambon: string | null
    search: string | null
    includeDeceased: boolean
  }
  summary: DmLabTrackingSummary
  items: DmLabTrackingRecord[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  fetchedAt: string
}

export interface DmLabPatientTimeline {
  hn: string
  patientName: string
  cid: string | null
  ageYears: number | null
  currentPttypeName: string | null
  labHistory: Array<{
    labOrderNumber: number
    orderDate: string
    vn: string
    a1c: number | null
    fpg: number | null
  }>
  e11Diagnoses: Array<{
    vstdate: string
    vn: string
    icd10: string
    diagType: string | null
  }>
  dmPrescriptions: Array<{
    vstdate: string
    vn: string
    icode: string
    drugName: string
    qty: number | null
  }>
}
