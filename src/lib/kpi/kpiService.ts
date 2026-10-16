import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { checkPeriodStatus, getPeriodsForFrequency } from './kpiTimeUtils'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

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
  const matched = periods.find(p => p.key === periodKey)
  return matched ? matched.label : (rawLabel || periodKey)
}

export function cleanAuthorName(name: string | null | undefined): string {
  if (!name) return ''
  if (name.includes('เธ') || name.includes('\uFFFD')) {
    return ''
  }
  return name.trim()
}

export class KpiService {
  /**
   * Evaluate whether resultValue meets target condition
   */
  static evaluateTarget(
    resultValue: number | null | undefined,
    operator: string | null | undefined,
    targetValue: number | null | undefined
  ): 'PASS' | 'FAIL' | 'WAITING_TARGET' | 'PENDING' {
    if (resultValue === null || resultValue === undefined) {
      return 'PENDING'
    }

    if (!operator && (targetValue === null || targetValue === undefined)) {
      return 'WAITING_TARGET'
    }

    const op = operator || '>='
    const target = targetValue ?? 0

    if (op === 'MIN') {
      if (targetValue !== null && targetValue !== undefined) {
        return resultValue <= target ? 'PASS' : 'FAIL'
      }
      return resultValue === 0 ? 'PASS' : 'WAITING_TARGET'
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
        return Math.abs(resultValue - target) < 0.0001 ? 'PASS' : 'FAIL'
      default:
        return 'WAITING_TARGET'
    }
  }

  /**
   * Get available fiscal years
   */
  static async getFiscalYears(executor: QueryExecutor = queryMemberDb): Promise<string[]> {
    const rows = await executor(`
      SELECT DISTINCT fiscal_year AS fiscalYear
      FROM kpi_topics
      WHERE is_active = 1
      ORDER BY fiscal_year DESC
    `)
    return rows.map(r => r.fiscalYear)
  }

