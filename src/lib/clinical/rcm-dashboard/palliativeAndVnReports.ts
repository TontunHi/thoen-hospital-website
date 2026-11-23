import { queryClinicalDb } from '@/lib/clinicalDb'
import { apiGateway } from '@/lib/apiGateway'
import { getCachedData } from '@/lib/cache'
import {
  type QueryExecutor,
  type FiscalDateRangeParams,
  type SssDentalResult,
  type DentalDoctorSummaryItem,
  type DentalPatientVisitItem,
  type OpdDoctorSummaryResult,
  type DoctorSummaryItem,
  type PttypeOption,
  type OPDRecord,
  type OpdDepartmentSummaryItem,
  type OpdDepartmentSummaryQueryRow,
  type IPDRecord,
  type IPDReportResult,
  type DepartmentMetricData,
  type IpdDepartmentAdjrwItem,
  type IpdDepartmentAdjrwQueryRow,
  type DoctorChartSummary,
  type IPDChartReportData,
  type InvoiceSummaryResult,
  type InvoiceSummaryItem,
  type InvoiceSummaryGrandTotal,
  type InvoiceDetailResult,
  type InvoiceDetailItem,
  type PalliativeCareReportParams,
  type PalliativeCareResult,
  type PalliativeCareItem,
  type PalliativeCareSummary,
  type PalliativeCarePc1ReportParams,
  type PalliativeCarePc1Result,
  type PalliativeCarePc1Item,
  type PalliativeCarePc1Summary,
  type VnClinicalDetails,
  type VnClinicalDetailsHeader,
  type VnScreenData,
  type VnDiagItem,
  type VnOrderItem,
  type VnOrderCategoryGroup,
  type VnOrderCategorySummary,
  CLINICAL_DEPARTMENT_DEFINITIONS,
  BASE_COMPENSATION_OPTIONS,
  resolveFiscalDateRange,
  formatThaiSex,
  buildDepartmentSqlCase,
  classifySpecialty,
  dateRangeToYymmList,
  buildInvoiceCountAndSummarySql,
  mapInvoiceFilteredSummary,
} from './typesAndHelpers'

  /**
   * Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด
   */
