import { getCachedData } from '@/lib/cache'
import {
  defaultRcmDashboardGateway,
  type RcmDashboardGatewayAdapter,
} from './gatewayAdapter'
import {
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
  BASE_COMPENSATION_OPTIONS,
  resolveFiscalDateRange,
} from './typesAndHelpers'

/**
 * Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด
 */
export async function getPalliativeCareReport(
  params: PalliativeCareReportParams = {},
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<PalliativeCareResult> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
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
    async () => (await gw.getRcmPalliativeCareRaw({ startDate: ds1, endDate: ds2 })) as any[],
    300000
  )

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
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<PalliativeCarePc1Result> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
  const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
  const paidStatus = params.paidStatus || 'ALL'
  const search = (params.search || '').trim().toLowerCase()

  const cacheKey = `rcm-palliative-care-pc1-${ds1}-${ds2}`

  const rawRows = await getCachedData(
    cacheKey,
    async () => (await gw.getRcmPalliativeCarePc1Raw({ startDate: ds1, endDate: ds2 })) as any[],
    300000
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
 * Retrieves comprehensive clinical details for a single visit (VN).
 */
export async function getVnClinicalDetails(
  vn: string,
  gateway: Partial<RcmDashboardGatewayAdapter> = {}
): Promise<VnClinicalDetails | null> {
  const gw = { ...defaultRcmDashboardGateway, ...gateway }
  const cleanVn = (vn || '').trim()
  if (!cleanVn) return null

  const { headerRows, screenRows, diagRows, orderRows } = await gw.getRcmVnClinicalDetailsRaw(cleanVn)

  if (!headerRows || headerRows.length === 0) {
    return null
  }

  const h = headerRows[0] as any
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
    const s = screenRows[0] as any
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