  /**
   * Get topics by fiscal year
   */
  static async getTopics(
    fiscalYear?: string,
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiTopicItem[]> {
    let sql = `
      SELECT 
        t.id, 
        t.fiscal_year AS fiscalYear, 
        t.code, 
        t.title, 
        t.description, 
        t.is_active AS isActive,
        (SELECT COUNT(*) FROM kpi_indicators i WHERE i.topic_id = t.id) AS indicatorCount
      FROM kpi_topics t
      WHERE t.is_active = 1
    `
    const params: any[] = []
    if (fiscalYear) {
      sql += ' AND t.fiscal_year = ?'
      params.push(fiscalYear)
    }
    sql += ' ORDER BY t.fiscal_year DESC, t.id ASC'

    const rows = await executor(sql, params)
    return rows.map(r => ({
      ...r,
      isActive: Boolean(r.isActive),
      indicatorCount: Number(r.indicatorCount || 0),
    }))
  }

  /**
   * Get distinct categories for a topic
   */
  static async getCategories(
    topicId: number,
    executor: QueryExecutor = queryMemberDb
  ): Promise<string[]> {
    const rows = await executor(`
      SELECT DISTINCT category
      FROM kpi_indicators
      WHERE topic_id = ?
      ORDER BY category ASC
    `, [topicId])
    return rows.map(r => r.category)
  }

  /**
   * Get distinct responsible persons for a topic
   */
  static async getResponsiblePersons(
    topicId: number,
    executor: QueryExecutor = queryMemberDb
  ): Promise<string[]> {
    const rows = await executor(`
      SELECT DISTINCT responsible_name AS responsibleName
      FROM kpi_indicators
      WHERE topic_id = ? AND responsible_name IS NOT NULL AND responsible_name != ''
      ORDER BY responsible_name ASC
    `, [topicId])
    return rows.map(r => r.responsibleName)
  }

  /**
   * Get indicators list with optional filtering and entry for a specific period
   */
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
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiIndicatorItem[]> {
    let sql = `
      SELECT 
        i.id,
        i.topic_id AS topicId,
        i.sequence,
        i.category,
        i.subcategory,
        i.code,
        i.old_code AS oldCode,
        i.frequency,
        i.title,
        i.numerator_name AS numeratorName,
        i.denominator_name AS denominatorName,
        i.target_raw AS targetRaw,
        i.target_operator AS targetOperator,
        i.target_value AS targetValue,
        i.target_unit AS targetUnit,
        i.responsible_name AS responsibleName,
        i.indicator_type AS indicatorType,
        i.display_order AS displayOrder,
        e.id AS entryId,
        e.period_key AS entryPeriodKey,
        e.period_label AS entryPeriodLabel,
        e.numerator_value AS entryNumeratorValue,
        e.denominator_value AS entryDenominatorValue,
        e.result_value AS entryResultValue,
        e.result_text AS entryResultText,
        e.status AS entryStatus,
        e.note AS entryNote,
        e.recorded_by_id AS entryRecordedById,
        COALESCE(m.name, e.recorded_by_name) AS entryRecordedByName,
        e.recorded_at AS entryRecordedAt,
        e.updated_at AS entryUpdatedAt
      FROM kpi_indicators i
      LEFT JOIN kpi_entries e ON e.indicator_id = i.id
    `

    const params: any[] = []
    if (filters.fiscalYear) {
      sql += ' AND e.fiscal_year = ?'
      params.push(filters.fiscalYear)
    }
    if (filters.periodKey) {
      sql += ' AND e.period_key = ?'
      params.push(filters.periodKey)
    }

    sql += `
      LEFT JOIN members m ON m.id = e.recorded_by_id
      WHERE i.topic_id = ?
    `
    params.push(filters.topicId)

    if (filters.category) {
      sql += ' AND i.category = ?'
      params.push(filters.category)
    }
    if (filters.frequency) {
      sql += ' AND i.frequency = ?'
      params.push(filters.frequency)
    }
    if (filters.responsibleName) {
      sql += ' AND i.responsible_name LIKE ?'
      params.push(`%${filters.responsibleName}%`)
    }
    if (filters.search) {
      sql += ' AND (i.title LIKE ? OR i.code LIKE ? OR i.subcategory LIKE ? OR i.responsible_name LIKE ?)'
      const searchTerm = `%${filters.search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    sql += ' ORDER BY i.display_order ASC, i.id ASC'

    const rows = await executor(sql, params)

    return rows.map(r => ({
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
      targetValue: r.targetValue !== null ? parseFloat(r.targetValue) : null,
      targetUnit: r.targetUnit,
      responsibleName: r.responsibleName,
      indicatorType: r.indicatorType,
      displayOrder: r.displayOrder,
      currentEntry: r.entryId ? {
        id: r.entryId,
        indicatorId: r.id,
        fiscalYear: filters.fiscalYear || '',
        periodKey: r.entryPeriodKey,
        periodLabel: cleanPeriodLabel(r.entryPeriodLabel, r.entryPeriodKey, r.frequency),
        numeratorValue: r.entryNumeratorValue !== null ? parseFloat(r.entryNumeratorValue) : null,
        denominatorValue: r.entryDenominatorValue !== null ? parseFloat(r.entryDenominatorValue) : null,
        resultValue: r.entryResultValue !== null ? parseFloat(r.entryResultValue) : null,
        resultText: r.entryResultText,
        status: r.entryStatus,
        note: r.entryNote,
        recordedById: r.entryRecordedById ?? null,
        recordedByName: cleanAuthorName(r.entryRecordedByName),
        recordedAt: r.entryRecordedAt,
        updatedAt: r.entryUpdatedAt,
      } : null,
    }))
  }

  /**
   * Get single indicator with all period entries
   */
  static async getIndicatorById(
    id: number,
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiIndicatorItem | null> {
    const indRows = await executor(`
      SELECT 
        i.id,
        i.topic_id AS topicId,
        i.sequence,
        i.category,
        i.subcategory,
        i.code,
        i.old_code AS oldCode,
        i.frequency,
        i.title,
        i.numerator_name AS numeratorName,
        i.denominator_name AS denominatorName,
        i.target_raw AS targetRaw,
        i.target_operator AS targetOperator,
        i.target_value AS targetValue,
        i.target_unit AS targetUnit,
        i.responsible_name AS responsibleName,
        i.indicator_type AS indicatorType,
        i.display_order AS displayOrder,
        t.fiscal_year AS fiscalYear
      FROM kpi_indicators i
      JOIN kpi_topics t ON t.id = i.topic_id
      WHERE i.id = ?
    `, [id])

    if (!indRows.length) return null
    const r = indRows[0]

    const entriesRows = await executor(`
      SELECT 
        e.id,
        e.indicator_id AS indicatorId,
        e.fiscal_year AS fiscalYear,
        e.period_key AS periodKey,
        e.period_label AS periodLabel,
        e.numerator_value AS numeratorValue,
        e.denominator_value AS denominatorValue,
        e.result_value AS resultValue,
        e.result_text AS resultText,
        e.status,
        e.note,
        e.recorded_by_id AS recordedById,
        COALESCE(m.name, e.recorded_by_name) AS recordedByName,
        e.recorded_at AS recordedAt,
        e.updated_at AS updatedAt
      FROM kpi_entries e
      LEFT JOIN members m ON m.id = e.recorded_by_id
      WHERE e.indicator_id = ?
      ORDER BY e.id ASC
    `, [id])

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
      targetValue: r.targetValue !== null ? parseFloat(r.targetValue) : null,
      targetUnit: r.targetUnit,
      responsibleName: r.responsibleName,
      indicatorType: r.indicatorType,
      displayOrder: r.displayOrder,
      entries: entriesRows.map((e: any) => ({
        id: e.id,
        indicatorId: e.indicatorId,
        fiscalYear: e.fiscalYear,
        periodKey: e.periodKey,
        periodLabel: cleanPeriodLabel(e.periodLabel, e.periodKey, r.frequency),
        numeratorValue: e.numeratorValue !== null ? parseFloat(e.numeratorValue) : null,
        denominatorValue: e.denominatorValue !== null ? parseFloat(e.denominatorValue) : null,
        resultValue: e.resultValue !== null ? parseFloat(e.resultValue) : null,
        resultText: e.resultText,
        status: e.status,
        note: e.note,
        recordedById: e.recordedById,
        recordedByName: cleanAuthorName(e.recordedByName),
        recordedAt: e.recordedAt,
        updatedAt: e.updatedAt,
      })),
    }
  }

  /**
   * Save or update an entry for an indicator
   */
  static async saveEntry(
    input: SaveEntryInput,
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiEntryItem> {
    const indicator = await this.getIndicatorById(input.indicatorId, executor)
    if (!indicator) {
      throw new Error(`Indicator with ID ${input.indicatorId} not found`)
    }

    // Check reporting window lock and responsible person unless admin
    if (!input.isAdmin) {
      const windowStatus = checkPeriodStatus(
        indicator.frequency,
        input.periodKey,
        input.fiscalYear
      )
      if (!windowStatus.isOpen) {
        throw new Error(windowStatus.message)
      }

      // Check responsible person permission
      const userName = (input.recordedByName || '').trim()
      const resp = (indicator.responsibleName || '').trim()
      const isResponsible = Boolean(
        userName && resp && (
          resp.includes(userName) || 
          userName.includes(resp) ||
          resp.split(/[,/&+\s]+/).some(part => part && (userName.includes(part) || part.includes(userName)))
        )
      )
      if (!isResponsible && resp.length > 0) {
        throw new Error(`เฉพาะผู้รับผิดชอบ (${resp}) หรือผู้ดูแลระบบเท่านั้นที่สามารถบันทึกผลได้`)
      }
    }

    // If recordedById provided, lookup member's official clean name from members table
    let authorName = input.recordedByName
    if (input.recordedById) {
      try {
        const memberRows = await executor('SELECT name FROM members WHERE id = ? LIMIT 1', [input.recordedById])
        if (memberRows && memberRows.length > 0 && memberRows[0].name) {
          authorName = memberRows[0].name
        }
      } catch {
        // Fallback to provided name
      }
    }
    authorName = cleanAuthorName(authorName) || input.recordedByName || null

    // Ensure canonical Thai period label
    const safePeriodLabel = cleanPeriodLabel(input.periodLabel, input.periodKey, indicator.frequency)

    // Auto-calculate percentage if numerator and denominator provided and resultValue not set
    let computedResult = input.resultValue
    if (
      computedResult === undefined ||
      computedResult === null
    ) {
      if (
        input.numeratorValue !== undefined &&
        input.numeratorValue !== null &&
        input.denominatorValue !== undefined &&
        input.denominatorValue !== null &&
        input.denominatorValue > 0
      ) {
        computedResult = parseFloat(((input.numeratorValue / input.denominatorValue) * 100).toFixed(2))
      }
    }

    // Evaluate target status
    const status = this.evaluateTarget(
      computedResult,
      indicator.targetOperator,
      indicator.targetValue
    )

    // Check if entry already exists
    const existing = await executor(`
      SELECT id FROM kpi_entries 
      WHERE indicator_id = ? AND period_key = ?
    `, [input.indicatorId, input.periodKey])

    let entryId: number
    const now = new Date()

    if (existing.length > 0) {
      entryId = existing[0].id
      await executor(`
        UPDATE kpi_entries SET
          period_label = ?,
          numerator_value = ?,
          denominator_value = ?,
          result_value = ?,
          result_text = ?,
          status = ?,
          note = ?,
          recorded_by_id = ?,
          recorded_by_name = ?,
          recorded_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `, [
        safePeriodLabel,
        input.numeratorValue ?? null,
        input.denominatorValue ?? null,
        computedResult ?? null,
        input.resultText ?? null,
        status,
        input.note ?? null,
        input.recordedById ?? null,
        authorName,
        entryId
      ])
    } else {
      const insertRes: any = await executor(`
        INSERT INTO kpi_entries (
          indicator_id, fiscal_year, period_key, period_label,
          numerator_value, denominator_value, result_value, result_text,
          status, note, recorded_by_id, recorded_by_name, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        input.indicatorId,
        input.fiscalYear,
        input.periodKey,
        safePeriodLabel,
        input.numeratorValue ?? null,
        input.denominatorValue ?? null,
        computedResult ?? null,
        input.resultText ?? null,
        status,
        input.note ?? null,
        input.recordedById ?? null,
        authorName
      ])
      entryId = insertRes.insertId
    }

    logAudit(
      'UPDATE',
      'kpi_entries',
      JSON.stringify({
        indicatorId: input.indicatorId,
        periodKey: input.periodKey,
        resultValue: computedResult,
        status,
        by: authorName
      })
    ).catch(() => {})

    return {
      id: entryId,
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

  /**
   * Update target configuration for an indicator (Admin / Quality Center)
   */
  static async updateTarget(
    input: UpdateTargetInput,
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    await executor(`
      UPDATE kpi_indicators SET
        target_operator = ?,
        target_value = ?,
        target_unit = ?,
        target_raw = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      input.targetOperator,
      input.targetValue,
      input.targetUnit ?? '%',
      input.targetRaw ?? (input.targetValue !== null ? `${input.targetOperator || '>='} ${input.targetValue}${input.targetUnit || '%'}` : null),
      input.indicatorId
    ])

    // Re-evaluate existing entries for this indicator
    const entries = await executor(`
      SELECT id, result_value AS resultValue
      FROM kpi_entries
      WHERE indicator_id = ?
    `, [input.indicatorId])

    for (const e of entries) {
      const val = e.resultValue !== null ? parseFloat(e.resultValue) : null
      const newStatus = this.evaluateTarget(val, input.targetOperator, input.targetValue)
      await executor(`
        UPDATE kpi_entries SET status = ? WHERE id = ?
      `, [newStatus, e.id])
    }

    logAudit(
      'UPDATE',
      'kpi_indicators',
      JSON.stringify({
        indicatorId: input.indicatorId,
        newOperator: input.targetOperator,
        newValue: input.targetValue,
        by: input.updatedByName
      })
    ).catch(() => {})
  }

  /**
   * Create a new indicator (Admin or Quality Center)
   */
  static async createIndicator(
    input: CreateIndicatorInput,
    executor: QueryExecutor = queryMemberDb
  ): Promise<number> {
    const targetRaw = input.targetRaw || (input.targetValue !== null && input.targetValue !== undefined ? `${input.targetOperator || '>='} ${input.targetValue}${input.targetUnit || '%'}` : null)

    const res: any = await executor(`
      INSERT INTO kpi_indicators (
        topic_id, sequence, category, subcategory, code, old_code,
        frequency, title, numerator_name, denominator_name,
        target_raw, target_operator, target_value, target_unit,
        responsible_name, indicator_type, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      input.topicId,
      input.sequence ?? null,
      input.category,
      input.subcategory ?? null,
      input.code ?? null,
      input.oldCode ?? null,
      input.frequency,
      input.title,
      input.numeratorName ?? null,
      input.denominatorName ?? null,
      targetRaw,
      input.targetOperator ?? '>=',
      input.targetValue ?? null,
      input.targetUnit ?? '%',
      input.responsibleName ?? null,
      input.indicatorType ?? null,
      input.displayOrder ?? 999
    ])

    const newId = res.insertId

    logAudit(
      'CREATE',
      'kpi_indicators',
      JSON.stringify({
        id: newId,
        title: input.title,
        by: input.createdByName
      })
    ).catch(() => {})

    return newId
  }

  /**
   * Update existing indicator
   */
  static async updateIndicator(
    input: UpdateIndicatorInput,
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    const existing = await this.getIndicatorById(input.id, executor)
    if (!existing) {
      throw new Error(`Indicator with ID ${input.id} not found`)
    }

    const targetRaw = input.targetRaw !== undefined 
      ? input.targetRaw 
      : (input.targetValue !== null && input.targetValue !== undefined 
          ? `${input.targetOperator || existing.targetOperator || '>='} ${input.targetValue}${input.targetUnit || existing.targetUnit || '%'}` 
          : existing.targetRaw)

    await executor(`
      UPDATE kpi_indicators SET
        sequence = ?,
        category = ?,
        subcategory = ?,
        code = ?,
        old_code = ?,
        frequency = ?,
        title = ?,
        numerator_name = ?,
        denominator_name = ?,
        target_raw = ?,
        target_operator = ?,
        target_value = ?,
        target_unit = ?,
        responsible_name = ?,
        indicator_type = ?,
        display_order = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      input.sequence !== undefined ? input.sequence : existing.sequence,
      input.category !== undefined ? input.category : existing.category,
      input.subcategory !== undefined ? input.subcategory : existing.subcategory,
      input.code !== undefined ? input.code : existing.code,
      input.oldCode !== undefined ? input.oldCode : existing.oldCode,
      input.frequency !== undefined ? input.frequency : existing.frequency,
      input.title !== undefined ? input.title : existing.title,
      input.numeratorName !== undefined ? input.numeratorName : existing.numeratorName,
      input.denominatorName !== undefined ? input.denominatorName : existing.denominatorName,
      targetRaw,
      input.targetOperator !== undefined ? input.targetOperator : existing.targetOperator,
      input.targetValue !== undefined ? input.targetValue : existing.targetValue,
      input.targetUnit !== undefined ? input.targetUnit : existing.targetUnit,
      input.responsibleName !== undefined ? input.responsibleName : existing.responsibleName,
      input.indicatorType !== undefined ? input.indicatorType : existing.indicatorType,
      input.displayOrder !== undefined ? input.displayOrder : existing.displayOrder,
      input.id
    ])

    // If target condition changed, re-evaluate existing entries
    if (input.targetValue !== undefined || input.targetOperator !== undefined) {
      const newOp = input.targetOperator !== undefined ? input.targetOperator : existing.targetOperator
      const newVal = input.targetValue !== undefined ? input.targetValue : existing.targetValue

      const entries = await executor(`
        SELECT id, result_value AS resultValue FROM kpi_entries WHERE indicator_id = ?
      `, [input.id])

      for (const e of entries) {
        const val = e.resultValue !== null ? parseFloat(e.resultValue) : null
        const newStatus = this.evaluateTarget(val, newOp, newVal)
        await executor('UPDATE kpi_entries SET status = ? WHERE id = ?', [newStatus, e.id])
      }
    }

    logAudit(
      'UPDATE',
      'kpi_indicators',
      JSON.stringify({
        id: input.id,
        by: input.updatedByName
      })
    ).catch(() => {})
  }

  /**
   * Delete indicator and all associated entries
   */
  static async deleteIndicator(
    id: number,
    deletedByName?: string | null,
    executor: QueryExecutor = queryMemberDb
  ): Promise<void> {
    await executor('DELETE FROM kpi_indicators WHERE id = ?', [id])

    logAudit(
      'DELETE',
      'kpi_indicators',
      JSON.stringify({
        id,
        by: deletedByName
      })
    ).catch(() => {})
  }

  /**
   * Get dashboard statistics
   */
  static async getStats(
    topicId: number,
    periodKey?: string,
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiDashboardStats> {
    const indicators = await this.getIndicators({ topicId, periodKey }, executor)

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

    const passRatePercentage = totalAnswered > 0
      ? parseFloat(((totalPass / totalAnswered) * 100).toFixed(1))
      : 0

    const categoryBreakdown = Array.from(catMap.entries()).map(([category, stats]) => ({
      category,
      ...stats
    }))

    return {
      totalIndicators: indicators.length,
      totalAnswered,
      totalPending,
      totalPass,
      totalFail,
      totalWaitingTarget,
      passRatePercentage,
      categoryBreakdown
    }
  }
}
