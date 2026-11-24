import { apiGateway } from '@/lib/apiGateway'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'

export interface SeamlessRepBreakdown {
  rep: string
  fund: string | null
  type: string | null
  collected: number
  compensated: number
}

export interface SeamlessEnrichedFields {
  /** Seamless (DMIS) Reps จาก rcmdb.seamless จับคู่ด้วย VN (OPD) / AN (IPD) คั่นด้วย comma */
  repSeamless?: string | null
  rep_seamless?: string | null
  /** ยอดชดเชยจาก Seamless — แยกจาก compensated (e-Claim) เพื่อไม่ให้นับซ้ำ */
  compensatedSeamless?: number
  compensated_seamless?: number
  /** ชื่อกองทุน Seamless (Fund) คั่นด้วย comma */
  seamlessFunds?: string | null
  seamless_funds?: string | null
  /** รายละเอียดยอดเงินแยกรายใบ Rep ของ Seamless */
  seamlessRepItems?: SeamlessRepBreakdown[]
  seamless_rep_items?: SeamlessRepBreakdown[]
}

export type SeamlessEnricherFetcher = ((payload: {
  vns: string[]
  ans: string[]
}) => Promise<{
  vnRows: Array<Record<string, any>>
  anRows: Array<Record<string, any>>
}>) & { __includeSeamless?: boolean }

const defaultSeamlessFetcher: SeamlessEnricherFetcher = Object.assign(
  async (payload: { vns: string[]; ans: string[] }) => {
    const res = await apiGateway.clinical.enrichSeamlessVisits(payload)
    return {
      vnRows: Array.isArray(res?.vnRows) ? res.vnRows : [],
      anRows: Array.isArray(res?.anRows) ? res.anRows : [],
    }
  },
  { __includeSeamless: true }
)

interface SeamlessVisitAggregate {
  reps: Set<string>
  funds: Set<string>
  totalCompensated: number
  items: SeamlessRepBreakdown[]
}

/**
 * แยกเลข Rep ที่ได้จาก GROUP_CONCAT หรือ comma-separated string
 */
