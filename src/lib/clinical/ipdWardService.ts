import { apiGateway } from '@/lib/apiGateway'
import { getSwrCachedData } from '@/lib/cache'

export interface WardSectionConfig {
  id: string
  title: string
  shortTitle: string
  floor: string
  badgeColor: string
  accentColor: string
}

export const WARD_SECTIONS: WardSectionConfig[] = [
  {
    id: 'w1',
    title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 1 - 20',
    shortTitle: 'สามัญ 1-20',
    floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
    badgeColor: 'badge-emerald',
    accentColor: '#10b981',
  },
  {
    id: 'w2',
    title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 21 - 40',
    shortTitle: 'สามัญ 21-40',
    floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
    badgeColor: 'badge-teal',
    accentColor: '#14b8a6',
  },
  {
    id: 'w3',
    title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องแยก',
    shortTitle: 'ห้องแยก',
    floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
    badgeColor: 'badge-cyan',
    accentColor: '#06b6d4',
  },
  {
    id: 'icu',
    title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยวิกฤต (ICU)',
    shortTitle: 'ICU',
    floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
    badgeColor: 'badge-rose',
    accentColor: '#f43f5e',
  },
  {
    id: 'special',
    title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 4 ห้องพิเศษ',
    shortTitle: 'ห้องพิเศษ',
    floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 4',
    badgeColor: 'badge-purple',
    accentColor: '#a855f7',
  },
  {
    id: 'lr',
    title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 5 ห้องคลอด',
    shortTitle: 'ห้องคลอด',
    floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 5',
    badgeColor: 'badge-amber',
    accentColor: '#f59e0b',
  },
  {
    id: 'surgery',
    title: 'หอผู้ป่วยศัลยกรรม อาคารร่มบุญ',
    shortTitle: 'ศัลยกรรม ร่มบุญ',
    floor: 'อาคารร่มบุญ',
    badgeColor: 'badge-orange',
    accentColor: '#f97316',
  },
]

export interface WardSummarySection extends WardSectionConfig {
  count: number
}

export interface WardSummaryResult {
  totalPatients: number
  updatedAt: string
  sections: WardSummarySection[]
}

export interface PatientRecord {
  hn: string
  ptname: string
  age: number
  regdate: string
  admitDays: number
  bedno: string
  ward: string
  wardGroup: string
}

export interface WardRosterSection extends WardSectionConfig {
  patients: PatientRecord[]
}

export interface WardRosterResult {
  totalPatients: number
  updatedAt: string
  sections: WardRosterSection[]
}

export const OCCUPANCY_WARD_CONFIG = [
  { wardCode: '06', name: 'ชั้น 3 Ward', beds: 44 },
  { wardCode: '05', name: 'ชั้น 3 ICU', beds: 8 },
  { wardCode: '04', name: 'ชั้น 4 ห้องพิเศษ', beds: 21 },
  { wardCode: '02', name: 'ชั้น 5 ห้องคลอด', beds: 8 },
  { wardCode: '09', name: 'อาคารหอผู้ป่วยในร่มบุญ', beds: 22 },
] as const

export const TOTAL_HOSPITAL_BEDS = 81

export interface SpecialtyBreakdown {
  name: string
  count: number
}

export interface IcnpClassification {
  name: string
  count: number
}

export interface DeliveryRoomDetail {
  beds: number
  occupied: number
  remaining: number
  usagePercent: number
}

export interface WardExtra {
  onVentilator?: number
  ciCount?: number
  vipPersons?: number
  preDelivery?: DeliveryRoomDetail
  postDelivery?: DeliveryRoomDetail
}

export interface WardOccupancy {
  id: string
  name: string
  totalBeds: number
  occupiedBeds: number
  remainingBeds: number
  usagePercent: number
  occupancyRate: number | null
  admitToday: number
  dischargeToday: number
  specialties: SpecialtyBreakdown[]
  icnpClassifications: IcnpClassification[]
  unclassifiedBeds: string[]
  extra?: WardExtra
}

export interface BedOccupancyData {
  opdPatientCount: number
  totalBeds: number
  totalOccupied: number
  totalRemaining: number
  totalUsagePercent: number
  occupancyRate: number
  occupancyFormula: {
    totalAdmDays: number
    daysInMonth: number
  }
  totalAdmitToday: number
  totalDischargeToday: number
  wards: WardOccupancy[]
  updatedAt: string
}

export interface OrPatientItem {
  hn: string
  ptname: string
  age_text: number | string | null
  room_name: string
  request_time: string
  status_name: string
}

export interface OrRoomStatusResult {
  waiting: OrPatientItem[]
  inProgress: OrPatientItem[]
  recovery: OrPatientItem[]
  total: number
  updatedAt: string
}

