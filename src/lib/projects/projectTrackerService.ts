import { apiGateway, GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  aggregateProjectDashboardStats,
  enrichProjectRecord,
  getPopulatedFiscalYears,
  normalizeBudgetNumber,
  normalizeOptionalText,
  resolveDefaultFiscalYear,
  sortByPreferredOrder,
  sortStrategies,
} from './projectTrackerDomain'
import {
  PROJECT_BUDGET_SOURCES,
  PROJECT_SUBMISSION_STATUSES,
  type ProjectBatchImportResult,
  type ProjectCreateInput,
  type ProjectListResult,
  type ProjectRecord,
  type ProjectRecordRaw,
  type ProjectUpdateInput,
} from './projectTrackerTypes'

export class ProjectTrackerNotFoundError extends Error {
  readonly status = 404
  constructor(message: string) {
    super(message)
    this.name = 'ProjectTrackerNotFoundError'
  }
}

export class ProjectTrackerValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'ProjectTrackerValidationError'
  }
}

export interface ProjectTrackerActor {
  username?: string | null
  email?: string | null
}

export interface ProjectTrackerGatewayAdapter {
  ensureProjectsSchemaV2: typeof apiGateway.app.ensureProjectsSchemaV2
  getProjectsBundleV2: typeof apiGateway.app.getProjectsBundleV2
  createProjectV2: typeof apiGateway.app.createProjectV2
  updateProjectV2: typeof apiGateway.app.updateProjectV2
  deleteProjectV2: typeof apiGateway.app.deleteProjectV2
  batchImportProjectsV2: typeof apiGateway.app.batchImportProjectsV2
}

const defaultProjectTrackerGateway: ProjectTrackerGatewayAdapter = {
  ensureProjectsSchemaV2: () => apiGateway.app.ensureProjectsSchemaV2(),
  getProjectsBundleV2: (fiscalYear) => apiGateway.app.getProjectsBundleV2(fiscalYear),
  createProjectV2: (fields, actorKey) => apiGateway.app.createProjectV2(fields, actorKey),
  updateProjectV2: (id, fields, actorKey) => apiGateway.app.updateProjectV2(id, fields, actorKey),
  deleteProjectV2: (id) => apiGateway.app.deleteProjectV2(id),
  batchImportProjectsV2: (body) => apiGateway.app.batchImportProjectsV2(body),
}

export interface ProjectTrackerListFilters {
  fiscalYear?: number
  strategy?: string
  submissionStatus?: string
  budgetSource?: string
  search?: string
}

interface ProjectFieldTransform {
  key: keyof ProjectCreateInput
  transform?: (val: unknown) => unknown
}

const PROJECT_FIELD_TRANSFORMS: readonly ProjectFieldTransform[] = [
  { key: 'fiscalYear' },
  {
    key: 'sequenceNo',
    transform: (val) => (typeof val === 'number' && Number.isInteger(val) && val > 0 ? val : undefined),
  },
  { key: 'projectCode', transform: normalizeOptionalText },
  { key: 'strategy', transform: (val) => String(val ?? 'งานประจำ').trim() },
  { key: 'projectName', transform: (val) => String(val ?? '').trim() },
  { key: 'responsibleUnit', transform: normalizeOptionalText },
  { key: 'q1Budget', transform: normalizeBudgetNumber },
  { key: 'q2Budget', transform: normalizeBudgetNumber },
  { key: 'q3Budget', transform: normalizeBudgetNumber },
  { key: 'q4Budget', transform: normalizeBudgetNumber },
  { key: 'actualSpent', transform: normalizeBudgetNumber },
  {
    key: 'submissionStatus',
    transform: (val) => String(val ?? 'ยังไม่ส่ง').trim() || 'ยังไม่ส่ง',
  },
  {
    key: 'budgetSource',
    transform: (val) => String(val ?? 'เงินบำรุง').trim() || 'เงินบำรุง',
  },
  { key: 'notes', transform: normalizeOptionalText },
]

function serializeTimestamp(val: unknown): string {
  if (val instanceof Date) return val.toISOString()
  return String(val ?? '')
}

function mapProjectRow(row: Record<string, unknown>): ProjectRecordRaw {
  return {
    id: Number(row.id),
    fiscalYear: Number(row.fiscalYear),
    sequenceNo: Number(row.sequenceNo ?? 1),
    projectCode: row.projectCode ? String(row.projectCode) : null,
    strategy: String(row.strategy ?? 'งานประจำ'),
    projectName: String(row.projectName ?? ''),
    responsibleUnit: row.responsibleUnit ? String(row.responsibleUnit) : null,
    q1Budget: normalizeBudgetNumber(row.q1Budget),
    q2Budget: normalizeBudgetNumber(row.q2Budget),
    q3Budget: normalizeBudgetNumber(row.q3Budget),
    q4Budget: normalizeBudgetNumber(row.q4Budget),
    actualSpent: normalizeBudgetNumber(row.actualSpent),
    submissionStatus: String(row.submissionStatus ?? 'ยังไม่ส่ง'),
    budgetSource: String(row.budgetSource ?? 'เงินบำรุง'),
    notes: row.notes ? String(row.notes) : null,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    createdAt: serializeTimestamp(row.createdAt),
    updatedAt: serializeTimestamp(row.updatedAt),
  }
}