export function splitSeamlessReps(value?: string | null): string[] {
  if (!value) return []
  return Array.from(
    new Set(
      String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
}

/**
 * ตรวจสอบว่าคำค้นหา (search) ตรงกับเลข Rep ของ Seamless หรือไม่
 */
export function matchesSeamlessRepSearch(row: any, searchLower: string): boolean {
  if (!searchLower || !row) return false
  const repSeamless = row.repSeamless ?? row.rep_seamless ?? row.seamless ?? null
  if (repSeamless && String(repSeamless).toLowerCase().includes(searchLower)) {
    return true
  }
  const funds = row.seamlessFunds ?? row.seamless_funds ?? null
  if (funds && String(funds).toLowerCase().includes(searchLower)) {
    return true
  }
  return false
}

function buildAggregateMap(resRows: Array<Record<string, any>>): Map<string, SeamlessVisitAggregate> {
  const map = new Map<string, SeamlessVisitAggregate>()
  for (const s of resRows || []) {
    if (!s || typeof s !== 'object' || s.k == null) continue
    if (!('rep' in s) && !('rep_seamless' in s)) continue

    const key = String(s.k).trim()
    if (!key) continue

    let entry = map.get(key)
    if (!entry) {
      entry = { reps: new Set(), funds: new Set(), totalCompensated: 0, items: [] }
      map.set(key, entry)
    }

    if (s.rep) {
      const repCode = String(s.rep).trim()
      if (!repCode) continue
      const compVal = Number(s.compensated ?? s.compensated_seamless ?? 0)
      const collVal = Number(s.collected ?? 0)
      const fundVal = s.fund
        ? String(s.fund).trim()
        : s.seamless_funds
          ? String(s.seamless_funds).trim()
          : null
      const typeVal = s.type ? String(s.type).trim() : null

      entry.reps.add(repCode)
      if (fundVal) {
        for (const f of fundVal.split(',').map((x: string) => x.trim()).filter(Boolean)) {
          entry.funds.add(f)
        }
      }
      entry.totalCompensated = Math.round((entry.totalCompensated + compVal) * 100) / 100
      entry.items.push({
        rep: repCode,
        fund: fundVal,
        type: typeVal,
        collected: Math.round(collVal * 100) / 100,
        compensated: Math.round(compVal * 100) / 100,
      })
    } else if (s.rep_seamless) {
      const repList = splitSeamlessReps(String(s.rep_seamless))
      if (repList.length === 0) continue
      const compVal = Number(s.compensated_seamless ?? s.compensated ?? 0)
      const fundVal = s.seamless_funds ? String(s.seamless_funds).trim() : null

      for (const rCode of repList) entry.reps.add(rCode)
      if (fundVal) {
        for (const f of fundVal.split(',').map((x: string) => x.trim()).filter(Boolean)) {
          entry.funds.add(f)
        }
      }
      entry.totalCompensated = Math.round((entry.totalCompensated + compVal) * 100) / 100
      for (let i = 0; i < repList.length; i++) {
        entry.items.push({
          rep: repList[i],
          fund: fundVal,
          type: null,
          collected: 0,
          compensated: repList.length === 1 ? Math.round(compVal * 100) / 100 : 0,
        })
      }
    }
  }
  return map
}

/**
 * ดึงและแนบเลข Rep + ยอดเงินแยกรายใบจากตาราง `rcmdb.seamless` ผ่าน API Gateway Named Endpoint
 * (Zero-SQL in Next.js)
 */
export async function enrichRowsWithSeamless<T extends Record<string, any>>(
  rows: T[],
  fetcher: SeamlessEnricherFetcher | unknown = defaultSeamlessFetcher
): Promise<(T & SeamlessEnrichedFields)[]> {
  if (!Array.isArray(rows) || rows.length === 0) return rows || []

  const vnSet = new Set<string>()
  const anSet = new Set<string>()

  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const vn = r.vn != null ? String(r.vn).trim() : ''
    const an = r.an != null ? String(r.an).trim() : ''
    if (vn && vn !== '-' && vn !== '—') vnSet.add(vn)
    if (an && an !== '-' && an !== '—') anSet.add(an)
  }

  let vnRows: Array<Record<string, any>> = []
  let anRows: Array<Record<string, any>> = []

  if (vnSet.size > 0 || anSet.size > 0) {
    const activeFetcher =
      typeof fetcher === 'function' ? (fetcher as SeamlessEnricherFetcher) : defaultSeamlessFetcher
    try {
      const res = await activeFetcher({
        vns: Array.from(vnSet),
        ans: Array.from(anSet),
      })
      if (res && typeof res === 'object') {
        vnRows = Array.isArray((res as any).vnRows) ? (res as any).vnRows : []
        anRows = Array.isArray((res as any).anRows) ? (res as any).anRows : []
      }
    } catch {
      vnRows = []
      anRows = []
    }
  }

  const vnMap = buildAggregateMap(vnRows)
  const anMap = buildAggregateMap(anRows)

  return rows.map((row: T) => {
    if (!row || typeof row !== 'object') return row

    const vn = row.vn != null ? String(row.vn).trim() : ''
    const an = row.an != null ? String(row.an).trim() : ''

    const matched = (vn && vnMap.get(vn)) || (an && anMap.get(an)) || null

    if (matched && matched.reps.size > 0) {
      const repSeamlessStr = Array.from(matched.reps).join(',')
      const fundsStr = matched.funds.size > 0 ? Array.from(matched.funds).join(', ') : null
      const compVal = matched.totalCompensated
      const items = matched.items

      return {
        ...row,
        repSeamless: repSeamlessStr,
        rep_seamless: repSeamlessStr,
        seamlessFunds: fundsStr,
        seamless_funds: fundsStr,
        compensatedSeamless: compVal,
        compensated_seamless: compVal,
        seamlessRepItems: items,
        seamless_rep_items: items,
      }
    }

    const existingRepRaw =
      row.repSeamless ??
      row.rep_seamless ??
      (typeof row.seamless === 'string' && row.seamless !== 'Y' && row.seamless !== 'N'
        ? row.seamless
        : null)
    const existingReps = splitSeamlessReps(existingRepRaw)
    const existingComp = Number(
      row.compensatedSeamless ?? row.compensated_seamless ?? row.seamless_compensated ?? 0
    )
    const existingFund =
      row.seamlessFunds ?? row.seamless_funds ?? row.fund_seamless ?? row.seamless_type ?? null
    const existingItems: SeamlessRepBreakdown[] = Array.isArray(row.seamlessRepItems)
      ? row.seamlessRepItems
      : Array.isArray(row.seamless_rep_items)
        ? row.seamless_rep_items
        : existingReps.map((rCode) => ({
            rep: rCode,
            fund: existingFund ? String(existingFund) : null,
            type: row.seamless_type ? String(row.seamless_type) : null,
            collected: 0,
            compensated: existingReps.length === 1 ? existingComp : 0,
          }))

    const normalizedRep = existingReps.length > 0 ? existingReps.join(',') : null

    return {
      ...row,
      repSeamless: normalizedRep,
      rep_seamless: normalizedRep,
      seamlessFunds: existingFund ? String(existingFund) : null,
      seamless_funds: existingFund ? String(existingFund) : null,
      compensatedSeamless: existingComp,
      compensated_seamless: existingComp,
      seamlessRepItems: existingItems,
      seamless_rep_items: existingItems,
    }
  })
}

/**
 * หุ้ม `enrichRowsWithSeamless` ด้วย In-Memory Cache แยกตาม `cacheKey`
 * เมื่อไม่ส่ง fetcher (หรือส่ง fetcher ที่มี __includeSeamless) จะเรียก API Gateway จริง
 * หาก unit test ของบริการอื่นส่ง mock ที่ไม่ตั้ง __includeSeamless จะคืนค่าเดิมแบบ offline เพื่อไม่ให้กระทบ test เดิม
 */
export async function enrichItemsWithSeamlessCache<T extends Record<string, any>>(
  cacheKey: string,
  items: T[],
  fetcher: SeamlessEnricherFetcher | unknown = defaultSeamlessFetcher,
  refresh = false
): Promise<(T & SeamlessEnrichedFields)[]> {
  if (!Array.isArray(items) || items.length === 0) return items || []
  const seamlessKey = `${cacheKey}:seamless-map`
  if (refresh) {
    invalidateCacheKey(seamlessKey)
  }

  const isDefaultCall = fetcher === undefined || fetcher === defaultSeamlessFetcher
  const hasExplicitSeamlessFlag = Boolean((fetcher as any)?.__includeSeamless)
  const effectiveFetcher: SeamlessEnricherFetcher =
    isDefaultCall
      ? defaultSeamlessFetcher
      : hasExplicitSeamlessFlag && typeof fetcher === 'function'
        ? (fetcher as SeamlessEnricherFetcher)
        : async () => ({ vnRows: [], anRows: [] })

  const enrichedSnapshot = await getCachedData(
    seamlessKey,
    async () => {
      const minimalRows = items.map((r) => ({
        vn: r.vn ?? null,
        an: r.an ?? null,
        repSeamless: r.repSeamless ?? null,
        rep_seamless: r.rep_seamless ?? null,
        seamless: r.seamless ?? null,
        compensatedSeamless: r.compensatedSeamless ?? null,
        compensated_seamless: r.compensated_seamless ?? null,
        seamless_compensated: r.seamless_compensated ?? null,
        seamlessFunds: r.seamlessFunds ?? null,
        seamless_funds: r.seamless_funds ?? null,
        fund_seamless: r.fund_seamless ?? null,
        seamless_type: r.seamless_type ?? null,
        seamlessRepItems: r.seamlessRepItems ?? null,
        seamless_rep_items: r.seamless_rep_items ?? null,
      }))
      return await enrichRowsWithSeamless(minimalRows, effectiveFetcher)
    },
    300000
  )

  return items.map((item, idx) => {
    const snap = enrichedSnapshot[idx]
    if (!snap) return item
    return {
      ...item,
      repSeamless: snap.repSeamless ?? null,
      rep_seamless: snap.rep_seamless ?? null,
      seamlessFunds: snap.seamlessFunds ?? null,
      seamless_funds: snap.seamless_funds ?? null,
      compensatedSeamless: snap.compensatedSeamless ?? 0,
      compensated_seamless: snap.compensated_seamless ?? 0,
      seamlessRepItems: snap.seamlessRepItems ?? [],
      seamless_rep_items: snap.seamless_rep_items ?? [],
    }
  })
}
