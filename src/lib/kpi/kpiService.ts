import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import {
  checkPeriodStatus,
  getPeriodsForFrequency,
  checkIndicatorDueStatus,
  matchesPeriodKey,
  isPercentageIndicator,
  calculateIndicatorResult,
} from './kpiTimeUtils'
import type { KpiAiAuditItem } from './kpiAuditService'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

export interface KpiGatewayAdapter {
  getKpiFiscalYears: typeof apiGateway.app.getKpiFiscalYears
  getKpiTopics: typeof apiGateway.app.getKpiTopics
  getKpiCategories: typeof apiGateway.app.getKpiCategories
  getKpiResponsiblePersons: typeof apiGateway.app.getKpiResponsiblePersons
  getKpiIndicators: typeof apiGateway.app.getKpiIndicators
  getKpiIndicatorById: typeof apiGateway.app.getKpiIndicatorById
  saveKpiEntry: typeof apiGateway.app.saveKpiEntry
  updateKpiTarget: typeof apiGateway.app.updateKpiTarget
  createKpiIndicator: typeof apiGateway.app.createKpiIndicator
  updateKpiIndicator: typeof apiGateway.app.updateKpiIndicator
  deleteKpiIndicator: typeof apiGateway.app.deleteKpiIndicator
  upsertKpiTopicForImport: typeof apiGateway.app.upsertKpiTopicForImport
  importKpiBatch: typeof apiGateway.app.importKpiBatch
}

const defaultKpiGateway: KpiGatewayAdapter = {
  getKpiFiscalYears: () => apiGateway.app.getKpiFiscalYears(),
  getKpiTopics: (fy) => apiGateway.app.getKpiTopics(fy),
  getKpiCategories: (topicId) => apiGateway.app.getKpiCategories(topicId),
  getKpiResponsiblePersons: (topicId) => apiGateway.app.getKpiResponsiblePersons(topicId),
  getKpiIndicators: (filters) => apiGateway.app.getKpiIndicators(filters),
  getKpiIndicatorById: (id) => apiGateway.app.getKpiIndicatorById(id),
  saveKpiEntry: (payload) => apiGateway.app.saveKpiEntry(payload),
  updateKpiTarget: (id, payload) => apiGateway.app.updateKpiTarget(id, payload),
  createKpiIndicator: (payload) => apiGateway.app.createKpiIndicator(payload),
  updateKpiIndicator: (id, payload) => apiGateway.app.updateKpiIndicator(id, payload),
  deleteKpiIndicator: (id) => apiGateway.app.deleteKpiIndicator(id),
  upsertKpiTopicForImport: (payload) => apiGateway.app.upsertKpiTopicForImport(payload),
  importKpiBatch: (topicId, rows) => apiGateway.app.importKpiBatch(topicId, rows),
}

export interface KpiTopicItem {
  id: number
  fiscalYear: string
  code: string
  title: string
  description: string | null
  isActive: boolean
  indicatorCount?: number
}

export interface KpiEntryItem {
  id: number
  indicatorId: number
  fiscalYear: string
  periodKey: string
  periodLabel: string
  numeratorValue: number | null
  denominatorValue: number | null
  resultValue: number | null
  resultText: string | null
  status: 'PASS' | 'FAIL' | 'PENDING' | 'WAITING_TARGET'
  note: string | null
  recordedById: number | null
  recordedByName: string | null
  recordedAt: string | null
  updatedAt: string | null
}

export interface KpiIndicatorItem {
  id: number
  topicId: number
  sequence: string | null
  category: string
  subcategory: string | null
  code: string | null
  oldCode: string | null
  frequency: string
  title: string
  numeratorName: string | null
  denominatorName: string | null
  targetRaw: string | null
  targetOperator: string | null
  targetValue: number | null
  targetUnit: string | null
  responsibleName: string | null
  indicatorType: string | null
  displayOrder: number
  currentEntry?: KpiEntryItem | null
  entries?: KpiEntryItem[]
  aiAudit?: KpiAiAuditItem | null
  aiAudits?: KpiAiAuditItem[]
}

export interface SaveEntryInput {
  indicatorId: number
  fiscalYear: string
  periodKey: string
  periodLabel: string
  numeratorValue?: number | null
  denominatorValue?: number | null
  resultValue?: number | null
  resultText?: string | null
  note?: string | null
  recordedById?: number | null
  recordedByName?: string | null
  isAdmin?: boolean
}

