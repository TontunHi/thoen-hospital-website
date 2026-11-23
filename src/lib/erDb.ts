import { apiGateway } from '@/lib/apiGateway'
import { queryClinicalDb } from '@/lib/clinicalDb'
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

/**
 * Fetch live Emergency Room (ER) triage status from HOSxP via Gateway with mandatory 8s TTL cache.
 */
export async function fetchErLiveStatusData(
  queryExecutor = queryClinicalDb
): Promise<ErLiveStatusRawData> {
  return getCachedData(
    'er-live-status-data',
    async () => {
      let activePatients: ErPatientRow[] | null = null
      let criticalCount = 0
      let emergencyCount = 0
      let urgencyCount = 0
      let semiUrgencyCount = 0
      let nonUrgencyCount = 0

      try {
        const gwRes = await apiGateway.clinical.getErStatus('tv')
        if (gwRes && Array.isArray(gwRes.activePatients)) {
          activePatients = gwRes.activePatients as ErPatientRow[]
          if (Array.isArray(gwRes.levels)) {
            const levels = gwRes.levels as Array<{ er_emergency_level_id?: number; total?: number | string }>
            criticalCount = Number(levels.find((l) => l.er_emergency_level_id === 1)?.total) || 0
            emergencyCount = Number(levels.find((l) => l.er_emergency_level_id === 2)?.total) || 0
            urgencyCount = Number(levels.find((l) => l.er_emergency_level_id === 3)?.total) || 0
            semiUrgencyCount = Number(levels.find((l) => l.er_emergency_level_id === 4)?.total) || 0
            nonUrgencyCount = Number(levels.find((l) => l.er_emergency_level_id === 5)?.total) || 0
          }
        }
      } catch {
        // Fallback to queryExecutor
      }

      if (activePatients === null) {
        const activePatientsQuery = `
          SELECT 
            pt.hn,
            er.vn,
            concat(coalesce(pt.pname, ''), coalesce(pt.fname, ''), ' ', coalesce(pt.lname, '')) as ptname,
            YEAR(current_date)-YEAR(pt.birthday) as age,
            i.bedno,
            time(er.enter_er_time) as enter_time,
            er.er_list,
            eel.er_emergency_level_name,
            er.er_emergency_level_id,
            er.observe,
            edt.name as dch_type_name,
            w.name as wardname,
            h.name as hosname 
          FROM er_regist er 
          left outer join vn_stat vn on er.vn=vn.vn 
          left outer join patient pt on vn.hn=pt.hn 
          left outer join er_emergency_level eel on er.er_emergency_level_id=eel.er_emergency_level_id 
          left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type 
          left outer join an_stat an on er.vn=an.vn 
          left outer join iptadm i on an.an=i.an  
          left outer join ward w on an.ward=w.ward   
          left outer join referout r on vn.vn=r.vn 
          left outer join hospcode h on r.refer_hospcode=h.hospcode 
          WHERE er.vstdate = current_date 
            and ((er.er_dch_type in ('2','3','5','6','7','8','9') and w.name is null) and h.name is null) 
          ORDER BY er.enter_er_time DESC
        `
        activePatients = await queryExecutor<ErPatientRow>(activePatientsQuery)
        criticalCount = activePatients.filter((p) => Number(p.er_emergency_level_id) === 1).length
        emergencyCount = activePatients.filter((p) => Number(p.er_emergency_level_id) === 2).length
        urgencyCount = activePatients.filter((p) => Number(p.er_emergency_level_id) === 3).length
        semiUrgencyCount = activePatients.filter((p) => Number(p.er_emergency_level_id) === 4).length
        nonUrgencyCount = activePatients.filter((p) => Number(p.er_emergency_level_id) === 5).length
      }

      const ptTypesQuery = `
        select count(er.vn) as v, ept.name 
        from er_regist er 
        left outer join er_period ep on er.er_period=ep.er_period 
        left outer join er_pt_type ept on er.er_pt_type=ept.er_pt_type 
        where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
        group by er.er_pt_type
      `
      const ptTypes = await queryExecutor<Record<string, unknown>>(ptTypesQuery)

      const emergencyLevelsQuery = `
        select count(er.vn) as v, ept.er_emergency_level_name 
        from er_regist er 
        left outer join er_period ep on er.er_period=ep.er_period 
        left outer join er_emergency_level ept on er.er_emergency_level_id=ept.er_emergency_level_id 
        where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
          and er.er_emergency_level_id is not null 
        group by ept.er_emergency_level_name 
        order by ept.er_emergency_level_id
      `
      const emergencyLevels = await queryExecutor<Record<string, unknown>>(emergencyLevelsQuery)

      const dischargeTypesQuery = `
        select count(er.vn) as v, ept.name 
        from er_regist er 
        left outer join er_period ep on er.er_period=ep.er_period 
        left outer join er_dch_type ept on er.er_dch_type=ept.er_dch_type 
        where er.vstdate BETWEEN DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 DAY),INTERVAL - 1 MONTH) and CURRENT_DATE() 
          and ept.er_dch_type is not null 
        group by ept.name 
        order by ept.er_dch_type
      `
      const dischargeTypes = await queryExecutor<Record<string, unknown>>(dischargeTypesQuery)

      const errorStatusQuery = `
        SELECT 
          d.\`name\` as nname,
          er.vstdate,
          pt.hn,
          er.vn,
          edt.name as status_name
        FROM er_regist er 
        left outer join vn_stat vn on er.vn=vn.vn 
        left outer join patient pt on vn.hn=pt.hn 
        left outer join er_dch_type edt on er.er_dch_type=edt.er_dch_type 
        left outer join doctor d on er.er_doctor=d.\`code\` 
        WHERE (er.vstdate between DATE_ADD(DATE_ADD(LAST_DAY(now()),INTERVAL 1 day),INTERVAL - 7 MONTH) 
               and DATE_ADD(DATE_ADD(CURDATE(),INTERVAL -1 day),INTERVAL 0 MONTH) ) 
          and (er.er_dch_type in ('5','6','7','8','9')) 
        ORDER BY er.vstdate DESC
      `
      const errorStatusRows = await queryExecutor<Record<string, unknown>>(errorStatusQuery)

      return {
        activePatients,
        errorStatusList: {
          total: errorStatusRows.length,
          list: errorStatusRows,
        },
        summary: {
          totalActive: activePatients.length,
          critical: criticalCount,
          emergency: emergencyCount,
          urgency: urgencyCount,
          semiUrgency: semiUrgencyCount,
          nonUrgency: nonUrgencyCount,
        },
        stats: {
          ptTypes,
          emergencyLevels,
          dischargeTypes,
        },
      }
    },
    8000
  )
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
