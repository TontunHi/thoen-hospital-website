import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  aggregateFctDashboardStats,
  getAvailableFiscalYears,
  getCurrentThaiFiscalYear,
  getThaiFiscalYearFromDate,
  normalizeAdlGroupValue,
  normalizeHn,
  normalizeNutritionStatusValue,
  normalizeOptionalText,
  normalizePcuValue,
  normalizeRiskValue,
  parseFlexibleVisitDate,
  suggestAdlGroup,
  toNullableNumber,
} from './fctHomeVisitDomain'
import {
  FCT_ALL_OPTION_CATEGORIES,
  FCT_OPTION_CATEGORY_META,
  type FctBatchImportResult,
  type FctHomeVisitCreateInput,
  type FctHomeVisitListResult,
  type FctHomeVisitOptionRecord,
  type FctHomeVisitPatientLookupResult,
  type FctHomeVisitRecord,
  type FctHomeVisitUpdateInput,
  type FctOptionCategory,
} from './fctHomeVisitTypes'

export class FctHomeVisitConflictError extends Error {
  readonly status = 409
  constructor(message: string) {
    super(message)
    this.name = 'FctHomeVisitConflictError'
  }
}

export class FctHomeVisitNotFoundError extends Error {
  readonly status = 404
  constructor(message: string) {
    super(message)
    this.name = 'FctHomeVisitNotFoundError'
  }
}

export class FctHomeVisitValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'FctHomeVisitValidationError'
  }
}

export interface FctHomeVisitActor {
  username?: string | null
  email?: string | null
}

export interface FctHomeVisitDbDeps {
  appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  appTransaction: (
    statements: Array<{ sql: string; params?: unknown[] }>
  ) => Promise<{
    count: number
    results: Array<{ affectedRows: number; insertId: number | null }>
  }>
  clinicalQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
}

export interface FctHomeVisitListFilters {
  fiscalYear?: number
  pcuName?: string
  adlGroup?: string
  visitOutcome?: string
  search?: string
}

export interface FctHomeVisitOptionCreateInput {
  category: FctOptionCategory
  label: string
  sortOrder?: number
  isActive?: boolean
}

export interface FctHomeVisitOptionUpdateInput {
  label?: string
  sortOrder?: number
  isActive?: boolean
}

interface VisitFieldMapping {
  key: keyof FctHomeVisitCreateInput
  column: string
  transform: (val: unknown) => unknown
}

const VISIT_FIELD_MAPPINGS: readonly VisitFieldMapping[] = [
  { key: 'visitDate', column: 'visit_date', transform: (v) => String(v ?? '').trim() },
  { key: 'pcuName', column: 'pcu_name', transform: normalizePcuValue },
  { key: 'patientName', column: 'patient_name', transform: (v) => String(v ?? '').trim() },
  { key: 'hn', column: 'hn', transform: (v) => normalizeHn(v as string | null | undefined) },
  { key: 'age', column: 'age', transform: toNullableNumber },
  { key: 'address', column: 'address', transform: normalizeOptionalText },
  { key: 'adlScore', column: 'adl_score', transform: toNullableNumber },
  { key: 'adlGroup', column: 'adl_group', transform: normalizeAdlGroupValue },
  { key: 'diagnosis', column: 'diagnosis', transform: normalizeOptionalText },
  { key: 'patientCategory', column: 'patient_category', transform: normalizeOptionalText },
  { key: 'followUpPlan', column: 'follow_up_plan', transform: normalizeOptionalText },
  { key: 'treatmentFacility', column: 'treatment_facility', transform: normalizeOptionalText },
  { key: 'visitOutcome', column: 'visit_outcome', transform: normalizeOptionalText },
  { key: 'overallRiskLevel', column: 'overall_risk_level', transform: normalizeRiskValue },
  { key: 'riskLevel', column: 'risk_level', transform: normalizeRiskValue },
  { key: 'dentalNote', column: 'dental_note', transform: normalizeOptionalText },
  { key: 'pharmacyNote', column: 'pharmacy_note', transform: normalizeOptionalText },
  { key: 'nutritionStatus', column: 'nutrition_status', transform: normalizeNutritionStatusValue },
  { key: 'nutritionNote', column: 'nutrition_note', transform: normalizeOptionalText },
  { key: 'ptCategory', column: 'pt_category', transform: normalizeOptionalText },
  { key: 'ptNote', column: 'pt_note', transform: normalizeOptionalText },
  { key: 'thaiMedCategory', column: 'thai_med_category', transform: normalizeOptionalText },
  { key: 'thaiMedNote', column: 'thai_med_note', transform: normalizeOptionalText },
]