export interface UpdateTargetInput {
  indicatorId: number
  targetOperator: string | null
  targetValue: number | null
  targetUnit?: string | null
  targetRaw?: string | null
  updatedByName?: string | null
}

export interface CreateIndicatorInput {
  topicId: number
  sequence?: string | null
  category: string
  subcategory?: string | null
  code?: string | null
  oldCode?: string | null
  frequency: string
  title: string
  numeratorName?: string | null
  denominatorName?: string | null
  targetRaw?: string | null
  targetOperator?: string | null
  targetValue?: number | null
  targetUnit?: string | null
  responsibleName?: string | null
  indicatorType?: string | null
  displayOrder?: number
  createdByName?: string | null
}

export interface UpdateIndicatorInput extends Partial<CreateIndicatorInput> {
  id: number
  updatedByName?: string | null
}

export interface KpiDashboardStats {
  totalIndicators: number
  totalAnswered: number
  totalPending: number
  totalPass: number
  totalFail: number
  totalWaitingTarget: number
  passRatePercentage: number
  categoryBreakdown: Array<{
    category: string
    total: number
    answered: number
    pass: number
    fail: number
  }>
}

export function cleanPeriodLabel(rawLabel: string | null | undefined, periodKey: string, frequency: string): string {
  if (rawLabel && !rawLabel.includes('เธ') && !rawLabel.includes('เน') && !rawLabel.includes('\uFFFD')) {
    return rawLabel
  }
  const periods = getPeriodsForFrequency(frequency)
  const matched = periods.find((p) => p.key === periodKey)
  return matched ? matched.label : rawLabel || periodKey
}

export function cleanAuthorName(name: string | null | undefined): string {
  if (!name) return ''
  if (name.includes('เธ') || name.includes('\uFFFD')) {
    return ''
  }
  return name.trim()
}

export class KpiService {
  static evaluateTarget(
    resultValue: number | null | undefined,
    operator: string | null | undefined,
    targetValue: number | null | undefined,
    options?: { isZeroDenominator?: boolean }
  ): 'PASS' | 'FAIL' | 'WAITING_TARGET' | 'PENDING' {
    if (resultValue === null || resultValue === undefined) {
      return 'PENDING'
    }

    if (options?.isZeroDenominator) {
      return 'PASS'
    }

    if (targetValue === null || targetValue === undefined) {
      if (operator === 'MIN') {
        return resultValue === 0 ? 'PASS' : 'WAITING_TARGET'
      }
      return 'WAITING_TARGET'
    }

    const op = operator || '>='
    const target = targetValue

    if (op === 'MIN') {
      return resultValue <= target ? 'PASS' : 'FAIL'
    }

    switch (op) {
      case '>=':
        return resultValue >= target ? 'PASS' : 'FAIL'
      case '<=':
        return resultValue <= target ? 'PASS' : 'FAIL'
      case '>':
        return resultValue > target ? 'PASS' : 'FAIL'
      case '<':
        return resultValue < target ? 'PASS' : 'FAIL'
      case '=':
        return Math.abs(resultValue - target) < 1e-6 ? 'PASS' : 'FAIL'
      default:
        return 'WAITING_TARGET'
    }
  }

  private static computeReEvaluatedEntryStatuses(
    entries: KpiEntryItem[] | undefined,
    targetOperator: string | null | undefined,
    targetValue: number | null | undefined,
    indicatorMeta: { title?: string | null; targetUnit?: string | null; numeratorName?: string | null }
  ): Array<{ id: number; status: string }> {
    const isPct = isPercentageIndicator(indicatorMeta)
    return (entries || []).map((e) => {
      const numVal = e.numeratorValue !== null && e.numeratorValue !== undefined ? Number(e.numeratorValue) : null
      const denVal = e.denominatorValue !== null && e.denominatorValue !== undefined ? Number(e.denominatorValue) : null
      let val = e.resultValue !== null && e.resultValue !== undefined ? Number(e.resultValue) : null
      const isZeroDenominator = numVal === 0 && denVal === 0

      if (val === null && numVal !== null && denVal !== null) {
        if (denVal > 0) {
          val = calculateIndicatorResult(numVal, denVal, isPct)
        } else if (isZeroDenominator) {
          val = 0
        }
      }

      const newStatus = this.evaluateTarget(val, targetOperator, targetValue, { isZeroDenominator })
      return { id: e.id, status: newStatus }
    })
  }

