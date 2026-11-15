import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  aggregateDashboardStats,
  enrichCohortRecord,
  getAvailableFiscalYears,
  getCurrentThaiFiscalYear,
  normalizeCid,
  normalizeHn,
  toNullableNumber,
} from './dmRemissionDomain'
import {
  DM_DEFAULT_REMISSION_STATUS,
  DM_OPTION_CATEGORY_META,
  type DmOptionCategory,
  type DmRemissionCohortRaw,
  type DmRemissionCohortRecord,
  type DmRemissionCreateInput,
  type DmRemissionListResult,
  type DmRemissionOptionRecord,
  type DmRemissionPatientLookupResult,
  type DmRemissionUpdateInput,
} from './dmRemissionTypes'

export class DmRemissionConflictError extends Error {
  readonly status = 409
  constructor(message: string) {
    super(message)
    this.name = 'DmRemissionConflictError'
  }
}

export class DmRemissionNotFoundError extends Error {
  readonly status = 404
  constructor(message: string) {
    super(message)
    this.name = 'DmRemissionNotFoundError'
  }
}

export class DmRemissionValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'DmRemissionValidationError'
  }
}

export interface DmRemissionActor {
  username?: string | null
  email?: string | null
}

export interface DmRemissionDbDeps {
  appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  appTransaction: (
    statements: Array<{ sql: string; params?: unknown[] }>
  ) => Promise<{
    count: number
    results: Array<{ affectedRows: number; insertId: number | null }>
  }>
  clinicalQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
}

export interface DmRemissionListFilters {
  fiscalYear?: number
  pcuName?: string
  remissionStatus?: string
  search?: string
}

export interface DmRemissionOptionCreateInput {
  category: DmOptionCategory
  label: string
  sortOrder?: number
  isActive?: boolean
}

export interface DmRemissionOptionUpdateInput {
  label?: string
  sortOrder?: number
  isActive?: boolean
}

interface CohortFieldMapping {
  key: keyof DmRemissionCreateInput
  column: string
  transform?: (val: unknown) => unknown
}

function normalizeOptionalText(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const trimmed = String(val).trim()
  return trimmed || null
}

const COHORT_FIELD_MAPPINGS: readonly CohortFieldMapping[] = [
  { key: 'fiscalYear', column: 'fiscal_year' },
  { key: 'pcuName', column: 'pcu_name', transform: normalizeOptionalText },
  { key: 'patientName', column: 'patient_name', transform: (v) => String(v ?? '').trim() },
  { key: 'cid', column: 'cid', transform: (v) => normalizeCid(v as string | null | undefined) },
  { key: 'hn', column: 'hn', transform: (v) => normalizeHn(v as string | null | undefined) },
  { key: 'age', column: 'age', transform: toNullableNumber },
  { key: 'underlyingDiseases', column: 'underlying_diseases', transform: normalizeOptionalText },
  { key: 'heightCm', column: 'height_cm', transform: toNullableNumber },
  { key: 'weightBeforeKg', column: 'weight_before_kg', transform: toNullableNumber },
  { key: 'weightAfterKg', column: 'weight_after_kg', transform: toNullableNumber },
  { key: 'waistBeforeCm', column: 'waist_before_cm', transform: toNullableNumber },
  { key: 'waistAfterCm', column: 'waist_after_cm', transform: toNullableNumber },
  { key: 'fpgBefore', column: 'fpg_before', transform: toNullableNumber },
  { key: 'fpgAfter', column: 'fpg_after', transform: toNullableNumber },
  { key: 'a1cBefore', column: 'a1c_before', transform: toNullableNumber },
  { key: 'a1cAfter', column: 'a1c_after', transform: toNullableNumber },
  { key: 'a1cPostStop3m', column: 'a1c_post_stop_3m', transform: toNullableNumber },
  { key: 'medsBefore', column: 'meds_before', transform: normalizeOptionalText },
  { key: 'medsAfter', column: 'meds_after', transform: normalizeOptionalText },
  { key: 'summaryA1c', column: 'summary_a1c', transform: normalizeOptionalText },
  { key: 'summaryMeds', column: 'summary_meds', transform: normalizeOptionalText },
  { key: 'summaryWeight', column: 'summary_weight', transform: normalizeOptionalText },
  { key: 'summaryWaist', column: 'summary_waist', transform: normalizeOptionalText },
  { key: 'summaryDiet', column: 'summary_diet', transform: normalizeOptionalText },
  { key: 'summaryExercise', column: 'summary_exercise', transform: normalizeOptionalText },
  { key: 'summaryIf', column: 'summary_if', transform: normalizeOptionalText },
  { key: 'summaryRemission', column: 'summary_remission', transform: normalizeOptionalText },
]

