import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type QueryExecutor } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  classifyPpSpecialCodes,
  PERSON_SELECT_COLUMNS,
  PERSON_FROM_JOINS,
  chunkArray,
  compareTargetItems,
  compareScreenedItems,
  compareService1B004NItems,
  type CcsTargetPopulationParams,
  type CcsTargetPopulationResult,
  type CcsTargetPopulationItem,
  type CcsTargetPopulationSummary,
  type CcsTargetScreeningFilter,
  type CcsTargetSearchField,
  type CcsTargetSortField,
  type CcsTargetRowMatchType,
  type RepIndividualPersonLookup,
  type CcsScreenedRecipientsParams,
  type CcsScreenedRecipientsResult,
  type CcsScreenedRecipientItem,
  type CcsScreenedRecipientsSummary,
  type CcsMethodFilter,
  type CcsOkFilter,
  type CcsResultStatusFilter,
  type CcsCompensationFilter,
  type CcsScreenedSearchField,
  type CcsScreenedSortField,
  type CcsAdpMappingCheck,
  type CcsAdpMappingItem,
  type CcsService1B004NParams,
  type CcsService1B004NResult,
  type CcsService1B004NItem,
  type CcsService1B004NSummary,
  type CcsService1B004NCompensationFilter,
  type CcsService1B004NSearchField,
  type CcsService1B004NSortField,
  type CcsService1B004PParams,
  type CcsService1B004PResult,
  type CcsService1B004PItem,
  type CcsService1B004PSummary,
  type CcsService1B004PCompensationFilter,
  type CcsService1B004PSearchField,
  type CcsService1B004PSortField,
  type CcsService1B004_0NParams,
  type CcsService1B004_0NResult,
  type CcsService1B004_0NCompensationFilter,
  type CcsService1B004_0NSearchField,
  type CcsService1B004_0NSortField,
  type CcsService1B005Params,
  type CcsService1B005Result,
  type CcsService1B005CompensationFilter,
  type CcsService1B005SearchField,
  type CcsService1B005SortField,
} from './typesAndHelpers'

  /**
   * 1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก (Screened Recipients)
   * Corresponds to FoxPro `1.1.รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก` report:
   * Queries OPD visits in date range receiving CCS screening (PP special code,
   * Z124 diagnosis, Colposcopy ADP 1B005, or mapped CCS ADP items),
   * reconciles with Seamless (`rcmdb.seamless` CCS), HPV Rep (`rcmdb.repeclaim`),
   * AuthenCode, and NHSO / Rep / NewEclaim / EClaim reimbursement status.
   */
