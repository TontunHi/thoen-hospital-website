import { apiGateway } from '@/lib/apiGateway'
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

export interface ProjectTrackerDbDeps {
  appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  appTransaction: (
    statements: Array<{ sql: string; params?: unknown[] }>
  ) => Promise<{
    count: number
    results: Array<{ affectedRows: number; insertId: number | null }>
  }>
}

export interface ProjectTrackerListFilters {
  fiscalYear?: number
  strategy?: string
  submissionStatus?: string
  budgetSource?: string
  search?: string
}

interface ProjectFieldMapping {
  key: keyof ProjectCreateInput
  column: string
  transform?: (val: unknown) => unknown
}

const PROJECT_FIELD_MAPPINGS: readonly ProjectFieldMapping[] = [
  { key: 'fiscalYear', column: 'fiscal_year' },
  {
    key: 'sequenceNo',
    column: 'sequence_no',
    transform: (val) => (typeof val === 'number' && Number.isInteger(val) && val > 0 ? val : 1),
  },
  { key: 'projectCode', column: 'project_code', transform: normalizeOptionalText },
  { key: 'strategy', column: 'strategy', transform: (val) => String(val ?? 'งานประจำ').trim() },
  { key: 'projectName', column: 'project_name', transform: (val) => String(val ?? '').trim() },
  { key: 'responsibleUnit', column: 'responsible_unit', transform: normalizeOptionalText },
  { key: 'q1Budget', column: 'q1_budget', transform: normalizeBudgetNumber },
  { key: 'q2Budget', column: 'q2_budget', transform: normalizeBudgetNumber },
  { key: 'q3Budget', column: 'q3_budget', transform: normalizeBudgetNumber },
  { key: 'q4Budget', column: 'q4_budget', transform: normalizeBudgetNumber },
  { key: 'actualSpent', column: 'actual_spent', transform: normalizeBudgetNumber },
  {
    key: 'submissionStatus',
    column: 'submission_status',
    transform: (val) => String(val ?? 'ยังไม่ส่ง').trim() || 'ยังไม่ส่ง',
  },
  {
    key: 'budgetSource',
    column: 'budget_source',
    transform: (val) => String(val ?? 'เงินบำรุง').trim() || 'เงินบำรุง',
  },
  { key: 'notes', column: 'notes', transform: normalizeOptionalText },
]

const PROJECT_SELECT_SQL = `
  SELECT
    id,
    fiscal_year AS fiscalYear,
    sequence_no AS sequenceNo,
    project_code AS projectCode,
    strategy,
    project_name AS projectName,
    responsible_unit AS responsibleUnit,
    q1_budget AS q1Budget,
    q2_budget AS q2Budget,
    q3_budget AS q3Budget,
    q4_budget AS q4Budget,
    actual_spent AS actualSpent,
    submission_status AS submissionStatus,
    budget_source AS budgetSource,
    notes,
    created_by AS createdBy,
    updated_by AS updatedBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM project_tracking_records
`

