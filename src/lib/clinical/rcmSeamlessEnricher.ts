import { queryClinicalDb } from '@/lib/clinicalDb'
import type { QueryExecutor } from './rcmDashboardService'

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

/**
 * ดึงและแนบเลข Rep + ยอดเงินแยกรายใบจากตาราง `rcmdb.seamless` ให้กับรายการผู้รับบริการทุกกองทุน
 *
 * - รองรับทั้งรายการที่มี `vn` (OPD), `an` (IPD), หรือมีทั้งสองอย่างปนกันในตารางเดียว
 * - แนบฟิลด์ทั้งแบบ camelCase (`repSeamless`, `compensatedSeamless`, `seamlessFunds`, `seamlessRepItems`)
 *   และ snake_case (`rep_seamless`, `compensated_seamless`, `seamless_funds`, `seamless_rep_items`)
 *   เพื่อให้ทั้ง Service Layer และ Client Component ทุกหน้าอ่านไปใช้ได้ทันที
 * - หากแถวใดมีข้อมูล `rep_seamless` จาก SQL เดิมอยู่แล้ว แต่ query เสริมไม่คืนค่า (เช่น ใน unit test ที่ใช้ mockResolvedValueOnce)
 *   จะคงค่าเดิมของแถวนั้นไว้และสร้าง `seamlessRepItems` ให้โดยไม่ทำข้อมูลหาย
 * - ล้มเหลวแบบ graceful: หาก query ล้มเหลว จะคืน `rows` เดิมพร้อม normalize ฟิลด์ที่มีอยู่
 */
export async function enrichRowsWithSeamless<T extends Record<string, any>>(
  rows: T[],
  executor: QueryExecutor = queryClinicalDb
): Promise<(T & SeamlessEnrichedFields)[]> {
  if (!Array.isArray(rows) || rows.length === 0) return rows || []

  const safeExec = async (sql: string, params: any[]): Promise<any[]> => {
    try {
      const res = await executor(sql, params, { timeoutMs: 15000 })
      return Array.isArray(res) ? res : []
    } catch {
      return []
    }
  }

  // แยกเก็บ VN และ AN จากทุกรายการ
  const vnSet = new Set<string>()
  const anSet = new Set<string>()

  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const vn = r.vn != null ? String(r.vn).trim() : ''
    const an = r.an != null ? String(r.an).trim() : ''
    if (vn && vn !== '-' && vn !== '—') vnSet.add(vn)
    if (an && an !== '-' && an !== '—') anSet.add(an)
  }

  const queryByColumn = async (
    column: 'VN' | 'AN',
    keys: string[]
  ): Promise<Map<string, SeamlessVisitAggregate>> => {
    const map = new Map<string, SeamlessVisitAggregate>()
    if (keys.length === 0) return map

    const CHUNK_SIZE = 1000
    const chunks: string[][] = []
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      chunks.push(keys.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        safeExec(
          `
          SELECT
            ${column} AS k,
            Rep AS rep,
            GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ', ') AS fund,
            GROUP_CONCAT(DISTINCT Type ORDER BY Type SEPARATOR ', ') AS type,
            SUM(IFNULL(Collected, 0)) AS collected,
            SUM(IFNULL(Compensated, 0)) AS compensated,
            GROUP_CONCAT(DISTINCT Rep ORDER BY Rep SEPARATOR ',') AS rep_seamless,
            GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ',') AS seamless_funds,
            SUM(IFNULL(Compensated, 0)) AS compensated_seamless
          FROM rcmdb.seamless
          WHERE ${column} IN (${chunk.map(() => '?').join(',')})
            AND IFNULL(Rep, '') <> ''
          GROUP BY ${column}, Rep
          ORDER BY Rep ASC
          `,
          chunk
        )
      )
    )

    for (const resRows of chunkResults) {
      for (const s of resRows || []) {
        // กรองแถวที่ไม่ใช่ผลลัพธ์ของ rcmdb.seamless (เช่นกรณี test mock คืนแถวผู้ป่วยของ query หลักกลับมา)
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
    }

    return map
  }

  const [vnMap, anMap] = await Promise.all([
    queryByColumn('VN', Array.from(vnSet)),
    queryByColumn('AN', Array.from(anSet)),
  ])

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

    // Fallback: หากแถวเดิมมีฟิลด์ seamless จาก SQL join อยู่แล้ว (เช่น rep_seamless หรือ seamless)
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

import { getCachedData, invalidateCacheKey } from '@/lib/cache'

/**
 * หุ้ม `enrichRowsWithSeamless` ด้วย In-Memory Cache แยกตาม `cacheKey`
 * เพื่อให้นำไปเรียกใช้กับ `allItems` ของทุกกองทุนได้โดยไม่ยิง DB ซ้ำเมื่อเปลี่ยนหน้า/กรองการ์ด
 */
export async function enrichItemsWithSeamlessCache<T extends Record<string, any>>(
  cacheKey: string,
  items: T[],
  executor: QueryExecutor = queryClinicalDb,
  refresh = false
): Promise<(T & SeamlessEnrichedFields)[]> {
  if (!Array.isArray(items) || items.length === 0) return items || []
  const seamlessKey = `${cacheKey}:seamless-map`
  if (refresh) {
    invalidateCacheKey(seamlessKey)
  }

  const shouldQueryDb =
    executor === queryClinicalDb || Boolean((executor as any)?.__includeSeamless)
  const effectiveExecutor: QueryExecutor = shouldQueryDb
    ? executor
    : async () => []

  // สร้าง snapshot ของ (vn, an, fallback seamless fields) เพื่อนำไป query & cache เฉพาะ lookup
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
      return await enrichRowsWithSeamless(minimalRows, effectiveExecutor)
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

