import {
  splitSeamlessReps,
  type SeamlessRepBreakdown,
} from './rcmSeamlessEnricher'

export const NO_REP_FILTER_VALUE = '__NO_REP__'

export type RepSourceType = 'eclaim' | 'seamless'

export interface RepRowLike {
  vn?: string | null
  an?: string | null
  rep?: string | null
  rep_nhso?: string | null
  rep_rep?: string | null
  rep_eclaim?: string | null
  compensated?: number | null
  money_invoice?: number | null
  money_rep?: number | null
  compensated_nhso?: number | null
  compensated_rep?: number | null
  compensated_eclaim?: number | null
  fund?: string | null
  repSeamless?: string | null
  rep_seamless?: string | null
  seamless?: string | null
  compensatedSeamless?: number | null
  compensated_seamless?: number | null
  seamless_compensated?: number | null
  seamlessFunds?: string | null
  seamless_funds?: string | null
  fund_seamless?: string | null
  seamless_type?: string | null
  seamlessRepItems?: Array<{
    rep: string
    fund: string | null
    type: string | null
    collected: number
    compensated: number
  }> | null
  seamless_rep_items?: Array<{
    rep: string
    fund: string | null
    type: string | null
    collected: number
    compensated: number
  }> | null
}

export interface RepTagEntry {
  rep: string
  source: RepSourceType
  tag: string
  prefix: string | null
  fund: string | null
  visitCount: number
  compensated: number
}

export interface RepTagGroupSummary {
  groupKey: string
  label: string
  source: RepSourceType | 'none'
  prefix: string | null
  repCount: number
  visitCount: number
  compensated: number
  reps: string[]
}

export interface RepBreakdownSummary {
  totalVisits: number
  withAnyRepCount: number
  withEclaimRepCount: number
  withSeamlessRepCount: number
  withMultipleRepsCount: number
  withoutRepCount: number
  totalEclaimCompensated: number
  totalSeamlessCompensated: number
  tagGroups: RepTagGroupSummary[]
  repItems: RepTagEntry[]
}

export function splitPrimaryReps(value?: string | null): string[] {
  return splitSeamlessReps(value)
}

export function extractRepPrefix(rep: string): string | null {
  const match = String(rep || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{2,8})\d/)
  return match ? match[1] : null
}

export function parseRepFilterParam(reps?: string | string[] | null): string[] {
  if (!reps) return []
  const rawList = Array.isArray(reps) ? reps : String(reps).split(',')
  return Array.from(new Set(rawList.map((s) => s.trim()).filter(Boolean)))
}

export function getRowPrimaryReps(row: RepRowLike): string[] {
  const combined = [row?.rep, row?.rep_nhso, row?.rep_rep, row?.rep_eclaim]
    .filter(Boolean)
    .join(',')
  return splitPrimaryReps(combined)
}

function getRowPrimaryCompensated(row: RepRowLike): number {
  if (!row) return 0
  return (
    Number(
      row.compensated ??
        row.money_invoice ??
        row.money_rep ??
        row.compensated_nhso ??
        row.compensated_rep ??
        row.compensated_eclaim ??
        0
    ) || 0
  )
}

function getRowSeamlessCompensated(row: RepRowLike): number {
  if (!row) return 0
  return Number(row.compensatedSeamless ?? row.compensated_seamless ?? row.seamless_compensated ?? 0) || 0
}

function getRowSeamlessFunds(row: RepRowLike): string | null {
  if (!row) return null
  const val = row.seamlessFunds ?? row.seamless_funds ?? row.fund_seamless ?? null
  return val ? String(val).trim() || null : null
}

function getRowSeamlessRepString(row: RepRowLike): string | null {
  if (!row) return null
  const val =
    row.repSeamless ??
    row.rep_seamless ??
    (typeof row.seamless === 'string' && row.seamless !== 'Y' && row.seamless !== 'N'
      ? row.seamless
      : null)
  return val ? String(val).trim() || null : null
}

export function getRowSeamlessEntries(row: RepRowLike): SeamlessRepBreakdown[] {
  if (!row) return []
  if (Array.isArray(row.seamlessRepItems) && row.seamlessRepItems.length > 0) {
    return row.seamlessRepItems
  }
  if (Array.isArray(row.seamless_rep_items) && row.seamless_rep_items.length > 0) {
    return row.seamless_rep_items
  }
  const reps = splitSeamlessReps(getRowSeamlessRepString(row))
  const comp = getRowSeamlessCompensated(row)
  const funds = getRowSeamlessFunds(row)
  return reps.map((rep, _idx, arr) => ({
    rep,
    fund: funds,
    type: row.seamless_type ? String(row.seamless_type) : null,
    collected: 0,
    compensated: arr.length === 1 ? comp : 0,
  }))
}

