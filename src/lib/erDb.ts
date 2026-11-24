import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'

export interface ErPatientRow {
  hn?: string | null
  vn?: string | null
  ptname?: string | null
  age?: number | null
  bedno?: string | null
  enter_time?: string | null
  er_list?: string | null
  er_emergency_level_name?: string | null
  er_emergency_level_id?: number | string | null
  observe?: string | null
  dch_type_name?: string | null
  wardname?: string | null
  hosname?: string | null
  [key: string]: unknown
}

export interface ErLiveStatusRawData {
  activePatients: ErPatientRow[]
  errorStatusList: {
    total: number
    list: Record<string, unknown>[]
  }
  summary: {
    totalActive: number
    critical: number
    emergency: number
    urgency: number
    semiUrgency: number
    nonUrgency: number
  }
  stats: {
    ptTypes: Record<string, unknown>[]
    emergencyLevels: Record<string, unknown>[]
    dischargeTypes: Record<string, unknown>[]
  }
}

export type ErLiveDashboardFetcher = () => Promise<ErLiveStatusRawData>

const defaultErFetcher: ErLiveDashboardFetcher = async () => {
  const data = await apiGateway.clinical.getErLiveDashboard()
  return {
    activePatients: (data?.activePatients || []) as ErPatientRow[],
    errorStatusList: data?.errorStatusList || { total: 0, list: [] },
    summary: data?.summary || {
      totalActive: 0,
      critical: 0,
      emergency: 0,
      urgency: 0,
      semiUrgency: 0,
      nonUrgency: 0,
    },
    stats: data?.stats || { ptTypes: [], emergencyLevels: [], dischargeTypes: [] },
  }
}

/**
 * Fetch live Emergency Room (ER) triage status from HOSxP via Gateway Named API with mandatory 8s TTL cache.
 * Zero-SQL in Next.js.
 */
export async function fetchErLiveStatusData(
  fetcher: ErLiveDashboardFetcher = defaultErFetcher
): Promise<ErLiveStatusRawData> {
  return getCachedData('er-live-status-data', () => fetcher(), 8000)
}

/**
 * Apply role-based and TV-mode PDPA PHI masking to ER status data.
 */
export function formatErStatusForViewer(
  erData: ErLiveStatusRawData,
  options: { isStaff: boolean; isTvMode: boolean }
) {
  const { isStaff, isTvMode } = options
  const activePatients =
    isStaff || isTvMode
      ? erData.activePatients.map((p) => {
          if (isStaff) return p
          const nameParts = String(p.ptname || '')
            .trim()
            .split(/\s+/)
          const maskedName =
            nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : p.ptname
          return {
            ...p,
            hn: p.hn ? `xxxx${String(p.hn).slice(-4)}` : '',
            vn: p.vn ? `xxxx${String(p.vn).slice(-4)}` : '',
            ptname: maskedName,
          }
        })
      : []

  return {
    activePatients,
    errorStatusList: isStaff
      ? erData.errorStatusList
      : { total: erData.errorStatusList?.total || 0, list: [] },
    summary: erData.summary,
    stats: erData.stats,
  }
}