const CREATE_RECORDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS project_tracking_records (
    id INT NOT NULL AUTO_INCREMENT,
    fiscal_year INT NOT NULL,
    sequence_no INT NOT NULL DEFAULT 1,
    project_code VARCHAR(50) NULL,
    strategy VARCHAR(50) NOT NULL,
    project_name VARCHAR(500) NOT NULL,
    responsible_unit VARCHAR(255) NULL,
    q1_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    q2_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    q3_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    q4_budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    actual_spent DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    submission_status VARCHAR(50) NOT NULL DEFAULT 'ยังไม่ส่ง',
    budget_source VARCHAR(50) NOT NULL DEFAULT 'เงินบำรุง',
    notes TEXT NULL,
    created_by VARCHAR(100) NULL,
    updated_by VARCHAR(100) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    INDEX idx_pt_fiscal_year (fiscal_year),
    INDEX idx_pt_strategy (strategy),
    INDEX idx_pt_status (submission_status),
    INDEX idx_pt_seq (fiscal_year, sequence_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS project_tracking_meta (
    meta_key VARCHAR(100) NOT NULL,
    meta_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (meta_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

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

export class ProjectTrackerService {
  private readonly deps: ProjectTrackerDbDeps
  private schemaEnsured = false
  private ensurePromise: Promise<void> | null = null

  constructor(deps?: Partial<ProjectTrackerDbDeps>) {
    this.deps = {
      appQuery: deps?.appQuery ?? ((sql, params) => apiGateway.app.query(sql, params)),
      appTransaction:
        deps?.appTransaction ?? ((statements) => apiGateway.app.transaction(statements)),
    }
  }

  private async executeWrite(
    sql: string,
    params: unknown[] = []
  ): Promise<{ affectedRows: number; insertId: number | null }> {
    const tx = await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      { sql, params },
    ])
    return tx.results?.[1] ?? { affectedRows: 0, insertId: null }
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return
    if (this.ensurePromise) return this.ensurePromise

    this.ensurePromise = (async () => {
      await this.deps.appTransaction([
        { sql: 'SET NAMES utf8mb4' },
        { sql: CREATE_RECORDS_TABLE_SQL },
        { sql: CREATE_META_TABLE_SQL },
      ])

      this.schemaEnsured = true
    })()

    try {
      await this.ensurePromise
    } finally {
      this.ensurePromise = null
    }
  }

  private async getByIdOrThrow(id: number): Promise<ProjectRecord> {
    const rows = await this.deps.appQuery<Record<string, unknown>>(
      `${PROJECT_SELECT_SQL} WHERE id = ? LIMIT 1`,
      [id]
    )
    if (!rows || rows.length === 0) {
      throw new ProjectTrackerNotFoundError('ไม่พบข้อมูลโครงการที่ระบุ')
    }
    return enrichProjectRecord(mapProjectRow(rows[0]))
  }

  private async getNextSequenceNo(fiscalYear: number): Promise<number> {
    const rows = await this.deps.appQuery<{ maxSeq: number | string | null }>(
      `SELECT MAX(sequence_no) AS maxSeq FROM project_tracking_records WHERE fiscal_year = ?`,
      [fiscalYear]
    )
    return Number(rows[0]?.maxSeq ?? 0) + 1
  }

  async listProjects(filters: ProjectTrackerListFilters = {}): Promise<ProjectListResult> {
    await this.ensureSchema()

    const fyQueryPromise = this.deps.appQuery<{ fiscalYear: number | string }>(
      `SELECT DISTINCT fiscal_year AS fiscalYear FROM project_tracking_records ORDER BY fiscal_year DESC`
    )

    let fyRows: Array<{ fiscalYear: number | string }>
    let targetFiscalYear: number
    let allYearRows: Array<Record<string, unknown>>

    if (filters.fiscalYear !== undefined) {
      targetFiscalYear = filters.fiscalYear
      ;[fyRows, allYearRows] = await Promise.all([
        fyQueryPromise,
        this.deps.appQuery<Record<string, unknown>>(
          `${PROJECT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY sequence_no ASC, id ASC`,
          [targetFiscalYear]
        ),
      ])
    } else {
      fyRows = await fyQueryPromise
      const populated = fyRows
        .map((r) => Number(r.fiscalYear))
        .filter((n) => Number.isInteger(n))
      targetFiscalYear = resolveDefaultFiscalYear(populated)
      allYearRows = await this.deps.appQuery<Record<string, unknown>>(
        `${PROJECT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY sequence_no ASC, id ASC`,
        [targetFiscalYear]
      )
    }

    const populatedYears = fyRows
      .map((r) => Number(r.fiscalYear))
      .filter((n) => Number.isInteger(n))

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

    const sequenceNo =
      input.sequenceNo && Number.isInteger(input.sequenceNo) && input.sequenceNo > 0
        ? input.sequenceNo
        : await this.getNextSequenceNo(input.fiscalYear)

    const actorKey = actor?.username || actor?.email || null

    const columns: string[] = []
    const placeholders: string[] = []
    const params: unknown[] = []

    const resolvedInput: ProjectCreateInput = {
      ...input,
      sequenceNo,
      projectName,
    }

    for (const mapping of PROJECT_FIELD_MAPPINGS) {
      const rawVal = resolvedInput[mapping.key]
      const val = mapping.transform ? mapping.transform(rawVal) : rawVal
      columns.push(mapping.column)
      placeholders.push('?')
      params.push(val ?? null)
    }

    columns.push('created_by', 'updated_by')
    placeholders.push('?', '?')
    params.push(actorKey, actorKey)

    const result = await this.executeWrite(
      `INSERT INTO project_tracking_records (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params
    )

    if (!result.insertId) {
      throw new Error('ไม่สามารถบันทึกข้อมูลโครงการได้')
    }

    const created = await this.getByIdOrThrow(result.insertId)

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

    const existing = await this.getByIdOrThrow(id)

    const setClauses: string[] = []
    const params: unknown[] = []

    for (const mapping of PROJECT_FIELD_MAPPINGS) {
      if (!(mapping.key in input)) continue
      const rawVal = input[mapping.key]
      if (rawVal === undefined) continue
      const val = mapping.transform ? mapping.transform(rawVal) : rawVal
      setClauses.push(`${mapping.column} = ?`)
      params.push(val ?? null)
    }

    if (setClauses.length === 0) {
      return existing
    }

    const actorKey = actor?.username || actor?.email || null
    setClauses.push('updated_by = ?')
    params.push(actorKey, id)

    await this.executeWrite(
      `UPDATE project_tracking_records SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    )

    const updated = await this.getByIdOrThrow(id)

    await logAudit(
      'UPDATE',
      'project_tracking_records',
      `Updated project #${updated.id} (status: ${updated.submissionStatus}, spent: ${updated.actualSpent})`,
      actor?.username || actor?.email
        ? { username: actor?.username ?? undefined, email: actor?.email ?? undefined }
        : undefined
    )

    return updated
  }

  async deleteProject(id: number, actor?: ProjectTrackerActor): Promise<{ id: number }> {
    await this.ensureSchema()

    const existing = await this.getByIdOrThrow(id)

    await this.executeWrite(`DELETE FROM project_tracking_records WHERE id = ?`, [id])

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
    let nextSeq = mode === 'replace' ? 1 : await this.getNextSequenceNo(fiscalYear)

    const statements: Array<{ sql: string; params?: unknown[] }> = [
      { sql: 'SET NAMES utf8mb4' },
    ]

    if (mode === 'replace') {
      statements.push({
        sql: `DELETE FROM project_tracking_records WHERE fiscal_year = ?`,
        params: [fiscalYear],
      })
    }

    const IMPORT_CHUNK_SIZE = 100
    const rowValuesTuple = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'

    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE)
      const valueTuples: string[] = []
      const params: unknown[] = []

      for (const row of chunk) {
        const seq =
          row.sequenceNo && Number.isInteger(row.sequenceNo) && row.sequenceNo > 0
            ? row.sequenceNo
            : nextSeq
        nextSeq = Math.max(nextSeq, seq) + 1

        valueTuples.push(rowValuesTuple)
        params.push(
          fiscalYear,
          seq,
          normalizeOptionalText(row.projectCode),
          String(row.strategy || 'งานประจำ').trim(),
          String(row.projectName || '').trim(),
          normalizeOptionalText(row.responsibleUnit),
          normalizeBudgetNumber(row.q1Budget),
          normalizeBudgetNumber(row.q2Budget),
          normalizeBudgetNumber(row.q3Budget),
          normalizeBudgetNumber(row.q4Budget),
          normalizeBudgetNumber(row.actualSpent),
          String(row.submissionStatus || 'ยังไม่ส่ง').trim() || 'ยังไม่ส่ง',
          String(row.budgetSource || 'เงินบำรุง').trim() || 'เงินบำรุง',
          normalizeOptionalText(row.notes),
          actorKey,
          actorKey
        )
      }

      statements.push({
        sql: `
          INSERT INTO project_tracking_records (
            fiscal_year, sequence_no, project_code, strategy, project_name,
            responsible_unit, q1_budget, q2_budget, q3_budget, q4_budget,
            actual_spent, submission_status, budget_source, notes,
            created_by, updated_by
          ) VALUES ${valueTuples.join(', ')}
        `,
        params,
      })
    }

    const tx = await this.deps.appTransaction(statements)
    const deletedCount = mode === 'replace' ? (tx.results?.[1]?.affectedRows ?? 0) : 0

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
