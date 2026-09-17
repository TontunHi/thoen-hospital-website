import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getCachedData } from '@/lib/cache'
import { logger } from '@/lib/logger'

/**
 * Ward configuration — hardcoded bed counts matching the legacy PHP system.
 * Total: 81 beds across 5 wards.
 */
const WARD_CONFIG = [
  { wardCode: '06', name: 'ชั้น 3 Ward', beds: 44 },
  { wardCode: '05', name: 'ชั้น 3 ICU', beds: 8 },
  { wardCode: '04', name: 'ชั้น 4 ห้องพิเศษ', beds: 21 },
  { wardCode: '02', name: 'ชั้น 5 ห้องคลอด', beds: 8 },
  { wardCode: '09', name: 'อาคารหอผู้ป่วยในร่มบุญ', beds: 22 },
] as const

const TOTAL_BEDS = 81

interface SpecialtyBreakdown {
  name: string
  count: number
}

interface IcnpClassification {
  name: string
  count: number
}

interface DeliveryRoomDetail {
  beds: number
  occupied: number
  remaining: number
  usagePercent: number
}

interface WardExtra {
  onVentilator?: number
  ciCount?: number
  vipPersons?: number
  preDelivery?: DeliveryRoomDetail
  postDelivery?: DeliveryRoomDetail
}

