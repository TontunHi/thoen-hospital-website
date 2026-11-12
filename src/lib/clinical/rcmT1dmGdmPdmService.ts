import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'
import { isUniversalCoverageScheme } from './rcmColorectalCancerService'
import { matchesPttypeFilter } from './pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from './rcmSeamlessEnricher'

// ── Types: กองทุน T1DM/GDM/PDM (หัวข้อที่ 2 รายชื่อผู้รับบริการ) ──────────────────────

export type T1dmGdmPdmCardFilter =
  | 'ALL'
  | 'REGISTERED'
  | 'NOT_REGISTERED'
  | 'COMPENSATED'
  | 'UNCOMPENSATED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'UC_ONLY'

export type T1dmGdmPdmSearchField =
  | 'ALL'
  | 'HN'
  | 'CID'
  | 'PTNAME'
  | 'VN'
  | 'ICD10'
  | 'TYPE'
  | 'PTTYPE'
  | 'REP'

export type T1dmGdmPdmSortField =
  | 'vstdate'
  | 'vsttime'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'type'
  | 'regdate'
  | 'lmp'
  | 'pdx'
  | 'status'
  | 'compensated'

export interface T1dmGdmPdmReportParams extends FiscalDateRangeParams {
  cardFilter?: T1dmGdmPdmCardFilter
  searchField?: T1dmGdmPdmSearchField
  search?: string
  sortBy?: T1dmGdmPdmSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
  pttypes?: string
  ucOnly?: boolean
}

export interface T1dmGdmPdmRecipientItem {
  no: number
  vn: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  nation: string | null
  tel: string | null
  ok: string | null // 'Y' or null
  isRegistered: boolean
  type: string | null // e.g. T1DM, GDM, PDM
  regdate: string | null
  vstdate: string
  vsttime: string
  lmp: string | null
  authencode: string | null
  pttypenamePatient: string | null
  pttypenameVisit: string | null
  maininscl: string | null
  pttype_eclaim_id?: string
  department: string | null
  clinic: string | null
  pdx: string | null
  dx0: string | null
  dx1: string | null
  dx2: string | null
  dx3: string | null
  dx4: string | null
  dx5: string | null
  op0: string | null
  op1: string | null
  op2: string | null
  op3: string | null
  op4: string | null
  op5: string | null
  allDx: string[]
  allOp: string[]
  status: string | null
  rep: string | null
  compensated: number
  isCompensated: boolean
  fund: string | null
  subfund: string | null
  isUc: boolean
}

export interface T1dmGdmPdmSummary {
  totalCases: number
  uniquePatients: number
  registeredCases: number
  registeredRate: number
  notRegisteredCases: number
  notRegisteredRate: number
  compensatedCases: number
  compensationRate: number
  totalCompensated: number
  averageCompensated: number
  uncompensatedCases: number
  withAuthenCases: number
  withAuthenRate: number
  noAuthenCases: number
  ucCases: number
  ucRate: number
}

