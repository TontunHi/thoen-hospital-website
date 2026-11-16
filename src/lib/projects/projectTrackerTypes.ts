export const PROJECT_STRATEGY_OPTIONS = [
  'ย.1',
  'ย.2',
  'ย.3',
  'ย.4',
  'ย.5',
  'ย.6',
  'งานประจำ',
] as const

export const PROJECT_SUBMISSION_STATUSES = [
  'ส่งแล้ว',
  'ยังไม่ส่ง',
  'ไม่ใช้งบประมาณ',
  'ยกเลิกโครงการ',
] as const

export const PROJECT_BUDGET_SOURCES = [
  'เงินบำรุง',
  'กปท.',
  'งบอื่นๆ',
  'ไม่ใช้งบประมาณ',
] as const

export type ProjectStrategy = string
export type ProjectSubmissionStatus = string
export type ProjectBudgetSource = string

export interface ProjectRecordRaw {
  id: number
  fiscalYear: number
  sequenceNo: number
  projectCode: string | null
  strategy: string
  projectName: string
  responsibleUnit: string | null
  q1Budget: number
  q2Budget: number
  q3Budget: number
  q4Budget: number
  actualSpent: number
  submissionStatus: string
  budgetSource: string
  notes: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectRecord extends ProjectRecordRaw {
  allocatedBudget: number
  remainingBudget: number
  disbursementRate: number
}

export interface ProjectCreateInput {
  fiscalYear: number
  sequenceNo?: number | null
  projectCode?: string | null
  strategy: string
  projectName: string
  responsibleUnit?: string | null
  q1Budget?: number | null
  q2Budget?: number | null
  q3Budget?: number | null
  q4Budget?: number | null
  actualSpent?: number | null
  submissionStatus?: string | null
  budgetSource?: string | null
  notes?: string | null
}

export type ProjectUpdateInput = Partial<ProjectCreateInput>

export interface ProjectStrategySummary {
  strategy: string
  strategyTitle: string
  totalProjects: number
  submittedCount: number
  pendingCount: number
  noBudgetCount: number
  cancelledCount: number
  completionRate: number
  allocatedBudget: number
  actualSpent: number
  remainingBudget: number
}

export interface ProjectBreakdownStat {
  label: string
  count: number
  allocatedBudget: number
  actualSpent: number
}

export interface ProjectQuarterSummary {
  quarter: 'ไตรมาส 1' | 'ไตรมาส 2' | 'ไตรมาส 3' | 'ไตรมาส 4'
  key: 'q1Budget' | 'q2Budget' | 'q3Budget' | 'q4Budget'
  allocatedBudget: number
}

export interface ProjectDashboardStats {
  totalProjects: number
  submittedCount: number
  pendingCount: number
  noBudgetCount: number
  cancelledCount: number
  submissionRate: number
  allocatedBudgetTotal: number
  actualSpentTotal: number
  remainingBudgetTotal: number
  disbursementRate: number
  remainingRate: number
  byStrategy: ProjectStrategySummary[]
  byStatus: Record<string, number>
  byBudgetSource: ProjectBreakdownStat[]
  byQuarter: ProjectQuarterSummary[]
}

export interface ProjectListResult {
  fiscalYear: number
  availableFiscalYears: number[]
  availableStrategies: string[]
  availableStatuses: string[]
  availableBudgetSources: string[]
  items: ProjectRecord[]
  stats: ProjectDashboardStats
}

export interface ProjectImportPreviewRow {
  rowNumber: number
  data: ProjectCreateInput
}

export interface ProjectImportParseResult {
  rows: ProjectImportPreviewRow[]
  skippedEmptyRows: number
  errors: Array<{ rowNumber: number; message: string }>
  detectedSheetName: string
  detectedFiscalYear: number
}

export interface ProjectBatchImportResult {
  inserted: number
  updated: number
  totalProcessed: number
  fiscalYear: number
}

export const PROJECT_EXCEL_COLUMNS = [
  'ลำดับ',
  'รหัสโครงการ',
  'ยุทธศาสตร์',
  'ชื่อโครงการ',
  'หน่วยงาน/ผู้รับผิดชอบ',
  'ไตรมาส 1',
  'ไตรมาส 2',
  'ไตรมาส 3',
  'ไตรมาส 4',
  'งบประมาณที่ได้รับ',
  'งบประมาณใช้จริง',
  'งบประมาณคงเหลือ',
  'สถานะการส่งสรุปงาน',
  'แหล่งงบประมาณ',
  'หมายเหตุ/ปัญหาอุปสรรค',
] as const
