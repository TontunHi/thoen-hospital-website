export type RepSourceKind =
  | 'repdata'
  | 'repeclaim'
  | 'seamless'

export type RepReconcileDeptFilter = 'ALL' | 'OP' | 'IP'

export type RepReconcileStatusFilter =
  | 'ALL'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'HAS_ERROR'
  | 'APPEAL'
  | 'PENDING_REP'

export type RepReconcileSortField =
  | 'admdate'
  | 'rep'
  | 'vn'
  | 'hn'
  | 'ptname'
  | 'fund'
  | 'income'
  | 'compensated'
  | 'diff'

export type FundCategoryGroup =
  | 'pp'
  | 'disease_drug'
  | 'rehab_special'
  | 'general'

export interface FundDefinition {
  id: string
  code: string
  label: string
  shortLabel: string
  category: FundCategoryGroup
  href: string
  priority: number
  seamlessPrefixes: readonly string[]
  repFundKeywords: readonly string[]
  adpCodes: readonly string[]
  adpPrefixes: readonly string[]
  icd10Prefixes: readonly string[]
  description: string
}

export interface RepReconcileQueryParams {
  ds1?: string
  ds2?: string
  fundIds?: string[]
  focusFundId?: string
  sources?: RepSourceKind[]
  repPrefixes?: string[]
  department?: RepReconcileDeptFilter
  status?: RepReconcileStatusFilter
  includePendingRep?: boolean
  search?: string
  sortBy?: RepReconcileSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface RepReconcileItem {
  id: string
  visitKey: string
  vn: string | null
  an: string | null
  hn: string
  cid: string
  ptname: string
  admdate: string
  admdateThai: string
  department: 'OP' | 'IP'
  mainInscl: string
  pttypeName: string | null
  rep: string | null
  repPrefix: string | null
  source: RepSourceKind
  matchedSources: RepSourceKind[]
  repFund: string | null
  repSubFund: string | null
  projectCode: string | null
  primaryFundId: string
  primaryFundCode: string
  primaryFundLabel: string
  matchedFundIds: string[]
  matchedFundLabels: string[]
  matchReason: string
  adpCodes: string[]
  income: number
  compensated: number
  diff: number
  percentPay: number
  errorCode: string | null
  appeal: 'Y' | 'N'
  status: 'paid' | 'denied' | 'appeal' | 'pending_rep'
  eclaimNo: string | null
  eclaimStatus: string | null
  eclaimIncome: number
  payNo: string | null
  payDate: string | null
  payDateThai: string | null
  stmid: string | null
  fileName: string | null
}

export interface FundSummaryCard {
  fundId: string
  code: string
  label: string
  shortLabel: string
  category: FundCategoryGroup
  href: string
  repLineCount: number
  uniqueRepCount: number
  uniqueVisitCount: number
  totalIncome: number
  totalCompensated: number
  totalDiff: number
  reimbursementRate: number
  seamlessCompensated: number
  eclaimCompensated: number
  seamlessLineCount: number
  eclaimLineCount: number
  errorCount: number
}

export interface RepTypeSummaryItem {
  prefix: string
  label: string
  source: RepSourceKind
  repCount: number
  lineCount: number
  totalCompensated: number
}

export interface SourceBreakdownSummary {
  source: RepSourceKind
  label: string
  lineCount: number
  uniqueRepCount: number
  totalIncome: number
  totalCompensated: number
}

export interface RepReconcileSummary {
  totalLines: number
  uniqueRepCount: number
  uniqueVisitCount: number
  totalIncome: number
  totalCompensated: number
  totalDiff: number
  reimbursementRate: number
  seamlessCompensated: number
  eclaimCompensated: number
  errorCount: number
  appealCount: number
  pendingRepCount: number
  dedupRemovedCount: number
  sourceBreakdown: SourceBreakdownSummary[]
  fundCards: FundSummaryCard[]
  repTypeBreakdown: RepTypeSummaryItem[]
}

export interface RepReconcileResult {
  range: {
    startDate: string
    endDate: string
  }
  summary: RepReconcileSummary
  items: RepReconcileItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  availableFundCatalog: Array<{
    id: string
    code: string
    label: string
    shortLabel: string
    category: FundCategoryGroup
    href: string
    lineCount: number
    totalCompensated: number
  }>
  availableRepPrefixes: string[]
}

export interface VnReconcileDetails {
  visitKey: string
  vn: string | null
  an: string | null
  hn: string
  cid: string
  ptname: string
  admdate: string
  admdateThai: string
  department: 'OP' | 'IP'
  pttypeName: string | null
  pdx: string | null
  dxList: string[]
  adpItems: Array<{
    icode: string
    name: string
    nhsoAdpCode: string
    qty: number
    sumPrice: number
  }>
  allRepLines: Array<{
    source: RepSourceKind
    rep: string | null
    fund: string | null
    subFund: string | null
    income: number
    compensated: number
    errorCode: string | null
    appeal: string | null
    eclaimNo: string | null
    eclaimStatus: string | null
    payNo: string | null
    payDateThai: string | null
    fileName: string | null
  }>
}
