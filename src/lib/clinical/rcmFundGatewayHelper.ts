import { apiGateway } from '@/lib/apiGateway'
import type { SeamlessEnricherFetcher } from './rcmSeamlessEnricher'

export interface RcmAdpMappingItem {
  icode: string
  name: string
  strength: string | null
  nhso_adp_code: string
}

export interface RcmAdpMappingResult {
  adpCode: string
  isMapped: boolean
  mappedCount: number
  items: RcmAdpMappingItem[]
}

export interface RcmFundGatewayAdapter {
  getAdpMapping: (
    adpCode: string,
    options?: { includeNonDrug?: boolean; refresh?: boolean }
  ) => Promise<{
    success?: boolean
    adpCode?: string
    isMapped: boolean
    mappedCount: number
    items: Array<Record<string, any>>
  }>
  getRcmFundData: (
    fundKey: string,
    params?: {
      startDate?: string
      endDate?: string
      ds1?: string
      ds2?: string
      adpCode?: string
      patientType?: 'OPD' | 'IPD'
      serviceType?: string
      [key: string]: unknown
    }
  ) => Promise<{
    success?: boolean
    fundKey?: string
    data?: { rawRows?: Array<Record<string, any>>; adpMapping?: any }
    rawRows?: Array<Record<string, any>>
  }>
}

export const defaultRcmFundGateway: RcmFundGatewayAdapter = {
  getAdpMapping: (adpCode, options) => apiGateway.clinical.getAdpMapping(adpCode, options),
  getRcmFundData: (fundKey, params) => apiGateway.clinical.getRcmFundData(fundKey, params),
}

export const offlineNoopSeamlessFetcher: SeamlessEnricherFetcher = async () => ({
  vnRows: [],
  anRows: [],
})

/**
 * Resolve the Seamless enricher fetcher: use default Gateway enricher in production,
 * or offline no-op when a custom mock gateway adapter is injected in unit tests.
 */
export function resolveSeamlessFetcher(
  gateway: unknown,
  defaultGateway: unknown = defaultRcmFundGateway
): SeamlessEnricherFetcher | undefined {
  return gateway === defaultGateway ? undefined : offlineNoopSeamlessFetcher
}

/**
 * Standard Zero-SQL NHSO ADP mapping check via API Gateway.
 */
export async function fetchAdpMappingViaGateway(
  adpCode: string,
  gateway: RcmFundGatewayAdapter = defaultRcmFundGateway,
  options?: { includeNonDrug?: boolean; refresh?: boolean }
): Promise<RcmAdpMappingResult> {
  try {
    const gwRes = await gateway.getAdpMapping(adpCode, options)
    if (gwRes && typeof gwRes.isMapped === 'boolean') {
      const items: RcmAdpMappingItem[] = (gwRes.items || []).map((r: any) => ({
        icode: String(r.icode || '').trim(),
        name: String(r.name || '').trim(),
        strength: r.strength ? String(r.strength).trim() : null,
        nhso_adp_code: String(r.nhso_adp_code || '').trim(),
      }))
      return {
        adpCode: gwRes.adpCode || adpCode,
        isMapped: gwRes.isMapped,
        mappedCount: gwRes.mappedCount ?? items.length,
        items,
      }
    }
  } catch {
    // Graceful empty mapping fallback on Gateway error
  }
  return {
    adpCode,
    isMapped: false,
    mappedCount: 0,
    items: [],
  }
}

/**
 * Extract rawRows array from Gateway `getRcmFundData` response consistently.
 */
export function extractFundRawRows<T = Record<string, any>>(gwRes: any): T[] {
  if (Array.isArray(gwRes?.data?.rawRows)) return gwRes.data.rawRows as T[]
  if (Array.isArray(gwRes?.rawRows)) return gwRes.rawRows as T[]
  if (Array.isArray(gwRes)) return gwRes as T[]
  return []
}
