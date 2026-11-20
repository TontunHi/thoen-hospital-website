import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { matchesPeriodKey } from './kpiTimeUtils'
import type { KpiIndicatorItem, QueryExecutor } from './kpiService'

export type KpiAuditStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'NO_HUMAN_ENTRY'
  | 'MANUAL_OR_HYBRID'
  | 'UNCONFIGURED_RULE'
  | 'SQL_ERROR'

export interface KpiAiAuditItem {
  id: number
  indicatorId: number
  fiscalYear: string
  periodKey: string
  ruleCode: string
  status: KpiAuditStatus
  humanNumerator: number | null
  humanDenominator: number | null
  humanResult: number | null
  aiNumerator: number | null
  aiDenominator: number | null
  aiResult: number | null
  diffNumerator: number | null
  diffDenominator: number | null
  diffResult: number | null
  thipManualRef: string | null
  explanationTh: string | null
  diagnostics: Record<string, Array<Record<string, unknown>>>
  auditedAt: string | null
  updatedAt: string | null
}

export interface UpsertKpiAuditEntryInput {
  indicatorId: number
  ruleCode: string
  status: KpiAuditStatus
  humanNumerator?: number | null
  humanDenominator?: number | null
  humanResult?: number | null
  aiNumerator?: number | null
  aiDenominator?: number | null
  aiResult?: number | null
  diffNumerator?: number | null
  diffDenominator?: number | null
  diffResult?: number | null
  thipManualRef?: string | null
  explanationTh?: string | null
  diagnostics?: Record<string, Array<Record<string, unknown>>> | null
}

export interface UpsertKpiAuditBatchInput {
  fiscalYear: string
  periodKey: string
  auditedAt?: string | null
  actorName?: string | null
  items: UpsertKpiAuditEntryInput[]
}

const FORBIDDEN_PHI_KEYS = new Set([
  'hn',
  'an',
  'vn',
  'cid',
  'pname',
  'fname',
  'lname',
  'full_name',
  'patient_name',
  'birthday',
  'birthdate',
  'addrpart',
  'hometel',
  'mobile_phone_number',
])

const THAI_CID_RE = /\b\d{13}\b/

export class PhiViolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhiViolationError'
  }
}

export function assertNoPhiInValue(value: unknown, path = 'diagnostics'): void {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    if (THAI_CID_RE.test(value)) {
      throw new PhiViolationError(`ตรวจพบข้อมูลต้องสงสัยคล้ายเลขบัตรประชาชน 13 หลักใน ${path}`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoPhiInValue(item, `${path}[${idx}]`))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_PHI_KEYS.has(k.trim().toLowerCase())) {
        throw new PhiViolationError(`ไม่อนุญาตให้บันทึกคอลัมน์ข้อมูลส่วนบุคคล (${k}) ลงในผลตรวจ AI`)
      }
      assertNoPhiInValue(v, `${path}.${k}`)
    }
  }
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

function parseDiagnosticsJson(raw: unknown): Record<string, Array<Record<string, unknown>>> {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, Array<Record<string, unknown>>>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      return {}
    }
  }
  return {}
}

function normalizeAuditDateTime(raw?: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  // Store Asia/Bangkok YYYY-MM-DD HH:mm:ss cleanly for MariaDB DATETIME
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return bkk.toISOString().slice(0, 19).replace('T', ' ')
}

