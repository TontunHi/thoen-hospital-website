import { queryClinicalDb } from '@/lib/clinicalDb'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

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

// -------------------------------------------------------------
// Bed Occupancy Interfaces
// -------------------------------------------------------------

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

// -------------------------------------------------------------
// OR Room Interfaces
// -------------------------------------------------------------

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

// -------------------------------------------------------------
// Helper Logic: Bed & Ward Grouping
// -------------------------------------------------------------

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
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        name: String(r.specialtyName || 'ไม่ระบุ'),
        count: Number(r.patientCount) || 0,
      }
    })
    .filter(s => s.count > 0)
}

function parseIcnp(rows: unknown[]): IcnpClassification[] {
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        name: String(r.icnpName || ''),
        count: Number(r.can) || 0,
      }
    })
    .filter(item => item.name && item.count > 0)
}

function parseUnclassifiedBeds(rows: unknown[]): string[] {
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>
      return String(r.bedno || '').trim()
    })
    .filter(bed => bed.length > 0)
}

// -------------------------------------------------------------
// Deep Domain Module: IpdWardService
// -------------------------------------------------------------

export const IpdWardService = {
  /**
   * Fetch aggregate public ward summary (no PHI).
   */
  async getWardSummary(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<WardSummaryResult> {
    const sql = `
      SELECT 
        an.ward,
        p.bedno
      FROM an_stat an
      LEFT OUTER JOIN iptadm p ON an.an = p.an
      WHERE an.dchdate IS NULL
        AND an.ward IN ('02', '04', '05', '06', '09')
    `

    const rows = await executor(sql)
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
    executor: QueryExecutor = queryClinicalDb
  ): Promise<WardRosterResult> {
    const sql = `
      SELECT 
        pt.hn,
        TRIM(CONCAT(COALESCE(pt.pname, ''), ' ', COALESCE(pt.fname, ''))) AS ptname,
        TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age,
        DATE_FORMAT(an.regdate, '%Y-%m-%d') AS regdate,
        DATEDIFF(CURRENT_DATE(), an.regdate) AS admit_days,
        p.bedno,
        an.ward
      FROM an_stat an
      LEFT OUTER JOIN patient pt ON an.hn = pt.hn
      LEFT OUTER JOIN iptadm p ON an.an = p.an
      WHERE an.dchdate IS NULL
        AND an.ward IN ('02', '04', '05', '06', '09')
      ORDER BY p.bedno ASC
    `

    const rows = await executor(sql)
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
   * Fetch comprehensive bed occupancy report and calculations.
   */
  async getBedOccupancyReport(
    executor: QueryExecutor = queryClinicalDb
  ): Promise<BedOccupancyData> {
    const [
      opdResult,
      wardOccupancyResult,
      vipRoomResult,
      vipRoomPersonResult,
      deliveryPreResult,
      deliveryPostResult,
      admitTodayResult,
      dischargeTodayResult,
      occupancyRateOverallResult,
      occupancyRateByWardResult,
      icuVentilatorResult,
      specialtyWard06Result,
      specialtyWard05Result,
      specialtyWard04Result,
      specialtyWard02Result,
      specialtyWard09Result,
      icnpWard06Result,
      icnpWard05Result,
      icnpWard04Result,
      icnpWard02Result,
      icnpWard09Result,
      unclassifiedBedsWard06Result,
      unclassifiedBedsWard05Result,
      unclassifiedBedsWard04Result,
      unclassifiedBedsWard02Result,
      unclassifiedBedsWard09Result,
    ] = await Promise.all([
      // Group 1: OPD patient count today
      executor(`
        SELECT COUNT(DISTINCT o.hn) AS opdCount
        FROM ovst o
        WHERE o.vstdate = CURRENT_DATE
      `),

      // Group 2a: Ward occupancy
      executor(`
        SELECT i.ward, COUNT(i.an) AS occupiedBeds
        FROM ipt i
        WHERE i.dchtype IS NULL
          AND i.ward IN ('02', '04', '05', '06', '09')
        GROUP BY i.ward
      `),

      // Group 2b: VIP room (ward '04') distinct bedno
      executor(`
        SELECT COUNT(DISTINCT b.bedno) AS occupiedBeds
        FROM ipt i
        LEFT OUTER JOIN iptadm b ON i.an = b.an
        WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'
      `),

      // Group 2b-extra: VIP room person count
      executor(`
        SELECT COUNT(b.bedno) AS personCount
        FROM ipt i
        LEFT OUTER JOIN iptadm b ON i.an = b.an
        WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'
      `),

      // Group 2c: ห้องคลอด รอคลอด (bedno LIKE 'C0%')
      executor(`
        SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds
        FROM ipt i
        LEFT OUTER JOIN iptadm ip ON i.an = ip.an
        WHERE i.dchtype IS NULL
          AND i.ward = '02'
          AND ip.bedno <> ''
          AND ip.bedno LIKE 'C0%'
      `),

      // Group 2d: ห้องคลอด หลังคลอด (bedno LIKE 'CP%')
      executor(`
        SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds
        FROM ipt i
        LEFT OUTER JOIN iptadm ip ON i.an = ip.an
        WHERE i.dchtype IS NULL
          AND i.ward = '02'
          AND ip.bedno <> ''
          AND ip.bedno LIKE 'CP%'
      `),

      // Group 3a: Admit today per ward
      executor(`
        SELECT i.ward, COUNT(i.an) AS admitCount
        FROM ipt i
        WHERE i.regdate = CURRENT_DATE
          AND i.ward IN ('02', '04', '05', '06', '09')
        GROUP BY i.ward
      `),

      // Group 3b: Discharge today per ward
      executor(`
        SELECT i.ward, COUNT(i.an) AS dischargeCount
        FROM ipt i
        WHERE i.dchdate = CURRENT_DATE
          AND i.ward IN ('02', '04', '05', '06', '09')
        GROUP BY i.ward
      `),

      // Group 4a: Occupancy rate overall
      executor(`
        SELECT
          SUM(admdate) AS totalAdmDays,
          DAY(LAST_DAY(CURRENT_DATE)) AS daysInMonth
        FROM an_stat
        WHERE dchdate BETWEEN
          DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH)
          AND LAST_DAY(CURRENT_DATE)
      `),

      // Group 4b: Occupancy rate by ward
      executor(`
        SELECT
          ward,
          SUM(admdate) AS totalAdmDays,
          DAY(CURRENT_DATE) AS daysSoFar
        FROM an_stat
        WHERE ward IN ('02', '04', '05', '06', '09')
          AND dchdate BETWEEN
            DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH)
            AND LAST_DAY(CURRENT_DATE)
        GROUP BY ward
      `),

      // Group 6: ICU on ventilator
      executor(`
        SELECT COUNT(i.an) AS onVentilator
        FROM ipt i
        LEFT OUTER JOIN opitemrece o
          ON i.an = o.an
          AND o.rxdate = CURRENT_DATE
          AND o.icode IN ('3002054', '3002024', '3002025')
        WHERE i.dchtype IS NULL
          AND i.ward = '05'
          AND o.rxdate IS NOT NULL
      `),

      // Group 5: Specialty breakdown
      executor(`
        SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
        FROM ipt i
        LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
        WHERE i.dchdate IS NULL AND i.ward = '06'
        GROUP BY i.spclty
      `),
      executor(`
        SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
        FROM ipt i
        LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
        WHERE i.dchdate IS NULL AND i.ward = '05'
        GROUP BY i.spclty
      `),
      executor(`
        SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
        FROM ipt i
        LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
        WHERE i.dchdate IS NULL AND i.ward = '04'
        GROUP BY i.spclty
      `),
      executor(`
        SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
        FROM ipt i
        LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
        WHERE i.dchdate IS NULL AND i.ward = '02'
        GROUP BY i.spclty
      `),
      executor(`
        SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
        FROM ipt i
        LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
        WHERE i.dchdate IS NULL AND i.ward = '09'
        GROUP BY i.spclty
      `),

      // Group 7a: ICNP classification
      executor(`
        SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
        FROM ipt_icnp i
        LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
        LEFT OUTER JOIN ipt ii ON i.an = ii.an
        WHERE ii.dchdate IS NULL AND ii.ward = '06' AND ic.icnp_classification_name IS NOT NULL
        GROUP BY i.icnp_classification_id
        ORDER BY i.icnp_classification_id DESC
      `),
      executor(`
        SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
        FROM ipt_icnp i
        LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
        LEFT OUTER JOIN ipt ii ON i.an = ii.an
        WHERE ii.dchdate IS NULL AND ii.ward = '05' AND ic.icnp_classification_name IS NOT NULL
        GROUP BY i.icnp_classification_id
        ORDER BY i.icnp_classification_id DESC
      `),
      executor(`
        SELECT COUNT(b.bedno) AS can, ic.icnp_classification_name AS icnpName
        FROM ipt i
        LEFT OUTER JOIN ward w ON i.ward = w.ward
        LEFT OUTER JOIN ipt_icnp ii ON i.an = ii.an
        LEFT OUTER JOIN icnp_classification ic ON ii.icnp_classification_id = ic.icnp_classification_id
        LEFT OUTER JOIN iptadm b ON ii.an = b.an
        WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%' AND ic.icnp_classification_name IS NOT NULL
        GROUP BY ii.icnp_classification_id
        ORDER BY ic.icnp_classification_id DESC
      `),
      executor(`
        SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
        FROM ipt_icnp i
        LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
        LEFT OUTER JOIN ipt ii ON i.an = ii.an
        WHERE ii.dchdate IS NULL AND ii.ward = '02' AND ic.icnp_classification_name IS NOT NULL
        GROUP BY i.icnp_classification_id
        ORDER BY i.icnp_classification_id DESC
      `),
      executor(`
        SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
        FROM ipt_icnp i
        LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
        LEFT OUTER JOIN ipt ii ON i.an = ii.an
        WHERE ii.dchdate IS NULL AND ii.ward = '09' AND ic.icnp_classification_name IS NOT NULL
        GROUP BY i.icnp_classification_id
        ORDER BY i.icnp_classification_id DESC
      `),

      // Group 7b: Unclassified beds
      executor(`
        SELECT DISTINCT i.bedno
        FROM iptadm i
        LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
        LEFT OUTER JOIN an_stat a ON a.an = i.an
        WHERE a.dchdate IS NULL AND a.ward = '06' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
        ORDER BY i.bedno ASC
      `),
      executor(`
        SELECT DISTINCT i.bedno
        FROM iptadm i
        LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
        LEFT OUTER JOIN an_stat a ON a.an = i.an
        WHERE a.dchdate IS NULL AND a.ward = '05' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
        ORDER BY i.bedno ASC
      `),
      executor(`
        SELECT DISTINCT i.bedno
        FROM iptadm i
        LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
        LEFT OUTER JOIN an_stat a ON a.an = i.an
        WHERE a.dchdate IS NULL AND a.ward = '04' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
        ORDER BY i.bedno ASC
      `),
      executor(`
        SELECT DISTINCT i.bedno
        FROM iptadm i
        LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
        LEFT OUTER JOIN an_stat a ON a.an = i.an
        WHERE a.dchdate IS NULL AND a.ward = '02' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
        ORDER BY i.bedno ASC
      `),
      executor(`
        SELECT DISTINCT i.bedno
        FROM iptadm i
        LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
        LEFT OUTER JOIN an_stat a ON a.an = i.an
        WHERE a.dchdate IS NULL AND a.ward = '09' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
        ORDER BY i.bedno ASC
      `),
    ])

    const opdPatientCount = Number((opdResult[0] as Record<string, unknown>)?.opdCount) || 0

    const occupancyByWard = new Map<string, number>()
    for (const row of wardOccupancyResult) {
      const r = row as Record<string, unknown>
      occupancyByWard.set(String(r.ward), Number(r.occupiedBeds) || 0)
    }

    const vipRoomCount = Number((vipRoomResult[0] as Record<string, unknown>)?.occupiedBeds) || 0
    const vipPersonCount = Number((vipRoomPersonResult[0] as Record<string, unknown>)?.personCount) || 0

    const preDeliveryOccupied = Number((deliveryPreResult[0] as Record<string, unknown>)?.occupiedBeds) || 0
    const postDeliveryOccupied = Number((deliveryPostResult[0] as Record<string, unknown>)?.occupiedBeds) || 0

    const admitByWard = new Map<string, number>()
    for (const row of admitTodayResult) {
      const r = row as Record<string, unknown>
      admitByWard.set(String(r.ward), Number(r.admitCount) || 0)
    }
    const dischargeByWard = new Map<string, number>()
    for (const row of dischargeTodayResult) {
      const r = row as Record<string, unknown>
      dischargeByWard.set(String(r.ward), Number(r.dischargeCount) || 0)
    }

    const overallRow = occupancyRateOverallResult[0] as Record<string, unknown> | undefined
    const totalAdmDays = Number(overallRow?.totalAdmDays) || 0
    const daysInMonth = Number(overallRow?.daysInMonth) || 30

    const occupancyRateByWard = new Map<string, number>()
    for (const row of occupancyRateByWardResult) {
      const r = row as Record<string, unknown>
      occupancyRateByWard.set(String(r.ward), Number(r.totalAdmDays) || 0)
    }

    const onVentilator = Number((icuVentilatorResult[0] as Record<string, unknown>)?.onVentilator) || 0

    const specialtyResults: Record<string, SpecialtyBreakdown[]> = {
      '06': parseSpecialties(specialtyWard06Result),
      '05': parseSpecialties(specialtyWard05Result),
      '04': parseSpecialties(specialtyWard04Result),
      '02': parseSpecialties(specialtyWard02Result),
      '09': parseSpecialties(specialtyWard09Result),
    }

    const icnpResults: Record<string, IcnpClassification[]> = {
      '06': parseIcnp(icnpWard06Result),
      '05': parseIcnp(icnpWard05Result),
      '04': parseIcnp(icnpWard04Result),
      '02': parseIcnp(icnpWard02Result),
      '09': parseIcnp(icnpWard09Result),
    }

    const unclassifiedBedsResults: Record<string, string[]> = {
      '06': parseUnclassifiedBeds(unclassifiedBedsWard06Result),
      '05': parseUnclassifiedBeds(unclassifiedBedsWard05Result),
      '04': parseUnclassifiedBeds(unclassifiedBedsWard04Result),
      '02': parseUnclassifiedBeds(unclassifiedBedsWard02Result),
      '09': parseUnclassifiedBeds(unclassifiedBedsWard09Result),
    }

    const wards: WardOccupancy[] = OCCUPANCY_WARD_CONFIG.map((config) => {
      let occupied: number

      if (config.wardCode === '04') {
        occupied = vipRoomCount
      } else {
        occupied = occupancyByWard.get(config.wardCode) || 0
      }

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
        specialties: specialtyResults[config.wardCode] || [],
        icnpClassifications: icnpResults[config.wardCode] || [],
        unclassifiedBeds: unclassifiedBedsResults[config.wardCode] || [],
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
    executor: QueryExecutor = queryClinicalDb
  ): Promise<OrRoomStatusResult> {
    const buildOrQuery = (statusId: string) => `
      SELECT DISTINCT
        op.hn,
        TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''))) AS ptname,
        TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age_text,
        COALESCE(opr.room_name, '-') AS room_name,
        TIME_FORMAT(op.request_time, '%H:%i') AS request_time,
        COALESCE(ops.status_name, '${statusId === '1' ? 'รอผ่าตัด' : statusId === '2' ? 'กำลังผ่าตัด' : 'ผ่าตัดเสร็จ/พักฟื้น'}') AS status_name
      FROM operation_list op
      LEFT OUTER JOIN patient pt ON op.hn = pt.hn
      LEFT OUTER JOIN operation_room opr ON op.room_id = opr.room_id
      LEFT OUTER JOIN operation_status ops ON op.status_id = ops.status_id
      WHERE op.operation_date = CURRENT_DATE()
        AND op.status_id IN ('${statusId}')
      ORDER BY op.request_time ASC
    `

    const [waitingList, inProgressList, recoveryList] = await Promise.all([
      executor(buildOrQuery('1')),
      executor(buildOrQuery('2')),
      executor(buildOrQuery('3')),
    ])

    const maskList = (list: Record<string, unknown>[]): OrPatientItem[] =>
      (list || []).map((item) => ({
        hn: String(item.hn || ''),
        ptname: maskPatientName(String(item.ptname || '')),
        age_text: item.age_text !== undefined && item.age_text !== null ? Number(item.age_text) : '-',
        room_name: String(item.room_name || '-'),
        request_time: String(item.request_time || ''),
        status_name: String(item.status_name || ''),
      }))

    const waiting = maskList(waitingList)
    const inProgress = maskList(inProgressList)
    const recovery = maskList(recoveryList)

    return {
      waiting,
      inProgress,
      recovery,
      total: waiting.length + inProgress.length + recovery.length,
      updatedAt: new Date().toISOString(),
    }
  },
}
