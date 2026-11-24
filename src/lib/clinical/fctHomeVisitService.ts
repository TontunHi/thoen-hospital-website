import { apiGateway, GatewayError, GatewayNotFoundError } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  aggregateFctDashboardStats,
  getPopulatedFiscalYears,
  getThaiFiscalYearFromDate,
  normalizeAdlGroupValue,
  normalizeHn,
  normalizeNutritionStatusValue,
  normalizeOptionalText,
  normalizePcuValue,
  normalizeRiskValue,
  parseFlexibleVisitDate,
  resolveDefaultFiscalYear,
  suggestAdlGroup,
  toNullableNumber,
} from './fctHomeVisitDomain'
import {
  FCT_ALL_OPTION_CATEGORIES,
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

export interface FctHomeVisitGatewayDeps {
  ensureFctHomeVisitSchema: typeof apiGateway.clinical.ensureFctHomeVisitSchema
  lookupFctHomeVisitPatientByHn: typeof apiGateway.clinical.lookupFctHomeVisitPatientByHn
  listFctHomeVisitOptionsRaw: typeof apiGateway.clinical.listFctHomeVisitOptionsRaw
  createFctHomeVisitOption: typeof apiGateway.clinical.createFctHomeVisitOption
  updateFctHomeVisitOption: typeof apiGateway.clinical.updateFctHomeVisitOption
  deleteFctHomeVisitOption: typeof apiGateway.clinical.deleteFctHomeVisitOption
  getFctHomeVisitsBundle: typeof apiGateway.clinical.getFctHomeVisitsBundle
  getFctHomeVisitByIdRaw: typeof apiGateway.clinical.getFctHomeVisitByIdRaw
  createFctHomeVisit: typeof apiGateway.clinical.createFctHomeVisit
  updateFctHomeVisit: typeof apiGateway.clinical.updateFctHomeVisit
  deleteFctHomeVisit: typeof apiGateway.clinical.deleteFctHomeVisit
  batchImportFctHomeVisits: typeof apiGateway.clinical.batchImportFctHomeVisits
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

function serializeTimestamp(val: unknown): string {
  if (val instanceof Date) return val.toISOString()
  return String(val ?? '')
}

function serializeIsoDate(val: unknown): string | null {
  if (val === null || val === undefined) return null
  if (val instanceof Date && Number.isFinite(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  const str = String(val).trim().slice(0, 10)
  return str || null
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

function assertValidOptionalIsoVisitDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || parseFlexibleVisitDate(trimmed) !== trimmed) {
    throw new FctHomeVisitValidationError('วันที่เยี่ยมบ้านไม่ถูกต้อง')
  }
  return trimmed
}

function buildNormalizedCreateFields(input: FctHomeVisitCreateInput): Record<string, unknown> {
  const patientName = (input.patientName ?? '').trim()
  if (!patientName) {
    throw new FctHomeVisitValidationError('กรุณาระบุชื่อ-สกุลผู้ป่วย')
  }

  const visitDate = assertValidOptionalIsoVisitDate(input.visitDate)
  const fiscalYear = getThaiFiscalYearFromDate(visitDate, input.fiscalYear)
  const adlScore = toNullableNumber(input.adlScore)
  const adlGroup = normalizeAdlGroupValue(input.adlGroup) ?? suggestAdlGroup(adlScore)
  const hn = normalizeHn(input.hn)

  return {
    fiscalYear,
    visitDate,
    pcuName: normalizePcuValue(input.pcuName),
    patientName,
    hn,
    age: toNullableNumber(input.age),
    address: normalizeOptionalText(input.address),
    adlScore,
    adlGroup,
    diagnosis: normalizeOptionalText(input.diagnosis),
    patientCategory: normalizeOptionalText(input.patientCategory),
    followUpPlan: normalizeOptionalText(input.followUpPlan),
    treatmentFacility: normalizeOptionalText(input.treatmentFacility),
    visitOutcome: normalizeOptionalText(input.visitOutcome),
    overallRiskLevel: normalizeRiskValue(input.overallRiskLevel),
    riskLevel: normalizeRiskValue(input.riskLevel),
    dentalNote: normalizeOptionalText(input.dentalNote),
    pharmacyNote: normalizeOptionalText(input.pharmacyNote),
    nutritionStatus: normalizeNutritionStatusValue(input.nutritionStatus),
    nutritionNote: normalizeOptionalText(input.nutritionNote),
    ptCategory: normalizeOptionalText(input.ptCategory),
    ptNote: normalizeOptionalText(input.ptNote),
    thaiMedCategory: normalizeOptionalText(input.thaiMedCategory),
    thaiMedNote: normalizeOptionalText(input.thaiMedNote),
  }
}

function rethrowMappedGatewayError(err: unknown): never {
  if (err instanceof GatewayNotFoundError) {
    throw new FctHomeVisitNotFoundError(err.message)
  }
  if (err instanceof GatewayError) {
    if (err.status === 409) throw new FctHomeVisitConflictError(err.message)
    if (err.status === 404) throw new FctHomeVisitNotFoundError(err.message)
    if (err.status === 400) throw new FctHomeVisitValidationError(err.message)
  }
  throw err
}

export class FctHomeVisitService {
  private readonly gw: FctHomeVisitGatewayDeps
  private schemaEnsured = false
  private ensurePromise: Promise<void> | null = null

  constructor(deps?: Partial<FctHomeVisitGatewayDeps>) {
    this.gw = {
      ensureFctHomeVisitSchema:
        deps?.ensureFctHomeVisitSchema ?? (() => apiGateway.clinical.ensureFctHomeVisitSchema()),
      lookupFctHomeVisitPatientByHn:
        deps?.lookupFctHomeVisitPatientByHn ??
        ((hn) => apiGateway.clinical.lookupFctHomeVisitPatientByHn(hn)),
      listFctHomeVisitOptionsRaw:
        deps?.listFctHomeVisitOptionsRaw ??
        (() => apiGateway.clinical.listFctHomeVisitOptionsRaw()),
      createFctHomeVisitOption:
        deps?.createFctHomeVisitOption ??
        ((body) => apiGateway.clinical.createFctHomeVisitOption(body)),
      updateFctHomeVisitOption:
        deps?.updateFctHomeVisitOption ??
        ((id, body) => apiGateway.clinical.updateFctHomeVisitOption(id, body)),
      deleteFctHomeVisitOption:
        deps?.deleteFctHomeVisitOption ??
        ((id) => apiGateway.clinical.deleteFctHomeVisitOption(id)),
      getFctHomeVisitsBundle:
        deps?.getFctHomeVisitsBundle ?? ((fy) => apiGateway.clinical.getFctHomeVisitsBundle(fy)),
      getFctHomeVisitByIdRaw:
        deps?.getFctHomeVisitByIdRaw ?? ((id) => apiGateway.clinical.getFctHomeVisitByIdRaw(id)),
      createFctHomeVisit:
        deps?.createFctHomeVisit ?? ((body) => apiGateway.clinical.createFctHomeVisit(body)),
      updateFctHomeVisit:
        deps?.updateFctHomeVisit ??
        ((id, body) => apiGateway.clinical.updateFctHomeVisit(id, body)),
      deleteFctHomeVisit:
        deps?.deleteFctHomeVisit ?? ((id) => apiGateway.clinical.deleteFctHomeVisit(id)),
      batchImportFctHomeVisits:
        deps?.batchImportFctHomeVisits ??
        ((body) => apiGateway.clinical.batchImportFctHomeVisits(body)),
    }
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return
    if (this.ensurePromise) return this.ensurePromise
    this.ensurePromise = (async () => {
      await this.gw.ensureFctHomeVisitSchema()
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
    if (!cleanHn) return null

    const pt = await this.gw.lookupFctHomeVisitPatientByHn(cleanHn)
    if (!pt) return null

    return {
      hn: String(pt.hn ?? cleanHn).trim(),
      patientName: String(pt.ptname ?? '').trim(),
      age: toNullableNumber(pt.age),
      address: normalizeOptionalText(pt.address),
    }
  }

  async listOptions(): Promise<Record<FctOptionCategory, FctHomeVisitOptionRecord[]>> {
    await this.ensureSchema()
    const rows = await this.gw.listFctHomeVisitOptionsRaw()
    const grouped = createEmptyOptionGroups()
    for (const row of rows || []) {
      const mapped = mapOptionRow(row)
      if (FCT_ALL_OPTION_CATEGORIES.includes(mapped.category)) {
        grouped[mapped.category].push(mapped)
      }
    }
    return grouped
  }

  async listVisits(filters: FctHomeVisitListFilters = {}): Promise<FctHomeVisitListResult> {
    await this.ensureSchema()
    const bundle = await this.gw.getFctHomeVisitsBundle(filters.fiscalYear)
    const optionRows = bundle.optionRows || []
    const yearRows = bundle.yearRows || []
    const pcuRows = bundle.pcuRows || []
    const visitRows = bundle.visitRows || []

    const targetFiscalYear =
      filters.fiscalYear !== undefined
        ? filters.fiscalYear
        : bundle.targetFiscalYear ??
          resolveDefaultFiscalYear(yearRows.map((r) => Number(r.fiscalYear)))

    const options = createEmptyOptionGroups()
    for (const row of optionRows) {
      const mapped = mapOptionRow(row)
      if (FCT_ALL_OPTION_CATEGORIES.includes(mapped.category)) {
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
      const normalized = normalizePcuValue(row.pcuName)
      if (normalized) pcuSet.add(normalized)
    }
    const availablePcus = Array.from(pcuSet).sort((a, b) => a.localeCompare(b, 'th'))

    const allYearRecords = visitRows.map(mapVisitRow)

    const pcuFilter = filters.pcuName?.trim()
    const pcuScopedRecords =
      pcuFilter && pcuFilter !== 'ALL'
        ? allYearRecords.filter((r) => (r.pcuName?.trim() || 'ไม่ระบุ รพ.สต.') === pcuFilter)
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

  async createVisit(
    input: FctHomeVisitCreateInput,
    actor?: FctHomeVisitActor | null
  ): Promise<FctHomeVisitRecord> {
    await this.ensureSchema()

    const actorName = actor?.username?.trim() || 'system'
    const fields = buildNormalizedCreateFields(input)

    let createdRaw: Record<string, unknown>
    try {
      createdRaw = await this.gw.createFctHomeVisit({ fields, actorName })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    if (!createdRaw) {
      throw new Error('ไม่พบข้อมูลรายการเยี่ยมบ้านที่เพิ่งบันทึก')
    }
    const created = mapVisitRow(createdRaw)

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

    const existingRaw = await this.gw.getFctHomeVisitByIdRaw(id)
    if (!existingRaw) {
      throw new FctHomeVisitNotFoundError(`ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}`)
    }
    const existing = mapVisitRow(existingRaw)

    if (input.patientName !== undefined && !input.patientName.trim()) {
      throw new FctHomeVisitValidationError('กรุณาระบุชื่อ-สกุลผู้ป่วย')
    }

    const fields: Record<string, unknown> = {}
    const resolvedInput: FctHomeVisitUpdateInput = { ...input }

    if (resolvedInput.visitDate !== undefined) {
      const validVisitDate = assertValidOptionalIsoVisitDate(resolvedInput.visitDate)
      resolvedInput.visitDate = validVisitDate
      if (validVisitDate) {
        fields.fiscalYear = getThaiFiscalYearFromDate(validVisitDate)
      } else if (
        typeof resolvedInput.fiscalYear === 'number' &&
        Number.isInteger(resolvedInput.fiscalYear)
      ) {
        fields.fiscalYear = resolvedInput.fiscalYear
      }
    } else if (
      typeof resolvedInput.fiscalYear === 'number' &&
      Number.isInteger(resolvedInput.fiscalYear)
    ) {
      fields.fiscalYear = resolvedInput.fiscalYear
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

    if (resolvedInput.visitDate !== undefined) fields.visitDate = resolvedInput.visitDate
    if (resolvedInput.pcuName !== undefined) fields.pcuName = normalizePcuValue(resolvedInput.pcuName)
    if (resolvedInput.patientName !== undefined)
      fields.patientName = String(resolvedInput.patientName).trim()
    if (resolvedInput.hn !== undefined) fields.hn = normalizeHn(resolvedInput.hn)
    if (resolvedInput.age !== undefined) fields.age = toNullableNumber(resolvedInput.age)
    if (resolvedInput.address !== undefined) fields.address = normalizeOptionalText(resolvedInput.address)
    if (resolvedInput.adlScore !== undefined) fields.adlScore = toNullableNumber(resolvedInput.adlScore)
    if (resolvedInput.adlGroup !== undefined)
      fields.adlGroup = normalizeAdlGroupValue(resolvedInput.adlGroup)
    if (resolvedInput.diagnosis !== undefined)
      fields.diagnosis = normalizeOptionalText(resolvedInput.diagnosis)
    if (resolvedInput.patientCategory !== undefined)
      fields.patientCategory = normalizeOptionalText(resolvedInput.patientCategory)
    if (resolvedInput.followUpPlan !== undefined)
      fields.followUpPlan = normalizeOptionalText(resolvedInput.followUpPlan)
    if (resolvedInput.treatmentFacility !== undefined)
      fields.treatmentFacility = normalizeOptionalText(resolvedInput.treatmentFacility)
    if (resolvedInput.visitOutcome !== undefined)
      fields.visitOutcome = normalizeOptionalText(resolvedInput.visitOutcome)
    if (resolvedInput.overallRiskLevel !== undefined)
      fields.overallRiskLevel = normalizeRiskValue(resolvedInput.overallRiskLevel)
    if (resolvedInput.riskLevel !== undefined)
      fields.riskLevel = normalizeRiskValue(resolvedInput.riskLevel)
    if (resolvedInput.dentalNote !== undefined)
      fields.dentalNote = normalizeOptionalText(resolvedInput.dentalNote)
    if (resolvedInput.pharmacyNote !== undefined)
      fields.pharmacyNote = normalizeOptionalText(resolvedInput.pharmacyNote)
    if (resolvedInput.nutritionStatus !== undefined)
      fields.nutritionStatus = normalizeNutritionStatusValue(resolvedInput.nutritionStatus)
    if (resolvedInput.nutritionNote !== undefined)
      fields.nutritionNote = normalizeOptionalText(resolvedInput.nutritionNote)
    if (resolvedInput.ptCategory !== undefined)
      fields.ptCategory = normalizeOptionalText(resolvedInput.ptCategory)
    if (resolvedInput.ptNote !== undefined) fields.ptNote = normalizeOptionalText(resolvedInput.ptNote)
    if (resolvedInput.thaiMedCategory !== undefined)
      fields.thaiMedCategory = normalizeOptionalText(resolvedInput.thaiMedCategory)
    if (resolvedInput.thaiMedNote !== undefined)
      fields.thaiMedNote = normalizeOptionalText(resolvedInput.thaiMedNote)

    const actorName = actor?.username?.trim() || 'system'
    let updatedRaw: Record<string, unknown>
    try {
      updatedRaw = await this.gw.updateFctHomeVisit(id, { fields, actorName })
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    if (!updatedRaw) {
      throw new FctHomeVisitNotFoundError(`ไม่พบข้อมูลการเยี่ยมบ้าน ID: ${id}`)
    }
    const updated = mapVisitRow(updatedRaw)

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

    let deleted: { id: number; fiscalYear: number }
    try {
      deleted = await this.gw.deleteFctHomeVisit(id)
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    await logAudit(
      'DELETE',
      'fct_home_visits',
      `Deleted FCT home visit ID: ${id} (FY: ${deleted.fiscalYear})`,
      actor
    )

    return deleted
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

    const actorName = actor?.username?.trim() || 'system'
    const normalizedItems = rows.map((row) => buildNormalizedCreateFields(row))

    const res = await this.gw.batchImportFctHomeVisits({
      items: normalizedItems,
      actorName,
    })

    await logAudit(
      'CREATE',
      'fct_home_visits',
      `Batch imported FCT home visits: inserted ${res.insertedCount}, skipped duplicates ${res.skippedDuplicateCount}`,
      actor
    )

    return res
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

    const actorName = actor?.username?.trim() || 'system'
    let createdRaw: Record<string, unknown>
    try {
      createdRaw = await this.gw.createFctHomeVisitOption({
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

    if (input.label !== undefined && !input.label.trim()) {
      throw new FctHomeVisitValidationError('กรุณาระบุชื่อตัวเลือก')
    }

    let updatedRaw: Record<string, unknown>
    try {
      updatedRaw = await this.gw.updateFctHomeVisitOption(id, {
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
      'fct_home_visit_options',
      `Updated FCT Home Visit option ID: ${id} (category: ${updated.category})`,
      actor
    )

    return updated
  }

  async deleteOption(
    id: number,
    actor?: FctHomeVisitActor | null
  ): Promise<{ id: number; category: FctOptionCategory }> {
    await this.ensureSchema()

    let deleted: { id: number; category: string }
    try {
      deleted = await this.gw.deleteFctHomeVisitOption(id)
    } catch (err) {
      rethrowMappedGatewayError(err)
    }

    const category = deleted.category as FctOptionCategory

    await logAudit(
      'DELETE',
      'fct_home_visit_options',
      `Deleted FCT Home Visit option ID: ${id} (category: ${category})`,
      actor
    )

    return { id: deleted.id, category }
  }
}

export const fctHomeVisitService = new FctHomeVisitService()