export function getRowAllRepStrings(row: RepRowLike): string[] {
  const primary = getRowPrimaryReps(row)
  const seamless = getRowSeamlessEntries(row).map((s) => s.rep)
  return Array.from(new Set([...primary, ...seamless]))
}

export function rowHasAnyRep(row: RepRowLike): boolean {
  return getRowAllRepStrings(row).length > 0
}

export function matchesRepFilter(row: RepRowLike, selectedReps: readonly string[]): boolean {
  if (!selectedReps || selectedReps.length === 0) return true

  const normalizedSelected = new Set(
    selectedReps.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
  )
  const rowReps = getRowAllRepStrings(row)

  if (normalizedSelected.has(NO_REP_FILTER_VALUE) && rowReps.length === 0) {
    return true
  }

  return rowReps.some((rep) => normalizedSelected.has(rep.toUpperCase()))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function buildRepBreakdownSummary(rows: readonly RepRowLike[]): RepBreakdownSummary {
  const safeRows = Array.isArray(rows) ? rows : []

  let withAnyRepCount = 0
  let withEclaimRepCount = 0
  let withSeamlessRepCount = 0
  let withMultipleRepsCount = 0
  let withoutRepCount = 0
  let totalEclaimCompensated = 0
  let totalSeamlessCompensated = 0

  const repMap = new Map<
    string,
    {
      rep: string
      source: RepSourceType
      tag: string
      prefix: string | null
      fund: string | null
      visitCount: number
      compensated: number
    }
  >()

  const groupMap = new Map<
    string,
    {
      groupKey: string
      label: string
      source: RepSourceType | 'none'
      prefix: string | null
      reps: Set<string>
      visitCount: number
      compensated: number
    }
  >()

  for (const row of safeRows) {
    if (!row || typeof row !== 'object') continue

    const rawPrimaryReps = getRowPrimaryReps(row)
    const seamlessItems = getRowSeamlessEntries(row)
    const seamlessRepUpperSet = new Set(
      seamlessItems.map((s) => String(s.rep || '').trim().toUpperCase()).filter(Boolean)
    )
    const primaryReps = rawPrimaryReps.filter(
      (r) => !seamlessRepUpperSet.has(r.toUpperCase())
    )
    const rowComp = getRowPrimaryCompensated(row)
    const rowSeamlessComp = getRowSeamlessCompensated(row)

    const hasPrimary = primaryReps.length > 0
    const hasSeamless = seamlessItems.length > 0
    const distinctAll = new Set<string>([...primaryReps, ...seamlessItems.map((s) => s.rep)])

    if (distinctAll.size > 0) {
      withAnyRepCount += 1
    } else {
      withoutRepCount += 1
    }

    if (hasPrimary) {
      withEclaimRepCount += 1
      totalEclaimCompensated += rowComp
    }

    if (hasSeamless) {
      withSeamlessRepCount += 1
      totalSeamlessCompensated += rowSeamlessComp
    }

    if (distinctAll.size > 1) {
      withMultipleRepsCount += 1
    }

    // Aggregate primary e-Claim REPs
    if (hasPrimary) {
      const eclaimGroupKey = 'eclaim'
      let eclaimGroup = groupMap.get(eclaimGroupKey)
      if (!eclaimGroup) {
        eclaimGroup = {
          groupKey: eclaimGroupKey,
          label: 'e-Claim (REP หลัก)',
          source: 'eclaim',
          prefix: null,
          reps: new Set(),
          visitCount: 0,
          compensated: 0,
        }
        groupMap.set(eclaimGroupKey, eclaimGroup)
      }
      eclaimGroup.visitCount += 1
      eclaimGroup.compensated += rowComp

      const perRepComp = primaryReps.length > 0 ? rowComp / primaryReps.length : 0
      const rowFund = row.fund ? String(row.fund).trim() : null

      for (const repCode of primaryReps) {
        eclaimGroup.reps.add(repCode)
        const key = `eclaim:${repCode.toUpperCase()}`
        const existing = repMap.get(key)
        if (existing) {
          existing.visitCount += 1
          existing.compensated += perRepComp
          if (!existing.fund && rowFund) existing.fund = rowFund
        } else {
          repMap.set(key, {
            rep: repCode,
            source: 'eclaim',
            tag: rowFund ? `e-Claim · ${rowFund}` : 'e-Claim',
            prefix: extractRepPrefix(repCode),
            fund: rowFund,
            visitCount: 1,
            compensated: perRepComp,
          })
        }
      }
    }

    // Aggregate Seamless REPs (deduplicated per row for visit counts)
    if (hasSeamless) {
      const rowSeamlessGroupsSeen = new Set<string>()
      const rowSeamlessRepsSeen = new Set<string>()
      const fallbackFunds = getRowSeamlessFunds(row)

      for (const sItem of seamlessItems) {
        const repCode = String(sItem.rep || '').trim()
        if (!repCode) continue

        const prefix = extractRepPrefix(repCode)
        const fundName = (sItem.fund && String(sItem.fund).trim()) || fallbackFunds || null
        const tagLabel = prefix
          ? fundName
            ? `${prefix} · ${fundName}`
            : prefix
          : fundName || 'Seamless'
        const groupKey = `seamless:${prefix || fundName || 'OTHER'}`
        const sComp = Number(sItem.compensated ?? 0) || 0

        let sGroup = groupMap.get(groupKey)
        if (!sGroup) {
          sGroup = {
            groupKey,
            label: tagLabel,
            source: 'seamless',
            prefix,
            reps: new Set(),
            visitCount: 0,
            compensated: 0,
          }
          groupMap.set(groupKey, sGroup)
        }
        sGroup.reps.add(repCode)
        if (!rowSeamlessGroupsSeen.has(groupKey)) {
          rowSeamlessGroupsSeen.add(groupKey)
          sGroup.visitCount += 1
        }
        sGroup.compensated += sComp

        const repKey = `seamless:${repCode.toUpperCase()}`
        const existing = repMap.get(repKey)
        if (existing) {
          if (!rowSeamlessRepsSeen.has(repKey)) {
            rowSeamlessRepsSeen.add(repKey)
            existing.visitCount += 1
          }
          existing.compensated += sComp
          if (!existing.fund && fundName) existing.fund = fundName
        } else {
          rowSeamlessRepsSeen.add(repKey)
          repMap.set(repKey, {
            rep: repCode,
            source: 'seamless',
            tag: tagLabel,
            prefix,
            fund: fundName,
            visitCount: 1,
            compensated: sComp,
          })
        }
      }
    }
  }

  if (withoutRepCount > 0) {
    groupMap.set('none', {
      groupKey: 'none',
      label: 'ยังไม่มีเลข REP',
      source: 'none',
      prefix: null,
      reps: new Set([NO_REP_FILTER_VALUE]),
      visitCount: withoutRepCount,
      compensated: 0,
    })
  }

  const tagGroups: RepTagGroupSummary[] = Array.from(groupMap.values())
    .map((g) => ({
      groupKey: g.groupKey,
      label: g.label,
      source: g.source,
      prefix: g.prefix,
      repCount: g.source === 'none' ? 0 : g.reps.size,
      visitCount: g.visitCount,
      compensated: roundMoney(g.compensated),
      reps: Array.from(g.reps).sort((a, b) => a.localeCompare(b, 'en')),
    }))
    .sort((a, b) => {
      const order = (src: RepSourceType | 'none') =>
        src === 'eclaim' ? 0 : src === 'seamless' ? 1 : 2
      const diff = order(a.source) - order(b.source)
      if (diff !== 0) return diff
      return b.visitCount - a.visitCount || b.compensated - a.compensated
    })

  const repItems: RepTagEntry[] = Array.from(repMap.values())
    .map((r) => ({
      ...r,
      compensated: roundMoney(r.compensated),
    }))
    .sort((a, b) => b.visitCount - a.visitCount || b.compensated - a.compensated || a.rep.localeCompare(b.rep))

  return {
    totalVisits: safeRows.length,
    withAnyRepCount,
    withEclaimRepCount,
    withSeamlessRepCount,
    withMultipleRepsCount,
    withoutRepCount,
    totalEclaimCompensated: roundMoney(totalEclaimCompensated),
    totalSeamlessCompensated: roundMoney(totalSeamlessCompensated),
    tagGroups,
    repItems,
  }
}
