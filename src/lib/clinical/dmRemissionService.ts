import { apiGateway, GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  aggregateDashboardStats,
  enrichCohortRecord,
  getPopulatedFiscalYears,
  normalizeCid,
  normalizeHn,
  resolveDefaultFiscalYear,
  toNullableNumber,
} from './dmRemissionDomain'
import {
  DM_DEFAULT_REMISSION_STATUS,
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

export interface DmRemissionGatewayDeps {
  ensureDmRemissionSchema: typeof apiGateway.clinical.ensureDmRemissionSchema
  lookupDmRemissionPatientByHn: typeof apiGateway.clinical.lookupDmRemissionPatientByHn
  listDmRemissionOptionsRaw: typeof apiGateway.clinical.listDmRemissionOptionsRaw
  createDmRemissionOption: typeof apiGateway.clinical.createDmRemissionOption
  updateDmRemissionOption: typeof apiGateway.clinical.updateDmRemissionOption
  deleteDmRemissionOption: typeof apiGateway.clinical.deleteDmRemissionOption
  getDmRemissionCohortsBundle: typeof apiGateway.clinical.getDmRemissionCohortsBundle
  createDmRemissionCohort: typeof apiGateway.clinical.createDmRemissionCohort
  updateDmRemissionCohort: typeof apiGateway.clinical.updateDmRemissionCohort
  deleteDmRemissionCohort: typeof apiGateway.clinical.deleteDmRemissionCohort
  carryoverDmRemissionCohorts: typeof apiGateway.clinical.carryoverDmRemissionCohorts
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

function normalizeOptionalText(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const trimmed = String(val).trim()
  return trimmed || null
}

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

function mapCohortRow(row: DmRemissionCohortRaw | Record<string, unknown>): DmRemissionCohortRecord {
  const raw = row as DmRemissionCohortRaw
  return enrichCohortRecord({
    ...raw,
    fiscalYear: Number(raw.fiscalYear),
    createdAt: serializeTimestamp(raw.createdAt),
    updatedAt: serializeTimestamp(raw.updatedAt),
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

function rethrowMappedGatewayError(err: unknown): never {
  if (err instanceof GatewayNotFoundError) {
    throw new DmRemissionNotFoundError(err.message)
  }
  if (err instanceof GatewayError) {
    if (err.status === 409) {
      throw new DmRemissionConflictError(err.message)
    }
    if (err.status === 404) {
      throw new DmRemissionNotFoundError(err.message)
    }
    if (err.status === 400) {
      throw new DmRemissionValidationError(err.message)
    }
  }
  throw err
}

function buildNormalizedCreateFields(input: DmRemissionCreateInput): Record<string, unknown> {
  return {
    fiscalYear: input.fiscalYear,
    pcuName: normalizeOptionalText(input.pcuName),
    patientName: String(input.patientName ?? '').trim(),
    cid: normalizeCid(input.cid),
    hn: normalizeHn(input.hn),
    age: toNullableNumber(input.age),
    underlyingDiseases: normalizeOptionalText(input.underlyingDiseases),
    heightCm: toNullableNumber(input.heightCm),
    weightBeforeKg: toNullableNumber(input.weightBeforeKg),
    weightAfterKg: toNullableNumber(input.weightAfterKg),
    waistBeforeCm: toNullableNumber(input.waistBeforeCm),
    waistAfterCm: toNullableNumber(input.waistAfterCm),
    fpgBefore: toNullableNumber(input.fpgBefore),
    fpgAfter: toNullableNumber(input.fpgAfter),
    a1cBefore: toNullableNumber(input.a1cBefore),
    a1cAfter: toNullableNumber(input.a1cAfter),
    a1cPostStop3m: toNullableNumber(input.a1cPostStop3m),
    medsBefore: normalizeOptionalText(input.medsBefore),
    medsAfter: normalizeOptionalText(input.medsAfter),
    summaryA1c: normalizeOptionalText(input.summaryA1c),
    summaryMeds: normalizeOptionalText(input.summaryMeds),
    summaryWeight: normalizeOptionalText(input.summaryWeight),
    summaryWaist: normalizeOptionalText(input.summaryWaist),
    summaryDiet: normalizeOptionalText(input.summaryDiet),
    summaryExercise: normalizeOptionalText(input.summaryExercise),
    summaryIf: normalizeOptionalText(input.summaryIf),
    summaryRemission: normalizeOptionalText(input.summaryRemission),
  }
}

function buildNormalizedUpdateFields(input: DmRemissionUpdateInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (input.fiscalYear !== undefined) fields.fiscalYear = input.fiscalYear
  if (input.pcuName !== undefined) fields.pcuName = normalizeOptionalText(input.pcuName)
  if (input.patientName !== undefined) fields.patientName = String(input.patientName).trim()
  if (input.cid !== undefined) fields.cid = normalizeCid(input.cid)
  if (input.hn !== undefined) fields.hn = normalizeHn(input.hn)
  if (input.age !== undefined) fields.age = toNullableNumber(input.age)
  if (input.underlyingDiseases !== undefined)
    fields.underlyingDiseases = normalizeOptionalText(input.underlyingDiseases)
  if (input.heightCm !== undefined) fields.heightCm = toNullableNumber(input.heightCm)
  if (input.weightBeforeKg !== undefined)
    fields.weightBeforeKg = toNullableNumber(input.weightBeforeKg)
  if (input.weightAfterKg !== undefined)
    fields.weightAfterKg = toNullableNumber(input.weightAfterKg)
  if (input.waistBeforeCm !== undefined)
    fields.waistBeforeCm = toNullableNumber(input.waistBeforeCm)
  if (input.waistAfterCm !== undefined) fields.waistAfterCm = toNullableNumber(input.waistAfterCm)
  if (input.fpgBefore !== undefined) fields.fpgBefore = toNullableNumber(input.fpgBefore)
  if (input.fpgAfter !== undefined) fields.fpgAfter = toNullableNumber(input.fpgAfter)
  if (input.a1cBefore !== undefined) fields.a1cBefore = toNullableNumber(input.a1cBefore)
  if (input.a1cAfter !== undefined) fields.a1cAfter = toNullableNumber(input.a1cAfter)
  if (input.a1cPostStop3m !== undefined)
    fields.a1cPostStop3m = toNullableNumber(input.a1cPostStop3m)
  if (input.medsBefore !== undefined) fields.medsBefore = normalizeOptionalText(input.medsBefore)
  if (input.medsAfter !== undefined) fields.medsAfter = normalizeOptionalText(input.medsAfter)
  if (input.summaryA1c !== undefined) fields.summaryA1c = normalizeOptionalText(input.summaryA1c)
  if (input.summaryMeds !== undefined) fields.summaryMeds = normalizeOptionalText(input.summaryMeds)
  if (input.summaryWeight !== undefined)
    fields.summaryWeight = normalizeOptionalText(input.summaryWeight)
  if (input.summaryWaist !== undefined)
    fields.summaryWaist = normalizeOptionalText(input.summaryWaist)
  if (input.summaryDiet !== undefined) fields.summaryDiet = normalizeOptionalText(input.summaryDiet)
  if (input.summaryExercise !== undefined)
    fields.summaryExercise = normalizeOptionalText(input.summaryExercise)
  if (input.summaryIf !== undefined) fields.summaryIf = normalizeOptionalText(input.summaryIf)
  if (input.summaryRemission !== undefined)
    fields.summaryRemission = normalizeOptionalText(input.summaryRemission)
  return fields
}

export class DmRemissionService {
  private readonly gw: DmRemissionGatewayDeps
  private schemaEnsured = false
  private ensurePromise: Promise<void> | null = null

  constructor(deps?: Partial<DmRemissionGatewayDeps>) {
    this.gw = {
      ensureDmRemissionSchema:
        deps?.ensureDmRemissionSchema ?? (() => apiGateway.clinical.ensureDmRemissionSchema()),
      lookupDmRemissionPatientByHn:
        deps?.lookupDmRemissionPatientByHn ??
        ((hn) => apiGateway.clinical.lookupDmRemissionPatientByHn(hn)),
      listDmRemissionOptionsRaw:
        deps?.listDmRemissionOptionsRaw ?? (() => apiGateway.clinical.listDmRemissionOptionsRaw()),
      createDmRemissionOption:
        deps?.createDmRemissionOption ??
        ((body) => apiGateway.clinical.createDmRemissionOption(body)),
      updateDmRemissionOption:
        deps?.updateDmRemissionOption ??
        ((id, body) => apiGateway.clinical.updateDmRemissionOption(id, body)),
      deleteDmRemissionOption:
        deps?.deleteDmRemissionOption ?? ((id) => apiGateway.clinical.deleteDmRemissionOption(id)),
      getDmRemissionCohortsBundle:
        deps?.getDmRemissionCohortsBundle ??
        ((fy) => apiGateway.clinical.getDmRemissionCohortsBundle(fy)),
      createDmRemissionCohort:
        deps?.createDmRemissionCohort ??
        ((body) => apiGateway.clinical.createDmRemissionCohort(body)),
      updateDmRemissionCohort:
        deps?.updateDmRemissionCohort ??
        ((id, body) => apiGateway.clinical.updateDmRemissionCohort(id, body)),
      deleteDmRemissionCohort:
        deps?.deleteDmRemissionCohort ?? ((id) => apiGateway.clinical.deleteDmRemissionCohort(id)),
      carryoverDmRemissionCohorts:
        deps?.carryoverDmRemissionCohorts ??
        ((body) => apiGateway.clinical.carryoverDmRemissionCohorts(body)),
    }
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return
    if (this.ensurePromise) return this.ensurePromise
    this.ensurePromise = (async () => {
      await this.gw.ensureDmRemissionSchema()
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
    if (!cleanHn) return null

    const pt = await this.gw.lookupDmRemissionPatientByHn(cleanHn)
    if (!pt) return null

    return {
      hn: String(pt.hn ?? cleanHn).trim(),
      cid: normalizeCid(pt.cid),
      patientName: String(pt.ptname ?? '').trim(),
      age: toNullableNumber(pt.age),
    }
  }

  async listOptions(): Promise<Record<DmOptionCategory, DmRemissionOptionRecord[]>> {
    await this.ensureSchema()
    const rows = await this.gw.listDmRemissionOptionsRaw()
    const grouped: Record<DmOptionCategory, DmRemissionOptionRecord[]> = {
      remission: [],
      diet: [],
      exercise: [],
      if_fasting: [],
      pcu: [],
    }
    for (const row of rows || []) {
      const mapped = mapOptionRow(row)
      if (ALL_OPTION_CATEGORIES.includes(mapped.category)) {
        grouped[mapped.category].push(mapped)
      }
    }
    return grouped
  }

  async listCohorts(filters: DmRemissionListFilters = {}): Promise<DmRemissionListResult> {
    await this.ensureSchema()
    const bundle = await this.gw.getDmRemissionCohortsBundle(filters.fiscalYear)
    const optionRows = bundle.optionRows || []
    const yearRows = bundle.yearRows || []
    const pcuRows = bundle.pcuRows || []
    const cohortRows = bundle.cohortRows || []

    const targetFiscalYear =
      filters.fiscalYear !== undefined
        ? filters.fiscalYear
        : bundle.targetFiscalYear ??
          resolveDefaultFiscalYear(yearRows.map((r) => Number(r.fiscalYear)))

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

    const availableFiscalYears = getPopulatedFiscalYears(
      yearRows.map((r) => Number(r.fiscalYear))
    )

    const pcuSet = new Set<string>()
    for (const opt of options.pcu) {
      if (opt.isActive && opt.label.trim()) pcuSet.add(opt.label.trim())
    }
    for (const row of pcuRows) {
      if (row.pcuName && row.pcuName.trim()) pcuSet.add(row.pcuName.trim())
    }
    const availablePcus = Array.from(pcuSet).sort((a, b) => a.localeCompare(b, 'th'))

    const allYearRecords = cohortRows.map(mapCohortRow)

    const pcuFilter = filters.pcuName?.trim()
    const pcuScopedRecords =
      pcuFilter && pcuFilter !== 'ALL'
        ? allYearRecords.filter((r) => (r.pcuName?.trim() || 'ไม่ระบุ รพ.สต.') === pcuFilter)
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

  async createCohort(
    input: DmRemissionCreateInput,
    actor?: DmRemissionActor | null
  ): Promise<DmRemissionCohortRecord> {
    await this.ensureSchema()

    const patientName = (input.patientName ?? '').trim()
    if (!patientName) {
      throw new DmRemissionValidationError('กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
    }

    const actorName = actor?.username?.trim() || 'system'
    const fields = buildNormalizedCreateFields(input)

    let createdRaw: Record<string, unknown>
    try {
      createdRaw = await this.gw.createDmRemissionCohort({ fields, actorName })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    if (!createdRaw) {
      throw new Error('ไม่พบข้อมูลรายการที่เพิ่งบันทึก')
    }
    const created = mapCohortRow(createdRaw)

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

    if (input.patientName !== undefined && !input.patientName.trim()) {
      throw new DmRemissionValidationError('กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
    }

    const actorName = actor?.username?.trim() || 'system'
    const fields = buildNormalizedUpdateFields(input)

    let updatedRaw: Record<string, unknown>
    try {
      updatedRaw = await this.gw.updateDmRemissionCohort(id, { fields, actorName })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    if (!updatedRaw) {
      throw new DmRemissionNotFoundError(`ไม่พบข้อมูล DM Remission ID: ${id}`)
    }
    const updated = mapCohortRow(updatedRaw)

    await logAudit(
      'UPDATE',
      'dm_remission_cohorts',
      `Updated DM Remission cohort ID: ${id} (FY: ${updated.fiscalYear})`,
      actor
    )

    return updated
  }

  async deleteCohort(
    id: number,
    actor?: DmRemissionActor | null
  ): Promise<{ id: number; fiscalYear: number }> {
    await this.ensureSchema()

    let deleted: { id: number; fiscalYear: number }
    try {
      deleted = await this.gw.deleteDmRemissionCohort(id)
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    await logAudit(
      'DELETE',
      'dm_remission_cohorts',
      `Deleted DM Remission cohort ID: ${id} (FY: ${deleted.fiscalYear})`,
      actor
    )

    return deleted
  }

  async carryoverFromFiscalYear(
    fromFiscalYear: number,
    toFiscalYear: number,
    actor?: DmRemissionActor | null
  ): Promise<{ copiedCount: number; skippedCount: number }> {
    await this.ensureSchema()

    if (toFiscalYear <= fromFiscalYear) {
      throw new DmRemissionValidationError('ปีงบประมาณปลายทางต้องมากกว่าปีงบประมาณต้นทาง')
    }

    const actorName = actor?.username?.trim() || 'system'
    let res: { copiedCount: number; skippedCount: number }
    try {
      res = await this.gw.carryoverDmRemissionCohorts({
        fromFiscalYear,
        toFiscalYear,
        actorName,
        defaultRemissionStatus: DM_DEFAULT_REMISSION_STATUS,
      })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    await logAudit(
      'CREATE',
      'dm_remission_cohorts',
      `Carryover DM Remission cohorts from FY ${fromFiscalYear} to FY ${toFiscalYear}: copied ${res.copiedCount}, skipped ${res.skippedCount}`,
      actor
    )

    return res
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

    const actorName = actor?.username?.trim() || 'system'
    let createdRaw: Record<string, unknown>
    try {
      createdRaw = await this.gw.createDmRemissionOption({
        category: input.category,
        label,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        actorName,
      })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    const created = mapOptionRow(createdRaw)

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

    if (input.label !== undefined && !input.label.trim()) {
      throw new DmRemissionValidationError('กรุณาระบุชื่อตัวเลือก')
    }

    let updatedRaw: Record<string, unknown>
    try {
      updatedRaw = await this.gw.updateDmRemissionOption(id, {
        label: input.label !== undefined ? input.label.trim() : undefined,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    const updated = mapOptionRow(updatedRaw)

    await logAudit(
      'UPDATE',
      'dm_remission_options',
      `Updated DM Remission option ID: ${id} (category: ${updated.category})`,
      actor
    )

    return updated
  }

  async deleteOption(
    id: number,
    actor?: DmRemissionActor | null
  ): Promise<{ id: number; category: DmOptionCategory }> {
    await this.ensureSchema()

    let deleted: { id: number; category: string }
    try {
      deleted = await this.gw.deleteDmRemissionOption(id)
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    const category = deleted.category as DmOptionCategory

    await logAudit(
      'DELETE',
      'dm_remission_options',
      `Deleted DM Remission option ID: ${id} (category: ${category})`,
      actor
    )

    return { id: deleted.id, category }
  }
}

export const dmRemissionService = new DmRemissionService()