const COHORT_SELECT_SQL = `
  SELECT
    id,
    fiscal_year AS fiscalYear,
    pcu_name AS pcuName,
    patient_name AS patientName,
    cid,
    hn,
    age,
    underlying_diseases AS underlyingDiseases,
    height_cm AS heightCm,
    weight_before_kg AS weightBeforeKg,
    weight_after_kg AS weightAfterKg,
    waist_before_cm AS waistBeforeCm,
    waist_after_cm AS waistAfterCm,
    fpg_before AS fpgBefore,
    fpg_after AS fpgAfter,
    a1c_before AS a1cBefore,
    a1c_after AS a1cAfter,
    a1c_post_stop_3m AS a1cPostStop3m,
    meds_before AS medsBefore,
    meds_after AS medsAfter,
    summary_a1c AS summaryA1c,
    summary_meds AS summaryMeds,
    summary_weight AS summaryWeight,
    summary_waist AS summaryWaist,
    summary_diet AS summaryDiet,
    summary_exercise AS summaryExercise,
    summary_if AS summaryIf,
    summary_remission AS summaryRemission,
    created_by AS createdBy,
    updated_by AS updatedBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM dm_remission_cohorts
`

const OPTION_SELECT_SQL = `
  SELECT
    id,
    category,
    label,
    sort_order AS sortOrder,
    is_active AS isActive,
    created_by AS createdBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM dm_remission_options
`