interface WardOccupancy {
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

interface BedOccupancyData {
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

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    if (session.role === 'subdistrict') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      )
    }

    // No audit log — aggregate data only, no PII

    const cacheKey = 'bed-occupancy-data'

    const data = await getCachedData<BedOccupancyData>(cacheKey, async () => {
      // Execute all query groups in parallel for performance
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
        queryHosDb(`
          SELECT COUNT(DISTINCT o.hn) AS opdCount
          FROM ovst o
          WHERE o.vstdate = CURRENT_DATE
        `),

        // Group 2a: Ward occupancy — patients currently admitted per ward
        queryHosDb(`
          SELECT i.ward, COUNT(i.an) AS occupiedBeds
          FROM ipt i
          WHERE i.dchtype IS NULL
            AND i.ward IN ('02', '04', '05', '06', '09')
          GROUP BY i.ward
        `),

        // Group 2b: VIP room (ward '04') — count distinct bedno LIKE 'v%'
        // PHP uses distinct bedno for room count vs person count
        queryHosDb(`
          SELECT COUNT(DISTINCT b.bedno) AS occupiedBeds
          FROM ipt i
          LEFT OUTER JOIN iptadm b ON i.an = b.an
          WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'
        `),

        // Group 2b-extra: VIP room person count (non-distinct)
        queryHosDb(`
          SELECT COUNT(b.bedno) AS personCount
          FROM ipt i
          LEFT OUTER JOIN iptadm b ON i.an = b.an
          WHERE i.dchtype IS NULL AND b.bedno LIKE 'v%'
        `),

        // Group 2c: ห้องคลอด รอคลอด (bedno LIKE 'C0%')
        queryHosDb(`
          SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds
          FROM ipt i
          LEFT OUTER JOIN iptadm ip ON i.an = ip.an
          WHERE i.dchtype IS NULL
            AND i.ward = '02'
            AND ip.bedno <> ''
            AND ip.bedno LIKE 'C0%'
        `),

        // Group 2d: ห้องคลอด หลังคลอด (bedno LIKE 'CP%')
        queryHosDb(`
          SELECT COUNT(DISTINCT ip.bedno) AS occupiedBeds
          FROM ipt i
          LEFT OUTER JOIN iptadm ip ON i.an = ip.an
          WHERE i.dchtype IS NULL
            AND i.ward = '02'
            AND ip.bedno <> ''
            AND ip.bedno LIKE 'CP%'
        `),

        // Group 3a: Admit today per ward
        queryHosDb(`
          SELECT i.ward, COUNT(i.an) AS admitCount
          FROM ipt i
          WHERE i.regdate = CURRENT_DATE
            AND i.ward IN ('02', '04', '05', '06', '09')
          GROUP BY i.ward
        `),

        // Group 3b: Discharge today per ward
        queryHosDb(`
          SELECT i.ward, COUNT(i.an) AS dischargeCount
          FROM ipt i
          WHERE i.dchdate = CURRENT_DATE
            AND i.ward IN ('02', '04', '05', '06', '09')
          GROUP BY i.ward
        `),

        // Group 4a: Occupancy rate overall — monthly sum from an_stat
        queryHosDb(`
          SELECT
            SUM(admdate) AS totalAdmDays,
            DAY(LAST_DAY(CURRENT_DATE)) AS daysInMonth
          FROM an_stat
          WHERE dchdate BETWEEN
            DATE_ADD(DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY), INTERVAL -1 MONTH)
            AND LAST_DAY(CURRENT_DATE)
        `),

        // Group 4b: Occupancy rate by ward
        queryHosDb(`
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

        // Group 6: ICU on ventilator (icode items for ventilator usage)
        queryHosDb(`
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

        // Group 5: Specialty breakdown per ward
        queryHosDb(`
          SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
          FROM ipt i
          LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
          WHERE i.dchdate IS NULL AND i.ward = '06'
          GROUP BY i.spclty
        `),
        queryHosDb(`
          SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
          FROM ipt i
          LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
          WHERE i.dchdate IS NULL AND i.ward = '05'
          GROUP BY i.spclty
        `),
        queryHosDb(`
          SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
          FROM ipt i
          LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
          WHERE i.dchdate IS NULL AND i.ward = '04'
          GROUP BY i.spclty
        `),
        queryHosDb(`
          SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
          FROM ipt i
          LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
          WHERE i.dchdate IS NULL AND i.ward = '02'
          GROUP BY i.spclty
        `),
        queryHosDb(`
          SELECT COUNT(i.an) AS patientCount, s.name AS specialtyName
          FROM ipt i
          LEFT OUTER JOIN spclty s ON i.spclty = s.spclty
          WHERE i.dchdate IS NULL AND i.ward = '09'
          GROUP BY i.spclty
        `),

        // Group 7a: ICNP classification per ward (06, 05, 04, 02, 09)
        queryHosDb(`
          SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
          FROM ipt_icnp i
          LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
          LEFT OUTER JOIN ipt ii ON i.an = ii.an
          WHERE ii.dchdate IS NULL AND ii.ward = '06' AND ic.icnp_classification_name IS NOT NULL
          GROUP BY i.icnp_classification_id
          ORDER BY i.icnp_classification_id DESC
        `),
        queryHosDb(`
          SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
          FROM ipt_icnp i
          LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
          LEFT OUTER JOIN ipt ii ON i.an = ii.an
          WHERE ii.dchdate IS NULL AND ii.ward = '05' AND ic.icnp_classification_name IS NOT NULL
          GROUP BY i.icnp_classification_id
          ORDER BY i.icnp_classification_id DESC
        `),
        queryHosDb(`
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
        queryHosDb(`
          SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
          FROM ipt_icnp i
          LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
          LEFT OUTER JOIN ipt ii ON i.an = ii.an
          WHERE ii.dchdate IS NULL AND ii.ward = '02' AND ic.icnp_classification_name IS NOT NULL
          GROUP BY i.icnp_classification_id
          ORDER BY i.icnp_classification_id DESC
        `),
        queryHosDb(`
          SELECT COUNT(ii.an) AS can, ic.icnp_classification_name AS icnpName
          FROM ipt_icnp i
          LEFT OUTER JOIN icnp_classification ic ON i.icnp_classification_id = ic.icnp_classification_id
          LEFT OUTER JOIN ipt ii ON i.an = ii.an
          WHERE ii.dchdate IS NULL AND ii.ward = '09' AND ic.icnp_classification_name IS NOT NULL
          GROUP BY i.icnp_classification_id
          ORDER BY i.icnp_classification_id DESC
        `),

        // Group 7b: Unclassified beds per ward (beds with no ICNP classification)
        queryHosDb(`
          SELECT DISTINCT i.bedno
          FROM iptadm i
          LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
          LEFT OUTER JOIN an_stat a ON a.an = i.an
          WHERE a.dchdate IS NULL AND a.ward = '06' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
          ORDER BY i.bedno ASC
        `),
        queryHosDb(`
          SELECT DISTINCT i.bedno
          FROM iptadm i
          LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
          LEFT OUTER JOIN an_stat a ON a.an = i.an
          WHERE a.dchdate IS NULL AND a.ward = '05' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
          ORDER BY i.bedno ASC
        `),
        queryHosDb(`
          SELECT DISTINCT i.bedno
          FROM iptadm i
          LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
          LEFT OUTER JOIN an_stat a ON a.an = i.an
          WHERE a.dchdate IS NULL AND a.ward = '04' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
          ORDER BY i.bedno ASC
        `),
        queryHosDb(`
          SELECT DISTINCT i.bedno
          FROM iptadm i
          LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
          LEFT OUTER JOIN an_stat a ON a.an = i.an
          WHERE a.dchdate IS NULL AND a.ward = '02' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
          ORDER BY i.bedno ASC
        `),
        queryHosDb(`
          SELECT DISTINCT i.bedno
          FROM iptadm i
          LEFT OUTER JOIN ipt_icnp p ON i.an = p.an
          LEFT OUTER JOIN an_stat a ON a.an = i.an
          WHERE a.dchdate IS NULL AND a.ward = '09' AND p.icnp_classification_id IS NULL AND i.bedno IS NOT NULL AND i.bedno <> ''
          ORDER BY i.bedno ASC
        `),
      ])

      // Parse results
      const opdPatientCount = Number((opdResult[0] as Record<string, unknown>)?.opdCount) || 0

      // Build ward occupancy map
      const occupancyByWard = new Map<string, number>()
      for (const row of wardOccupancyResult) {
        const r = row as Record<string, unknown>
        occupancyByWard.set(String(r.ward), Number(r.occupiedBeds) || 0)
      }

      // VIP room (ward '04') uses distinct bedno for room count
      const vipRoomCount = Number((vipRoomResult[0] as Record<string, unknown>)?.occupiedBeds) || 0
      const vipPersonCount = Number((vipRoomPersonResult[0] as Record<string, unknown>)?.personCount) || 0

      // ห้องคลอด sub-sections
      const preDeliveryOccupied = Number((deliveryPreResult[0] as Record<string, unknown>)?.occupiedBeds) || 0
      const postDeliveryOccupied = Number((deliveryPostResult[0] as Record<string, unknown>)?.occupiedBeds) || 0

      // Admit/discharge maps
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

      // Occupancy rate overall
      const overallRow = occupancyRateOverallResult[0] as Record<string, unknown> | undefined
      const totalAdmDays = Number(overallRow?.totalAdmDays) || 0
      const daysInMonth = Number(overallRow?.daysInMonth) || 30

      // Occupancy rate by ward
      const occupancyRateByWard = new Map<string, number>()
      for (const row of occupancyRateByWardResult) {
        const r = row as Record<string, unknown>
        occupancyRateByWard.set(String(r.ward), Number(r.totalAdmDays) || 0)
      }

      // ICU ventilator
      const onVentilator = Number((icuVentilatorResult[0] as Record<string, unknown>)?.onVentilator) || 0

      // Specialty results map
      const specialtyResults: Record<string, SpecialtyBreakdown[]> = {
        '06': parseSpecialties(specialtyWard06Result),
        '05': parseSpecialties(specialtyWard05Result),
        '04': parseSpecialties(specialtyWard04Result),
        '02': parseSpecialties(specialtyWard02Result),
        '09': parseSpecialties(specialtyWard09Result),
      }

      // ICNP classification results map
      const icnpResults: Record<string, IcnpClassification[]> = {
        '06': parseIcnp(icnpWard06Result),
        '05': parseIcnp(icnpWard05Result),
        '04': parseIcnp(icnpWard04Result),
        '02': parseIcnp(icnpWard02Result),
        '09': parseIcnp(icnpWard09Result),
      }

      // Unclassified beds map
      const unclassifiedBedsResults: Record<string, string[]> = {
        '06': parseUnclassifiedBeds(unclassifiedBedsWard06Result),
        '05': parseUnclassifiedBeds(unclassifiedBedsWard05Result),
        '04': parseUnclassifiedBeds(unclassifiedBedsWard04Result),
        '02': parseUnclassifiedBeds(unclassifiedBedsWard02Result),
        '09': parseUnclassifiedBeds(unclassifiedBedsWard09Result),
      }

      // Build ward occupancy array
      const wards: WardOccupancy[] = WARD_CONFIG.map(config => {
        let occupied: number

        if (config.wardCode === '04') {
          // ห้องพิเศษ uses distinct bedno count (rooms, not persons)
          occupied = vipRoomCount
        } else {
          occupied = occupancyByWard.get(config.wardCode) || 0
        }

        const remaining = Math.max(0, config.beds - occupied)
        const usagePercent = config.beds > 0
          ? Number(((occupied * 100) / config.beds).toFixed(2))
          : 0

        // Ward-level occupancy rate from an_stat
        const wardAdmDays = occupancyRateByWard.get(config.wardCode) || 0
        const wardOccRate = (config.beds > 0 && daysInMonth > 0)
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

        // Extra data for specific wards
        if (config.wardCode === '05') {
          // ICU: ventilator and CI (non-ventilator critical)
          const icuOccupied = occupancyByWard.get('05') || 0
          ward.extra = {
            onVentilator,
            ciCount: Math.max(0, icuOccupied - onVentilator),
          }
        } else if (config.wardCode === '04') {
          // ห้องพิเศษ: note about room vs person count
          ward.extra = {
            vipPersons: vipPersonCount,
          }
          ward.occupiedBeds = vipRoomCount
        } else if (config.wardCode === '02') {
          // ห้องคลอด: pre-delivery and post-delivery sub-sections
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

      // Totals
      const totalOccupied = wards.reduce((sum, w) => sum + w.occupiedBeds, 0)
      const totalRemaining = Math.max(0, TOTAL_BEDS - totalOccupied)
      const totalUsagePercent = TOTAL_BEDS > 0
        ? Number(((totalOccupied * 100) / TOTAL_BEDS).toFixed(2))
        : 0
      const overallOccupancyRate = (TOTAL_BEDS > 0 && daysInMonth > 0)
        ? Number(((totalAdmDays * 100) / (TOTAL_BEDS * daysInMonth)).toFixed(2))
        : 0

      return {
        opdPatientCount,
        totalBeds: TOTAL_BEDS,
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
    }, 10000) // 10 seconds cache

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Bed occupancy API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอัตราการครองเตียง',
      },
      { status: 500 }
    )
  }
}

/** Parse specialty query results into typed array */
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

/** Parse ICNP classification query results */
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

/** Parse unclassified beds query results */
function parseUnclassifiedBeds(rows: unknown[]): string[] {
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>
      return String(r.bedno || '').trim()
    })
    .filter(bed => bed.length > 0)
}
