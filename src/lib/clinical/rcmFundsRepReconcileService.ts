import { apiGateway } from '@/lib/apiGateway'
import { getSwrCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange } from './rcmDashboardService'
import {
  classifyStatementFund,
  extractRepPrefixCode,
  formatRepTypeLabel,
  getFundDefinition,
  RCM_FUND_CATALOG,
} from './funds-reconcile/fundCatalog'
import type {
  RepReconcileQueryParams,
  RepReconcileResult,
  RepSourceKind,
  VnReconcileDetails,
} from './funds-reconcile/types'

export * from './funds-reconcile/types'
export {
  RCM_FUND_CATALOG,
  classifyStatementFund,
  extractRepPrefixCode,
  formatRepTypeLabel,
  getFundDefinition,
} from './funds-reconcile/fundCatalog'

const VALID_SOURCES = new Set<RepSourceKind>(['repdata', 'repeclaim', 'seamless'])

/**
 * Injectable Gateway adapter for zero-SQL Next.js architecture and 100% offline Vitest unit testing.
 */
export interface FundsReconcileGatewayAdapter {
  getReconcileReport: (
    params: {
      ds1?: string
      ds2?: string
      funds?: string
      focusFundId?: string
      sources?: string
      repPrefixes?: string
      department?: string
      status?: string
      includePendingRep?: boolean
      search?: string
      sortBy?: string
      sortOrder?: string
      page?: number
      pageSize?: number
      exportAll?: boolean
      refresh?: boolean
    }
  ) => Promise<RepReconcileResult>
  getVnReconcileDetails: (visitKey: string) => Promise<VnReconcileDetails | null>
}

const defaultGatewayAdapter: FundsReconcileGatewayAdapter = {
  getReconcileReport: async (params) => apiGateway.clinical.getRcmFundsRepReconcile(params),
  getVnReconcileDetails: async (visitKey) => apiGateway.clinical.getRcmFundsRepReconcileVnDetails(visitKey),
}

function normalizeCacheSegment(values?: string[]): string {
  if (!values || values.length === 0) return ''
  return [...values].map((v) => v.trim()).filter(Boolean).sort().join(',')
}

/**
 * Unified RCM Funds REP Reconciliation Service (3 Active Sources via API Gateway: repdata, repeclaim, seamless).
 * Zero SQL in Next.js — delegates aggregation, enrichment, and caching to API Gateway (/api/v1/clinical/rcm/funds-rep-reconcile).
 */
export class RcmFundsRepReconcileService {
  /**
   * Fetches reconciled fund cards, REP type breakdown, and paginated statement lines via API Gateway.
   */
  static async getReconcileReport(
    params: RepReconcileQueryParams = {},
    gateway: FundsReconcileGatewayAdapter = defaultGatewayAdapter
  ): Promise<RepReconcileResult> {
    const range = resolveFiscalDateRange({ ds1: params.ds1, ds2: params.ds2 })
    const includePendingRep = Boolean(params.includePendingRep)
    const forceRefresh = Boolean(params.refresh)
    const exportAll = Boolean(params.exportAll)
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const sortBy = params.sortBy || 'admdate'
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc'

    const fundsCsv = normalizeCacheSegment(params.fundIds)
    const sourcesCsv = normalizeCacheSegment(
      (params.sources || []).filter((s): s is RepSourceKind => VALID_SOURCES.has(s))
    )
    const repPrefixesCsv = normalizeCacheSegment(
      (params.repPrefixes || []).map((p) => p.toUpperCase())
    )

    const gatewayParams = {
      ds1: range.startDate,
      ds2: range.endDate,
      ...(fundsCsv ? { funds: fundsCsv } : {}),
      ...(params.focusFundId?.trim() ? { focusFundId: params.focusFundId.trim() } : {}),
      ...(sourcesCsv ? { sources: sourcesCsv } : {}),
      ...(repPrefixesCsv ? { repPrefixes: repPrefixesCsv } : {}),
      ...(params.department && params.department !== 'ALL' ? { department: params.department } : {}),
      ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
      ...(includePendingRep ? { includePendingRep: true } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      sortBy,
      sortOrder,
      page,
      pageSize,
      ...(exportAll ? { exportAll: true } : {}),
      ...(forceRefresh ? { refresh: true } : {}),
    }

    if (exportAll) {
      return gateway.getReconcileReport(gatewayParams)
    }

    const cacheKey = [
      'rcm-funds-rep-reconcile-v2',
      range.startDate,
      range.endDate,
      fundsCsv,
      params.focusFundId?.trim() || '',
      sourcesCsv,
      repPrefixesCsv,
      params.department || 'ALL',
      params.status || 'ALL',
      includePendingRep ? '1' : '0',
      params.search?.trim() || '',
      sortBy,
      sortOrder,
      page,
      pageSize,
    ].join(':')

    if (forceRefresh) {
      invalidateCacheKey(cacheKey)
    }

    return getSwrCachedData<RepReconcileResult>(
      cacheKey,
      () => gateway.getReconcileReport(gatewayParams),
      { staleTtlMs: 3 * 60_000, maxTtlMs: 20 * 60_000, forceRefresh }
    )
  }

  /**
   * Lazy Detail Modal loader for a single VN or AN via API Gateway.
   */
  static async getVnReconcileDetails(
    visitKey: string,
    gateway: FundsReconcileGatewayAdapter = defaultGatewayAdapter
  ): Promise<VnReconcileDetails | null> {
    const cleanKey = visitKey?.trim()
    if (!cleanKey) return null

    const cacheKey = `rcm-funds-rep-reconcile-vn:${cleanKey}`
    return getSwrCachedData<VnReconcileDetails | null>(
      cacheKey,
      () => gateway.getVnReconcileDetails(cleanKey),
      { staleTtlMs: 3 * 60_000, maxTtlMs: 20 * 60_000 }
    )
  }
}
