import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { matchesPeriodKey } from './kpiTimeUtils'
import type { KpiIndicatorItem } from './kpiService'

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

export interface KpiAuditGatewayAdapter {
  ensureKpiAuditsTableV2: typeof apiGateway.app.ensureKpiAuditsTableV2
  upsertKpiAuditBatchV2: typeof apiGateway.app.upsertKpiAuditBatchV2
  getKpiAuditsByTopicV2: typeof apiGateway.app.getKpiAuditsByTopicV2
}

const defaultKpiAuditGateway: KpiAuditGatewayAdapter = {
  ensureKpiAuditsTableV2: () => apiGateway.app.ensureKpiAuditsTableV2(),
  upsertKpiAuditBatchV2: (body) => apiGateway.app.upsertKpiAuditBatchV2(body),
  getKpiAuditsByTopicV2: (params) => apiGateway.app.getKpiAuditsByTopicV2(params),
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
  static async ensureTable(gateway: Partial<KpiAuditGatewayAdapter> = {}): Promise<void> {
    const gw: KpiAuditGatewayAdapter = { ...defaultKpiAuditGateway, ...gateway }
    await gw.ensureKpiAuditsTableV2()
  }

  static async upsertAuditBatch(
    input: UpsertKpiAuditBatchInput,
    gateway: Partial<KpiAuditGatewayAdapter> = {}
  ): Promise<{ savedCount: number; skippedCount: number }> {
    const gw: KpiAuditGatewayAdapter = { ...defaultKpiAuditGateway, ...gateway }

    // Enforce zero-PHI guard at boundary BEFORE transmitting over network
    const serializedItems = input.items.map((item) => {
      const diag = item.diagnostics || {}
      assertNoPhiInValue(diag, `items[${item.ruleCode}].diagnostics`)
      assertNoPhiInValue(item.explanationTh, `items[${item.ruleCode}].explanationTh`)
      const diagJson = Object.keys(diag).length > 0 ? JSON.stringify(diag) : null

      return {
        indicatorId: item.indicatorId,
        ruleCode: item.ruleCode,
        status: item.status,
        humanNumerator: item.humanNumerator ?? null,
        humanDenominator: item.humanDenominator ?? null,
        humanResult: item.humanResult ?? null,
        aiNumerator: item.aiNumerator ?? null,
        aiDenominator: item.aiDenominator ?? null,
        aiResult: item.aiResult ?? null,
        diffNumerator: item.diffNumerator ?? null,
        diffDenominator: item.diffDenominator ?? null,
        diffResult: item.diffResult ?? null,
        thipManualRef: item.thipManualRef ?? null,
        explanationTh: item.explanationTh ?? null,
        diagJson,
      }
    })

    const auditedAtSql = normalizeAuditDateTime(input.auditedAt)
    const { savedCount, skippedCount } = await gw.upsertKpiAuditBatchV2({
      fiscalYear: input.fiscalYear,
      periodKey: input.periodKey,
      auditedAtSql,
      items: serializedItems,
    })

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
    gateway: Partial<KpiAuditGatewayAdapter> = {}
  ): Promise<KpiAiAuditItem[]> {
    const gw: KpiAuditGatewayAdapter = { ...defaultKpiAuditGateway, ...gateway }

    try {
      const rows = await gw.getKpiAuditsByTopicV2({
        topicId: filters.topicId,
        fiscalYear: filters.fiscalYear,
        periodKey: filters.periodKey,
      })
      return (rows || []).map((r: Record<string, unknown>) => ({
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
        thipManualRef: (r.thipManualRef as string | null) ?? null,
        explanationTh: (r.explanationTh as string | null) ?? null,
        diagnostics: parseDiagnosticsJson(r.diagnosticsJson),
        auditedAt: r.auditedAt ? String(r.auditedAt) : null,
        updatedAt: r.updatedAt ? String(r.updatedAt) : null,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err || '')
      if (/doesn't exist|ER_NO_SUCH_TABLE|Unknown table/i.test(msg)) {
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

    return indicators.map((ind) => {
      const list = byIndicator.get(ind.id) || []
      if (list.length === 0) {
        return { ...ind, aiAudits: [], aiAudit: null }
      }
      const targetPeriod = requestedPeriodKey || ind.currentEntry?.periodKey
      const matched =
        (targetPeriod && list.find((a) => matchesPeriodKey(a.periodKey, targetPeriod))) ||
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