export interface T1dmGdmPdmReportResult {
  categoryTitle: string
  reportTitle: string
  ds1: string
  ds2: string
  summary: T1dmGdmPdmSummary
  items: T1dmGdmPdmRecipientItem[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  cardFilter: T1dmGdmPdmCardFilter
  search: string
  sortBy: T1dmGdmPdmSortField
  sortOrder: 'asc' | 'desc'
}

// ── Service Implementation ──────────────────────────────────────────────────

export class RcmT1dmGdmPdmService {
  /**
   * สร้างรายงานรายชื่อผู้รับบริการ กองทุน T1DM/GDM/PDM (หัวข้อที่ 2)
   * แปลงจาก FoxPro:
   * - ตาราง ovst o, patient pt, ovstdiag dx, vn_stat v
   * - เงื่อนไข dx.icd10 REGEXP 'O24' (โรคเบาหวานขณะตั้งครรภ์และระยะหลังคลอด)
   * - ข้อมูลทะเบียน rcmdb.t1dm dd ON dd.pid = pt.cid
   * - ข้อมูล Authen Code จาก rcmdb.authencode cc ON cc.vn = o.vn
   * - ข้อมูลชดเชยจาก rcmdb.repeclaim, rcmdb.repdata, rcmdb.neweclaim, eclaimdb.m_registerdata
   */
  static async getRecipientsReport(
    params: T1dmGdmPdmReportParams,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<T1dmGdmPdmReportResult> {
    const categoryTitle = 'กองทุน T1DM/GDM/PDM'
    const reportTitle = 'รายชื่อผู้รับบริการ'

    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)

    const cardFilter: T1dmGdmPdmCardFilter = params.cardFilter || 'ALL'
    const searchField: T1dmGdmPdmSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: T1dmGdmPdmSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-t1dm-gdm-pdm-recipients-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        // Safe check / query: join rcmdb.t1dm if available, otherwise coalesce
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
            IFNULL(pt.sex, '') AS sex_code,
            IFNULL(v.age_y, TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate)) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            CONCAT_WS(' ', NULLIF(pt.informtel, ''), NULLIF(pt.hometel, '')) AS tel,
            IF(dd.pid IS NOT NULL, 'Y', NULL) AS ok,
            dd.type AS type,
            DATE_FORMAT(dd.register_date, '%Y-%m-%d') AS regdate,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            (
              SELECT DATE_FORMAT(anc.lmp, '%Y-%m-%d')
              FROM person p
              JOIN person_anc anc ON anc.person_id = p.person_id
              WHERE p.patient_hn = o.hn
                AND (anc.labor_date IS NULL OR o.vstdate <= anc.labor_date)
              ORDER BY anc.person_anc_id DESC
              LIMIT 1
            ) AS lmp,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            IFNULL(ptt_pt.name, pt.pttype) AS pttypename_patient,
            IFNULL(ptt.name, o.pttype) AS pttypename_visit,
            IFNULL(ptt.hipdata_code, '') AS maininscl,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(dep.department, o.main_dep) AS department,
            IFNULL(spc.name, o.spclty) AS clinic,
            v.pdx,
            v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname, '-:ยังไม่ได้ส่ง') AS status,
            COALESCE(
              NULLIF(TRIM(nhso.rep), ''),
              NULLIF(TRIM(rep.rep), ''),
              NULLIF(TRIM(nn.Rep), ''),
              NULLIF(TRIM(m.rep), '')
            ) AS rep,
            CASE
              WHEN nhso.vn IS NOT NULL AND nhso.compensated > 0 THEN nhso.compensated
              WHEN rep.vn IS NOT NULL AND rep.compensated > 0 THEN rep.compensated
              WHEN nn.Seq IS NOT NULL AND nn.Income > 0 THEN nn.Income
              WHEN m.vn IS NOT NULL AND m.compensated > 0 THEN m.compensated
              ELSE COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated, 0)
            END AS compensated,
            rep.fund,
            rep.subfund
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          JOIN ovstdiag dx ON dx.vn = o.vn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN rcmdb.t1dm dd ON dd.pid = pt.cid
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: ได้รับ Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn,
                   GROUP_CONCAT(DISTINCT IF(errorcode = '' OR errorcode IS NULL, rep, NULL)) AS rep,
                   SUM(IF(errorcode = '' OR errorcode IS NULL, compensated, NULL)) AS compensated,
                   IF(SUM(IF(errorcode = '' OR errorcode IS NULL, 1, 0)) > 0, 'Rep :: ส่ง Rep แล้ว', NULL) AS statusname,
                   GROUP_CONCAT(DISTINCT fund SEPARATOR ', ') AS fund,
                   GROUP_CONCAT(DISTINCT subfund SEPARATOR ', ') AS subfund
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY vn
          ) rep ON rep.vn = o.vn
          LEFT JOIN rcmdb.neweclaim nn ON nn.Seq = o.vn
          LEFT JOIN (
            SELECT m.opdseq AS vn,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.rep ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
                   SUBSTRING_INDEX(GROUP_CONCAT(m.sums_serviceitem ORDER BY m.eclaim_no DESC), ',', 1) AS compensated,
                   SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(ecs.name, m.status) ORDER BY m.eclaim_no DESC), ',', 1) AS statusname
            FROM eclaimdb.m_registerdata m
            LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
            WHERE m.person_type = '1' AND IFNULL(m.opdseq,'') <> ''
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND dx.icd10 REGEXP 'O24'
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC;
        `

        const sqlParams: any[] = [
          ds1, ds2, // nhso
          ds1, ds2, // rep
          ds1, ds2, // ovst
        ]

        let rows: any[] = []
        try {
          rows = ((await executor(sql, sqlParams, { timeoutMs: 90000 })) as any[]) || []
        } catch (dbErr: any) {
          // If rcmdb.t1dm doesn't exist yet, retry without dd join and enrich from Website DB mirror if available
          if (dbErr?.message && /rcmdb\.t1dm/i.test(dbErr.message)) {
            const fallbackSql = sql.replace(
              'LEFT JOIN rcmdb.t1dm dd ON dd.pid = pt.cid',
              'LEFT JOIN (SELECT NULL AS pid, NULL AS type, NULL AS register_date) dd ON 1=0'
            )
            rows = ((await executor(fallbackSql, sqlParams, { timeoutMs: 90000 })) as any[]) || []
          } else {
            throw dbErr
          }
        }

        // Enrich with any T1DM records stored in t1dm_registries mirror table if not yet in rcmdb.t1dm
        if (executor === queryClinicalDb && rows.length > 0) {
          try {
            const { apiGateway } = await import('@/lib/apiGateway')
            const mirrorRows = await apiGateway.app.query<{
              pid: string
              type: string
              regdate: string
            }>(`
              SELECT pid, type, DATE_FORMAT(register_date, '%Y-%m-%d') AS regdate
              FROM t1dm_registries
              WHERE pid IS NOT NULL AND pid <> ''
            `)
            if (Array.isArray(mirrorRows) && mirrorRows.length > 0) {
              const mirrorMap = new Map<string, { type: string; regdate: string }>()
              for (const mr of mirrorRows) {
                if (mr.pid) {
                  mirrorMap.set(String(mr.pid).trim(), {
                    type: mr.type || 'T1DM',
                    regdate: mr.regdate || '',
                  })
                }
              }
              for (const r of rows) {
                const cid = String(r.cid || '').trim()
                if (!r.ok && cid && mirrorMap.has(cid)) {
                  const matched = mirrorMap.get(cid)!
                  r.ok = 'Y'
                  r.type = matched.type
                  r.regdate = matched.regdate || null
                }
              }
            }
          } catch {
            // non-blocking if mirror table doesn't exist
          }
        }

        return rows
      },
      600000 // Cache TTL 10 minutes
    )

    // Map rows into domain objects
    let allItems: T1dmGdmPdmRecipientItem[] = (rawRows || []).map((r, index) => {
      const okVal = r.ok === 'Y' || r.ok === '1' ? 'Y' : null
      const isRegistered = okVal === 'Y'
      const compensatedVal = Number(r.compensated || 0)
      const hasRep = Boolean(r.rep && String(r.rep).trim() !== '')
      const isCompensated = compensatedVal > 0 || hasRep
      const pttypeEclaimId = String(r.pttype_eclaim_id || '').trim()
      const isUc = isUniversalCoverageScheme(r.maininscl, r.pttypename_visit || r.pttypename_patient, pttypeEclaimId)

      const pdx = r.pdx ? String(r.pdx).trim() : null
      const dxList: string[] = [
        pdx,
        r.dx0 ? String(r.dx0).trim() : null,
        r.dx1 ? String(r.dx1).trim() : null,
        r.dx2 ? String(r.dx2).trim() : null,
        r.dx3 ? String(r.dx3).trim() : null,
        r.dx4 ? String(r.dx4).trim() : null,
        r.dx5 ? String(r.dx5).trim() : null,
      ].filter((x): x is string => Boolean(x && x !== ''))

      const opList: string[] = [
        r.op0 ? String(r.op0).trim() : null,
        r.op1 ? String(r.op1).trim() : null,
        r.op2 ? String(r.op2).trim() : null,
        r.op3 ? String(r.op3).trim() : null,
        r.op4 ? String(r.op4).trim() : null,
        r.op5 ? String(r.op5).trim() : null,
      ].filter((x): x is string => Boolean(x && x !== ''))

      return {
        no: index + 1,
        vn: String(r.vn || '').trim(),
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').trim(),
        ptname: String(r.ptname || '').trim(),
        sex: formatThaiSex(r.sex_code),
        birthday: r.birthday ? String(r.birthday) : null,
        age: Number(r.age || 0),
        nation: r.nation ? String(r.nation).trim() : null,
        tel: r.tel ? String(r.tel).trim() : null,
        ok: okVal,
        isRegistered,
        type: r.type ? String(r.type).trim() : null,
        regdate: r.regdate ? String(r.regdate) : null,
        vstdate: String(r.vstdate || ''),
        vsttime: String(r.vsttime || ''),
        lmp: r.lmp ? String(r.lmp) : null,
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypenamePatient: r.pttypename_patient ? String(r.pttypename_patient).trim() : null,
        pttypenameVisit: r.pttypename_visit ? String(r.pttypename_visit).trim() : null,
        maininscl: r.maininscl ? String(r.maininscl).trim() : null,
        pttype_eclaim_id: pttypeEclaimId,
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        op0: r.op0 ? String(r.op0).trim() : null,
        op1: r.op1 ? String(r.op1).trim() : null,
        op2: r.op2 ? String(r.op2).trim() : null,
        op3: r.op3 ? String(r.op3).trim() : null,
        op4: r.op4 ? String(r.op4).trim() : null,
        op5: r.op5 ? String(r.op5).trim() : null,
        allDx: dxList,
        allOp: opList,
        status: r.status ? String(r.status).trim() : (isCompensated ? 'มี Rep แล้ว' : 'รอส่งเบิก'),
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: compensatedVal,
        isCompensated,
        fund: r.fund ? String(r.fund).trim() : null,
        subfund: r.subfund ? String(r.subfund).trim() : null,
        isUc,
      }
    })

    // Dual-Mode summaryCohort Filtering (pttypes takes precedence, ucOnly fallback)
    allItems = await enrichItemsWithSeamlessCache(cacheKey, allItems, executor, Boolean(params.refresh))
    let summaryCohort = allItems
    if (params.pttypes) {
      summaryCohort = allItems.filter((i) =>
        matchesPttypeFilter((i as any).pttypename || i.pttypenameVisit || i.pttypenamePatient || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      )
    } else if (params.ucOnly) {
      summaryCohort = allItems.filter((i) => i.isUc)
    }

    // Compute Summary across summaryCohort
    const totalCases = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn))
    const uniquePatients = uniqueHns.size

    let registeredCases = 0
    let compensatedCases = 0
    let totalCompensated = 0
    let withAuthenCases = 0
    let ucCases = 0

    for (const item of summaryCohort) {
      if (item.isRegistered) registeredCases++
      if (item.isCompensated) {
        compensatedCases++
        totalCompensated += item.compensated
      }
      if (item.authencode) withAuthenCases++
      if (item.isUc) ucCases++
    }

    const notRegisteredCases = totalCases - registeredCases
    const uncompensatedCases = totalCases - compensatedCases
    const noAuthenCases = totalCases - withAuthenCases

    const registeredRate = totalCases > 0 ? (registeredCases / totalCases) * 100 : 0
    const notRegisteredRate = totalCases > 0 ? (notRegisteredCases / totalCases) * 100 : 0
    const compensationRate = totalCases > 0 ? (compensatedCases / totalCases) * 100 : 0
    const withAuthenRate = totalCases > 0 ? (withAuthenCases / totalCases) * 100 : 0
    const ucRate = totalCases > 0 ? (ucCases / totalCases) * 100 : 0
    const averageCompensated = compensatedCases > 0 ? totalCompensated / compensatedCases : 0

    const summary: T1dmGdmPdmSummary = {
      totalCases,
      uniquePatients,
      registeredCases,
      registeredRate,
      notRegisteredCases,
      notRegisteredRate,
      compensatedCases,
      compensationRate,
      totalCompensated,
      averageCompensated,
      uncompensatedCases,
      withAuthenCases,
      withAuthenRate,
      noAuthenCases,
      ucCases,
      ucRate,
    }

    // Apply Card Filter
    let filtered = [...summaryCohort]
    switch (cardFilter) {
      case 'REGISTERED':
        filtered = filtered.filter((i) => i.isRegistered)
        break
      case 'NOT_REGISTERED':
        filtered = filtered.filter((i) => !i.isRegistered)
        break
      case 'COMPENSATED':
        filtered = filtered.filter((i) => i.isCompensated)
        break
      case 'UNCOMPENSATED':
        filtered = filtered.filter((i) => !i.isCompensated)
        break
      case 'WITH_AUTHEN':
        filtered = filtered.filter((i) => Boolean(i.authencode))
        break
      case 'NO_AUTHEN':
        filtered = filtered.filter((i) => !i.authencode)
        break
      case 'UC_ONLY':
        filtered = filtered.filter((i) => i.isUc)
        break
      case 'ALL':
      default:
        break
    }

    // Apply Global Search
    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') return i.hn.toLowerCase().includes(search)
        if (searchField === 'CID') return i.cid.toLowerCase().includes(search)
        if (searchField === 'PTNAME') return i.ptname.toLowerCase().includes(search)
        if (searchField === 'VN') return i.vn.toLowerCase().includes(search)
        if (searchField === 'ICD10') {
          return (
            (i.pdx && i.pdx.toLowerCase().includes(search)) ||
            i.allDx.some((dx) => dx.toLowerCase().includes(search))
          )
        }
        if (searchField === 'TYPE') return i.type && i.type.toLowerCase().includes(search)
        if (searchField === 'PTTYPE') {
          return (
            (i.pttypenameVisit && i.pttypenameVisit.toLowerCase().includes(search)) ||
            (i.pttypenamePatient && i.pttypenamePatient.toLowerCase().includes(search))
          )
        }
        if (searchField === 'REP') return i.rep && i.rep.toLowerCase().includes(search)

        // Default 'ALL'
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          i.allDx.some((dx) => dx.toLowerCase().includes(search)) ||
          (i.type && i.type.toLowerCase().includes(search)) ||
          (i.pttypenameVisit && i.pttypenameVisit.toLowerCase().includes(search)) ||
          (i.pttypenamePatient && i.pttypenamePatient.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.status && i.status.toLowerCase().includes(search)) ||
          (i.department && i.department.toLowerCase().includes(search))
        )
      })
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (valA == null) valA = ''
      if (valB == null) valB = ''

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = String(valB).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Re-index displayed rows
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      no: idx + 1,
    }))

    const totalCount = reindexed.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    let resultItems: T1dmGdmPdmRecipientItem[] = reindexed
    if (!exportAll) {
      const startIndex = (page - 1) * pageSize
      resultItems = reindexed.slice(startIndex, startIndex + pageSize)
    }

    return {
      categoryTitle,
      reportTitle,
      ds1,
      ds2,
      summary,
      items: resultItems,
      totalCount,
      totalPages,
      page,
      pageSize,
      cardFilter,
      search,
      sortBy,
      sortOrder,
    }
  }
}
