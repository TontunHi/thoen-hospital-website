import { apiGateway } from '@/lib/apiGateway'

export interface VisitRepItem {
  rep: string
  compensated: number
  reason?: string | null
  source?: 'repeclaim' | 'repdata'
}

export interface PalliativeVisitEntry {
  id?: number
  visitNo: number
  visitDate: string
  rep?: string | null
  compensated?: number
  reason?: string | null
  repItems?: VisitRepItem[]
}

export interface PalliativeRegistryItem {
  id: number
  hn: string
  an?: string | null
  patientName: string
  isLtc?: boolean
  address: string | null
  phone: string | null
  icd10Principal: string | null
  icd10Palliative: string | null
  projectCode: string | null
  registrationStatus: string
  registeredDate?: string | null
  visits?: PalliativeVisitEntry[]
  visit1Date: string | null
  visit1Rep?: string | null
  visit1Compensated?: number
  visit1Reason?: string | null
  visit1RepItems?: VisitRepItem[]
  visit2Date: string | null
  visit2Rep?: string | null
  visit2Compensated?: number
  visit2Reason?: string | null
  visit2RepItems?: VisitRepItem[]
  visit3Date: string | null
  visit3Rep?: string | null
  visit3Compensated?: number
  visit3Reason?: string | null
  visit3RepItems?: VisitRepItem[]
  visit4Date: string | null
  visit4Rep?: string | null
  visit4Compensated?: number
  visit4Reason?: string | null
  visit4RepItems?: VisitRepItem[]
  visit5Date: string | null
  visit5Rep?: string | null
  visit5Compensated?: number
  visit5Reason?: string | null
  visit5RepItems?: VisitRepItem[]
  visit6Date: string | null
  visit6Rep?: string | null
  visit6Compensated?: number
  visit6Reason?: string | null
  visit6RepItems?: VisitRepItem[]
  deathDate: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface PalliativeSyncInsertedItem {
  hn: string
  patientName: string
  icd10Principal?: string | null
  registeredDate?: string | null
}

export interface PalliativeSyncUpdatedItem {
  hn: string
  patientName: string
  updatedFields: Array<'status' | 'registeredDate' | 'deathDate'>
  registeredDate?: string | null
  deathDate?: string | null
}

export interface PalliativeSyncVisitAddedItem {
  hn: string
  patientName: string
  addedVisits: Array<{
    visitNo: number
    visitDate: string
  }>
}

export interface PalliativeSyncSkippedLtcItem {
  hn: string
  patientName: string
}

export interface PalliativeSyncSummary {
  totalClinicMembers: number
  insertedCount: number
  updatedCount: number
  visitsAddedCount: number
  skippedLtcCount: number
  syncedAt: string
  insertedItems?: PalliativeSyncInsertedItem[]
  updatedItems?: PalliativeSyncUpdatedItem[]
  visitsAddedItems?: PalliativeSyncVisitAddedItem[]
  skippedLtcItems?: PalliativeSyncSkippedLtcItem[]
}

export interface ListRegistriesParams {
  search?: string
  registrationStatus?: string
  claimStatus?: string
  claimResult?: string
  fiscalYear?: string | number
  color?: string
  compAmount?: string
  compVisits?: string
  exportAll?: boolean
  forceSync?: boolean
  page?: number
  limit?: number
}

export const PALLIATIVE_DX_REGEX = /^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185/
export const DEFAULT_ICD10_PALLIATIVE = 'OPD (Z515 +Z718+Z636(เยี่ยมบ้าน) ใน Cormorbidประเภท 2)'
export const DEFAULT_PROJECT_CODE = '30001, Cons01'
export const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000

export function normalizeHn(hn: string | null | undefined): string {
  const raw = String(hn || '').trim()
  if (!raw) return ''
  return /^\d+$/.test(raw) ? raw.padStart(7, '0') : raw
}

export function normalizeRegistryDateToIso(d: string | null | undefined): string {
  if (!d) return ''
  const clean = d.trim()

  const mYmd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (mYmd) {
    let yr = parseInt(mYmd[1], 10)
    if (yr > 2500) yr -= 543
    return `${yr}-${mYmd[2].padStart(2, '0')}-${mYmd[3].padStart(2, '0')}`
  }

  const mDmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (mDmy) {
    let yr = parseInt(mDmy[3], 10)
    if (yr > 2500) yr -= 543
    return `${yr}-${mDmy[2].padStart(2, '0')}-${mDmy[1].padStart(2, '0')}`
  }

  const mDmy2 = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/)
  if (mDmy2) {
    let yr = parseInt(mDmy2[3], 10)
    yr = yr >= 50 ? 2500 + yr - 543 : 2000 + yr
    return `${yr}-${mDmy2[2].padStart(2, '0')}-${mDmy2[1].padStart(2, '0')}`
  }

  return clean
}

export function isoToDisplayDmy(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoDate
  return `${m[3]}/${m[2]}/${m[1]}`
}

export interface RegistryStats {
  total: number
  registered: number
  pendingRegistration: number
  claimed: number
  paid: number
  waitingComp?: number
  deceased?: number
  deny: number
}

export interface ColorCounts {
  total: number
  green: number
  orange: number
  orangeWaitingRep: number
  pink: number
}

export function calculateFiscalYear(dateStr?: string | null): number | null {
  if (!dateStr || !dateStr.trim()) return null
  const clean = dateStr.trim()

  let year: number | null = null
  let month: number | null = null

  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10)
    month = parseInt(ymdMatch[2], 10)
  } else {
    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (dmyMatch) {
      month = parseInt(dmyMatch[2], 10)
      year = parseInt(dmyMatch[3], 10)
    }
  }

  if (!year || !month) return null
  if (year > 2400) year -= 543

  const beYear = year + 543
  return month >= 10 ? beYear + 1 : beYear
}

export function getItemFiscalYear(item: {
  registeredDate?: string | null
  visit1Date?: string | null
  createdAt?: string | Date | null
}): number | null {
  return (
    calculateFiscalYear(item.registeredDate) ||
    calculateFiscalYear(item.visit1Date) ||
    calculateFiscalYear(item.createdAt ? String(item.createdAt) : null)
  )
}

export interface PatientLookupResult {
  hn: string
  an: string | null
  patientName: string
  address: string
  phone: string
  death: string
  deathDate: string | null
  isRegistered: boolean
  registeredDate: string | null
  icd10Principal: string | null
  isAlreadyInRegistry?: boolean
  existingRegistryId?: number
  isLtc?: boolean
  ltcMessage?: string
}

export interface PalliativeLookupGatewayAdapter {
  lookupPalliativePatientByHn: typeof apiGateway.app.lookupPalliativePatientByHn
}

const defaultLookupGateway: PalliativeLookupGatewayAdapter = {
  lookupPalliativePatientByHn: (hn) => apiGateway.app.lookupPalliativePatientByHn(hn),
}

/**
 * Look up patient demographics, Clinic 2423 Palliative Care registration status,
 * and ICD10 primary diagnosis from HOSxP via Gateway Named API.
 */
export async function lookupPatientByHn(
  hn: string,
  gateway: Partial<PalliativeLookupGatewayAdapter> = defaultLookupGateway
): Promise<PatientLookupResult | null> {
  const rawInput = (hn || '').trim()
  if (!rawInput) return null

  const gw: PalliativeLookupGatewayAdapter = { ...defaultLookupGateway, ...gateway }
  const res = await gw.lookupPalliativePatientByHn(rawInput)
  if (!res) return null
  const data = ('data' in res && res.data !== undefined ? res.data : res) as PatientLookupResult | null
  if (!data || !data.hn) return null
  return data
}