export async function getScreenedRecipientsReport(
    params: CcsScreenedRecipientsParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsScreenedRecipientsResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const methodFilter: CcsMethodFilter = params.methodFilter || 'ALL'
    const okFilter: CcsOkFilter = params.okFilter || 'ALL'
    const resultStatusFilter: CcsResultStatusFilter = params.resultStatusFilter || 'ALL'
    const compensationFilter: CcsCompensationFilter = params.compensationFilter || 'ALL'
    const searchField: CcsScreenedSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsScreenedSortField = params.sortBy || 'vstdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p2-recipients-${ds1}-${ds2}`

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            o.an,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(nat.name, pt.nationality) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            COALESCE(NULLIF(TRIM(cc.AuthenCode), ''), NULLIF(TRIM(vt.auth_code), ''), NULLIF(TRIM(vt.claim_code), '')) AS authencode,
            ptt_pt.name AS pttypename_patient,
            ptt_o.name AS pttypename_visit,
            ptt_o.pttype_eclaim_id AS pttype_eclaim_id,
            dep.department,
            spc.name AS clinic,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            IF(GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '^1B004|^1B30' OR pap.checkup = 'Y', 'Y', NULL)) IS NOT NULL, 'Y', NULL) AS ok,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0044','1B30','1B40','1B004N','1B004P'), t.pp_special_code, NULL)) AS papsmear,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0044','1B30','1B004N'), 'ปกติ', IF(t.pp_special_code IN ('1B40','1B004P'), 'ผิดปกติ', NULL))) AS papsmear_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0040','1B0041','1B0042','1B0043','1B0045','1B004_0N','1B004_0P'), t.pp_special_code, NULL)) AS via,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0040','1B0043','1B004_0N'), 'ปกติ', IF(t.pp_special_code IN ('1B0041','1B0042','1B0043','1B0045','1B004_0P'), 'ผิดปกติ', NULL))) AS via_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '^1B0046', t.pp_special_code, NULL)) AS hpv,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code REGEXP '1B0046_[12]', 'ผิดปกติ', IF(t.pp_special_code REGEXP '1B0046', 'ปกติ', NULL))) AS hpv_result,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0048','1B0049','0320277_0','0320277_1'), t.pp_special_code, NULL)) AS other,
            GROUP_CONCAT(DISTINCT IF(t.pp_special_code IN ('1B0048','1B0049','0320277_0'), 'ปกติ', IF(t.pp_special_code IN ('0320277_1'), 'ผิดปกติ', NULL))) AS other_result,
            pap.checkup AS colposcopy,
            sm.type AS type,
            IF(rr.vn IS NOT NULL, rr.rep, sm.rep) AS rep,
            IF(rr.vn IS NOT NULL, rr.compensated, sm.compensated) AS compensated,
            sm.note,
            sm.paydate,
            c.name AS listname,
            COALESCE(nhso.statusname, rep.statusname, nn.StatusName, m.statusname) AS status,
            COALESCE(nhso.rep, rep.rep, nn.Rep, m.rep) AS rep_nhso,
            COALESCE(nhso.compensated, rep.compensated, nn.Income, m.compensated) AS nhso
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT JOIN pttype ptt_pt ON ptt_pt.pttype = pt.pttype
          LEFT JOIN pttype ptt_o ON ptt_o.pttype = o.pttype
          LEFT JOIN kskdepartment dep ON dep.depcode = o.main_dep
          LEFT JOIN spclty spc ON spc.spclty = o.spclty
          LEFT JOIN pp_special pp ON o.vn = pp.vn
          LEFT JOIN pp_special_type t ON t.pp_special_type_id = pp.pp_special_type_id
          LEFT JOIN (
            SELECT
              vn,
              GROUP_CONCAT(DISTINCT type ORDER BY type SEPARATOR ', ') AS type,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(note, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS note,
              DATE_FORMAT(MAX(paydate), '%Y-%m-%d') AS paydate
            FROM rcmdb.seamless
            WHERE IFNULL(vn, '') <> '' AND rep REGEXP 'CCS'
            GROUP BY vn
          ) sm ON sm.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated
            FROM rcmdb.repeclaim
            WHERE IFNULL(vn, '') <> '' AND filename REGEXP 'HPV'
            GROUP BY vn
          ) rr ON rr.vn = o.vn
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN visit_pttype vt ON vt.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'NHSO :: มี Invoice แล้ว' AS statusname
            FROM rcmdb.repeclaim
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
            GROUP BY vn
          ) nhso ON nhso.vn = o.vn
          LEFT JOIN (
            SELECT vn, GROUP_CONCAT(DISTINCT rep) AS rep, SUM(compensated) AS compensated,
                   'Rep :: มี Rep แล้ว' AS statusname
            FROM rcmdb.repdata
            WHERE department = 'OP' AND IFNULL(vn,'') <> '' AND admdate >= ? AND admdate < DATE_ADD(?, INTERVAL 1 DAY)
              AND (errorcode = '' OR errorcode IS NULL)
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
          LEFT JOIN (
            SELECT o2.vn, 'Y' AS checkup
            FROM ovst o2
            JOIN opitemrece oo ON oo.vn = o2.vn
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE o2.vstdate BETWEEN ? AND ? AND d.nhso_adp_code = '1B005'
            GROUP BY o2.vn
          ) pap ON pap.vn = o.vn
          LEFT JOIN (
            SELECT oo.vn, GROUP_CONCAT(DISTINCT d.nhso_adp_code) AS name
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE IFNULL(oo.vn,'') <> '' AND oo.vstdate BETWEEN ? AND ?
              AND d.nhso_adp_code IN ('1B0046_0','1B0046_01','1B0046_1','1B0046_11','1B0046_2','1B0046_21','1B004_0N','1B004_0P','1B004N','1B004P','1B005')
            GROUP BY oo.vn
          ) c ON c.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND (
              t.pp_special_code REGEXP '^1B004|^1B30|^01B40|^0320277'
              OR CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) REGEXP 'Z124'
              OR pap.checkup = 'Y'
              OR c.vn IS NOT NULL
            )
          GROUP BY o.vn
          ORDER BY o.vstdate DESC, o.vsttime DESC
        `
        return (await executor(
          sql,
          [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2],
          { timeoutMs: 60000 }
        )) as Record<string, unknown>[]
      },
      300000
    )

    const items: CcsScreenedRecipientItem[] = (rawRows || []).map((r) => {
      const papsmear_result = r.papsmear_result ? String(r.papsmear_result).trim() : null
      const via_result = r.via_result ? String(r.via_result).trim() : null
      const hpv_result = r.hpv_result ? String(r.hpv_result).trim() : null
      const other_result = r.other_result ? String(r.other_result).trim() : null

      const hasAbnormalResult =
        Boolean(papsmear_result && papsmear_result.includes('ผิดปกติ')) ||
        Boolean(via_result && via_result.includes('ผิดปกติ')) ||
        Boolean(hpv_result && hpv_result.includes('ผิดปกติ')) ||
        Boolean(other_result && other_result.includes('ผิดปกติ'))

      return {
        no: 0,
        vn: String(r.vn || '').trim(),
        an: r.an ? String(r.an).trim() : null,
        hn: String(r.hn || '').trim(),
        cid: String(r.cid || '').replace(/\D/g, ''),
        ptname: String(r.ptname || '').trim(),
        age: r.age != null ? Number(r.age) : null,
        nation: r.nation ? String(r.nation).trim() : null,
        vstdate: String(r.vstdate || '').trim(),
        vsttime: String(r.vsttime || '').trim(),
        authencode: r.authencode ? String(r.authencode).trim() : null,
        pttypename_patient: r.pttypename_patient ? String(r.pttypename_patient).trim() : null,
        pttypename_visit: r.pttypename_visit ? String(r.pttypename_visit).trim() : null,
        pttype_eclaim_id: r.pttype_eclaim_id ? String(r.pttype_eclaim_id).trim() : null,
        isUc: isUcEclaimCode(r.pttype_eclaim_id ? String(r.pttype_eclaim_id) : null),
        department: r.department ? String(r.department).trim() : null,
        clinic: r.clinic ? String(r.clinic).trim() : null,
        pdx: r.pdx ? String(r.pdx).trim() : null,
        dx0: r.dx0 ? String(r.dx0).trim() : null,
        dx1: r.dx1 ? String(r.dx1).trim() : null,
        dx2: r.dx2 ? String(r.dx2).trim() : null,
        dx3: r.dx3 ? String(r.dx3).trim() : null,
        dx4: r.dx4 ? String(r.dx4).trim() : null,
        dx5: r.dx5 ? String(r.dx5).trim() : null,
        ok: r.ok === 'Y' ? 'Y' : null,
        papsmear: r.papsmear ? String(r.papsmear).trim() : null,
        papsmear_result,
        via: r.via ? String(r.via).trim() : null,
        via_result,
        hpv: r.hpv ? String(r.hpv).trim() : null,
        hpv_result,
        other: r.other ? String(r.other).trim() : null,
        other_result,
        colposcopy: r.colposcopy === 'Y' ? 'Y' : null,
        type: r.type ? String(r.type).trim() : null,
        rep: r.rep ? String(r.rep).trim() : null,
        compensated: Number(r.compensated || 0),
        note: r.note ? String(r.note).trim() : null,
        paydate: r.paydate ? String(r.paydate).trim() : null,
        listname: r.listname ? String(r.listname).trim() : null,
        status: r.status ? String(r.status).trim() : null,
        rep_nhso: r.rep_nhso ? String(r.rep_nhso).trim() : null,
        nhso: Number(r.nhso || 0),
        hasAbnormalResult,
      }
    })

    const enrichedItems = await enrichItemsWithSeamlessCache(
      cacheKey,
      items,
      executor,
      Boolean((params as any).refresh)
    )

    // Full Page Filter: Apply pttypes / ucOnly filter across all cohort items before summary & pagination
    const summaryCohort = enrichedItems.filter((i) => {
      if (params.pttypes !== undefined) {
        return matchesPttypeFilter((i as any).pttypename || i.pttypename_visit || i.pttypename_patient || i.pttype_eclaim_id, params.pttypes, i.isUc, i.pttype_eclaim_id)
      }
      if (params.ucOnly) {
        return i.isUc ?? false
      }
      return true
    })

    // Compute Summary across summaryCohort
    const totalVisits = summaryCohort.length
    const uniqueHns = new Set(summaryCohort.map((i) => i.hn).filter(Boolean))
    const uniquePatients = uniqueHns.size
    const okCount = summaryCohort.filter((i) => i.ok === 'Y').length
    const notOkCount = summaryCohort.filter((i) => i.ok !== 'Y').length
    const papCount = summaryCohort.filter((i) => Boolean(i.papsmear)).length
    const viaCount = summaryCohort.filter((i) => Boolean(i.via)).length
    const hpvCount = summaryCohort.filter((i) => Boolean(i.hpv)).length
    const colposcopyCount = summaryCohort.filter((i) => i.colposcopy === 'Y').length
    const abnormalCount = summaryCohort.filter((i) => i.hasAbnormalResult).length
    const totalSeamlessCompensated = summaryCohort.reduce((acc, i) => acc + i.compensated, 0)
    const totalNhsoCompensated = summaryCohort.reduce((acc, i) => acc + i.nhso, 0)

    const summary: CcsScreenedRecipientsSummary = {
      totalVisits,
      uniquePatients,
      okCount,
      notOkCount,
      papCount,
      viaCount,
      hpvCount,
      colposcopyCount,
      abnormalCount,
      totalSeamlessCompensated,
      totalNhsoCompensated,
    }

    const repBreakdown = buildRepBreakdownSummary(summaryCohort)
    const selectedReps = parseRepFilterParam(params.reps)

    // Filter by screening method (FoxPro cshow: ทั้งหมด, PapSmear, VIA, HPV, ColpoScopy)
    let filtered = summaryCohort
    if (methodFilter === 'PapSmear') {
      filtered = filtered.filter((i) => Boolean(i.papsmear))
    } else if (methodFilter === 'VIA') {
      filtered = filtered.filter((i) => Boolean(i.via))
    } else if (methodFilter === 'HPV') {
      filtered = filtered.filter((i) => Boolean(i.hpv))
    } else if (methodFilter === 'ColpoScopy') {
      filtered = filtered.filter((i) => i.colposcopy === 'Y')
    }

    // Filter by OK recording status
    if (okFilter === 'OK') {
      filtered = filtered.filter((i) => i.ok === 'Y')
    } else if (okFilter === 'NOT_OK') {
      filtered = filtered.filter((i) => i.ok !== 'Y')
    }

    // Filter by test results
    if (resultStatusFilter === 'ABNORMAL') {
      filtered = filtered.filter((i) => i.hasAbnormalResult)
    } else if (resultStatusFilter === 'NORMAL') {
      filtered = filtered.filter((i) => !i.hasAbnormalResult)
    }

    // Filter by compensation
    if (compensationFilter === 'COMPENSATED') {
      filtered = filtered.filter((i) => i.compensated > 0 || i.nhso > 0 || i.status !== null || i.rep !== null)
    } else if (compensationFilter === 'UNCOMPENSATED') {
      filtered = filtered.filter(
        (i) => i.compensated === 0 && i.nhso === 0 && i.status === null && i.rep === null
      )
    }

    // Filter by search
    if (selectedReps.length > 0) {
      filtered = filtered.filter((i) => matchesRepFilter(i, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((i) => {
        if (searchField === 'HN') {
          return i.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return i.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return i.ptname.toLowerCase().includes(search)
        }
        if (searchField === 'VN') {
          return i.vn.toLowerCase().includes(search)
        }
        return (
          matchesSeamlessRepSearch(i, search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.vn.toLowerCase().includes(search) ||
          (i.pdx && i.pdx.toLowerCase().includes(search)) ||
          (i.listname && i.listname.toLowerCase().includes(search))
        )
      })
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => compareScreenedItems(a, b, sortBy, sortOrder))

    const totalCount = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.min(page, totalPages)

    const slice = exportAll ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    const offset = exportAll ? 0 : (safePage - 1) * pageSize

    const numberedItems = slice.map((item, idx) => ({
      ...item,
      no: offset + idx + 1,
    }))

    return {
      ds1,
      ds2,
      methodFilter,
      okFilter,
      resultStatusFilter,
      compensationFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
      repBreakdown,
    }
  }