const CREATE_COHORTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS dm_remission_cohorts (
    id INT NOT NULL AUTO_INCREMENT,
    fiscal_year INT NOT NULL,
    pcu_name VARCHAR(150) NULL,
    patient_name VARCHAR(255) NOT NULL,
    cid VARCHAR(20) NULL,
    hn VARCHAR(20) NULL,
    age INT NULL,
    underlying_diseases VARCHAR(500) NULL,
    height_cm DECIMAL(5, 2) NULL,
    weight_before_kg DECIMAL(6, 2) NULL,
    weight_after_kg DECIMAL(6, 2) NULL,
    waist_before_cm DECIMAL(6, 2) NULL,
    waist_after_cm DECIMAL(6, 2) NULL,
    fpg_before DECIMAL(6, 2) NULL,
    fpg_after DECIMAL(6, 2) NULL,
    a1c_before DECIMAL(5, 2) NULL,
    a1c_after DECIMAL(5, 2) NULL,
    a1c_post_stop_3m DECIMAL(5, 2) NULL,
    meds_before TEXT NULL,
    meds_after TEXT NULL,
    summary_a1c VARCHAR(50) NULL,
    summary_meds VARCHAR(50) NULL,
    summary_weight VARCHAR(50) NULL,
    summary_waist VARCHAR(50) NULL,
    summary_diet VARCHAR(100) NULL,
    summary_exercise VARCHAR(100) NULL,
    summary_if VARCHAR(100) NULL,
    summary_remission VARCHAR(100) NULL,
    created_by VARCHAR(100) NULL,
    updated_by VARCHAR(100) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dm_remission_fy_hn (fiscal_year, hn),
    UNIQUE KEY uq_dm_remission_fy_cid (fiscal_year, cid),
    INDEX idx_dm_remission_fy (fiscal_year),
    INDEX idx_dm_remission_pcu (pcu_name),
    INDEX idx_dm_remission_status (summary_remission)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_OPTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS dm_remission_options (
    id INT NOT NULL AUTO_INCREMENT,
    category VARCHAR(50) NOT NULL,
    label VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dm_remission_opt_cat_label (category, label),
    INDEX idx_dm_remission_opt_lookup (category, is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const ALL_OPTION_CATEGORIES: readonly DmOptionCategory[] = [
  'remission',
  'diet',
  'exercise',
  'if_fasting',
  'pcu',
]

function serializeTimestamp(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString()
  }
  return String(val ?? '')
}

function mapCohortRow(row: DmRemissionCohortRaw): DmRemissionCohortRecord {
  return enrichCohortRecord({
    ...row,
    fiscalYear: Number(row.fiscalYear),
    createdAt: serializeTimestamp(row.createdAt),
    updatedAt: serializeTimestamp(row.updatedAt),
  })
}

function mapOptionRow(row: Record<string, unknown>): DmRemissionOptionRecord {
  return {
    id: Number(row.id),
    category: row.category as DmOptionCategory,
    label: String(row.label ?? ''),
    sortOrder: Number(row.sortOrder ?? 0),
    isActive: Boolean(row.isActive),
    createdBy: row.createdBy ? String(row.createdBy) : null,
    createdAt: serializeTimestamp(row.createdAt),
    updatedAt: serializeTimestamp(row.updatedAt),
  }
}

function isDuplicateEntryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const record = err as { code?: unknown; errno?: unknown; message?: unknown }
  if (record.code === 'ER_DUP_ENTRY' || record.errno === 1062) return true
  if (typeof record.message === 'string' && /duplicate entry/i.test(record.message)) {
    return true
  }
  return false
}

export class DmRemissionService {
  private readonly deps: DmRemissionDbDeps
  private schemaEnsured = false
  private ensurePromise: Promise<void> | null = null

  constructor(deps?: Partial<DmRemissionDbDeps>) {
    this.deps = {
      appQuery: deps?.appQuery ?? ((sql, params) => apiGateway.app.query(sql, params)),
      appTransaction:
        deps?.appTransaction ?? ((statements) => apiGateway.app.transaction(statements)),
      clinicalQuery:
        deps?.clinicalQuery ?? ((sql, params) => apiGateway.clinical.query(sql, params)),
    }
  }

  private async executeWrite(
    sql: string,
    params: unknown[] = []
  ): Promise<{ affectedRows: number; insertId: number | null }> {
    // Pin SET NAMES utf8mb4 per transaction so MariaDB tis620 init_connect never corrupts Thai text.
    const tx = await this.deps.appTransaction([
      { sql: 'SET NAMES utf8mb4' },
      { sql, params },
    ])
    return tx.results?.[1] ?? { affectedRows: 0, insertId: null }
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) {
      return
    }
    if (this.ensurePromise) {
      return this.ensurePromise
    }

    this.ensurePromise = (async () => {
      await this.deps.appTransaction([
        { sql: 'SET NAMES utf8mb4' },
        { sql: CREATE_COHORTS_TABLE_SQL },
        { sql: CREATE_OPTIONS_TABLE_SQL },
      ])

      const countRows = await this.deps.appQuery<{ cnt: number | string }>(
        `SELECT COUNT(*) AS cnt FROM dm_remission_options WHERE category = 'remission'`
      )
      const existingCount = Number(countRows[0]?.cnt ?? 0)

      if (existingCount === 0) {
        const seedLabels = DM_OPTION_CATEGORY_META.remission.seedLabels
        if (seedLabels.length > 0) {
          const seedStatements = seedLabels.map((label, idx) => ({
            sql: `
              INSERT IGNORE INTO dm_remission_options (category, label, sort_order, is_active, created_by)
              VALUES (?, ?, ?, ?, ?)
            `,
            params: ['remission', label, idx, true, 'system'],
          }))
          await this.deps.appTransaction([{ sql: 'SET NAMES utf8mb4' }, ...seedStatements])
        }
      }

      this.schemaEnsured = true
    })()

    try {
      await this.ensurePromise
    } finally {
      this.ensurePromise = null
    }
  }

  async lookupPatientByHn(hn: string): Promise<DmRemissionPatientLookupResult | null> {
    const cleanHn = normalizeHn(hn)
    if (!cleanHn) {
      return null
    }

    const ptSql = `
      SELECT
        pt.hn,
        pt.cid,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age
      FROM patient pt
      WHERE pt.hn = ?
      LIMIT 1
    `

    const rows = await this.deps.clinicalQuery<{
      hn: string
      cid: string | null
      ptname: string | null
      age: number | string | null
    }>(ptSql, [cleanHn])

    if (!rows || rows.length === 0) {
      return null
    }

    const pt = rows[0]
    return {
      hn: String(pt.hn ?? cleanHn).trim(),
      cid: normalizeCid(pt.cid),
      patientName: String(pt.ptname ?? '').trim(),
      age: toNullableNumber(pt.age),
    }
  }

  async listOptions(): Promise<Record<DmOptionCategory, DmRemissionOptionRecord[]>> {
    await this.ensureSchema()

    const rows = await this.deps.appQuery<Record<string, unknown>>(
      `${OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`
    )

    const grouped: Record<DmOptionCategory, DmRemissionOptionRecord[]> = {
      remission: [],
      diet: [],
      exercise: [],
      if_fasting: [],
      pcu: [],
    }

    for (const row of rows) {
      const mapped = mapOptionRow(row)
      if (ALL_OPTION_CATEGORIES.includes(mapped.category)) {
        grouped[mapped.category].push(mapped)
      }
    }

    return grouped
  }

  async listCohorts(filters: DmRemissionListFilters = {}): Promise<DmRemissionListResult> {
    await this.ensureSchema()

    const targetFiscalYear = filters.fiscalYear ?? getCurrentThaiFiscalYear()

    const [optionRows, yearRows, pcuRows, cohortRows] = await Promise.all([
      this.deps.appQuery<Record<string, unknown>>(
        `${OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`
      ),
      this.deps.appQuery<{ fiscalYear: number | string }>(
        `SELECT DISTINCT fiscal_year AS fiscalYear FROM dm_remission_cohorts ORDER BY fiscal_year DESC`
      ),
      this.deps.appQuery<{ pcuName: string }>(
        `SELECT DISTINCT pcu_name AS pcuName FROM dm_remission_cohorts WHERE pcu_name IS NOT NULL AND pcu_name <> ''`
      ),
      this.deps.appQuery<DmRemissionCohortRaw>(
        `${COHORT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY id DESC`,
        [targetFiscalYear]
      ),
    ])

    const options: Record<DmOptionCategory, DmRemissionOptionRecord[]> = {
      remission: [],
      diet: [],
      exercise: [],
      if_fasting: [],
      pcu: [],
    }
    for (const row of optionRows) {
      const mapped = mapOptionRow(row)
      if (ALL_OPTION_CATEGORIES.includes(mapped.category)) {
        options[mapped.category].push(mapped)
      }
    }

    const availableFiscalYears = getAvailableFiscalYears(
      yearRows.map((r) => Number(r.fiscalYear))
    )

    const pcuSet = new Set<string>()
    for (const opt of options.pcu) {
      if (opt.isActive && opt.label.trim()) {
        pcuSet.add(opt.label.trim())
      }
    }
    for (const row of pcuRows) {
      if (row.pcuName && row.pcuName.trim()) {
        pcuSet.add(row.pcuName.trim())
      }
    }
    const availablePcus = Array.from(pcuSet).sort((a, b) => a.localeCompare(b, 'th'))

    const allYearRecords = cohortRows.map(mapCohortRow)

    const pcuFilter = filters.pcuName?.trim()
    const pcuScopedRecords =
      pcuFilter && pcuFilter !== 'ALL'
        ? allYearRecords.filter(
            (r) => (r.pcuName?.trim() || 'ไม่ระบุ รพ.สต.') === pcuFilter
          )
        : allYearRecords

    const configuredRemissionLabels = options.remission
      .filter((o) => o.isActive)
      .map((o) => o.label)

    const stats = aggregateDashboardStats(pcuScopedRecords, configuredRemissionLabels)

    let items = pcuScopedRecords

    const statusFilter = filters.remissionStatus?.trim()
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'ยังไม่ระบุ') {
        items = items.filter((r) => !r.summaryRemission || !r.summaryRemission.trim())
      } else {
        items = items.filter((r) => r.summaryRemission?.trim() === statusFilter)
      }
    }

    const searchTerm = filters.search?.trim().toLowerCase()
    if (searchTerm) {
      const compactSearch = searchTerm.replace(/[\s-]+/g, '')
      items = items.filter((r) => {
        const nameMatch = r.patientName.toLowerCase().includes(searchTerm)
        const hnMatch = Boolean(r.hn && r.hn.toLowerCase().includes(searchTerm))
        const cidMatch = Boolean(
          r.cid &&
            (r.cid.toLowerCase().includes(searchTerm) ||
              (compactSearch && r.cid.toLowerCase().includes(compactSearch)))
        )
        const pcuMatch = Boolean(r.pcuName && r.pcuName.toLowerCase().includes(searchTerm))
        return nameMatch || hnMatch || cidMatch || pcuMatch
      })
    }

    return {
      fiscalYear: targetFiscalYear,
      availableFiscalYears,
      availablePcus,
      items,
      options,
      stats,
    }
  }

  private async getCohortById(id: number): Promise<DmRemissionCohortRecord | null> {
    const rows = await this.deps.appQuery<DmRemissionCohortRaw>(
      `${COHORT_SELECT_SQL} WHERE id = ? LIMIT 1`,
      [id]
    )
    return rows.length > 0 ? mapCohortRow(rows[0]) : null
  }

  private async assertNoDuplicateCohort(
    fiscalYear: number,
    hn: string | null,
    cid: string | null,
    excludeId?: number
  ): Promise<void> {
    const identityClauses: string[] = []
    const params: unknown[] = [fiscalYear]

    if (hn) {
      identityClauses.push('hn = ?')
      params.push(hn)
    }
    if (cid) {
      identityClauses.push('cid = ?')
      params.push(cid)
    }

    if (identityClauses.length === 0) {
      return
    }

    let sql = `SELECT id FROM dm_remission_cohorts WHERE fiscal_year = ? AND (${identityClauses.join(' OR ')})`
    if (excludeId !== undefined) {
      sql += ' AND id <> ?'
      params.push(excludeId)
    }
    sql += ' LIMIT 1'

    const dupRows = await this.deps.appQuery<{ id: number }>(sql, params)
    if (dupRows.length > 0) {
      throw new DmRemissionConflictError(
        `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณ ${fiscalYear} แล้ว`
      )
    }
  }

  async createCohort(
    input: DmRemissionCreateInput,
    actor?: DmRemissionActor | null
  ): Promise<DmRemissionCohortRecord> {
    await this.ensureSchema()

    const patientName = (input.patientName ?? '').trim()
    if (!patientName) {
      throw new DmRemissionValidationError('กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
    }

    const hn = normalizeHn(input.hn)
    const cid = normalizeCid(input.cid)

    await this.assertNoDuplicateCohort(input.fiscalYear, hn, cid)

    const actorName = actor?.username?.trim() || 'system'
    const columns: string[] = []
    const placeholders: string[] = []
    const params: unknown[] = []

    for (const mapping of COHORT_FIELD_MAPPINGS) {
      const rawVal = input[mapping.key]
      const normalizedVal = mapping.transform ? mapping.transform(rawVal) : (rawVal ?? null)
      columns.push(mapping.column)
      placeholders.push('?')
      params.push(normalizedVal)
    }

    columns.push('created_by', 'updated_by')
    placeholders.push('?', '?')
    params.push(actorName, actorName)

    const insertSql = `
      INSERT INTO dm_remission_cohorts (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `

    let insertId: number | null = null
    try {
      const res = await this.executeWrite(insertSql, params)
      insertId = res.insertId
    } catch (err) {
      if (isDuplicateEntryError(err)) {
        throw new DmRemissionConflictError(
          `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณ ${input.fiscalYear} แล้ว`
        )
      }
      throw err
    }

    if (!insertId) {
      throw new Error('ไม่สามารถอ่านรหัสรายการที่สร้างใหม่ได้')
    }

    const created = await this.getCohortById(insertId)
    if (!created) {
      throw new Error('ไม่พบข้อมูลรายการที่เพิ่งบันทึก')
    }

    await logAudit(
      'CREATE',
      'dm_remission_cohorts',
      `Created DM Remission cohort ID: ${created.id} (FY: ${input.fiscalYear})`,
      actor
    )

    return created
  }

  async updateCohort(
    id: number,
    input: DmRemissionUpdateInput,
    actor?: DmRemissionActor | null
  ): Promise<DmRemissionCohortRecord> {
    await this.ensureSchema()

    const existing = await this.getCohortById(id)
    if (!existing) {
      throw new DmRemissionNotFoundError(`ไม่พบข้อมูล DM Remission ID: ${id}`)
    }

    if (input.patientName !== undefined && !input.patientName.trim()) {
      throw new DmRemissionValidationError('กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
    }

    const targetFiscalYear = input.fiscalYear ?? existing.fiscalYear
    const nextHn = input.hn !== undefined ? normalizeHn(input.hn) : existing.hn
    const nextCid = input.cid !== undefined ? normalizeCid(input.cid) : existing.cid

    await this.assertNoDuplicateCohort(targetFiscalYear, nextHn, nextCid, id)

    const setClauses: string[] = []
    const params: unknown[] = []

    for (const mapping of COHORT_FIELD_MAPPINGS) {
      if (input[mapping.key] !== undefined) {
        const rawVal = input[mapping.key]
        const normalizedVal = mapping.transform ? mapping.transform(rawVal) : rawVal
        setClauses.push(`${mapping.column} = ?`)
        params.push(normalizedVal)
      }
    }

    const actorName = actor?.username?.trim() || 'system'
    setClauses.push('updated_by = ?')
    params.push(actorName)
    params.push(id)

    const updateSql = `UPDATE dm_remission_cohorts SET ${setClauses.join(', ')} WHERE id = ?`

    try {
      await this.executeWrite(updateSql, params)
    } catch (err) {
      if (isDuplicateEntryError(err)) {
        throw new DmRemissionConflictError(
          `ผู้ป่วยนี้ (HN หรือเลขบัตรประชาชน) มีอยู่ในทะเบียนปีงบประมาณ ${targetFiscalYear} แล้ว`
        )
      }
      throw err
    }

    const updated = await this.getCohortById(id)
    if (!updated) {
      throw new DmRemissionNotFoundError(`ไม่พบข้อมูล DM Remission ID: ${id}`)
    }

    await logAudit(
      'UPDATE',
      'dm_remission_cohorts',
      `Updated DM Remission cohort ID: ${id} (FY: ${targetFiscalYear})`,
      actor
    )

    return updated
  }

  async deleteCohort(
    id: number,
    actor?: DmRemissionActor | null
  ): Promise<{ id: number; fiscalYear: number }> {
    await this.ensureSchema()

    const existing = await this.getCohortById(id)
    if (!existing) {
      throw new DmRemissionNotFoundError(`ไม่พบข้อมูล DM Remission ID: ${id}`)
    }

    await this.executeWrite('DELETE FROM dm_remission_cohorts WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'dm_remission_cohorts',
      `Deleted DM Remission cohort ID: ${id} (FY: ${existing.fiscalYear})`,
      actor
    )

    return { id, fiscalYear: existing.fiscalYear }
  }

  async carryoverFromFiscalYear(
    fromFiscalYear: number,
    toFiscalYear: number,
    actor?: DmRemissionActor | null
  ): Promise<{ copiedCount: number; skippedCount: number }> {
    await this.ensureSchema()

    if (toFiscalYear <= fromFiscalYear) {
      throw new DmRemissionValidationError(
        'ปีงบประมาณปลายทางต้องมากกว่าปีงบประมาณต้นทาง'
      )
    }

    const [sourceRows, targetIdentityRows] = await Promise.all([
      this.deps.appQuery<DmRemissionCohortRaw>(
        `${COHORT_SELECT_SQL}
         WHERE fiscal_year = ?
           AND (summary_remission IS NULL OR summary_remission <> 'Remission')
         ORDER BY id ASC`,
        [fromFiscalYear]
      ),
      this.deps.appQuery<{ hn: string | null; cid: string | null }>(
        `SELECT hn, cid FROM dm_remission_cohorts WHERE fiscal_year = ?`,
        [toFiscalYear]
      ),
    ])

    const existingHns = new Set<string>()
    const existingCids = new Set<string>()
    for (const row of targetIdentityRows) {
      const hn = normalizeHn(row.hn)
      const cid = normalizeCid(row.cid)
      if (hn) existingHns.add(hn)
      if (cid) existingCids.add(cid)
    }

    const actorName = actor?.username?.trim() || 'system'
    const statements: Array<{ sql: string; params?: unknown[] }> = []
    let copiedCount = 0
    let skippedCount = 0

    const insertSql = `
      INSERT INTO dm_remission_cohorts (
        fiscal_year, pcu_name, patient_name, cid, hn, age, underlying_diseases,
        height_cm, weight_before_kg, waist_before_cm, fpg_before, a1c_before,
        meds_before, summary_remission, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    for (const raw of sourceRows) {
      const r = mapCohortRow(raw)
      const hn = normalizeHn(r.hn)
      const cid = normalizeCid(r.cid)

      if ((hn && existingHns.has(hn)) || (cid && existingCids.has(cid))) {
        skippedCount += 1
        continue
      }

      if (hn) existingHns.add(hn)
      if (cid) existingCids.add(cid)

      statements.push({
        sql: insertSql,
        params: [
          toFiscalYear,
          r.pcuName ?? null,
          r.patientName,
          cid,
          hn,
          r.age,
          r.underlyingDiseases ?? null,
          r.heightCm,
          r.weightAfterKg ?? r.weightBeforeKg,
          r.waistAfterCm ?? r.waistBeforeCm,
          r.fpgAfter ?? r.fpgBefore,
          r.a1cAfter ?? r.a1cBefore,
          r.medsAfter ?? r.medsBefore ?? null,
          DM_DEFAULT_REMISSION_STATUS,
          actorName,
          actorName,
        ],
      })
      copiedCount += 1
    }

    if (statements.length > 0) {
      await this.deps.appTransaction([{ sql: 'SET NAMES utf8mb4' }, ...statements])
    }

    await logAudit(
      'CREATE',
      'dm_remission_cohorts',
      `Carryover DM Remission cohorts from FY ${fromFiscalYear} to FY ${toFiscalYear}: copied ${copiedCount}, skipped ${skippedCount}`,
      actor
    )

    return { copiedCount, skippedCount }
  }

  private async getOptionById(id: number): Promise<DmRemissionOptionRecord | null> {
    const rows = await this.deps.appQuery<Record<string, unknown>>(
      `${OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`,
      [id]
    )
    return rows.length > 0 ? mapOptionRow(rows[0]) : null
  }

  async createOption(
    input: DmRemissionOptionCreateInput,
    actor?: DmRemissionActor | null
  ): Promise<DmRemissionOptionRecord> {
    await this.ensureSchema()

    const label = (input.label ?? '').trim()
    if (!label) {
      throw new DmRemissionValidationError('กรุณาระบุชื่อตัวเลือก')
    }

    const dupRows = await this.deps.appQuery<{ id: number }>(
      `SELECT id FROM dm_remission_options WHERE category = ? AND label = ? LIMIT 1`,
      [input.category, label]
    )
    if (dupRows.length > 0) {
      throw new DmRemissionConflictError(`มีตัวเลือก "${label}" อยู่ในหมวดหมู่นี้แล้ว`)
    }

    const actorName = actor?.username?.trim() || 'system'
    const sortOrder = input.sortOrder ?? 0
    const isActive = input.isActive ?? true

    let insertId: number | null = null
    try {
      const res = await this.executeWrite(
        `INSERT INTO dm_remission_options (category, label, sort_order, is_active, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [input.category, label, sortOrder, isActive, actorName]
      )
      insertId = res.insertId
    } catch (err) {
      if (isDuplicateEntryError(err)) {
        throw new DmRemissionConflictError(`มีตัวเลือก "${label}" อยู่ในหมวดหมู่นี้แล้ว`)
      }
      throw err
    }

    if (!insertId) {
      throw new Error('ไม่สามารถอ่านรหัสตัวเลือกที่สร้างใหม่ได้')
    }

    const created = await this.getOptionById(insertId)
    if (!created) {
      throw new Error('ไม่พบข้อมูลตัวเลือกที่เพิ่งบันทึก')
    }

    await logAudit(
      'CREATE',
      'dm_remission_options',
      `Created DM Remission option ID: ${created.id} (category: ${input.category})`,
      actor
    )

    return created
  }

  async updateOption(
    id: number,
    input: DmRemissionOptionUpdateInput,
    actor?: DmRemissionActor | null
  ): Promise<DmRemissionOptionRecord> {
    await this.ensureSchema()

    const existing = await this.getOptionById(id)
    if (!existing) {
      throw new DmRemissionNotFoundError(`ไม่พบตัวเลือก ID: ${id}`)
    }

    const setClauses: string[] = []
    const params: unknown[] = []

    if (input.label !== undefined) {
      const label = input.label.trim()
      if (!label) {
        throw new DmRemissionValidationError('กรุณาระบุชื่อตัวเลือก')
      }
      const dupRows = await this.deps.appQuery<{ id: number }>(
        `SELECT id FROM dm_remission_options WHERE category = ? AND label = ? AND id <> ? LIMIT 1`,
        [existing.category, label, id]
      )
      if (dupRows.length > 0) {
        throw new DmRemissionConflictError(`มีตัวเลือก "${label}" อยู่ในหมวดหมู่นี้แล้ว`)
      }
      setClauses.push('label = ?')
      params.push(label)
    }

    if (input.sortOrder !== undefined) {
      setClauses.push('sort_order = ?')
      params.push(input.sortOrder)
    }

    if (input.isActive !== undefined) {
      setClauses.push('is_active = ?')
      params.push(input.isActive)
    }

    if (setClauses.length > 0) {
      params.push(id)
      try {
        await this.executeWrite(
          `UPDATE dm_remission_options SET ${setClauses.join(', ')} WHERE id = ?`,
          params
        )
      } catch (err) {
        if (isDuplicateEntryError(err)) {
          throw new DmRemissionConflictError('มีตัวเลือกชื่อนี้อยู่ในหมวดหมู่นี้แล้ว')
        }
        throw err
      }
    }

    const updated = await this.getOptionById(id)
    if (!updated) {
      throw new DmRemissionNotFoundError(`ไม่พบตัวเลือก ID: ${id}`)
    }

    await logAudit(
      'UPDATE',
      'dm_remission_options',
      `Updated DM Remission option ID: ${id} (category: ${existing.category})`,
      actor
    )

    return updated
  }

  async deleteOption(
    id: number,
    actor?: DmRemissionActor | null
  ): Promise<{ id: number; category: DmOptionCategory }> {
    await this.ensureSchema()

    const existing = await this.getOptionById(id)
    if (!existing) {
      throw new DmRemissionNotFoundError(`ไม่พบตัวเลือก ID: ${id}`)
    }

    await this.executeWrite('DELETE FROM dm_remission_options WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'dm_remission_options',
      `Deleted DM Remission option ID: ${id} (category: ${existing.category})`,
      actor
    )

    return { id, category: existing.category }
  }
}

export const dmRemissionService = new DmRemissionService()
