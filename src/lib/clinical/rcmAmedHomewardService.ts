import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import {
  resolveFiscalDateRange,
  formatThaiSex,
  type FiscalDateRangeParams,
  type QueryExecutor,
} from './rcmDashboardService'

// ── 1. Domain Types: ระบบ AMed และ Home Ward - รายงาน HOMEWARD ──────────────

export type HomewardCardFilter =
  | 'ALL'
  | 'ON_AMED'
  | 'NOT_ON_AMED'
  | 'WITH_AUTHEN'
  | 'NO_AUTHEN'
  | 'WITH_REP'
  | 'NO_REP'
  | 'WITH_DEBIT'

export type HomewardSortField =
  | 'dchdate'
  | 'admdate'
  | 'an'
  | 'hn'
  | 'cid'
  | 'ptname'
  | 'age'
  | 'los'
  | 'pdx'
  | 'income'
  | 'debit'
  | 'adjrw'

export interface HomewardReportParams extends FiscalDateRangeParams {
  cardFilter?: HomewardCardFilter
  search?: string
  sortBy?: HomewardSortField
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  exportAll?: boolean
  refresh?: boolean
}

export interface HomewardItem {
  no: number
  an: string
  hn: string
  cid: string
  ptname: string
  sex: string
  birthday: string | null
  age: number
  nation: string
  admdate: string
  dchdate: string
  los: number
  editdate: string | null
  day_diff: number
  ward: string
  bedno: string
  clinic: string
  prediag: string
  pdx: string
  pdxname: string
  sdx: string
  proc_code: string
  adjrw: number
  admdoctor: string
  dchdoctor: string
  authencode: string | null
  hasAuthen: boolean
  pttype_eclaim_id: string
  pttype_eclaim_name: string
  pttype: string
  pttypename: string
  copttype: string
  gfmis: string
  accountcode: string
  pttypeno: string
  hospmain: string
  hospsub: string
  dchstts: string
  dchtype: string
  summary_status: string
  income: number
  uc_money: number
  discount_money: number
  paid_money: number
  rcpt_money: number
  rcpno: string
  debit: number
  max_debt_amount: number | null
  follow_money: number
  bill: string | null
  billdate: string | null
  staff: string
  address: string
  mobile: string
  tel: string
  rep: string | null
  rep_remark: string | null
  invoice: string | null
  onweb_cid: string | null
  anonweb: string | null
  isOnAmed: boolean
  hasRep: boolean
}

export interface HomewardSummary {
  totalCases: number
  onAmedCases: number
  notOnAmedCases: number
  withAuthenCases: number
  noAuthenCases: number
  withRepCases: number
  noRepCases: number
  withDebitCases: number
  totalIncome: number
  totalDebit: number
  totalAdjrw: number
  avgLos: number
}

export interface HomewardReportResult {
  ds1: string
  ds2: string
  cardFilter: HomewardCardFilter
  search: string
  sortBy: HomewardSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: HomewardSummary
  items: HomewardItem[]
}

// ── 2. Service Implementation ────────────────────────────────────────────────

export class RcmAmedHomewardService {
  /**
   * Helper to check if rcmdb.amed table exists in the connected database.
   */
  static async checkAmedTableExists(executor: QueryExecutor = queryClinicalDb): Promise<boolean> {
    try {
      const res = await executor("SHOW TABLES IN rcmdb LIKE 'amed'")
      return Array.isArray(res) && res.length > 0
    } catch {
      return false
    }
  }