const VISIT_SELECT_SQL = `
  SELECT
    id,
    fiscal_year AS fiscalYear,
    DATE_FORMAT(visit_date, '%Y-%m-%d') AS visitDate,
    pcu_name AS pcuName,
    patient_name AS patientName,
    hn,
    age,
    address,
    adl_score AS adlScore,
    adl_group AS adlGroup,
    diagnosis,
    patient_category AS patientCategory,
    follow_up_plan AS followUpPlan,
    treatment_facility AS treatmentFacility,
    visit_outcome AS visitOutcome,
    overall_risk_level AS overallRiskLevel,
    risk_level AS riskLevel,
    dental_note AS dentalNote,
    pharmacy_note AS pharmacyNote,
    nutrition_status AS nutritionStatus,
    nutrition_note AS nutritionNote,
    pt_category AS ptCategory,
    pt_note AS ptNote,
    thai_med_category AS thaiMedCategory,
    thai_med_note AS thaiMedNote,
    created_by AS createdBy,
    updated_by AS updatedBy,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM fct_home_visits
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
  FROM fct_home_visit_options
`

const CREATE_VISITS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS fct_home_visits (
    id INT NOT NULL AUTO_INCREMENT,
    fiscal_year INT NOT NULL,
    visit_date DATE NOT NULL,
    pcu_name VARCHAR(150) NULL,
    patient_name VARCHAR(255) NOT NULL,
    hn VARCHAR(20) NULL,
    age INT NULL,
    address VARCHAR(500) NULL,
    adl_score INT NULL,
    adl_group VARCHAR(100) NULL,
    diagnosis VARCHAR(500) NULL,
    patient_category VARCHAR(150) NULL,
    follow_up_plan TEXT NULL,
    treatment_facility VARCHAR(255) NULL,
    visit_outcome VARCHAR(100) NULL,
    overall_risk_level VARCHAR(100) NULL,
    risk_level VARCHAR(100) NULL,
    dental_note TEXT NULL,
    pharmacy_note TEXT NULL,
    nutrition_status VARCHAR(150) NULL,
    nutrition_note TEXT NULL,
    pt_category VARCHAR(255) NULL,
    pt_note TEXT NULL,
    thai_med_category VARCHAR(255) NULL,
    thai_med_note TEXT NULL,
    created_by VARCHAR(100) NULL,
    updated_by VARCHAR(100) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    INDEX idx_fct_home_visits_fy (fiscal_year),
    INDEX idx_fct_home_visits_date (visit_date),
    INDEX idx_fct_home_visits_hn (hn),
    INDEX idx_fct_home_visits_pcu (pcu_name),
    INDEX idx_fct_home_visits_date_hn (visit_date, hn)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const CREATE_OPTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS fct_home_visit_options (
    id INT NOT NULL AUTO_INCREMENT,
    category VARCHAR(50) NOT NULL,
    label VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (id),
    UNIQUE KEY uq_fct_home_visit_opt_cat_label (category, label),
    INDEX idx_fct_home_visit_opt_lookup (category, is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

function serializeTimestamp(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString()
  }
  return String(val ?? '')
}

function serializeIsoDate(val: unknown): string {
  if (val instanceof Date && Number.isFinite(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  return String(val ?? '').trim().slice(0, 10)
}

function createEmptyOptionGroups(): Record<FctOptionCategory, FctHomeVisitOptionRecord[]> {
  return {
    pcu: [],
    patient_category: [],
    adl_group: [],
    visit_outcome: [],
    overall_risk: [],
    risk_level: [],
    treatment_facility: [],
    nutrition_status: [],
    pt_category: [],
    thai_med_category: [],
  }
}

function mapVisitRow(row: Record<string, unknown>): FctHomeVisitRecord {
  return {
    id: Number(row.id),
    fiscalYear: Number(row.fiscalYear),
    visitDate: serializeIsoDate(row.visitDate),
    pcuName: normalizeOptionalText(row.pcuName),
    patientName: String(row.patientName ?? '').trim(),
    hn: normalizeHn(row.hn as string | null | undefined),
    age: toNullableNumber(row.age),
    address: normalizeOptionalText(row.address),
    adlScore: toNullableNumber(row.adlScore),
    adlGroup: normalizeOptionalText(row.adlGroup),
    diagnosis: normalizeOptionalText(row.diagnosis),
    patientCategory: normalizeOptionalText(row.patientCategory),
    followUpPlan: normalizeOptionalText(row.followUpPlan),
    treatmentFacility: normalizeOptionalText(row.treatmentFacility),
    visitOutcome: normalizeOptionalText(row.visitOutcome),
    overallRiskLevel: normalizeOptionalText(row.overallRiskLevel),
    riskLevel: normalizeOptionalText(row.riskLevel),
    dentalNote: normalizeOptionalText(row.dentalNote),
    pharmacyNote: normalizeOptionalText(row.pharmacyNote),
    nutritionStatus: normalizeOptionalText(row.nutritionStatus),
    nutritionNote: normalizeOptionalText(row.nutritionNote),
    ptCategory: normalizeOptionalText(row.ptCategory),
    ptNote: normalizeOptionalText(row.ptNote),
    thaiMedCategory: normalizeOptionalText(row.thaiMedCategory),
    thaiMedNote: normalizeOptionalText(row.thaiMedNote),
    createdBy: normalizeOptionalText(row.createdBy),
    updatedBy: normalizeOptionalText(row.updatedBy),
    createdAt: serializeTimestamp(row.createdAt),
    updatedAt: serializeTimestamp(row.updatedAt),
  }
}

function mapOptionRow(row: Record<string, unknown>): FctHomeVisitOptionRecord {
  return {
    id: Number(row.id),
    category: row.category as FctOptionCategory,
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

function assertValidIsoVisitDate(raw: unknown): string {
  const trimmed = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || parseFlexibleVisitDate(trimmed) !== trimmed) {
    throw new FctHomeVisitValidationError('วันที่เยี่ยมบ้านไม่ถูกต้อง')
  }
  return trimmed
}

function buildCreateStatementPayload(
  input: FctHomeVisitCreateInput,
  actorName: string
): {
  sql: string
  params: unknown[]
  visitDate: string
  fiscalYear: number
  hn: string | null
  patientName: string
} {
  const patientName = (input.patientName ?? '').trim()
  if (!patientName) {
    throw new FctHomeVisitValidationError('กรุณาระบุชื่อ-สกุลผู้ป่วย')
  }

  const visitDate = assertValidIsoVisitDate(input.visitDate)
  const fiscalYear = getThaiFiscalYearFromDate(visitDate)
  const adlScore = toNullableNumber(input.adlScore)
  const adlGroup = normalizeAdlGroupValue(input.adlGroup) ?? suggestAdlGroup(adlScore)
  const hn = normalizeHn(input.hn)

  const resolvedInput: FctHomeVisitCreateInput = {
    ...input,
    visitDate,
    patientName,
    hn,
    adlScore,
    adlGroup,
  }

  const columns: string[] = ['fiscal_year']
  const placeholders: string[] = ['?']
  const params: unknown[] = [fiscalYear]

  for (const mapping of VISIT_FIELD_MAPPINGS) {
    columns.push(mapping.column)
    placeholders.push('?')
    params.push(mapping.transform(resolvedInput[mapping.key]))
  }

  columns.push('created_by', 'updated_by')
  placeholders.push('?', '?')
  params.push(actorName, actorName)

  const sql = `
    INSERT INTO fct_home_visits (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `

  return { sql, params, visitDate, fiscalYear, hn, patientName }
}

export class FctHomeVisitService {
  private readonly deps: FctHomeVisitDbDeps
  private schemaEnsured = false
  private ensurePromise: Promise<void> | null = null

  constructor(deps?: Partial<FctHomeVisitDbDeps>) {
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
        { sql: CREATE_VISITS_TABLE_SQL },
        { sql: CREATE_OPTIONS_TABLE_SQL },
      ])

      const countRows = await this.deps.appQuery<{ category: string; cnt: number | string }>(
        `SELECT category, COUNT(*) AS cnt FROM fct_home_visit_options GROUP BY category`
      )
      const countByCategory = new Map<string, number>()
      for (const row of countRows) {
        countByCategory.set(String(row.category), Number(row.cnt ?? 0))
      }

      const seedStatements: Array<{ sql: string; params: unknown[] }> = []
      for (const category of FCT_ALL_OPTION_CATEGORIES) {
        if ((countByCategory.get(category) ?? 0) === 0) {
          const seedLabels = FCT_OPTION_CATEGORY_META[category].seedLabels
          for (let idx = 0; idx < seedLabels.length; idx++) {
            seedStatements.push({
              sql: `
                INSERT IGNORE INTO fct_home_visit_options (category, label, sort_order, is_active, created_by)
                VALUES (?, ?, ?, ?, ?)
              `,
              params: [category, seedLabels[idx], idx, true, 'system'],
            })
          }
        }
      }

      if (seedStatements.length > 0) {
        await this.deps.appTransaction([{ sql: 'SET NAMES utf8mb4' }, ...seedStatements])
      }

      this.schemaEnsured = true
    })()

    try {
      await this.ensurePromise
    } finally {
      this.ensurePromise = null
    }
  }

  async lookupPatientByHn(hn: string): Promise<FctHomeVisitPatientLookupResult | null> {
    const cleanHn = normalizeHn(hn)
    if (!cleanHn) {
      return null
    }

    const ptSql = `
      SELECT
        pt.hn,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age,
        CONCAT(
          IFNULL(pt.addrpart, ''),
          IF(IFNULL(pt.moopart, '') != '', CONCAT(' ม.', pt.moopart), ''),
          IF(IFNULL(pt.road, '') != '', CONCAT(' ถ.', pt.road), ''),
          IF(t.name IS NOT NULL, CONCAT(' ต.', t.name), ''),
          IF(a.name IS NOT NULL, CONCAT(' อ.', a.name), ''),
          IF(c.name IS NOT NULL, CONCAT(' จ.', c.name), '')
        ) AS address
      FROM patient pt
      LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
      LEFT JOIN thaiaddress a ON a.chwpart = pt.chwpart AND a.amppart = pt.amppart AND a.tmbpart = '00'
      LEFT JOIN thaiaddress c ON c.chwpart = pt.chwpart AND c.amppart = '00' AND c.tmbpart = '00'
      WHERE pt.hn = ?
      LIMIT 1
    `

    const rows = await this.deps.clinicalQuery<{
      hn: string
      ptname: string | null
      age: number | string | null
      address: string | null
    }>(ptSql, [cleanHn])

    if (!rows || rows.length === 0) {
      return null
    }

    const pt = rows[0]
    return {
      hn: String(pt.hn ?? cleanHn).trim(),
      patientName: String(pt.ptname ?? '').trim(),
      age: toNullableNumber(pt.age),
      address: normalizeOptionalText(pt.address),
    }
  }

  async listOptions(): Promise<Record<FctOptionCategory, FctHomeVisitOptionRecord[]>> {
    await this.ensureSchema()

    const rows = await this.deps.appQuery<Record<string, unknown>>(
      `${OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`
    )

    const grouped = createEmptyOptionGroups()
    for (const row of rows) {
      const mapped = mapOptionRow(row)
      if (FCT_ALL_OPTION_CATEGORIES.includes(mapped.category)) {
        grouped[mapped.category].push(mapped)
      }
    }

    return grouped
  }

  async listVisits(filters: FctHomeVisitListFilters = {}): Promise<FctHomeVisitListResult> {
    await this.ensureSchema()

    const targetFiscalYear = filters.fiscalYear ?? getCurrentThaiFiscalYear()

    const [optionRows, yearRows, pcuRows, visitRows] = await Promise.all([
      this.deps.appQuery<Record<string, unknown>>(
        `${OPTION_SELECT_SQL} ORDER BY category ASC, sort_order ASC, id ASC`
      ),
      this.deps.appQuery<{ fiscalYear: number | string }>(
        `SELECT DISTINCT fiscal_year AS fiscalYear FROM fct_home_visits ORDER BY fiscal_year DESC`
      ),
      this.deps.appQuery<{ pcuName: string }>(
        `SELECT DISTINCT pcu_name AS pcuName FROM fct_home_visits WHERE pcu_name IS NOT NULL AND pcu_name <> ''`
      ),
      this.deps.appQuery<Record<string, unknown>>(
        `${VISIT_SELECT_SQL} WHERE fiscal_year = ? ORDER BY visit_date DESC, id DESC`,
        [targetFiscalYear]
      ),
    ])

    const options = createEmptyOptionGroups()
    for (const row of optionRows) {
      const mapped = mapOptionRow(row)
      if (FCT_ALL_OPTION_CATEGORIES.includes(mapped.category)) {
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
      const normalized = normalizePcuValue(row.pcuName)
      if (normalized) {
        pcuSet.add(normalized)
      }
    }
    const availablePcus = Array.from(pcuSet).sort((a, b) => a.localeCompare(b, 'th'))

    const allYearRecords = visitRows.map(mapVisitRow)

    const pcuFilter = filters.pcuName?.trim()
    const pcuScopedRecords =
      pcuFilter && pcuFilter !== 'ALL'
        ? allYearRecords.filter(
            (r) => (r.pcuName?.trim() || 'ไม่ระบุ รพ.สต.') === pcuFilter
          )
        : allYearRecords

    const activeLabels = (cat: FctOptionCategory) =>
      options[cat].filter((o) => o.isActive).map((o) => o.label)

    const stats = aggregateFctDashboardStats(pcuScopedRecords, targetFiscalYear, {
      adlGroups: activeLabels('adl_group'),
      outcomes: activeLabels('visit_outcome'),
      overallRisks: activeLabels('overall_risk'),
      riskLevels: activeLabels('risk_level'),
      nutritionStatuses: activeLabels('nutrition_status'),
    })

    let items = pcuScopedRecords

    const adlGroupFilter = filters.adlGroup?.trim()
    if (adlGroupFilter && adlGroupFilter !== 'ALL') {
      if (adlGroupFilter === 'ยังไม่ระบุ') {
        items = items.filter((r) => !r.adlGroup || !r.adlGroup.trim())
      } else {
        items = items.filter((r) => r.adlGroup?.trim() === adlGroupFilter)
      }
    }

    const outcomeFilter = filters.visitOutcome?.trim()
    if (outcomeFilter && outcomeFilter !== 'ALL') {
      if (outcomeFilter === 'ยังไม่ระบุ') {
        items = items.filter((r) => !r.visitOutcome || !r.visitOutcome.trim())
      } else {
        items = items.filter((r) => r.visitOutcome?.trim() === outcomeFilter)
      }
    }

    const searchTerm = filters.search?.trim().toLowerCase()
    if (searchTerm) {
      items = items.filter((r) => {
        const nameMatch = r.patientName.toLowerCase().includes(searchTerm)
        const hnMatch = Boolean(r.hn && r.hn.toLowerCase().includes(searchTerm))
        const dxMatch = Boolean(r.diagnosis && r.diagnosis.toLowerCase().includes(searchTerm))
        const addrMatch = Boolean(r.address && r.address.toLowerCase().includes(searchTerm))
        const followUpMatch = Boolean(
          r.followUpPlan && r.followUpPlan.toLowerCase().includes(searchTerm)
        )
        return nameMatch || hnMatch || dxMatch || addrMatch || followUpMatch
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

  private async getVisitById(id: number): Promise<FctHomeVisitRecord | null> {
    const rows = await this.deps.appQuery<Record<string, unknown>>(
      `${VISIT_SELECT_SQL} WHERE id = ? LIMIT 1`,
      [id]
    )
    return rows.length > 0 ? mapVisitRow(rows[0]) : null
  }

  async createVisit(
    input: FctHomeVisitCreateInput,
    actor?: FctHomeVisitActor | null
  ): Promise<FctHomeVisitRecord> {
    await this.ensureSchema()

    const actorName = actor?.username?.trim() || 'system'
    const payload = buildCreateStatementPayload(input, actorName)
    const res = await this.executeWrite(payload.sql, payload.params)
    const insertId = res.insertId

    if (!insertId) {
      throw new Error('ไม่สามารถอ่านรหัสรายการเยี่ยมบ้านที่สร้างใหม่ได้')
    }

    const created = await this.getVisitById(insertId)
    if (!created) {
      throw new Error('ไม่พบข้อมูลรายการเยี่ยมบ้านที่เพิ่งบันทึก')
    }

    await logAudit(
      'CREATE',
      'fct_home_visits',
      `Created FCT home visit ID: ${created.id} (FY: ${created.fiscalYear})`,
      actor
    )

    return created
  }

  async updateVisit(
    id: number,
    input: FctHomeVisitUpdateInput,
    actor?: FctHomeVisitActor | null
  ): Promise<FctHomeVisitRecord> {
    await this.ensureSchema()

    const existing = await this.getVisitById(id)
    if (!existing) {
      throw new FctHomeVisitNotFoundError(`ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}`)
    }

    if (input.patientName !== undefined && !input.patientName.trim()) {
      throw new FctHomeVisitValidationError('กรุณาระบุชื่อ-สกุลผู้ป่วย')
    }

    const setClauses: string[] = []
    const params: unknown[] = []
    const resolvedInput: FctHomeVisitUpdateInput = { ...input }

    if (resolvedInput.visitDate !== undefined) {
      const validVisitDate = assertValidIsoVisitDate(resolvedInput.visitDate)
      resolvedInput.visitDate = validVisitDate
      setClauses.push('fiscal_year = ?')
      params.push(getThaiFiscalYearFromDate(validVisitDate))
    }

    const effectiveAdlScore =
      resolvedInput.adlScore !== undefined
        ? toNullableNumber(resolvedInput.adlScore)
        : existing.adlScore

    if (resolvedInput.adlGroup === null) {
      resolvedInput.adlGroup = suggestAdlGroup(effectiveAdlScore)
    } else if (
      resolvedInput.adlGroup === undefined &&
      resolvedInput.adlScore !== undefined &&
      !existing.adlGroup
    ) {
      resolvedInput.adlGroup = suggestAdlGroup(effectiveAdlScore)
    }

    for (const mapping of VISIT_FIELD_MAPPINGS) {
      if (resolvedInput[mapping.key] !== undefined) {
        setClauses.push(`${mapping.column} = ?`)
        params.push(mapping.transform(resolvedInput[mapping.key]))
      }
    }

    const actorName = actor?.username?.trim() || 'system'
    setClauses.push('updated_by = ?')
    params.push(actorName)
    params.push(id)

    await this.executeWrite(
      `UPDATE fct_home_visits SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    )

    const updated = await this.getVisitById(id)
    if (!updated) {
      throw new FctHomeVisitNotFoundError(`ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}`)
    }

    await logAudit(
      'UPDATE',
      'fct_home_visits',
      `Updated FCT home visit ID: ${id} (FY: ${updated.fiscalYear})`,
      actor
    )

    return updated
  }

  async deleteVisit(
    id: number,
    actor?: FctHomeVisitActor | null
  ): Promise<{ id: number; fiscalYear: number }> {
    await this.ensureSchema()

    const existing = await this.getVisitById(id)
    if (!existing) {
      throw new FctHomeVisitNotFoundError(`ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}`)
    }

    await this.executeWrite('DELETE FROM fct_home_visits WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'fct_home_visits',
      `Deleted FCT home visit ID: ${id} (FY: ${existing.fiscalYear})`,
      actor
    )

    return { id, fiscalYear: existing.fiscalYear }
  }

  async batchImportVisits(
    rows: FctHomeVisitCreateInput[],
    actor?: FctHomeVisitActor | null
  ): Promise<FctBatchImportResult> {
    await this.ensureSchema()

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        insertedCount: 0,
        skippedDuplicateCount: 0,
        errorCount: 0,
        duplicates: [],
      }
    }

    const existingPairs = await this.deps.appQuery<{ visitDate: unknown; hn: string | null }>(
      `SELECT DATE_FORMAT(visit_date, '%Y-%m-%d') AS visitDate, hn
       FROM fct_home_visits
       WHERE hn IS NOT NULL AND hn <> ''`
    )

    const seenKeys = new Set<string>()
    for (const pair of existingPairs) {
      const cleanHn = normalizeHn(pair.hn)
      const cleanDate = serializeIsoDate(pair.visitDate)
      if (cleanHn && cleanDate) {
        seenKeys.add(`${cleanDate}|${cleanHn}`)
      }
    }

    const actorName = actor?.username?.trim() || 'system'
    const statements: Array<{ sql: string; params: unknown[] }> = []
    const duplicates: FctBatchImportResult['duplicates'] = []

    for (let idx = 0; idx < rows.length; idx++) {
      const payload = buildCreateStatementPayload(rows[idx], actorName)
      if (payload.hn) {
        const key = `${payload.visitDate}|${payload.hn}`
        if (seenKeys.has(key)) {
          duplicates.push({
            rowNumber: idx + 1,
            visitDate: payload.visitDate,
            hn: payload.hn,
            patientName: payload.patientName,
          })
          continue
        }
        seenKeys.add(key)
      }

      statements.push({ sql: payload.sql, params: payload.params })
    }

    if (statements.length > 0) {
      await this.deps.appTransaction([{ sql: 'SET NAMES utf8mb4' }, ...statements])
    }

    await logAudit(
      'CREATE',
      'fct_home_visits',
      `Batch imported FCT home visits: inserted ${statements.length}, skipped duplicates ${duplicates.length}`,
      actor
    )

    return {
      insertedCount: statements.length,
      skippedDuplicateCount: duplicates.length,
      errorCount: 0,
      duplicates,
    }
  }

  private async getOptionById(id: number): Promise<FctHomeVisitOptionRecord | null> {
    const rows = await this.deps.appQuery<Record<string, unknown>>(
      `${OPTION_SELECT_SQL} WHERE id = ? LIMIT 1`,
      [id]
    )
    return rows.length > 0 ? mapOptionRow(rows[0]) : null
  }

  async createOption(
    input: FctHomeVisitOptionCreateInput,
    actor?: FctHomeVisitActor | null
  ): Promise<FctHomeVisitOptionRecord> {
    await this.ensureSchema()

    const label = (input.label ?? '').trim()
    if (!label) {
      throw new FctHomeVisitValidationError('กรุณาระบุชื่อตัวเลือก')
    }

    const dupRows = await this.deps.appQuery<{ id: number }>(
      `SELECT id FROM fct_home_visit_options WHERE category = ? AND label = ? LIMIT 1`,
      [input.category, label]
    )
    if (dupRows.length > 0) {
      throw new FctHomeVisitConflictError(`มีตัวเลือก "${label}" อยู่ในหมวดหมู่นี้แล้ว`)
    }

    const actorName = actor?.username?.trim() || 'system'
    const sortOrder = input.sortOrder ?? 0
    const isActive = input.isActive ?? true

    let insertId: number | null = null
    try {
      const res = await this.executeWrite(
        `INSERT INTO fct_home_visit_options (category, label, sort_order, is_active, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [input.category, label, sortOrder, isActive, actorName]
      )
      insertId = res.insertId
    } catch (err) {
      if (isDuplicateEntryError(err)) {
        throw new FctHomeVisitConflictError(`มีตัวเลือก "${label}" อยู่ในหมวดหมู่นี้แล้ว`)
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
      'fct_home_visit_options',
      `Created FCT Home Visit option ID: ${created.id} (category: ${input.category})`,
      actor
    )

    return created
  }

  async updateOption(
    id: number,
    input: FctHomeVisitOptionUpdateInput,
    actor?: FctHomeVisitActor | null
  ): Promise<FctHomeVisitOptionRecord> {
    await this.ensureSchema()

    const existing = await this.getOptionById(id)
    if (!existing) {
      throw new FctHomeVisitNotFoundError(`ไม่พบตัวเลือก ID: ${id}`)
    }

    const setClauses: string[] = []
    const params: unknown[] = []

    if (input.label !== undefined) {
      const label = input.label.trim()
      if (!label) {
        throw new FctHomeVisitValidationError('กรุณาระบุชื่อตัวเลือก')
      }
      const dupRows = await this.deps.appQuery<{ id: number }>(
        `SELECT id FROM fct_home_visit_options WHERE category = ? AND label = ? AND id <> ? LIMIT 1`,
        [existing.category, label, id]
      )
      if (dupRows.length > 0) {
        throw new FctHomeVisitConflictError(`มีตัวเลือก "${label}" อยู่ในหมวดหมู่นี้แล้ว`)
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
          `UPDATE fct_home_visit_options SET ${setClauses.join(', ')} WHERE id = ?`,
          params
        )
      } catch (err) {
        if (isDuplicateEntryError(err)) {
          throw new FctHomeVisitConflictError('มีตัวเลือกชื่อนี้อยู่ในหมวดหมู่นี้แล้ว')
        }
        throw err
      }
    }

    const updated = await this.getOptionById(id)
    if (!updated) {
      throw new FctHomeVisitNotFoundError(`ไม่พบตัวเลือก ID: ${id}`)
    }

    await logAudit(
      'UPDATE',
      'fct_home_visit_options',
      `Updated FCT Home Visit option ID: ${id} (category: ${existing.category})`,
      actor
    )

    return updated
  }

  async deleteOption(
    id: number,
    actor?: FctHomeVisitActor | null
  ): Promise<{ id: number; category: FctOptionCategory }> {
    await this.ensureSchema()

    const existing = await this.getOptionById(id)
    if (!existing) {
      throw new FctHomeVisitNotFoundError(`ไม่พบตัวเลือก ID: ${id}`)
    }

    await this.executeWrite('DELETE FROM fct_home_visit_options WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'fct_home_visit_options',
      `Deleted FCT Home Visit option ID: ${id} (category: ${existing.category})`,
      actor
    )

    return { id, category: existing.category }
  }
}

export const fctHomeVisitService = new FctHomeVisitService()