export class KpiAuditService {
  static async ensureTable(executor: QueryExecutor = queryMemberDb): Promise<void> {
    await executor(`
      CREATE TABLE IF NOT EXISTS kpi_ai_audits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        indicator_id INT NOT NULL,
        fiscal_year VARCHAR(10) NOT NULL,
        period_key VARCHAR(50) NOT NULL,
        rule_code VARCHAR(50) NOT NULL,
        status VARCHAR(30) NOT NULL,
        human_numerator DECIMAL(14,4) NULL,
        human_denominator DECIMAL(14,4) NULL,
        human_result DECIMAL(14,4) NULL,
        ai_numerator DECIMAL(14,4) NULL,
        ai_denominator DECIMAL(14,4) NULL,
        ai_result DECIMAL(14,4) NULL,
        diff_numerator DECIMAL(14,4) NULL,
        diff_denominator DECIMAL(14,4) NULL,
        diff_result DECIMAL(14,4) NULL,
        thip_manual_ref VARCHAR(255) NULL,
        explanation_th TEXT NULL,
        diagnostics_json LONGTEXT NULL,
        audited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_kpi_ai_audit_ind_fy_period (indicator_id, fiscal_year, period_key),
        INDEX idx_kpi_ai_audit_fy_period_status (fiscal_year, period_key, status),
        CONSTRAINT fk_kpi_ai_audit_indicator FOREIGN KEY (indicator_id) REFERENCES kpi_indicators(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  static async upsertAuditBatch(
    input: UpsertKpiAuditBatchInput,
    executor: QueryExecutor = queryMemberDb
  ): Promise<{ savedCount: number; skippedCount: number }> {
    await this.ensureTable(executor)

    const validIndicatorRows = await executor(
      'SELECT id FROM kpi_indicators WHERE id IN (' +
        (input.items.length > 0 ? input.items.map(() => '?').join(',') : '0') +
        ')',
      input.items.map(i => i.indicatorId)
    )
    const validIds = new Set<number>(validIndicatorRows.map(r => Number(r.id)))

    const auditedAtSql = normalizeAuditDateTime(input.auditedAt)
    let savedCount = 0
    let skippedCount = 0

    for (const item of input.items) {
      if (!validIds.has(item.indicatorId)) {
        skippedCount += 1
        continue
      }

      const diag = item.diagnostics || {}
      assertNoPhiInValue(diag, `items[${item.ruleCode}].diagnostics`)
      assertNoPhiInValue(item.explanationTh, `items[${item.ruleCode}].explanationTh`)

      const diagJson = Object.keys(diag).length > 0 ? JSON.stringify(diag) : null

      await executor(
        `
        INSERT INTO kpi_ai_audits (
          indicator_id, fiscal_year, period_key, rule_code, status,
          human_numerator, human_denominator, human_result,
          ai_numerator, ai_denominator, ai_result,
          diff_numerator, diff_denominator, diff_result,
          thip_manual_ref, explanation_th, diagnostics_json, audited_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
        ON DUPLICATE KEY UPDATE
          rule_code = VALUES(rule_code),
          status = VALUES(status),
          human_numerator = VALUES(human_numerator),
          human_denominator = VALUES(human_denominator),
          human_result = VALUES(human_result),
          ai_numerator = VALUES(ai_numerator),
          ai_denominator = VALUES(ai_denominator),
          ai_result = VALUES(ai_result),
          diff_numerator = VALUES(diff_numerator),
          diff_denominator = VALUES(diff_denominator),
          diff_result = VALUES(diff_result),
          thip_manual_ref = VALUES(thip_manual_ref),
          explanation_th = VALUES(explanation_th),
          diagnostics_json = VALUES(diagnostics_json),
          audited_at = VALUES(audited_at)
        `,
        [
          item.indicatorId,
          input.fiscalYear,
          input.periodKey,
          item.ruleCode,
          item.status,
          item.humanNumerator ?? null,
          item.humanDenominator ?? null,
          item.humanResult ?? null,
          item.aiNumerator ?? null,
          item.aiDenominator ?? null,
          item.aiResult ?? null,
          item.diffNumerator ?? null,
          item.diffDenominator ?? null,
          item.diffResult ?? null,
          item.thipManualRef ?? null,
          item.explanationTh ?? null,
          diagJson,
          auditedAtSql,
        ]
      )
      savedCount += 1
    }

    logAudit(
      'UPDATE',
      'kpi_ai_audits',
      JSON.stringify({
        fiscalYear: input.fiscalYear,
        periodKey: input.periodKey,
        savedCount,
        skippedCount,
        by: input.actorName || 'thoen-kpi-auditor',
      })
    ).catch(() => {})

    return { savedCount, skippedCount }
  }

  static async getAuditsByTopic(
    filters: {
      topicId: number
      fiscalYear?: string
      periodKey?: string
    },
    executor: QueryExecutor = queryMemberDb
  ): Promise<KpiAiAuditItem[]> {
    let sql = `
      SELECT
        a.id,
        a.indicator_id AS indicatorId,
        a.fiscal_year AS fiscalYear,
        a.period_key AS periodKey,
        a.rule_code AS ruleCode,
        a.status,
        a.human_numerator AS humanNumerator,
        a.human_denominator AS humanDenominator,
        a.human_result AS humanResult,
        a.ai_numerator AS aiNumerator,
        a.ai_denominator AS aiDenominator,
        a.ai_result AS aiResult,
        a.diff_numerator AS diffNumerator,
        a.diff_denominator AS diffDenominator,
        a.diff_result AS diffResult,
        a.thip_manual_ref AS thipManualRef,
        a.explanation_th AS explanationTh,
        a.diagnostics_json AS diagnosticsJson,
        a.audited_at AS auditedAt,
        a.updated_at AS updatedAt
      FROM kpi_ai_audits a
      JOIN kpi_indicators i ON i.id = a.indicator_id
      WHERE i.topic_id = ?
    `
    const params: unknown[] = [filters.topicId]

    if (filters.fiscalYear) {
      sql += ' AND a.fiscal_year = ?'
      params.push(filters.fiscalYear)
    }
    if (filters.periodKey) {
      sql += ' AND a.period_key = ?'
      params.push(filters.periodKey)
    }
    sql += ' ORDER BY a.indicator_id ASC, a.period_key ASC'

    try {
      const rows = await executor(sql, params)
      return rows.map(r => ({
        id: Number(r.id),
        indicatorId: Number(r.indicatorId),
        fiscalYear: String(r.fiscalYear),
        periodKey: String(r.periodKey),
        ruleCode: String(r.ruleCode),
        status: String(r.status) as KpiAuditStatus,
        humanNumerator: toNullableNumber(r.humanNumerator),
        humanDenominator: toNullableNumber(r.humanDenominator),
        humanResult: toNullableNumber(r.humanResult),
        aiNumerator: toNullableNumber(r.aiNumerator),
        aiDenominator: toNullableNumber(r.aiDenominator),
        aiResult: toNullableNumber(r.aiResult),
        diffNumerator: toNullableNumber(r.diffNumerator),
        diffDenominator: toNullableNumber(r.diffDenominator),
        diffResult: toNullableNumber(r.diffResult),
        thipManualRef: r.thipManualRef ?? null,
        explanationTh: r.explanationTh ?? null,
        diagnostics: parseDiagnosticsJson(r.diagnosticsJson),
        auditedAt: r.auditedAt ? String(r.auditedAt) : null,
        updatedAt: r.updatedAt ? String(r.updatedAt) : null,
      }))
    } catch (err: any) {
      // Cold deploy safety: if kpi_ai_audits table has not been published to yet, return empty array
      if (/doesn't exist|ER_NO_SUCH_TABLE|Unknown table/i.test(String(err?.message || ''))) {
        return []
      }
      throw err
    }
  }

  static attachAuditsToIndicators(
    indicators: KpiIndicatorItem[],
    audits: KpiAiAuditItem[],
    requestedPeriodKey?: string
  ): KpiIndicatorItem[] {
    if (audits.length === 0) {
      return indicators
    }

    const byIndicator = new Map<number, KpiAiAuditItem[]>()
    for (const audit of audits) {
      const arr = byIndicator.get(audit.indicatorId) || []
      arr.push(audit)
      byIndicator.set(audit.indicatorId, arr)
    }

    return indicators.map(ind => {
      const list = byIndicator.get(ind.id) || []
      if (list.length === 0) {
        return { ...ind, aiAudits: [], aiAudit: null }
      }
      const targetPeriod = requestedPeriodKey || ind.currentEntry?.periodKey
      const matched =
        (targetPeriod && list.find(a => matchesPeriodKey(a.periodKey, targetPeriod))) ||
        list[list.length - 1] ||
        null

      return {
        ...ind,
        aiAudits: list,
        aiAudit: matched,
      }
    })
  }
}