  static async getFiscalYears(gateway: Partial<KpiGatewayAdapter> = {}): Promise<string[]> {
    const gw = { ...defaultKpiGateway, ...gateway }
    return gw.getKpiFiscalYears()
  }

  static async getTopics(
    fiscalYear?: string,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<KpiTopicItem[]> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const rows = await gw.getKpiTopics(fiscalYear)
    return (rows || []).map((r) => ({
      id: Number(r.id),
      fiscalYear: String(r.fiscalYear ?? ''),
      code: String(r.code ?? ''),
      title: String(r.title ?? ''),
      description: r.description ?? null,
      isActive: Boolean(r.isActive),
      indicatorCount: Number(r.indicatorCount || 0),
    }))
  }

  static async getCategories(
    topicId: number,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<string[]> {
    const gw = { ...defaultKpiGateway, ...gateway }
    return gw.getKpiCategories(topicId)
  }

  static async getResponsiblePersons(
    topicId: number,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<string[]> {
    const gw = { ...defaultKpiGateway, ...gateway }
    return gw.getKpiResponsiblePersons(topicId)
  }

  static async getIndicators(
    filters: {
      topicId: number
      fiscalYear?: string
      category?: string
      frequency?: string
      responsibleName?: string
      search?: string
      periodKey?: string
    },
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<KpiIndicatorItem[]> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const rows = await gw.getKpiIndicators(filters)

    const indicatorMap = new Map<number, KpiIndicatorItem>()

    for (const r of rows || []) {
      let ind = indicatorMap.get(r.id)
      if (!ind) {
        ind = {
          id: r.id,
          topicId: r.topicId,
          sequence: r.sequence,
          category: r.category,
          subcategory: r.subcategory,
          code: r.code,
          oldCode: r.oldCode,
          frequency: r.frequency,
          title: r.title,
          numeratorName: r.numeratorName,
          denominatorName: r.denominatorName,
          targetRaw: r.targetRaw,
          targetOperator: r.targetOperator,
          targetValue: r.targetValue !== null && r.targetValue !== undefined ? parseFloat(r.targetValue) : null,
          targetUnit: r.targetUnit,
          responsibleName: r.responsibleName,
          indicatorType: r.indicatorType,
          displayOrder: r.displayOrder,
          entries: [],
          currentEntry: null,
        }
        indicatorMap.set(r.id, ind)
      }

      if (r.entryId) {
        const numVal = r.entryNumeratorValue !== null && r.entryNumeratorValue !== undefined ? parseFloat(r.entryNumeratorValue) : null
        const denVal = r.entryDenominatorValue !== null && r.entryDenominatorValue !== undefined ? parseFloat(r.entryDenominatorValue) : null
        let resVal = r.entryResultValue !== null && r.entryResultValue !== undefined ? parseFloat(r.entryResultValue) : null
        let entryStatus = r.entryStatus

        const isPct = isPercentageIndicator({
          title: ind.title,
          targetUnit: ind.targetUnit,
          numeratorName: ind.numeratorName,
        })

        const isMiscalcedRatio = !isPct && resVal !== null && numVal !== null && denVal !== null && denVal > 0 && numVal < denVal && resVal > 1
        if ((resVal === null || isMiscalcedRatio) && numVal !== null && denVal !== null) {
          if (denVal > 0) {
            resVal = calculateIndicatorResult(numVal, denVal, isPct)
          } else if (denVal === 0 && numVal === 0) {
            resVal = 0
            if (entryStatus === 'PENDING') {
              entryStatus = 'PASS'
            }
          }
        }

        const entryItem: KpiEntryItem = {
          id: r.entryId,
          indicatorId: r.id,
          fiscalYear: filters.fiscalYear || '',
          periodKey: r.entryPeriodKey,
          periodLabel: cleanPeriodLabel(r.entryPeriodLabel, r.entryPeriodKey, r.frequency),
          numeratorValue: numVal,
          denominatorValue: denVal,
          resultValue: resVal,
          resultText: r.entryResultText,
          status: entryStatus,
          note: r.entryNote,
          recordedById: r.entryRecordedById ?? null,
          recordedByName: cleanAuthorName(r.entryRecordedByName),
          recordedAt: r.entryRecordedAt,
          updatedAt: r.entryUpdatedAt,
        }
        if (!ind.entries!.some((e) => e.id === entryItem.id)) {
          ind.entries!.push(entryItem)
        }
      }
    }

    for (const ind of indicatorMap.values()) {
      if (!ind.entries || ind.entries.length === 0) {
        ind.currentEntry = null
        continue
      }
      if (filters.periodKey) {
        ind.currentEntry = ind.entries.find((e) => matchesPeriodKey(e.periodKey, filters.periodKey)) || null
      } else {
        const due = checkIndicatorDueStatus(ind.frequency, filters.fiscalYear || '2570')
        const dueEntry = ind.entries.find((e) => matchesPeriodKey(e.periodKey, due.relevantPeriod.key))
        const answered = ind.entries.filter(
          (e) =>
            (e.resultValue !== null && e.resultValue !== undefined) ||
            (e.resultText && e.resultText.trim() !== '' && e.resultText !== 'ไม่มีรายงาน') ||
            (e.numeratorValue !== null && e.denominatorValue !== null && e.numeratorValue !== undefined && e.denominatorValue !== undefined)
        )
        const latestEntry = answered.length > 0 ? answered[answered.length - 1] : null
        ind.currentEntry = dueEntry || latestEntry || null
      }
    }

    return Array.from(indicatorMap.values())
  }

  static async getIndicatorById(
    id: number,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<KpiIndicatorItem | null> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const bundle = await gw.getKpiIndicatorById(id)
    if (!bundle?.indicator) return null

    const r = bundle.indicator
    const entriesRows = bundle.entries || []

    return {
      id: r.id,
      topicId: r.topicId,
      sequence: r.sequence,
      category: r.category,
      subcategory: r.subcategory,
      code: r.code,
      oldCode: r.oldCode,
      frequency: r.frequency,
      title: r.title,
      numeratorName: r.numeratorName,
      denominatorName: r.denominatorName,
      targetRaw: r.targetRaw,
      targetOperator: r.targetOperator,
      targetValue: r.targetValue !== null && r.targetValue !== undefined ? parseFloat(r.targetValue) : null,
      targetUnit: r.targetUnit,
      responsibleName: r.responsibleName,
      indicatorType: r.indicatorType,
      displayOrder: r.displayOrder,
      entries: entriesRows.map((e: any) => {
        const numVal = e.numeratorValue !== null && e.numeratorValue !== undefined ? parseFloat(e.numeratorValue) : null
        const denVal = e.denominatorValue !== null && e.denominatorValue !== undefined ? parseFloat(e.denominatorValue) : null
        let resVal = e.resultValue !== null && e.resultValue !== undefined ? parseFloat(e.resultValue) : null
        let entryStatus = e.status

        const isPct = isPercentageIndicator({
          title: r.title,
          targetUnit: r.targetUnit,
          numeratorName: r.numeratorName,
        })

        const isMiscalcedRatio = !isPct && resVal !== null && numVal !== null && denVal !== null && denVal > 0 && numVal < denVal && resVal > 1
        if ((resVal === null || isMiscalcedRatio) && numVal !== null && denVal !== null) {
          if (denVal > 0) {
            resVal = calculateIndicatorResult(numVal, denVal, isPct)
          } else if (denVal === 0 && numVal === 0) {
            resVal = 0
            if (entryStatus === 'PENDING') {
              entryStatus = 'PASS'
            }
          }
        }

        return {
          id: e.id,
          indicatorId: e.indicatorId,
          fiscalYear: e.fiscalYear,
          periodKey: e.periodKey,
          periodLabel: cleanPeriodLabel(e.periodLabel, e.periodKey, r.frequency),
          numeratorValue: numVal,
          denominatorValue: denVal,
          resultValue: resVal,
          resultText: e.resultText,
          status: entryStatus,
          note: e.note,
          recordedById: e.recordedById,
          recordedByName: cleanAuthorName(e.recordedByName),
          recordedAt: e.recordedAt,
          updatedAt: e.updatedAt,
        }
      }),
    }
  }

  static async saveEntry(
    input: SaveEntryInput,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<KpiEntryItem> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const indicator = await this.getIndicatorById(input.indicatorId, gw)
    if (!indicator) {
      throw new Error(`Indicator with ID ${input.indicatorId} not found`)
    }

    if (!input.isAdmin) {
      const windowStatus = checkPeriodStatus(indicator.frequency, input.periodKey, input.fiscalYear)
      if (!windowStatus.isOpen) {
        throw new Error(windowStatus.message)
      }

      const userName = (input.recordedByName || '').trim()
      const resp = (indicator.responsibleName || '').trim()
      const isResponsible = Boolean(
        userName &&
          resp &&
          (resp.includes(userName) ||
            userName.includes(resp) ||
            resp.split(/[,/&+\s]+/).some((part) => part && (userName.includes(part) || part.includes(userName))))
      )
      if (!isResponsible && resp.length > 0) {
        throw new Error(`เฉพาะผู้รับผิดชอบ (${resp}) หรือผู้ดูแลระบบเท่านั้นที่สามารถบันทึกผลได้`)
      }
    }

    const safePeriodLabel = cleanPeriodLabel(input.periodLabel, input.periodKey, indicator.frequency)

    let computedResult = input.resultValue
    let isZeroDenominator = false
    const hasNum = input.numeratorValue !== undefined && input.numeratorValue !== null
    const hasDen = input.denominatorValue !== undefined && input.denominatorValue !== null

    if (hasNum && hasDen) {
      if (input.denominatorValue! > 0) {
        if (computedResult === undefined || computedResult === null) {
          const isPct = isPercentageIndicator({
            title: indicator.title,
            targetUnit: indicator.targetUnit,
            numeratorName: indicator.numeratorName,
          })
          computedResult = calculateIndicatorResult(input.numeratorValue!, input.denominatorValue!, isPct)
        }
      } else if (input.denominatorValue === 0 && input.numeratorValue === 0) {
        computedResult = 0
        isZeroDenominator = true
      }
    } else if (computedResult === 0 && input.numeratorValue === 0 && input.denominatorValue === 0) {
      isZeroDenominator = true
    }

    const status = this.evaluateTarget(computedResult, indicator.targetOperator, indicator.targetValue, {
      isZeroDenominator,
    })

    const saved = await gw.saveKpiEntry({
      indicatorId: input.indicatorId,
      fiscalYear: input.fiscalYear,
      periodKey: input.periodKey,
      periodLabel: safePeriodLabel,
      numeratorValue: input.numeratorValue ?? null,
      denominatorValue: input.denominatorValue ?? null,
      resultValue: computedResult ?? null,
      resultText: input.resultText ?? null,
      status,
      note: input.note ?? null,
      recordedById: input.recordedById ?? null,
      recordedByName: cleanAuthorName(input.recordedByName) || input.recordedByName || null,
    })

    const authorName = cleanAuthorName(saved?.authorName) || cleanAuthorName(input.recordedByName) || input.recordedByName || null
    const now = new Date()

    logAudit(
      'UPDATE',
      'kpi_entries',
      JSON.stringify({
        indicatorId: input.indicatorId,
        periodKey: input.periodKey,
        resultValue: computedResult,
        status,
        by: authorName,
      })
    ).catch(() => {})

    return {
      id: saved.entryId,
      indicatorId: input.indicatorId,
      fiscalYear: input.fiscalYear,
      periodKey: input.periodKey,
      periodLabel: safePeriodLabel,
      numeratorValue: input.numeratorValue ?? null,
      denominatorValue: input.denominatorValue ?? null,
      resultValue: computedResult ?? null,
      resultText: input.resultText ?? null,
      status,
      note: input.note ?? null,
      recordedById: input.recordedById ?? null,
      recordedByName: authorName,
      recordedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
  }

  static async updateTarget(
    input: UpdateTargetInput,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<void> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const existing = await this.getIndicatorById(input.indicatorId, gw)
    const effectiveUnit = input.targetUnit !== undefined ? input.targetUnit : existing?.targetUnit ?? '%'
    const effectiveRaw =
      input.targetRaw !== undefined
        ? input.targetRaw
        : input.targetValue !== null && input.targetValue !== undefined
        ? `${input.targetOperator || '>='} ${input.targetValue}${effectiveUnit || ''}`
        : input.targetOperator === 'MIN'
        ? 'MIN'
        : null

    const entryStatusUpdates = this.computeReEvaluatedEntryStatuses(
      existing?.entries,
      input.targetOperator,
      input.targetValue,
      {
        title: existing?.title,
        targetUnit: effectiveUnit,
        numeratorName: existing?.numeratorName,
      }
    )

    await gw.updateKpiTarget(input.indicatorId, {
      targetOperator: input.targetOperator,
      targetValue: input.targetValue,
      targetUnit: effectiveUnit,
      targetRaw: effectiveRaw,
      entryStatusUpdates,
    })

    logAudit(
      'UPDATE',
      'kpi_indicators',
      JSON.stringify({
        indicatorId: input.indicatorId,
        newOperator: input.targetOperator,
        newValue: input.targetValue,
        by: input.updatedByName,
      })
    ).catch(() => {})
  }

  static async createIndicator(
    input: CreateIndicatorInput,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<number> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const resolvedUnit = input.targetUnit !== undefined ? input.targetUnit : '%'
    const targetRaw =
      input.targetRaw !== undefined
        ? input.targetRaw
        : input.targetValue !== null && input.targetValue !== undefined
        ? `${input.targetOperator || '>='} ${input.targetValue}${resolvedUnit || ''}`
        : null

    const res = await gw.createKpiIndicator({
      topicId: input.topicId,
      sequence: input.sequence ?? null,
      category: input.category,
      subcategory: input.subcategory ?? null,
      code: input.code ?? null,
      oldCode: input.oldCode ?? null,
      frequency: input.frequency,
      title: input.title,
      numeratorName: input.numeratorName ?? null,
      denominatorName: input.denominatorName ?? null,
      targetRaw,
      targetOperator: input.targetOperator ?? '>=',
      targetValue: input.targetValue ?? null,
      targetUnit: resolvedUnit,
      responsibleName: input.responsibleName ?? null,
      indicatorType: input.indicatorType ?? null,
      displayOrder: input.displayOrder ?? 999,
    })

    const newId = res.insertId

    logAudit(
      'CREATE',
      'kpi_indicators',
      JSON.stringify({
        id: newId,
        title: input.title,
        by: input.createdByName,
      })
    ).catch(() => {})

    return newId
  }

  static async updateIndicator(
    input: UpdateIndicatorInput,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<void> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const existing = await this.getIndicatorById(input.id, gw)
    if (!existing) {
      throw new Error(`Indicator with ID ${input.id} not found`)
    }

    const nextOp = input.targetOperator !== undefined ? input.targetOperator : existing.targetOperator
    const nextVal = input.targetValue !== undefined ? input.targetValue : existing.targetValue
    const nextUnit = input.targetUnit !== undefined ? input.targetUnit : existing.targetUnit

    const targetRaw =
      input.targetRaw !== undefined
        ? input.targetRaw
        : nextVal !== null && nextVal !== undefined
        ? `${nextOp || '>='} ${nextVal}${nextUnit || ''}`
        : input.targetValue === null
        ? nextOp === 'MIN'
          ? 'MIN'
          : null
        : existing.targetRaw

    const shouldReEvaluate =
      input.targetValue !== undefined || input.targetOperator !== undefined || input.targetUnit !== undefined
    const entryStatusUpdates = shouldReEvaluate
      ? this.computeReEvaluatedEntryStatuses(existing.entries, nextOp, nextVal, {
          title: input.title !== undefined ? input.title : existing.title,
          targetUnit: nextUnit,
          numeratorName: input.numeratorName !== undefined ? input.numeratorName : existing.numeratorName,
        })
      : []

    await gw.updateKpiIndicator(input.id, {
      sequence: input.sequence !== undefined ? input.sequence : existing.sequence,
      category: input.category !== undefined ? input.category : existing.category,
      subcategory: input.subcategory !== undefined ? input.subcategory : existing.subcategory,
      code: input.code !== undefined ? input.code : existing.code,
      oldCode: input.oldCode !== undefined ? input.oldCode : existing.oldCode,
      frequency: input.frequency !== undefined ? input.frequency : existing.frequency,
      title: input.title !== undefined ? input.title : existing.title,
      numeratorName: input.numeratorName !== undefined ? input.numeratorName : existing.numeratorName,
      denominatorName: input.denominatorName !== undefined ? input.denominatorName : existing.denominatorName,
      targetRaw,
      targetOperator: nextOp,
      targetValue: nextVal,
      targetUnit: nextUnit,
      responsibleName: input.responsibleName !== undefined ? input.responsibleName : existing.responsibleName,
      indicatorType: input.indicatorType !== undefined ? input.indicatorType : existing.indicatorType,
      displayOrder: input.displayOrder !== undefined ? input.displayOrder : existing.displayOrder,
      entryStatusUpdates,
    })

    logAudit(
      'UPDATE',
      'kpi_indicators',
      JSON.stringify({
        id: input.id,
        by: input.updatedByName,
      })
    ).catch(() => {})
  }

  static async deleteIndicator(
    id: number,
    deletedByName?: string | null,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<void> {
    const gw = { ...defaultKpiGateway, ...gateway }
    await gw.deleteKpiIndicator(id)

    logAudit(
      'DELETE',
      'kpi_indicators',
      JSON.stringify({
        id,
        by: deletedByName,
      })
    ).catch(() => {})
  }

  static async getStats(
    topicId: number,
    periodKey?: string,
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<KpiDashboardStats> {
    const indicators = await this.getIndicators({ topicId, periodKey }, gateway)

    let totalAnswered = 0
    let totalPending = 0
    let totalPass = 0
    let totalFail = 0
    let totalWaitingTarget = 0

    const catMap = new Map<string, { total: number; answered: number; pass: number; fail: number }>()

    for (const ind of indicators) {
      if (!catMap.has(ind.category)) {
        catMap.set(ind.category, { total: 0, answered: 0, pass: 0, fail: 0 })
      }
      const c = catMap.get(ind.category)!
      c.total++

      if (ind.currentEntry && (ind.currentEntry.resultValue !== null || ind.currentEntry.resultText)) {
        totalAnswered++
        c.answered++

        if (ind.currentEntry.status === 'PASS') {
          totalPass++
          c.pass++
        } else if (ind.currentEntry.status === 'FAIL') {
          totalFail++
          c.fail++
        } else if (ind.currentEntry.status === 'WAITING_TARGET') {
          totalWaitingTarget++
        } else {
          totalPending++
        }
      } else {
        totalPending++
      }
    }

    const passRatePercentage =
      totalAnswered > 0 ? parseFloat(((totalPass / totalAnswered) * 100).toFixed(1)) : 0

    const categoryBreakdown = Array.from(catMap.entries()).map(([category, stats]) => ({
      category,
      ...stats,
    }))

    return {
      totalIndicators: indicators.length,
      totalAnswered,
      totalPending,
      totalPass,
      totalFail,
      totalWaitingTarget,
      passRatePercentage,
      categoryBreakdown,
    }
  }

  static async importTopicAndIndicators(
    input: {
      fiscalYear: string
      code: string
      title: string
      description?: string | null
      rows: Array<{
        sequence?: string | null
        category?: string | null
        subcategory?: string | null
        code?: string | null
        oldCode?: string | null
        frequency?: string | null
        title: string
        numeratorName?: string | null
        denominatorName?: string | null
        targetRaw?: string | null
        targetOperator?: string | null
        targetValue?: number | null
        targetUnit?: string | null
        responsibleName?: string | null
        indicatorType?: string | null
      }>
      actorName: string
    },
    gateway: Partial<KpiGatewayAdapter> = {}
  ): Promise<{
    topicId: number
    fiscalYear: string
    code: string
    inserted: number
  }> {
    const gw = { ...defaultKpiGateway, ...gateway }
    const { topicId } = await gw.upsertKpiTopicForImport({
      fiscalYear: input.fiscalYear,
      code: input.code,
      title: input.title,
      description: input.description ?? null,
    })

    const kpiPayload = input.rows.map((row, i) => ({
      sequence: row.sequence ?? null,
      category: row.category || 'ทั่วไป',
      subcategory: row.subcategory ?? null,
      code: row.code ?? null,
      oldCode: row.oldCode ?? null,
      frequency: row.frequency || 'ราย 6 เดือน',
      title: row.title,
      numeratorName: row.numeratorName ?? null,
      denominatorName: row.denominatorName ?? null,
      targetRaw: row.targetRaw ?? null,
      targetOperator: row.targetOperator ?? null,
      targetValue: row.targetValue ?? null,
      targetUnit: row.targetUnit ?? null,
      responsibleName: row.responsibleName ?? null,
      indicatorType: row.indicatorType || 'HA',
      displayOrder: i + 1,
    }))

    const batchRes = await gw.importKpiBatch(topicId, kpiPayload)
    const inserted = batchRes.insertedCount || input.rows.length

    logAudit(
      'CREATE',
      'kpi_topics',
      JSON.stringify({
        topicId,
        fiscalYear: input.fiscalYear,
        code: input.code,
        insertedCount: inserted,
        by: input.actorName,
      })
    ).catch(() => {})

    return {
      topicId,
      fiscalYear: input.fiscalYear,
      code: input.code,
      inserted,
    }
  }
}