  /**
   * Fetch and calculate HOMEWARD report with full Two-Tier Query and In-Memory Filtering.
   */
  static async getHomewardReport(
    params: HomewardReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<HomewardReportResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const cardFilter: HomewardCardFilter = params.cardFilter || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: HomewardSortField = params.sortBy || 'dchdate'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'desc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.min(500, Math.max(1, Number(params.pageSize || 50)))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-homeward-report-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const hasAmedTable = await this.checkAmedTableExists(executor)

        const amedJoin = hasAmedTable
          ? 'LEFT OUTER JOIN rcmdb.amed aa ON aa.cid = pt.cid'
          : ''
        const amedSelect = hasAmedTable
          ? 'MAX(aa.cid) AS onweb_cid, MAX(aa.an) AS anonweb,'
          : 'NULL AS onweb_cid, NULL AS anonweb,'

        const sql = `
          SELECT 
            r.rep,
            r.remark AS rep_remark,
            re.rep AS invoice,
            ${amedSelect}
            i.an,
            i.hn,
            IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            IFNULL(pt.sex, '') AS sex_code,
            DATE_FORMAT(pt.birthday, '%Y-%m-%d') AS birthday,
            IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, i.regdate), 0) AS age,
            CONCAT_WS(':', pt.nationality, IFNULL(nat.name, pt.nationality)) AS nation,
            DATE_FORMAT(i.regdate, '%Y-%m-%d') AS admdate,
            DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS dchdate,
            IFNULL(a.admdate, 0) AS los,
            DATE_FORMAT(idx.modify_datetime, '%Y-%m-%d %H:%i') AS editdate,
            IFNULL(TIMESTAMPDIFF(DAY, i.dchdate, idx.modify_datetime), 0) AS day_diff,
            IFNULL(w.name, i.ward) AS ward,
            IFNULL(adm.bedno, '') AS bedno,
            IFNULL(spc.name, i.spclty) AS clinic,
            IFNULL(i.prediag, '') AS prediag,
            IFNULL(a.pdx, '') AS pdx,
            IFNULL(icd.name, a.pdx) AS pdxname,
            (
              SELECT GROUP_CONCAT(DISTINCT dx2.icd10 ORDER BY dx2.diagtype SEPARATOR ', ')
              FROM iptdiag dx2
              WHERE dx2.an = i.an AND dx2.diagtype <> 1
            ) AS sdx,
            (
              SELECT GROUP_CONCAT(DISTINCT op.icd9 SEPARATOR ', ')
              FROM iptoprt op
              WHERE op.an = i.an
            ) AS proc_code,
            IFNULL(i.adjrw, 0) AS adjrw,
            IFNULL(d1.name, i.admdoctor) AS admdoctor,
            IFNULL(d2.name, i.dch_doctor) AS dchdoctor,
            IFNULL(cc.auth_code, '') AS authencode,
            IFNULL(ptt.pttype_eclaim_id, '') AS pttype_eclaim_id,
            IFNULL(e.name, '') AS pttype_eclaim_name,
            IFNULL(i.pttype, '') AS pttype,
            IFNULL(ptt.name, i.pttype) AS pttypename,
            IFNULL(ptt.pttype, '') AS copttype,
            IFNULL(e.gf_ipd, '') AS gfmis,
            IFNULL(e.ar_ipd, '') AS accountcode,
            IFNULL(v.pttypeno, '') AS pttypeno,
            CONCAT_WS(':', v.hospmain, IFNULL(hm.name, v.hospmain)) AS hospmain,
            CONCAT_WS(':', v.hospsub, IFNULL(hs.name, v.hospsub)) AS hospsub,
            IFNULL(ds.name, i.dchstts) AS dchstts,
            IFNULL(dt.name, i.dchtype) AS dchtype,
            IFNULL(iss.ipt_summary_status_name, i.ipt_summary_status_id) AS summary_status,
            IFNULL(a.income, 0) AS income,
            IFNULL(a.uc_money, 0) AS uc_money,
            IFNULL(a.discount_money, 0) AS discount_money,
            IFNULL(a.paid_money, 0) AS paid_money,
            IFNULL(a.rcpt_money, 0) AS rcpt_money,
            IFNULL(a.rcpno_list, '') AS rcpno,
            (IFNULL(a.income, 0) - IFNULL(a.discount_money, 0) - IFNULL(a.rcpt_money, 0)) AS debit,
            (SELECT MAX(max_debt_amount) FROM ipt_pttype WHERE an = i.an) AS max_debt_amount,
            SUM(IFNULL(p.follow, 0)) AS follow_money,
            GROUP_CONCAT(DISTINCT CONCAT(p.bill, '#', IFNULL(p.follow, 0)) SEPARATOR ', ') AS bill,
            GROUP_CONCAT(DISTINCT DATE_FORMAT(p.lastdate, '%Y-%m-%d') SEPARATOR ', ') AS billdate,
            IFNULL(opu.name, i.staff) AS staff,
            IFNULL(pt.informaddr, '') AS address,
            IFNULL(pt.mobile_phone_number, '') AS mobile,
            CONCAT_WS(' / ', NULLIF(TRIM(pt.informtel), ''), NULLIF(TRIM(pt.hometel), '')) AS tel
          FROM ipt i
          LEFT OUTER JOIN an_stat a ON a.an = i.an
          LEFT OUTER JOIN patient pt ON i.hn = pt.hn
          LEFT OUTER JOIN rcmdb.debit_ipd_paid p ON p.an = i.an
          LEFT OUTER JOIN pttype ptt ON ptt.pttype = i.pttype
          LEFT OUTER JOIN pttype_eclaim e ON e.code = ptt.pttype_eclaim_id
          LEFT OUTER JOIN vn_stat v ON v.vn = i.vn
          LEFT OUTER JOIN iptdiag idx ON i.an = idx.an AND idx.diagtype = 1
          LEFT OUTER JOIN visit_pttype cc ON cc.vn = i.vn
          ${amedJoin}
          LEFT OUTER JOIN rcmdb.repdata r ON r.an = i.an
          LEFT OUTER JOIN rcmdb.repeclaim re ON re.an = i.an
          LEFT OUTER JOIN nationality nat ON nat.nationality = pt.nationality
          LEFT OUTER JOIN ward w ON w.ward = i.ward
          LEFT OUTER JOIN iptadm adm ON adm.an = i.an
          LEFT OUTER JOIN spclty spc ON spc.spclty = i.spclty
          LEFT OUTER JOIN icd101 icd ON icd.code = a.pdx
          LEFT OUTER JOIN doctor d1 ON d1.code = i.admdoctor
          LEFT OUTER JOIN doctor d2 ON d2.code = i.dch_doctor
          LEFT OUTER JOIN hospcode hm ON hm.hospcode = v.hospmain
          LEFT OUTER JOIN hospcode hs ON hs.hospcode = v.hospsub
          LEFT OUTER JOIN dchstts ds ON ds.dchstts = i.dchstts
          LEFT OUTER JOIN dchtype dt ON dt.dchtype = i.dchtype
          LEFT OUTER JOIN ipt_summary_status iss ON iss.ipt_summary_status_id = i.ipt_summary_status_id
          LEFT OUTER JOIN opduser opu ON opu.loginname = i.staff
          WHERE i.dchdate BETWEEN ? AND ?
            AND ptt.pttype_eclaim_id BETWEEN '01' AND '09'
          GROUP BY i.an
          ORDER BY i.dchdate DESC, i.an DESC
        `

        return (await executor(sql, [ds1, ds2], { timeoutMs: 90000 })) as any[]
      },
      300000 // Cache TTL 5 minutes
    )

    // Map Raw Rows to HomewardItem domain models
    const allItems: HomewardItem[] = (rawRows || []).map((row, idx) => {
      const authen = row.authencode ? String(row.authencode).trim() : null
      const repVal = row.rep ? String(row.rep).trim() : null
      const invVal = row.invoice ? String(row.invoice).trim() : null
      const onwebCid = row.onweb_cid ? String(row.onweb_cid).trim() : null
      const onwebAn = row.anonweb ? String(row.anonweb).trim() : null
      const isOnAmed = Boolean((onwebCid && onwebCid.length > 0) || (onwebAn && onwebAn.length > 0))
      const hasRep = Boolean((repVal && repVal.length > 0) || (invVal && invVal.length > 0))
      const hasAuthen = Boolean(authen && authen.length > 0)

      return {
        no: idx + 1,
        an: String(row.an || '').trim(),
        hn: String(row.hn || '').trim(),
        cid: String(row.cid || '').trim(),
        ptname: String(row.ptname || '').trim(),
        sex: formatThaiSex(row.sex_code),
        birthday: row.birthday ? String(row.birthday) : null,
        age: Number(row.age || 0),
        nation: String(row.nation || '').trim(),
        admdate: String(row.admdate || '').trim(),
        dchdate: String(row.dchdate || '').trim(),
        los: Number(row.los || 0),
        editdate: row.editdate ? String(row.editdate) : null,
        day_diff: Number(row.day_diff || 0),
        ward: String(row.ward || '').trim(),
        bedno: String(row.bedno || '').trim(),
        clinic: String(row.clinic || '').trim(),
        prediag: String(row.prediag || '').trim(),
        pdx: String(row.pdx || '').trim(),
        pdxname: String(row.pdxname || '').trim(),
        sdx: String(row.sdx || '').trim(),
        proc_code: String(row.proc_code || '').trim(),
        adjrw: Number(row.adjrw || 0),
        admdoctor: String(row.admdoctor || '').trim(),
        dchdoctor: String(row.dchdoctor || '').trim(),
        authencode: authen || null,
        hasAuthen,
        pttype_eclaim_id: String(row.pttype_eclaim_id || '').trim(),
        pttype_eclaim_name: String(row.pttype_eclaim_name || '').trim(),
        pttype: String(row.pttype || '').trim(),
        pttypename: String(row.pttypename || '').trim(),
        copttype: String(row.copttype || '').trim(),
        gfmis: String(row.gfmis || '').trim(),
        accountcode: String(row.accountcode || '').trim(),
        pttypeno: String(row.pttypeno || '').trim(),
        hospmain: String(row.hospmain || '').trim(),
        hospsub: String(row.hospsub || '').trim(),
        dchstts: String(row.dchstts || '').trim(),
        dchtype: String(row.dchtype || '').trim(),
        summary_status: String(row.summary_status || '').trim(),
        income: Number(row.income || 0),
        uc_money: Number(row.uc_money || 0),
        discount_money: Number(row.discount_money || 0),
        paid_money: Number(row.paid_money || 0),
        rcpt_money: Number(row.rcpt_money || 0),
        rcpno: String(row.rcpno || '').trim(),
        debit: Number(row.debit || 0),
        max_debt_amount: row.max_debt_amount != null ? Number(row.max_debt_amount) : null,
        follow_money: Number(row.follow_money || 0),
        bill: row.bill ? String(row.bill).trim() : null,
        billdate: row.billdate ? String(row.billdate).trim() : null,
        staff: String(row.staff || '').trim(),
        address: String(row.address || '').trim(),
        mobile: String(row.mobile || '').trim(),
        tel: String(row.tel || '').trim(),
        rep: repVal || null,
        rep_remark: row.rep_remark ? String(row.rep_remark).trim() : null,
        invoice: invVal || null,
        onweb_cid: onwebCid || null,
        anonweb: onwebAn || null,
        isOnAmed,
        hasRep,
      }
    })

    // Compute Tier 1 Aggregated Summary from all scoped records
    const totalCases = allItems.length
    let onAmedCases = 0
    let notOnAmedCases = 0
    let withAuthenCases = 0
    let noAuthenCases = 0
    let withRepCases = 0
    let noRepCases = 0
    let withDebitCases = 0
    let totalIncome = 0
    let totalDebit = 0
    let totalAdjrw = 0
    let totalLos = 0

    for (const item of allItems) {
      if (item.isOnAmed) onAmedCases++
      else notOnAmedCases++

      if (item.hasAuthen) withAuthenCases++
      else noAuthenCases++

      if (item.hasRep) withRepCases++
      else noRepCases++

      if (item.debit > 0) withDebitCases++

      totalIncome += item.income
      totalDebit += item.debit
      totalAdjrw += item.adjrw
      totalLos += item.los
    }

    const avgLos = totalCases > 0 ? Number((totalLos / totalCases).toFixed(2)) : 0

    const summary: HomewardSummary = {
      totalCases,
      onAmedCases,
      notOnAmedCases,
      withAuthenCases,
      noAuthenCases,
      withRepCases,
      noRepCases,
      withDebitCases,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalAdjrw: Math.round(totalAdjrw * 10000) / 10000,
      avgLos,
    }

    // Apply Card Filtering
    let filtered = allItems
    if (cardFilter === 'ON_AMED') {
      filtered = filtered.filter((i) => i.isOnAmed)
    } else if (cardFilter === 'NOT_ON_AMED') {
      filtered = filtered.filter((i) => !i.isOnAmed)
    } else if (cardFilter === 'WITH_AUTHEN') {
      filtered = filtered.filter((i) => i.hasAuthen)
    } else if (cardFilter === 'NO_AUTHEN') {
      filtered = filtered.filter((i) => !i.hasAuthen)
    } else if (cardFilter === 'WITH_REP') {
      filtered = filtered.filter((i) => i.hasRep)
    } else if (cardFilter === 'NO_REP') {
      filtered = filtered.filter((i) => !i.hasRep)
    } else if (cardFilter === 'WITH_DEBIT') {
      filtered = filtered.filter((i) => i.debit > 0)
    }

    // Apply Unified Search
    if (search) {
      filtered = filtered.filter((i) => {
        return (
          i.an.toLowerCase().includes(search) ||
          i.hn.toLowerCase().includes(search) ||
          i.cid.toLowerCase().includes(search) ||
          i.ptname.toLowerCase().includes(search) ||
          i.pdx.toLowerCase().includes(search) ||
          i.pdxname.toLowerCase().includes(search) ||
          i.sdx.toLowerCase().includes(search) ||
          i.ward.toLowerCase().includes(search) ||
          i.clinic.toLowerCase().includes(search) ||
          i.pttypename.toLowerCase().includes(search) ||
          i.admdoctor.toLowerCase().includes(search) ||
          i.dchdoctor.toLowerCase().includes(search) ||
          (i.authencode && i.authencode.toLowerCase().includes(search)) ||
          (i.rep && i.rep.toLowerCase().includes(search)) ||
          (i.invoice && i.invoice.toLowerCase().includes(search))
        )
      })
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'dchdate') {
        cmp = a.dchdate.localeCompare(b.dchdate)
      } else if (sortBy === 'admdate') {
        cmp = a.admdate.localeCompare(b.admdate)
      } else if (sortBy === 'an') {
        cmp = a.an.localeCompare(b.an)
      } else if (sortBy === 'hn') {
        cmp = a.hn.localeCompare(b.hn)
      } else if (sortBy === 'cid') {
        cmp = a.cid.localeCompare(b.cid)
      } else if (sortBy === 'ptname') {
        cmp = a.ptname.localeCompare(b.ptname)
      } else if (sortBy === 'age') {
        cmp = a.age - b.age
      } else if (sortBy === 'los') {
        cmp = a.los - b.los
      } else if (sortBy === 'pdx') {
        cmp = a.pdx.localeCompare(b.pdx)
      } else if (sortBy === 'income') {
        cmp = a.income - b.income
      } else if (sortBy === 'debit') {
        cmp = a.debit - b.debit
      } else if (sortBy === 'adjrw') {
        cmp = a.adjrw - b.adjrw
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    // Pagination (Tier 2 Paginated List)
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const pagedItems = exportAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

    // Re-index displayed items
    pagedItems.forEach((it, idx) => {
      it.no = exportAll ? idx + 1 : (page - 1) * pageSize + idx + 1
    })

    return {
      ds1,
      ds2,
      cardFilter,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize,
      totalCount,
      totalPages,
      summary,
      items: pagedItems,
    }
  }
}
