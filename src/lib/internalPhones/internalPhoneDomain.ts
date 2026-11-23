import type {
  InternalPhoneListFilters,
  InternalPhoneRecord,
  InternalPhoneSummaryStats,
} from './internalPhoneTypes'

export const OLD_BUILDING_NAME = 'อาคารร่มฉัตร'
export const NEW_BUILDING_NAME = 'อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น'

const PREFERRED_BUILDING_ORDER = [
  NEW_BUILDING_NAME,
  OLD_BUILDING_NAME,
  'อาคารร่มบุญ',
  'อาคารซักฟอก',
  'อาคาร/หน่วยงานอื่นๆ',
]

/**
 * Normalizes legacy building aliases:
 * - "ตึกเก่า" -> "อาคารร่มฉัตร"
 * - "ตึกใหม่" -> "อาคารผู้ป่วยนอก/บำบัดรักษาฯ6ชั้น"
 * and collapses extra whitespace.
 */
export function normalizeBuildingName(building: string): string {
  const cleaned = building.replace(/\s+/g, ' ').trim()
  if (cleaned === 'ตึกเก่า') {
    return OLD_BUILDING_NAME
  }
  if (cleaned === 'ตึกใหม่') {
    return NEW_BUILDING_NAME
  }
  return cleaned
}

/**
 * Normalizes optional floor / note text (empty string becomes null).
 */
export function normalizeOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const trimmed = String(value).replace(/\s+/g, ' ').trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Normalizes comma-separated phone extension strings into canonical `"1100, 1101"` format.
 */
export function normalizePhoneString(phone: unknown): string {
  if (phone === null || phone === undefined) return ''
  return splitPhoneNumbers(String(phone)).join(', ')
}

/**
 * Splits a phone field into individual extension numbers for copyable UI badges.
 * Supports comma, slash, or semicolon delimiters while keeping plain extensions intact.
 */
export function splitPhoneNumbers(phone: string | null | undefined): string[] {
  if (!phone) return []
  return phone
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function compareFloors(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const numA = Number(a)
  const numB = Number(b)
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return numA - numB
  }
  return a.localeCompare(b, 'th')
}

export function compareBuildingNames(a: string, b: string): number {
  const idxA = PREFERRED_BUILDING_ORDER.indexOf(a)
  const idxB = PREFERRED_BUILDING_ORDER.indexOf(b)
  if (idxA !== -1 && idxB !== -1) return idxA - idxB
  if (idxA !== -1) return -1
  if (idxB !== -1) return 1
  return a.localeCompare(b, 'th')
}

export function sortInternalPhones(records: InternalPhoneRecord[]): InternalPhoneRecord[] {
  return [...records].sort((a, b) => {
    const bCmp = compareBuildingNames(a.building, b.building)
    if (bCmp !== 0) return bCmp

    const fCmp = compareFloors(a.floor, b.floor)
    if (fCmp !== 0) return fCmp

    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder
    }

    return a.room.localeCompare(b.room, 'th')
  })
}

export function filterInternalPhones(
  records: InternalPhoneRecord[],
  filters: InternalPhoneListFilters
): InternalPhoneRecord[] {
  const building = filters.building?.trim()
  const floor = filters.floor?.trim()
  const search = filters.search?.trim().toLowerCase()

  return records.filter((item) => {
    if (!filters.includeInactive && !item.isActive) return false
    if (building && building !== 'ALL' && item.building !== building) return false
    if (floor && floor !== 'ALL') {
      if (floor === 'NONE') {
        if (item.floor !== null && item.floor !== '') return false
      } else if (item.floor !== floor) {
        return false
      }
    }
    if (search) {
      const haystack = [item.building, item.floor ?? '', item.room, item.phone, item.note ?? '']
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

export function extractBuildingFacets(records: InternalPhoneRecord[]): {
  buildings: string[]
  floorsByBuilding: Record<string, string[]>
} {
  const buildingSet = new Set<string>()
  const floorSets = new Map<string, Set<string>>()

  for (const item of records) {
    buildingSet.add(item.building)
    if (item.floor) {
      let set = floorSets.get(item.building)
      if (!set) {
        set = new Set<string>()
        floorSets.set(item.building, set)
      }
      set.add(item.floor)
    }
  }

  const buildings = Array.from(buildingSet).sort(compareBuildingNames)
  const floorsByBuilding: Record<string, string[]> = {}

  for (const b of buildings) {
    const set = floorSets.get(b)
    floorsByBuilding[b] = set ? Array.from(set).sort((x, y) => compareFloors(x, y)) : []
  }

  return { buildings, floorsByBuilding }
}

export function computeInternalPhoneStats(
  records: InternalPhoneRecord[]
): InternalPhoneSummaryStats {
  const buildingSet = new Set<string>()
  let extensionCount = 0

  for (const item of records) {
    buildingSet.add(item.building)
    extensionCount += splitPhoneNumbers(item.phone).length
  }

  return {
    totalCount: records.length,
    buildingCount: buildingSet.size,
    extensionCount,
  }
}

export interface FloorChoice {
  key: string // floor string (e.g. '1') or 'NONE'
  label: string // e.g. 'ชั้น 1' or 'จุดบริการทั่วไป (ไม่ระบุชั้น)'
  roomCount: number
  extensionCount: number
  previewRooms: string[]
}

export interface BuildingSummary {
  building: string
  roomCount: number
  extensionCount: number
  namedFloorCount: number
  floorChoices: FloorChoice[]
  requiresFloorSelection: boolean
}

export function buildBuildingSummaries(records: InternalPhoneRecord[]): BuildingSummary[] {
  const byBuilding = new Map<string, InternalPhoneRecord[]>()

  for (const item of records) {
    if (!item.isActive) continue
    const list = byBuilding.get(item.building) ?? []
    list.push(item)
    byBuilding.set(item.building, list)
  }

  const buildings = Array.from(byBuilding.keys()).sort(compareBuildingNames)

  return buildings.map((building) => {
    const items = byBuilding.get(building) ?? []
    const byFloorKey = new Map<string, InternalPhoneRecord[]>()

    let totalExt = 0
    for (const item of items) {
      totalExt += splitPhoneNumbers(item.phone).length
      const fKey = item.floor ? item.floor : 'NONE'
      const fList = byFloorKey.get(fKey) ?? []
      fList.push(item)
      byFloorKey.set(fKey, fList)
    }

    const sortedFloorKeys = Array.from(byFloorKey.keys()).sort((a, b) => {
      if (a === 'NONE' && b === 'NONE') return 0
      if (a === 'NONE') return 1
      if (b === 'NONE') return -1
      return compareFloors(a, b)
    })

    const floorChoices: FloorChoice[] = sortedFloorKeys.map((key) => {
      const fItems = byFloorKey.get(key) ?? []
      let fExt = 0
      for (const fi of fItems) {
        fExt += splitPhoneNumbers(fi.phone).length
      }
      return {
        key,
        label: key === 'NONE' ? 'ไม่ระบุชั้น' : `ชั้น ${key}`,
        roomCount: fItems.length,
        extensionCount: fExt,
        previewRooms: fItems.slice(0, 3).map((fi) => fi.room),
      }
    })

    const namedFloorCount = floorChoices.filter((fc) => fc.key !== 'NONE').length

    return {
      building,
      roomCount: items.length,
      extensionCount: totalExt,
      namedFloorCount,
      floorChoices,
      requiresFloorSelection: floorChoices.length > 1,
    }
  })
}