export async function getPalliativeCareReport(
    params: PalliativeCareReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PalliativeCareResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const ucOnly = params.ucOnly !== undefined ? Boolean(params.ucOnly) : true
    const hasRepInvoice = params.hasRepInvoice !== undefined ? Boolean(params.hasRepInvoice) : false
    const paidStatus = params.paidStatus || 'ALL'
    const deathStatus = params.deathStatus || 'ALL'
    const hnFilter = (params.hn || '').trim().toLowerCase()
    const compensatedExpr = typeof params.compensated === 'string' ? params.compensated.trim() : ''
    let compensatedFilterNums: number[] = []
    if (Array.isArray(params.compensated)) {
      compensatedFilterNums = params.compensated.map(Number).filter((n) => !isNaN(n))
    } else if (
      compensatedExpr &&
      !compensatedExpr.startsWith('>') &&
      !compensatedExpr.startsWith('<') &&
      !compensatedExpr.startsWith('=') &&
      compensatedExpr !== 'ALL' &&
      compensatedExpr !== 'PAID'
    ) {
      compensatedFilterNums = compensatedExpr
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n))
    }
    const filterType = params.filterType || 'ALL'
    const search = (params.search || '').trim().toLowerCase()

    const cacheKey = `rcm-palliative-care-${ds1}-${ds2}`

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(o.pttype, '') AS pttype,
            IFNULL(ptt.hipdata_code, '') AS inscl,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            CONCAT(IFNULL(pt.addrpart,''), ' ม.', IFNULL(pt.moopart,''), ' ', IFNULL(pt.road,'')) AS address,
            COALESCE(NULLIF(TRIM(pt.mobile_phone_number),''), NULLIF(TRIM(pt.informtel),''), NULLIF(TRIM(pt.hometel),''), '') AS tel,
            IFNULL(s.cc, '') AS cc,
            IFNULL(k.department, o.main_dep) AS room,
            IFNULL(sp.name, o.spclty) AS spclty,
            CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) AS Diag,
            CONCAT_WS(',', v.op0, v.op1, v.op2, v.op3, v.op4, v.op5) AS Oper,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z515', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z515,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Dx,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP 'Z718', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Z718,
            IF(GROUP_CONCAT(DISTINCT IF(dx.icd10 REGEXP '^C|D3[7-9]|D4', 'Y', NULL)) IS NOT NULL, 'Y', '') AS Cancer,
            IFNULL(dr.Drug, '') AS Drug,
            IFNULL(pt.death, 'N') AS death,
            DATE_FORMAT(pt.deathday, '%Y-%m-%d') AS death_date,
            IF(e.vn IS NULL AND rd.vn IS NULL, ' ', 'Y') AS OK,
            COALESCE(e.PallativeCare, rd.PallativeCare, 0) AS compensated,
            COALESCE(NULLIF(CONCAT_WS('#', e.rep, e.id), ''), NULLIF(CONCAT_WS('#', rd.rep, rd.id), ''), '') AS rep_invoice,
            CONCAT_WS('#', m.eclaim_no, m.id) AS eclaim_no,
            m.senddate,
            CASE 
              WHEN m.status IS NOT NULL THEN CONCAT(m.status, ' :: ', IFNULL(ecs.name, m.status))
              ELSE '- :: ยังไม่ได้ส่ง'
            END AS status_Eclaim,
            IFNULL(m.filename_send, '') AS filename_send
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn 
          JOIN ovstdiag dx ON dx.vn = o.vn
          LEFT JOIN (
            SELECT DISTINCT oo.vn, 'Y' AS Drug
            FROM opitemrece oo
            JOIN drugitems d ON d.icode = oo.icode
            WHERE d.nhso_adp_code REGEXP '^M'
              AND oo.vstdate BETWEEN ? AND ?
          ) dr ON dr.vn = o.vn
          LEFT JOIN opdscreen s ON s.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype 
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN (
            SELECT
              vn,
              SUM(PallativeCare) AS PallativeCare,
              SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS id
            FROM rcmdb.repeclaim
            WHERE PallativeCare > 0
              AND IFNULL(vn, '') <> ''
            GROUP BY vn
          ) e ON e.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUM(PallativeCare) AS PallativeCare,
              SUBSTRING_INDEX(GROUP_CONCAT(rep ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY PallativeCare DESC, AdmDate DESC, id DESC), ',', 1) AS id
            FROM rcmdb.repdata
            WHERE PallativeCare > 0
              AND IFNULL(vn, '') <> ''
            GROUP BY vn
          ) rd ON rd.vn = o.vn
          LEFT JOIN (
            SELECT 
              m.opdseq AS vn,
              MAX(m.eclaim_no) AS eclaim_no,
              SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT IF(m.status='4', m.rep, NULL) ORDER BY m.eclaim_no DESC), ',', 1) AS rep,
              SUBSTRING_INDEX(GROUP_CONCAT(m.maininscl ORDER BY m.eclaim_no DESC), ',', 1) AS maininscl,
              SUBSTRING_INDEX(GROUP_CONCAT(m.status ORDER BY m.eclaim_no DESC), ',', 1) AS status,
              SUBSTRING_INDEX(GROUP_CONCAT(m.code_id ORDER BY m.eclaim_no DESC), ',', 1) AS errorcode,
              SUBSTRING_INDEX(GROUP_CONCAT(m.tran_id ORDER BY m.eclaim_no DESC), ',', 1) AS id,
              SUBSTRING_INDEX(GROUP_CONCAT(UCASE(m.filename_send) ORDER BY m.eclaim_no DESC), ',', 1) AS filename_send,
              SUBSTRING_INDEX(GROUP_CONCAT(pp.child_dob ORDER BY m.eclaim_no DESC), ',', 1) AS vstdate,
              SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(m.date_send, m.filename_send) ORDER BY m.eclaim_no DESC), ',', 1) AS senddate
            FROM eclaimdb.m_registerdata m
            JOIN eclaimdb.m_ppcom pp ON pp.eclaim_no = m.eclaim_no 
            WHERE pp.itemname REGEXP '30001'
              AND m.person_type = '1'
              AND m.opdseq IS NOT NULL
            GROUP BY m.opdseq
          ) m ON m.vn = o.vn
          LEFT JOIN rcmdb.eclaimstatus ecs ON ecs.code = m.status
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
            AND IFNULL(o.pttype, '') NOT IN ('H1', '35', '36')
            AND dx.icd10 REGEXP 'B2[0-4]|^C|D[0-4]|I5|I6|J44|K704|K717|K72|N185|Z515|Z718'
          GROUP BY o.vn
          HAVING Dx = 'Y'
          ORDER BY o.hn ASC
        `
        return (await executor(sql, [ds1, ds2, ds1, ds2], { timeoutMs: 120000 })) as any[]
      },
      300000 // Cache TTL 5 minutes (300 seconds)
    )

    // Format & map rows
    let mapped: PalliativeCareItem[] = (rawRows || []).map((r, idx) => {
      const z515 = String(r.Z515 || '').trim()
      const errorName = !z515 ? 'ไม่พบรหัส Z515' : ''
      let formattedSendDate: string | null = null
      if (r.senddate) {
        const rawDate = String(r.senddate).trim()
        const match = rawDate.match(/(\d{4})(\d{2})(\d{2})/)
        if (match) {
          formattedSendDate = `${match[1]}-${match[2]}-${match[3]}`
        } else {
          formattedSendDate = rawDate
        }
      }

      return {
        no: idx + 1,
        vn: String(r.vn || ''),
        cid: String(r.cid || ''),
        hn: String(r.hn || ''),
        ptname: String(r.ptname || '').trim(),
        vstdate: String(r.vstdate || ''),
        authencode: String(r.authencode || '').trim(),
        pttype: String(r.pttype || '').trim(),
        inscl: String(r.inscl || '').trim(),
        pttypename: String(r.pttypename || '').trim(),
        address: String(r.address || '').trim(),
        tel: String(r.tel || '').trim(),
        cc: String(r.cc || '').trim(),
        room: String(r.room || '').trim(),
        spclty: String(r.spclty || '').trim(),
        diag: String(r.Diag || ''),
        oper: String(r.Oper || ''),
        z515,
        dx: String(r.Dx || '').trim(),
        z718: String(r.Z718 || '').trim(),
        cancer: String(r.Cancer || '').trim(),
        drug: String(r.Drug || '').trim(),
        death: String(r.death || 'N').trim(),
        death_date: r.death_date ? String(r.death_date) : null,
        ok: String(r.OK || ' ').trim(),
        compensated: Number(r.compensated || 0),
        rep_invoice: String(r.rep_invoice || '').trim(),
        eclaim_no: String(r.eclaim_no || '').trim(),
        senddate: formattedSendDate,
        status_eclaim: String(r.status_Eclaim || '').trim(),
        filename_send: String(r.filename_send || '').trim(),
        error_name: errorName,
      }
    })

    // Apply interactive filters
    // Exclude H1, 35, 36
    mapped = mapped.filter((item) => !['H1', '35', '36'].includes(item.pttype))

    if (ucOnly) {
      mapped = mapped.filter((item) => item.inscl === 'UCS')
    }

    if (hasRepInvoice) {
      mapped = mapped.filter((item) => Boolean(item.rep_invoice && item.rep_invoice.trim() !== ''))
    }

    if (compensatedFilterNums.length > 0) {
      mapped = mapped.filter((item) => compensatedFilterNums.includes(item.compensated))
    } else if (compensatedExpr && compensatedExpr !== 'ALL') {
      if (compensatedExpr === '0') {
        mapped = mapped.filter((item) => item.compensated === 0)
      } else if (compensatedExpr === 'PAID' || compensatedExpr === '>0') {
        mapped = mapped.filter((item) => item.compensated > 0 || item.ok === 'Y')
      } else if (compensatedExpr.startsWith('>=')) {
        const t = Number(compensatedExpr.slice(2).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated >= t)
      } else if (compensatedExpr.startsWith('>')) {
        const t = Number(compensatedExpr.slice(1).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated > t)
      } else if (compensatedExpr.startsWith('<=')) {
        const t = Number(compensatedExpr.slice(2).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated <= t)
      } else if (compensatedExpr.startsWith('<')) {
        const t = Number(compensatedExpr.slice(1).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated < t)
      } else if (compensatedExpr.startsWith('=')) {
        const t = Number(compensatedExpr.slice(1).trim())
        if (!isNaN(t)) mapped = mapped.filter((item) => item.compensated === t)
      }
    }

    if (paidStatus === 'PAID') {
      mapped = mapped.filter((item) => item.ok === 'Y' || item.compensated > 0)
    } else if (paidStatus === 'UNPAID') {
      mapped = mapped.filter((item) => item.ok !== 'Y' && item.compensated === 0)
    }

    if (deathStatus === 'Y') {
      mapped = mapped.filter((item) => item.death === 'Y')
    } else if (deathStatus === 'N') {
      mapped = mapped.filter((item) => item.death === 'N')
    }

    const z515Status = params.z515Status || 'ALL'
    if (z515Status === 'Y') {
      mapped = mapped.filter((item) => item.z515 === 'Y')
    } else if (z515Status === 'N') {
      mapped = mapped.filter((item) => !item.z515 || item.z515 !== 'Y')
    }

    if (hnFilter) {
      mapped = mapped.filter((item) => item.hn.toLowerCase().includes(hnFilter))
    }

    if (filterType === 'Chronic') {
      mapped = mapped.filter((item) => item.z718 === 'Y' && item.dx === 'Y')
    } else if (filterType === 'Opioid') {
      mapped = mapped.filter((item) => item.cancer === 'Y' && item.drug === 'Y')
    } else if (filterType === 'Death') {
      mapped = mapped.filter((item) => item.death === 'Y')
    }

    if (search) {
      mapped = mapped.filter(
        (item) =>
          item.hn.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.vn.includes(search) ||
          item.diag.toLowerCase().includes(search)
      )
    }

    // Re-index row numbers
    mapped.forEach((item, i) => {
      item.no = i + 1
    })

    const uniquePatients = new Set(mapped.map((item) => item.hn))

    const dbCompensations = (rawRows || [])
      .map((r) => Number(r.compensated || 0))
      .filter((val) => val > 0)
    const availableCompensations = Array.from(
      new Set([...BASE_COMPENSATION_OPTIONS, ...dbCompensations])
    ).sort((a, b) => a - b)

    const summary: PalliativeCareSummary = {
      totalVisits: mapped.length,
      totalPatients: uniquePatients.size,
      advanceCarePlanCount: mapped.filter((item) => item.z718 === 'Y' && item.dx === 'Y').length,
      opioidCount: mapped.filter((item) => item.cancer === 'Y' && item.drug === 'Y').length,
      hasZ515Count: mapped.filter((item) => item.z515 === 'Y').length,
      missingZ515Count: mapped.filter((item) => !item.z515).length,
      paidCount: mapped.filter((item) => item.ok === 'Y').length,
      totalCompensated: mapped.reduce((sum, item) => sum + item.compensated, 0),
      deceasedCount: mapped.filter((item) => item.death === 'Y').length,
    }

    return {
      ds1,
      ds2,
      ucOnly,
      hasRepInvoice,
      compensated: params.compensated,
      paidStatus,
      deathStatus,
      z515Status,
      hn: hnFilter,
      filterType,
      summary,
      items: mapped,
      availableCompensations,
    }
  }

  /**
   * Palliative Care End Of Life (PC.1)
   * บริการ Palliative Care End Of Life ตามรหัส ADP 30001
   */
export async function getPalliativeCarePc1Report(
    params: PalliativeCarePc1ReportParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<PalliativeCarePc1Result> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const paidStatus = params.paidStatus || 'ALL'
    const search = (params.search || '').trim().toLowerCase()

    const cacheKey = `rcm-palliative-care-pc1-${ds1}-${ds2}`

    const rawRows = await getCachedData(
      cacheKey,
      async () => {
        const sql = `
          SELECT 
            o.vn,
            IFNULL(pt.cid, '') AS cid,
            o.hn,
            CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
            TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age,
            IFNULL(n.name, IFNULL(pt.nationality, '')) AS nation,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
            TIME_FORMAT(o.vsttime, '%H:%i:%s') AS vsttime,
            IFNULL(cc.AuthenCode, '') AS authencode,
            IFNULL(ptt.name, o.pttype) AS pttypename,
            IFNULL(k.department, o.main_dep) AS department,
            IFNULL(sp.name, o.spclty) AS clinic,
            v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5,
            v.op0, v.op1, v.op2, v.op3, v.op4, v.op5,
            dd.listname,
            rd.rep,
            IFNULL(rd.compensated, 0) AS compensated,
            rd.TransactionType AS transaction_type,
            re.rep AS invoice,
            IFNULL(re.compensated, 0) AS invoice_compensated,
            re.resource,
            rd.subfund,
            rd.remark,
            rd.projectcode
          FROM ovst o
          JOIN (
            SELECT 
              oo.vn,
              GROUP_CONCAT(DISTINCT CONCAT_WS(' ', d.name, d.strength) SEPARATOR ', ') AS listname
            FROM opitemrece oo
            JOIN s_drugitems d ON d.icode = oo.icode
            WHERE oo.vstdate BETWEEN ? AND ?
              AND d.nhso_adp_code IN ('30001')
            GROUP BY oo.vn
          ) dd ON dd.vn = o.vn
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN nationality n ON n.nationality = pt.nationality
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
          LEFT JOIN spclty sp ON sp.spclty = o.spclty
          LEFT JOIN rcmdb.authencode cc ON cc.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(TransactionType, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS TransactionType,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(subfund, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS subfund,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(remark, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS remark,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(projectcode, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS projectcode
            FROM rcmdb.repdata
            WHERE IFNULL(vn, '') <> ''
              AND AdmDate >= DATE_SUB(?, INTERVAL 1 DAY)
              AND AdmDate < DATE_ADD(?, INTERVAL 2 DAY)
            GROUP BY vn
          ) rd ON rd.vn = o.vn
          LEFT JOIN (
            SELECT
              vn,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(rep, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS rep,
              SUM(IFNULL(compensated, 0)) AS compensated,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(resource, '') ORDER BY (PallativeCare > 0) DESC, (Compensated > 0) DESC, AdmDate DESC, id DESC), ',', 1) AS resource
            FROM rcmdb.repeclaim
            WHERE IFNULL(vn, '') <> ''
              AND AdmDate >= DATE_SUB(?, INTERVAL 1 DAY)
              AND AdmDate < DATE_ADD(?, INTERVAL 2 DAY)
            GROUP BY vn
          ) re ON re.vn = o.vn
          WHERE o.vstdate BETWEEN ? AND ?
          GROUP BY o.vn
          ORDER BY o.hn ASC, o.vn ASC
        `
        return (await executor(sql, [ds1, ds2, ds1, ds2, ds1, ds2, ds1, ds2], { timeoutMs: 120000 })) as any[]
      },
      300000 // Cache TTL 5 minutes
    )

    let mapped: PalliativeCarePc1Item[] = (rawRows || []).map((r, idx) => ({
      no: idx + 1,
      vn: String(r.vn || ''),
      cid: String(r.cid || ''),
      hn: String(r.hn || ''),
      ptname: String(r.ptname || '').trim(),
      age: Number(r.age || 0),
      nation: String(r.nation || 'ไทย').trim(),
      vstdate: String(r.vstdate || ''),
      vsttime: String(r.vsttime || ''),
      authencode: String(r.authencode || ''),
      pttypename: String(r.pttypename || ''),
      department: String(r.department || ''),
      clinic: String(r.clinic || ''),
      pdx: r.pdx ? String(r.pdx) : null,
      dx0: r.dx0 ? String(r.dx0) : null,
      dx1: r.dx1 ? String(r.dx1) : null,
      dx2: r.dx2 ? String(r.dx2) : null,
      dx3: r.dx3 ? String(r.dx3) : null,
      dx4: r.dx4 ? String(r.dx4) : null,
      dx5: r.dx5 ? String(r.dx5) : null,
      op0: r.op0 ? String(r.op0) : null,
      op1: r.op1 ? String(r.op1) : null,
      op2: r.op2 ? String(r.op2) : null,
      op3: r.op3 ? String(r.op3) : null,
      op4: r.op4 ? String(r.op4) : null,
      op5: r.op5 ? String(r.op5) : null,
      listname: String(r.listname || ''),
      rep: r.rep ? String(r.rep) : null,
      compensated: Number(r.compensated || 0),
      transaction_type: r.transaction_type ? String(r.transaction_type) : null,
      invoice: r.invoice ? String(r.invoice) : null,
      invoice_compensated: Number(r.invoice_compensated || 0),
      resource: r.resource ? String(r.resource) : null,
      subfund: r.subfund ? String(r.subfund) : null,
      remark: r.remark ? String(r.remark) : null,
      projectcode: r.projectcode ? String(r.projectcode) : null,
    }))

    if (paidStatus === 'PAID') {
      mapped = mapped.filter((item) => item.compensated > 0)
    } else if (paidStatus === 'UNPAID') {
      mapped = mapped.filter((item) => item.compensated === 0)
    } else if (paidStatus === 'INVOICE') {
      mapped = mapped.filter((item) => item.invoice_compensated > 0 || Boolean(item.invoice && item.invoice.trim()))
    }

    if (search) {
      mapped = mapped.filter(
        (item) =>
          item.hn.toLowerCase().includes(search) ||
          item.ptname.toLowerCase().includes(search) ||
          item.cid.includes(search) ||
          item.vn.includes(search) ||
          (item.pdx && item.pdx.toLowerCase().includes(search)) ||
          item.listname.toLowerCase().includes(search)
      )
    }

    // Re-index row numbers
    mapped.forEach((item, i) => {
      item.no = i + 1
    })

    const uniquePatients = new Set(mapped.map((item) => item.hn))

    const summary: PalliativeCarePc1Summary = {
      totalVisits: mapped.length,
      totalPatients: uniquePatients.size,
      paidCount: mapped.filter((item) => item.compensated > 0).length,
      unpaidCount: mapped.filter((item) => item.compensated === 0).length,
      totalCompensated: mapped.reduce((sum, item) => sum + item.compensated, 0),
      totalInvoiceCompensated: mapped.reduce((sum, item) => sum + item.invoice_compensated, 0),
    }

    return {
      ds1,
      ds2,
      paidStatus,
      summary,
      items: mapped,
    }
  }

  /**
   * Retrieves comprehensive clinical details for a single visit (VN),
   * including opdscreen (vitals, CC, HPI, PMH, PE), ovstdiag (diagnoses & physicians),
   * and opitemrece (itemized medications, labs, imaging, nursing & services grouped by category).
   */
export async function getVnClinicalDetails(
    vn: string,
    executor: QueryExecutor = queryClinicalDb
  ): Promise<VnClinicalDetails | null> {
    const cleanVn = (vn || '').trim()
    if (!cleanVn) return null

    const headerSql = `
      SELECT 
        o.vn, o.hn, IFNULL(pt.cid, '') AS cid,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        CASE WHEN pt.sex = '1' THEN 'ชาย' WHEN pt.sex = '2' THEN 'หญิง' ELSE IFNULL(pt.sex, '-') END AS sex,
        IFNULL(TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate), 0) AS age,
        DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
        IFNULL(o.vsttime, '') AS vsttime,
        IFNULL(p.name, IFNULL(o.pttype, '')) AS pttypename,
        IFNULL(k.department, IFNULL(o.main_dep, '')) AS department,
        IFNULL(s.name, IFNULL(o.spclty, '')) AS clinic
      FROM ovst o
      LEFT JOIN patient pt ON pt.hn = o.hn
      LEFT JOIN pttype p ON p.pttype = o.pttype
      LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
      LEFT JOIN spclty s ON s.spclty = o.spclty
      WHERE o.vn = ?
      LIMIT 1;
    `

    const screenSql = `
      SELECT 
        s.bw, s.height, s.bmi, s.bps, s.bpd, s.pulse, s.rr, s.temperature, s.spo2, s.fbs,
        s.cc, s.hpi, s.pmh, s.pe, s.screen_dep,
        IFNULL(k.department, s.screen_dep) AS screen_dep_name,
        s.symptom
      FROM opdscreen s
      LEFT JOIN kskdepartment k ON k.depcode = s.screen_dep
      WHERE s.vn = ?
      LIMIT 1;
    `

    const diagSql = `
      SELECT 
        d.icd10,
        IFNULL(i.name, d.icd10) AS icd_name,
        IFNULL(d.diagtype, '') AS diagtype,
        IFNULL(dt.name, CASE d.diagtype 
          WHEN '1' THEN 'PRINCIPLE DX (การวินิจฉัยโรคหลัก)' 
          WHEN '2' THEN 'CO-MORBIDITY (การวินิจฉัยโรคร่วม)' 
          WHEN '3' THEN 'COMPLICATION (ภาวะแทรกซ้อน)' 
          WHEN '4' THEN 'OTHER (การวินิจฉัยอื่นๆ)' 
          WHEN '5' THEN 'EXTERNAL CAUSE (สาเหตุภายนอก)' 
          ELSE 'ไม่ระบุประเภท' END) AS diagtype_name,
        IFNULL(doc.name, '') AS doctor_name
      FROM ovstdiag d
      LEFT JOIN icd101 i ON i.code = d.icd10
      LEFT JOIN diagtype dt ON dt.diagtype = d.diagtype
      LEFT JOIN doctor doc ON doc.code = d.doctor
      WHERE d.vn = ?
      ORDER BY d.diagtype ASC, d.ovst_diag_id ASC;
    `

    const orderSql = `
      SELECT 
        o.icode,
        COALESCE(d.name, nd.name, o.icode) AS item_name,
        d.strength,
        d.units,
        IFNULL(o.qty, 0) AS qty,
        IFNULL(o.unitprice, 0) AS unitprice,
        IFNULL(o.sum_price, 0) AS sum_price,
        IFNULL(o.paidst, '') AS paidst,
        IFNULL(pst.name, CASE o.paidst 
          WHEN '01' THEN 'ชำระเองเบิกได้' 
          WHEN '02' THEN 'ลูกหนี้สิทธิ' 
          WHEN '03' THEN 'ชำระเองเบิกไม่ได้' 
          WHEN '00' THEN 'ค้างชำระ' 
          ELSE o.paidst END) AS paidst_name,
        IFNULL(o.income, '') AS income_code,
        IFNULL(inc.name, '') AS income_name,
        CONCAT_WS(' ', du.name1, du.name2, du.name3, sp.name1, sp.name2, sp.name3) AS drugusage_text,
        IF(d.icode IS NOT NULL, 1, 0) AS is_drug
      FROM opitemrece o
      LEFT JOIN s_drugitems d ON d.icode = o.icode
      LEFT JOIN nondrugitems nd ON nd.icode = o.icode
      LEFT JOIN paidst pst ON pst.paidst = o.paidst
      LEFT JOIN income inc ON inc.income = o.income
      LEFT JOIN drugusage du ON du.drugusage = o.drugusage
      LEFT JOIN sp_use sp ON sp.sp_use = o.sp_use
      WHERE o.vn = ?
      ORDER BY o.income ASC, o.item_no ASC, o.icode ASC;
    `

    const [headerRows, screenRows, diagRows, orderRows] = await Promise.all([
      executor(headerSql, [cleanVn]),
      executor(screenSql, [cleanVn]),
      executor(diagSql, [cleanVn]),
      executor(orderSql, [cleanVn]),
    ])

    if (!headerRows || headerRows.length === 0) {
      return null
    }

    const h = headerRows[0]
    const header: VnClinicalDetailsHeader = {
      vn: String(h.vn || cleanVn),
      hn: String(h.hn || ''),
      cid: String(h.cid || ''),
      ptname: String(h.ptname || '').trim(),
      age: Number(h.age || 0),
      sex: String(h.sex || '-'),
      vstdate: String(h.vstdate || ''),
      vsttime: String(h.vsttime || ''),
      pttypename: String(h.pttypename || ''),
      department: String(h.department || ''),
      clinic: String(h.clinic || ''),
    }

    let screen: VnScreenData | null = null
    if (screenRows && screenRows.length > 0) {
      const s = screenRows[0]
      screen = {
        bw: s.bw != null ? Number(s.bw) : null,
        height: s.height != null ? Number(s.height) : null,
        bmi: s.bmi != null ? Number(s.bmi) : null,
        bps: s.bps != null ? Number(s.bps) : null,
        bpd: s.bpd != null ? Number(s.bpd) : null,
        pulse: s.pulse != null ? Number(s.pulse) : null,
        rr: s.rr != null ? Number(s.rr) : null,
        temperature: s.temperature != null ? Number(s.temperature) : null,
        spo2: s.spo2 != null ? Number(s.spo2) : null,
        fbs: s.fbs != null ? Number(s.fbs) : null,
        cc: s.cc ? String(s.cc).trim() : null,
        hpi: s.hpi ? String(s.hpi).trim() : null,
        pmh: s.pmh ? String(s.pmh).trim() : null,
        pe: s.pe ? String(s.pe).trim() : null,
        screen_dep: s.screen_dep ? String(s.screen_dep) : null,
        screen_dep_name: s.screen_dep_name ? String(s.screen_dep_name).trim() : null,
        symptom: s.symptom ? String(s.symptom).trim() : null,
      }
    }

    const diagnoses: VnDiagItem[] = (diagRows || []).map((d: any) => ({
      icd10: String(d.icd10 || ''),
      icd_name: String(d.icd_name || ''),
      diagtype: String(d.diagtype || ''),
      diagtype_name: String(d.diagtype_name || ''),
      doctor_name: d.doctor_name ? String(d.doctor_name).trim() : null,
    }))

    const orderItems: VnOrderItem[] = (orderRows || []).map((o: any) => {
      const inc = String(o.income_code || '')
      const isDrug = Boolean(o.is_drug)

      let categoryGroup: VnOrderCategoryGroup = 'OTHER'
      if (isDrug || ['03', '85', '86', '90', '91'].includes(inc)) {
        categoryGroup = 'DRUG'
      } else if (['05', '26', '27', '28', '93', '94'].includes(inc)) {
        categoryGroup = 'LAB'
      } else if (['04', '06', '87', '95'].includes(inc)) {
        categoryGroup = 'XRAY'
      } else if (['11', '12', '13', '14', '16', '20', '45', '71', '76', '77', '78', '98', '99', '36', '37'].includes(inc)) {
        categoryGroup = 'PROCEDURE_SERVICE'
      } else if (['18', '19', '24', '30', '31', '89', '92', '97'].includes(inc)) {
        categoryGroup = 'SUPPLY'
      }

      return {
        icode: String(o.icode || ''),
        item_name: String(o.item_name || ''),
        strength: o.strength ? String(o.strength).trim() : null,
        units: o.units ? String(o.units).trim() : null,
        qty: Number(o.qty || 0),
        unitprice: Number(o.unitprice || 0),
        sum_price: Number(o.sum_price || 0),
        paidst: String(o.paidst || ''),
        paidst_name: String(o.paidst_name || ''),
        income_code: inc,
        income_name: String(o.income_name || ''),
        category_group: categoryGroup,
        drugusage_text: String(o.drugusage_text || '').trim(),
      }
    })

    const categoryDefinitions: { group: VnOrderCategoryGroup; title: string }[] = [
      { group: 'DRUG', title: 'ยาและเวชภัณฑ์ยา' },
      { group: 'LAB', title: 'การตรวจชันสูตรทางห้องปฏิบัติการ (LAB)' },
      { group: 'XRAY', title: 'เอกซเรย์และการตรวจรังสี (X-Ray)' },
      { group: 'PROCEDURE_SERVICE', title: 'หัตถการและค่าบริการทางการพยาบาล / การแพทย์' },
      { group: 'SUPPLY', title: 'อุปกรณ์และเวชภัณฑ์มิใช่ยา' },
      { group: 'OTHER', title: 'ค่าบริการอื่นๆ' },
    ]

    const categories: VnOrderCategorySummary[] = categoryDefinitions
      .map((def) => {
        const groupItems = orderItems.filter((i) => i.category_group === def.group)
        return {
          category_group: def.group,
          title: def.title,
          total_price: groupItems.reduce((acc, curr) => acc + curr.sum_price, 0),
          item_count: groupItems.length,
          items: groupItems,
        }
      })
      .filter((cat) => cat.item_count > 0)

    const totalPrice = orderItems.reduce((sum, item) => sum + item.sum_price, 0)
    const totalItems = orderItems.reduce((sum, item) => sum + item.qty, 0)
    const totalPaid = orderItems
      .filter((i) => ['01', '03'].includes(i.paidst))
      .reduce((sum, item) => sum + item.sum_price, 0)
    const totalClaim = orderItems
      .filter((i) => i.paidst === '02')
      .reduce((sum, item) => sum + item.sum_price, 0)

    return {
      header,
      screen,
      diagnoses,
      orders: {
        items: orderItems,
        categories,
        total_price: totalPrice,
        total_items: totalItems,
        total_paid: totalPaid,
        total_claim: totalClaim,
      },
    }
  }