export interface IpdWardGatewayAdapter {
  getIpdWardRoster: typeof apiGateway.clinical.getIpdWardRoster
  getIpdBedStatusRaw: typeof apiGateway.clinical.getIpdBedStatusRaw
  getIpdOrStatus: typeof apiGateway.clinical.getIpdOrStatus
}

const defaultIpdWardGateway: IpdWardGatewayAdapter = {
  getIpdWardRoster: () => apiGateway.clinical.getIpdWardRoster(),
  getIpdBedStatusRaw: () => apiGateway.clinical.getIpdBedStatusRaw(),
  getIpdOrStatus: () => apiGateway.clinical.getIpdOrStatus(),
}

export function resolveWardGroupId(wardCode: string, bedno: string): string {
  const ward = (wardCode || '').trim()
  const bed = (bedno || '').trim()

  if (ward === '06') {
    if (bed.startsWith('Wย')) {
      return 'w3'
    }
    const digits = parseInt(bed.replace(/\D/g, ''), 10)
    if (digits >= 1 && digits <= 20) {
      return 'w1'
    } else if (digits >= 21 && digits <= 40) {
      return 'w2'
    }
    return 'w1'
  } else if (ward === '05') {
    return 'icu'
  } else if (ward === '04') {
    return 'special'
  } else if (ward === '02') {
    return 'lr'
  } else if (ward === '09') {
    return 'surgery'
  }
  return 'other'
}

export function maskPatientName(name: string | null | undefined): string {
  if (!name) return '-'
  const trimmed = name.trim()
  if (trimmed.length <= 3) return trimmed + '***'
  return trimmed.slice(0, 3) + '***'
}

function parseSpecialties(rows: unknown[]): SpecialtyBreakdown[] {
  return (rows || [])
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        name: String(r.specialtyName || 'ไม่ระบุ'),
        count: Number(r.patientCount) || 0,
      }
    })
    .filter((s) => s.count > 0)
}

function parseIcnp(rows: unknown[]): IcnpClassification[] {
  return (rows || [])
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        name: String(r.icnpName || ''),
        count: Number(r.can) || 0,
      }
    })
    .filter((item) => item.name && item.count > 0)
}

function parseUnclassifiedBeds(rows: unknown[]): string[] {
  return (rows || [])
    .map((row) => {
      const r = row as Record<string, unknown>
      return String(r.bedno || '').trim()
    })
    .filter((bed) => bed.length > 0)
}