function isNotFoundGatewayError(err: unknown): boolean {
  if (err instanceof GatewayNotFoundError) return true
  if (err instanceof GatewayError && err.status === 404) return true
  return false
}

export class ProjectTrackerService {
  private readonly gw: ProjectTrackerGatewayAdapter
  private schemaEnsured = false
  private ensurePromise: Promise<void> | null = null

  constructor(gateway?: Partial<ProjectTrackerGatewayAdapter>) {
    this.gw = { ...defaultProjectTrackerGateway, ...(gateway || {}) }
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return
    if (this.ensurePromise) return this.ensurePromise

    this.ensurePromise = (async () => {
      await this.gw.ensureProjectsSchemaV2()
      this.schemaEnsured = true
    })()

    try {
      await this.ensurePromise
    } finally {
      this.ensurePromise = null
    }
  }

  async listProjects(filters: ProjectTrackerListFilters = {}): Promise<ProjectListResult> {
    await this.ensureSchema()

    const bundle = await this.gw.getProjectsBundleV2(filters.fiscalYear)
    const fyRows = bundle?.fyRows || []
    const allYearRows = bundle?.allYearRows || []

    const populatedYears = fyRows
      .map((r) => Number(r.fiscalYear))
      .filter((n) => Number.isInteger(n))

    const targetFiscalYear =
      filters.fiscalYear !== undefined
        ? filters.fiscalYear
        : Number.isInteger(bundle?.targetFiscalYear)
        ? bundle.targetFiscalYear
        : resolveDefaultFiscalYear(populatedYears)

    const availableFiscalYears = getPopulatedFiscalYears(populatedYears)

    const allYearRecords = allYearRows.map((r) => enrichProjectRecord(mapProjectRow(r)))
    const stats = aggregateProjectDashboardStats(allYearRecords)

    const availableStrategies = sortStrategies(allYearRecords.map((r) => r.strategy))
    const availableStatuses = sortByPreferredOrder(
      allYearRecords.map((r) => r.submissionStatus),
      PROJECT_SUBMISSION_STATUSES
    )
    const availableBudgetSources = sortByPreferredOrder(
      allYearRecords.map((r) => r.budgetSource),
      PROJECT_BUDGET_SOURCES
    )

    const strategyFilter = (filters.strategy || '').trim()
    const statusFilter = (filters.submissionStatus || '').trim()
    const sourceFilter = (filters.budgetSource || '').trim()
    const searchFilter = (filters.search || '').trim().toLowerCase()

    const items = allYearRecords.filter((item) => {
      if (strategyFilter && item.strategy !== strategyFilter) return false
      if (statusFilter && item.submissionStatus !== statusFilter) return false
      if (sourceFilter && item.budgetSource !== sourceFilter) return false
      if (searchFilter) {
        const hay = [
          item.projectCode || '',
          item.projectName || '',
          item.responsibleUnit || '',
          item.strategy || '',
          item.notes || '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(searchFilter)) return false
      }
      return true
    })

    return {
      fiscalYear: targetFiscalYear,
      availableFiscalYears,
      availableStrategies,
      availableStatuses,
      availableBudgetSources,
      items,
      stats,
    }
  }

  async createProject(
    input: ProjectCreateInput,
    actor?: ProjectTrackerActor
  ): Promise<ProjectRecord> {
    await this.ensureSchema()

    const projectName = (input.projectName || '').trim()
    if (!projectName) {
      throw new ProjectTrackerValidationError('กรุณาระบุชื่อโครงการ')
    }

    const actorKey = actor?.username || actor?.email || null
    const resolvedInput: ProjectCreateInput = {
      ...input,
      projectName,
    }

    const fields: Record<string, unknown> = {}
    for (const field of PROJECT_FIELD_TRANSFORMS) {
      const rawVal = resolvedInput[field.key]
      const val = field.transform ? field.transform(rawVal) : rawVal
      if (field.key === 'sequenceNo' && val === undefined) continue
      fields[field.key] = val ?? null
    }

    const createdRow = await this.gw.createProjectV2(fields, actorKey)
    if (!createdRow || !createdRow.id) {
      throw new Error('ไม่สามารถบันทึกข้อมูลโครงการได้')
    }

    const created = enrichProjectRecord(mapProjectRow(createdRow))

    await logAudit(
      'CREATE',
      'project_tracking_records',
      `Created project #${created.id} (${created.strategy}: ${created.projectName.slice(0, 80)}) FY ${created.fiscalYear}`,
      actor?.username || actor?.email
        ? { username: actor?.username ?? undefined, email: actor?.email ?? undefined }
        : undefined
    )

    return created
  }

  async updateProject(
    id: number,
    input: ProjectUpdateInput,
    actor?: ProjectTrackerActor
  ): Promise<ProjectRecord> {
    await this.ensureSchema()

    const fields: Record<string, unknown> = {}
    for (const field of PROJECT_FIELD_TRANSFORMS) {
      if (!(field.key in input)) continue
      const rawVal = input[field.key]
      if (rawVal === undefined) continue
      const val = field.transform ? field.transform(rawVal) : rawVal
      fields[field.key] = val ?? null
    }

    const actorKey = actor?.username || actor?.email || null

    let updatedRow: Record<string, unknown>
    try {
      updatedRow = await this.gw.updateProjectV2(id, fields, actorKey)
    } catch (err) {
      if (isNotFoundGatewayError(err)) {
        throw new ProjectTrackerNotFoundError('ไม่พบข้อมูลโครงการที่ระบุ')
      }
      throw err
    }

    const updated = enrichProjectRecord(mapProjectRow(updatedRow))

    if (Object.keys(fields).length > 0) {
      await logAudit(
        'UPDATE',
        'project_tracking_records',
        `Updated project #${updated.id} (status: ${updated.submissionStatus}, spent: ${updated.actualSpent})`,
        actor?.username || actor?.email
          ? { username: actor?.username ?? undefined, email: actor?.email ?? undefined }
          : undefined
      )
    }

    return updated
  }

  async deleteProject(id: number, actor?: ProjectTrackerActor): Promise<{ id: number }> {
    await this.ensureSchema()

    let existingRow: Record<string, unknown>
    try {
      existingRow = await this.gw.deleteProjectV2(id)
    } catch (err) {
      if (isNotFoundGatewayError(err)) {
        throw new ProjectTrackerNotFoundError('ไม่พบข้อมูลโครงการที่ระบุ')
      }
      throw err
    }

    const existing = enrichProjectRecord(mapProjectRow(existingRow))

    await logAudit(
      'DELETE',
      'project_tracking_records',
      `Deleted project #${existing.id} (${existing.projectName.slice(0, 80)}) FY ${existing.fiscalYear}`,
      actor?.username || actor?.email
        ? { username: actor?.username ?? undefined, email: actor?.email ?? undefined }
        : undefined
    )

    return { id }
  }

  async batchImportProjects(
    fiscalYear: number,
    rows: ProjectCreateInput[],
    mode: 'append' | 'replace' = 'append',
    actor?: ProjectTrackerActor
  ): Promise<ProjectBatchImportResult> {
    await this.ensureSchema()

    if (rows.length === 0) {
      throw new ProjectTrackerValidationError('ไม่มีรายการโครงการสำหรับนำเข้า')
    }

    const actorKey = actor?.username || actor?.email || null
    const normalizedRows = rows.map((row) => ({
      sequenceNo:
        row.sequenceNo && Number.isInteger(row.sequenceNo) && row.sequenceNo > 0
          ? row.sequenceNo
          : undefined,
      projectCode: normalizeOptionalText(row.projectCode),
      strategy: String(row.strategy || 'งานประจำ').trim(),
      projectName: String(row.projectName || '').trim(),
      responsibleUnit: normalizeOptionalText(row.responsibleUnit),
      q1Budget: normalizeBudgetNumber(row.q1Budget),
      q2Budget: normalizeBudgetNumber(row.q2Budget),
      q3Budget: normalizeBudgetNumber(row.q3Budget),
      q4Budget: normalizeBudgetNumber(row.q4Budget),
      actualSpent: normalizeBudgetNumber(row.actualSpent),
      submissionStatus: String(row.submissionStatus || 'ยังไม่ส่ง').trim() || 'ยังไม่ส่ง',
      budgetSource: String(row.budgetSource || 'เงินบำรุง').trim() || 'เงินบำรุง',
      notes: normalizeOptionalText(row.notes),
    }))

    const res = await this.gw.batchImportProjectsV2({
      fiscalYear,
      rows: normalizedRows,
      mode,
      actorKey,
    })

    const deletedCount = Number(res?.deletedCount ?? 0)

    await logAudit(
      'CREATE',
      'project_tracking_records',
      `Batch imported ${rows.length} projects for FY ${fiscalYear} (mode: ${mode}${mode === 'replace' ? `, deleted: ${deletedCount}` : ''})`,
      actor?.username || actor?.email
        ? { username: actor?.username ?? undefined, email: actor?.email ?? undefined }
        : undefined
    )

    return {
      inserted: rows.length,
      updated: 0,
      totalProcessed: rows.length,
      fiscalYear,
    }
  }
}

export const projectTrackerService = new ProjectTrackerService()
