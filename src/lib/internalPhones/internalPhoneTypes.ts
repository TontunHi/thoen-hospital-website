export interface InternalPhoneRecord {
  id: number
  building: string
  floor: string | null
  room: string
  phone: string
  note: string | null
  displayOrder: number
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface InternalPhoneRecordRaw {
  id: number
  building: string
  floor: string | null
  room: string
  phone: string
  note: string | null
  displayOrder: number
  isActive: number | boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: unknown
  updatedAt: unknown
}

export interface InternalPhoneCreateInput {
  building: string
  floor?: string | null
  room: string
  phone?: string
  note?: string | null
  displayOrder?: number
  isActive?: boolean
}

export type InternalPhoneUpdateInput = Partial<InternalPhoneCreateInput>

export interface InternalPhoneListFilters {
  building?: string
  floor?: string
  search?: string
  includeInactive?: boolean
}

export interface InternalPhoneSummaryStats {
  totalCount: number
  buildingCount: number
  extensionCount: number
}

export interface InternalPhoneListResult {
  items: InternalPhoneRecord[]
  buildings: string[]
  floorsByBuilding: Record<string, string[]>
  stats: InternalPhoneSummaryStats
}

export interface InternalPhoneActor {
  username?: string | null
  email?: string | null
}