export const IpdWardService = {
  /**
   * Fetch aggregate public ward summary (no PHI).
   */
  async getWardSummary(
    gateway: Partial<IpdWardGatewayAdapter> = defaultIpdWardGateway
  ): Promise<WardSummaryResult> {
    const gw: IpdWardGatewayAdapter = { ...defaultIpdWardGateway, ...gateway }
    const rows = (await gw.getIpdWardRoster()) || []

    const counts: Record<string, number> = {
      w1: 0,
      w2: 0,
      w3: 0,
      icu: 0,
      special: 0,
      lr: 0,
      surgery: 0,
    }

    rows.forEach((row) => {
      const groupId = resolveWardGroupId(String(row.ward || ''), String(row.bedno || ''))
      if (groupId in counts) {
        counts[groupId]++
      }
    })

    const sections: WardSummarySection[] = WARD_SECTIONS.map((sec) => ({
      ...sec,
      count: counts[sec.id] || 0,
    }))

    return {
      totalPatients: rows.length,
      updatedAt: new Date().toISOString(),
      sections,
    }
  },

  /**
   * Fetch authenticated patient roster grouped by ward (PDPA masked).
   */
  async getWardPatientRoster(
    gateway: Partial<IpdWardGatewayAdapter> = defaultIpdWardGateway
  ): Promise<WardRosterResult> {
    const gw: IpdWardGatewayAdapter = { ...defaultIpdWardGateway, ...gateway }
    const rows = (await gw.getIpdWardRoster()) || []

    const groups: Record<string, PatientRecord[]> = {
      w1: [],
      w2: [],
      w3: [],
      icu: [],
      special: [],
      lr: [],
      surgery: [],
    }

    rows.forEach((row) => {
      const ward = String(row.ward || '')
      const bed = String(row.bedno || '').trim()
      const groupId = resolveWardGroupId(ward, bed)

      const patient: PatientRecord = {
        hn: String(row.hn || ''),
        ptname: String(row.ptname || 'ไม่ระบุชื่อ'),
        age: Number(row.age) || 0,
        regdate: String(row.regdate || ''),
        admitDays: Math.max(0, Number(row.admit_days) || 0),
        bedno: bed || '-',
        ward,
        wardGroup: groupId,
      }

      if (groups[groupId]) {
        groups[groupId].push(patient)
      }
    })

    const sections: WardRosterSection[] = WARD_SECTIONS.map((sec) => ({
      ...sec,
      patients: groups[sec.id] || [],
    }))

    return {
      totalPatients: rows.length,
      updatedAt: new Date().toISOString(),
      sections,
    }
  },

  /**
   * Fetch comprehensive bed occupancy report and calculations via Gateway Named API.
   */
  async getBedOccupancyReport(
    gateway: Partial<IpdWardGatewayAdapter> = defaultIpdWardGateway
  ): Promise<BedOccupancyData> {
    if (gateway === defaultIpdWardGateway) {
      return getSwrCachedData(
        'clinical:bed-occupancy-report',
        () => this._fetchBedOccupancyReport(defaultIpdWardGateway),
        { staleTtlMs: 8_000, maxTtlMs: 30_000 }
      )
    }
    const gw: IpdWardGatewayAdapter = { ...defaultIpdWardGateway, ...gateway }
    return this._fetchBedOccupancyReport(gw)
  },

  async _fetchBedOccupancyReport(
    gw: IpdWardGatewayAdapter
  ): Promise<BedOccupancyData> {
    const raw = (await gw.getIpdBedStatusRaw()) || {}
    const opdResult = (raw.opdResult || []) as Array<Record<string, unknown>>
    const wardOccupancyResult = (raw.wardOccupancyResult || []) as Array<Record<string, unknown>>
    const vipRoomResult = (raw.vipRoomResult || []) as Array<Record<string, unknown>>
    const vipRoomPersonResult = (raw.vipRoomPersonResult || []) as Array<Record<string, unknown>>
    const deliveryPreResult = (raw.deliveryPreResult || []) as Array<Record<string, unknown>>
    const deliveryPostResult = (raw.deliveryPostResult || []) as Array<Record<string, unknown>>
    const admitTodayResult = (raw.admitTodayResult || []) as Array<Record<string, unknown>>
    const dischargeTodayResult = (raw.dischargeTodayResult || []) as Array<Record<string, unknown>>
    const overallOccupancyResult = (raw.overallOccupancyResult || []) as Array<Record<string, unknown>>
    const wardOccupancyRateResult = (raw.wardOccupancyRateResult || []) as Array<Record<string, unknown>>
    const icuVentilatorResult = (raw.icuVentilatorResult || []) as Array<Record<string, unknown>>
    const specByWard = (raw.specByWard || {}) as Record<string, unknown[]>
    const icnpByWard = (raw.icnpByWard || {}) as Record<string, unknown[]>
    const unclassifiedByWard = (raw.unclassifiedByWard || {}) as Record<string, unknown[]>

    const opdPatientCount = Number(opdResult[0]?.opdCount) || 0

    const occupancyByWard = new Map<string, number>()
    for (const r of wardOccupancyResult) {
      occupancyByWard.set(String(r.ward), Number(r.occupiedBeds) || 0)
    }

    const vipRoomCount = Number(vipRoomResult[0]?.occupiedBeds) || 0
    const vipPersonCount = Number(vipRoomPersonResult[0]?.personCount) || 0

    const preDeliveryOccupied = Number(deliveryPreResult[0]?.occupiedBeds) || 0
    const postDeliveryOccupied = Number(deliveryPostResult[0]?.occupiedBeds) || 0

    const admitByWard = new Map<string, number>()
    for (const r of admitTodayResult) {
      admitByWard.set(String(r.ward), Number(r.admitCount) || 0)
    }
    const dischargeByWard = new Map<string, number>()
    for (const r of dischargeTodayResult) {
      dischargeByWard.set(String(r.ward), Number(r.dischargeCount) || 0)
    }

    const overallRow = overallOccupancyResult[0]
    const totalAdmDays = Number(overallRow?.totalAdmDays) || 0
    const daysInMonth = Number(overallRow?.daysInMonth) || 30

    const occupancyRateByWard = new Map<string, number>()
    for (const r of wardOccupancyRateResult) {
      occupancyRateByWard.set(String(r.ward), Number(r.totalAdmDays) || 0)
    }

    const onVentilator = Number(icuVentilatorResult[0]?.onVentilator) || 0

    const wards: WardOccupancy[] = OCCUPANCY_WARD_CONFIG.map((config) => {
      const occupied =
        config.wardCode === '04'
          ? vipRoomCount
          : occupancyByWard.get(config.wardCode) || 0

      const remaining = Math.max(0, config.beds - occupied)
      const usagePercent =
        config.beds > 0 ? Number(((occupied * 100) / config.beds).toFixed(2)) : 0

      const wardAdmDays = occupancyRateByWard.get(config.wardCode) || 0
      const wardOccRate =
        config.beds > 0 && daysInMonth > 0
          ? Number(((wardAdmDays * 100) / (config.beds * daysInMonth)).toFixed(2))
          : null

      const ward: WardOccupancy = {
        id: config.wardCode,
        name: config.name,
        totalBeds: config.beds,
        occupiedBeds: occupied,
        remainingBeds: remaining,
        usagePercent,
        occupancyRate: wardOccRate,
        admitToday: admitByWard.get(config.wardCode) || 0,
        dischargeToday: dischargeByWard.get(config.wardCode) || 0,
        specialties: parseSpecialties(specByWard[config.wardCode] || []),
        icnpClassifications: parseIcnp(icnpByWard[config.wardCode] || []),
        unclassifiedBeds: parseUnclassifiedBeds(unclassifiedByWard[config.wardCode] || []),
      }

      if (config.wardCode === '05') {
        const icuOccupied = occupancyByWard.get('05') || 0
        ward.extra = {
          onVentilator,
          ciCount: Math.max(0, icuOccupied - onVentilator),
        }
      } else if (config.wardCode === '04') {
        ward.extra = {
          vipPersons: vipPersonCount,
        }
        ward.occupiedBeds = vipRoomCount
      } else if (config.wardCode === '02') {
        ward.extra = {
          preDelivery: {
            beds: 4,
            occupied: preDeliveryOccupied,
            remaining: Math.max(0, 4 - preDeliveryOccupied),
            usagePercent: Number(((preDeliveryOccupied * 100) / 4).toFixed(2)),
          },
          postDelivery: {
            beds: 4,
            occupied: postDeliveryOccupied,
            remaining: Math.max(0, 4 - postDeliveryOccupied),
            usagePercent: Number(((postDeliveryOccupied * 100) / 4).toFixed(2)),
          },
        }
      }

      return ward
    })

    const totalOccupied = wards.reduce((sum, w) => sum + w.occupiedBeds, 0)
    const totalRemaining = Math.max(0, TOTAL_HOSPITAL_BEDS - totalOccupied)
    const totalUsagePercent =
      TOTAL_HOSPITAL_BEDS > 0
        ? Number(((totalOccupied * 100) / TOTAL_HOSPITAL_BEDS).toFixed(2))
        : 0
    const overallOccupancyRate =
      TOTAL_HOSPITAL_BEDS > 0 && daysInMonth > 0
        ? Number(((totalAdmDays * 100) / (TOTAL_HOSPITAL_BEDS * daysInMonth)).toFixed(2))
        : 0

    return {
      opdPatientCount,
      totalBeds: TOTAL_HOSPITAL_BEDS,
      totalOccupied,
      totalRemaining,
      totalUsagePercent,
      occupancyRate: overallOccupancyRate,
      occupancyFormula: {
        totalAdmDays,
        daysInMonth,
      },
      totalAdmitToday: wards.reduce((sum, w) => sum + w.admitToday, 0),
      totalDischargeToday: wards.reduce((sum, w) => sum + w.dischargeToday, 0),
      wards,
      updatedAt: new Date().toISOString(),
    }
  },

  /**
   * Fetch operating room status (waiting, in-progress, recovery) with PDPA masking.
   */
  async getOrRoomStatus(
    gateway: Partial<IpdWardGatewayAdapter> = defaultIpdWardGateway
  ): Promise<OrRoomStatusResult> {
    const gw: IpdWardGatewayAdapter = { ...defaultIpdWardGateway, ...gateway }
    const res = await gw.getIpdOrStatus()

    const maskList = (list: Array<Record<string, unknown>>, fallbackStatus: string): OrPatientItem[] =>
      (list || []).map((item) => ({
        hn: String(item.hn || ''),
        ptname: maskPatientName(String(item.ptname || '')),
        age_text: item.age_text !== undefined && item.age_text !== null ? Number(item.age_text) : '-',
        room_name: String(item.room_name || '-'),
        request_time: String(item.request_time || ''),
        status_name: String(item.status_name || fallbackStatus),
      }))

    const waiting = maskList(res?.waitingList || [], 'รอผ่าตัด')
    const inProgress = maskList(res?.inProgressList || [], 'กำลังผ่าตัด')
    const recovery = maskList(res?.recoveryList || [], 'ผ่าตัดเสร็จ/พักฟื้น')

    return {
      waiting,
      inProgress,
      recovery,
      total: waiting.length + inProgress.length + recovery.length,
      updatedAt: new Date().toISOString(),
    }
  },
}
