import { apiGateway } from '@/lib/apiGateway'

export interface PatientVisitSearchResult {
  hn: string
  cid: string
  ptname: string
  vn: string
  an?: string | null
  dateText: string
  department: string
  cc: string
  statusName: string
  opdDrugsCount: number
  opdLabsCount: number
  ipdDrugsCount: number
  ipdLabsCount: number
}

export interface VisitScreeningInfo {
  bps?: string | number | null
  bpd?: string | number | null
  bw?: string | number | null
  height?: string | number | null
  pulse?: string | number | null
  temperature?: string | number | null
  rr?: string | number | null
  cc?: string | null
  hpi?: string | null
  pe?: string | null
  pmh?: string | null
  department?: string | null
  dxMain?: string | null
  dxSub0?: string | null
  dxSub1?: string | null
  dxSub2?: string | null
}

export interface VisitDrugItem {
  dateText?: string
  name: string
  strength?: string | null
  qty: number | string
  units?: string | null
  usage?: string | null
}

export interface VisitLabItem {
  dateText?: string
  formName?: string | null
  itemName: string
  result: string
  refValue?: string | null
}

export interface OpdVisitDetails {
  type: 'OPD'
  patient: {
    hn: string
    cid: string
    name: string
    age: number
    dateText: string
  }
  screen: VisitScreeningInfo
  drugs: VisitDrugItem[]
  labs: VisitLabItem[]
  xray?: string | null
}

export interface IpdVisitDetails {
  type: 'IPD'
  patient: {
    hn: string
    cid: string
    name: string
    age: number
    dateText: string
    diagnosis?: string | null
  }
  drugs: VisitDrugItem[]
  labs: VisitLabItem[]
  xray?: string | null
}

export type VisitClinicalDetails = OpdVisitDetails | IpdVisitDetails

export interface LabTrackerPendingItem {
  hn: string
  patientName: string
  formName?: string | null
  orderTime: string
  receiveTime: string
  doctorName: string
}

export interface LabTrackerReportedItem {
  hn: string
  patientName: string
  reportTime: string
  ovstost?: string | null
  doctorName: string
}

export interface LabTrackerReportResult {
  senderName: string
  pending: LabTrackerPendingItem[]
  reported: LabTrackerReportedItem[]
}

export interface DoctorOrderStat {
  code: string
  name: string
  count: number
}

export interface LabTrackerDoctorsResult {
  doctors: DoctorOrderStat[]
  others: DoctorOrderStat[]
  totalCount: number
}

export interface LabTrackerDetailResult {
  hn: string
  patientName: string
  reported: Array<{
    formName?: string | null
    itemName: string
    result: string
    refValue?: string | null
  }>
  pending: Array<{
    formName?: string | null
    itemName: string
    isOutLab: string
  }>
}

export interface LoratadineDispenseItem {
  hn: string
  fullname: string
  age: number | string
  status: 'OPD' | 'IPD' | string
  vstdate: string
  rxdate: string
  rxtime: string
  qty: number
  doctorName: string
  department: string
}

export interface LoratadineDispenseSummary {
  items: LoratadineDispenseItem[]
  summary: {
    totalCount: number
    totalQty: number
    opdCount: number
    ipdCount: number
    adultCount: number
  }
}

export interface AppointmentMismatchRecord {
  hn: string
  department: string
  vstdate: string
  nextdate: string
  appUser: string
}

export interface ClinicalRecordsGatewayAdapter {
  searchPatientVisits: typeof apiGateway.clinical.searchPatientVisits
  getVisitClinicalDetails: typeof apiGateway.clinical.getVisitClinicalDetails
  getLabTrackerReport: typeof apiGateway.clinical.getLabTrackerReport
  getLabTrackerDoctors: typeof apiGateway.clinical.getLabTrackerDoctors
  getLabDetailByHn: typeof apiGateway.clinical.getLabDetailByHn
  getLoratadineMonitor: typeof apiGateway.clinical.getLoratadineMonitor
  getAppointmentMismatches: typeof apiGateway.clinical.getAppointmentMismatches
}

const defaultClinicalRecordsGateway: ClinicalRecordsGatewayAdapter = {
  searchPatientVisits: (q) => apiGateway.clinical.searchPatientVisits(q),
  getVisitClinicalDetails: (p) => apiGateway.clinical.getVisitClinicalDetails(p),
  getLabTrackerReport: (d) => apiGateway.clinical.getLabTrackerReport(d),
  getLabTrackerDoctors: () => apiGateway.clinical.getLabTrackerDoctors(),
  getLabDetailByHn: (hn) => apiGateway.clinical.getLabDetailByHn(hn),
  getLoratadineMonitor: (age) => apiGateway.clinical.getLoratadineMonitor(age),
  getAppointmentMismatches: () => apiGateway.clinical.getAppointmentMismatches(),
}

export const ClinicalRecordsService = {
  /**
   * Search patient clinical visits by Thai Citizen ID (CID) or Hospital Number (HN)
   */
  async searchPatientVisits(
    query: string,
    gateway: Partial<ClinicalRecordsGatewayAdapter> = defaultClinicalRecordsGateway
  ): Promise<PatientVisitSearchResult[]> {
    const trimmed = (query || '').trim()
    if (!trimmed) {
      return []
    }
    const gw: ClinicalRecordsGatewayAdapter = { ...defaultClinicalRecordsGateway, ...gateway }
    const gwRes = await gw.searchPatientVisits(trimmed)
    if (!Array.isArray(gwRes)) {
      return []
    }
    return gwRes.map((row: Record<string, unknown>) => ({
      hn: String(row.hn || ''),
      cid: String(row.cid || ''),
      ptname: String(row.ptname || ''),
      vn: String(row.vn || ''),
      an: row.an ? String(row.an) : null,
      dateText: String(row.dateText || ''),
      department: String(row.department || ''),
      cc: String(row.cc || ''),
      statusName: String(row.statusName || ''),
      opdDrugsCount: Number(row.opdDrugsCount) || 0,
      opdLabsCount: Number(row.opdLabsCount) || 0,
      ipdDrugsCount: Number(row.ipdDrugsCount) || 0,
      ipdLabsCount: Number(row.ipdLabsCount) || 0,
    }))
  },

  /**
   * Fetch comprehensive OPD or IPD clinical visit details (screening, diagnoses, lab orders, prescriptions, X-ray)
   */
  async getVisitClinicalDetails(
    params: { vn?: string | null; an?: string | null },
    gateway: Partial<ClinicalRecordsGatewayAdapter> = defaultClinicalRecordsGateway
  ): Promise<VisitClinicalDetails | null> {
    const vn = params.vn?.trim()
    const an = params.an?.trim()

    if (!vn && !an) {
      return null
    }
    const gw: ClinicalRecordsGatewayAdapter = { ...defaultClinicalRecordsGateway, ...gateway }
    const gwRes = await gw.getVisitClinicalDetails({ vn, an })
    if (gwRes && gwRes.type && gwRes.patient) {
      return gwRes as VisitClinicalDetails
    }
    return null
  },

  /**
   * Fetch today's lab tracking report (pending vs reported orders)
   */
  async getLabTrackerReport(
    doctorCode?: string | null,
    gateway: Partial<ClinicalRecordsGatewayAdapter> = defaultClinicalRecordsGateway
  ): Promise<LabTrackerReportResult> {
    const gw: ClinicalRecordsGatewayAdapter = { ...defaultClinicalRecordsGateway, ...gateway }
    const res = await gw.getLabTrackerReport(doctorCode)
    const pendingRows = (res?.pendingRows || []) as Array<Record<string, unknown>>
    const reportedRows = (res?.reportedRows || []) as Array<Record<string, unknown>>

    let senderName = 'ทั้งหมด'
    if (doctorCode && doctorCode !== 'all' && (pendingRows.length > 0 || reportedRows.length > 0)) {
      senderName = String(pendingRows[0]?.name || reportedRows[0]?.name || 'ผู้สั่งตรวจ')
    }

    return {
      senderName,
      pending: pendingRows.map((r) => ({
        hn: String(r.hn || ''),
        patientName: String(r.ptname || ''),
        formName: r.form_name ? String(r.form_name) : null,
        orderTime: String(r.order_time || '-'),
        receiveTime: String(r.receive_time || '-'),
        doctorName: String(r.name || ''),
      })),
      reported: reportedRows.map((r) => ({
        hn: String(r.hn || ''),
        patientName: String(r.ptname || ''),
        reportTime: String(r.report_time || '-'),
        ovstost: r.ovstost ? String(r.ovstost) : null,
        doctorName: String(r.name || ''),
      })),
    }
  },

  /**
   * Fetch doctors and staff ordering labs today
   */
  async getLabTrackerDoctors(
    gateway: Partial<ClinicalRecordsGatewayAdapter> = defaultClinicalRecordsGateway
  ): Promise<LabTrackerDoctorsResult> {
    const gw: ClinicalRecordsGatewayAdapter = { ...defaultClinicalRecordsGateway, ...gateway }
    const res = await gw.getLabTrackerDoctors()
    const doctors = (res?.doctors || []) as Array<Record<string, unknown>>
    const others = (res?.others || []) as Array<Record<string, unknown>>

    return {
      doctors: doctors.map((d) => ({
        code: String(d.code || ''),
        name: String(d.name || ''),
        count: Number(d.cc ?? d.count) || 0,
      })),
      others: others.map((o) => ({
        code: String(o.code || ''),
        name: String(o.name || ''),
        count: Number(o.cc ?? o.count) || 0,
      })),
      totalCount: Number(res?.totalCount) || 0,
    }
  },

  /**
   * Fetch lab tracker details by patient HN for today
   */
  async getLabTrackerDetails(
    hn: string,
    gateway: Partial<ClinicalRecordsGatewayAdapter> = defaultClinicalRecordsGateway
  ): Promise<LabTrackerDetailResult | null> {
    const trimmedHn = (hn || '').trim()
    if (!trimmedHn) return null

    const gw: ClinicalRecordsGatewayAdapter = { ...defaultClinicalRecordsGateway, ...gateway }
    const gwRes = await gw.getLabDetailByHn(trimmedHn)
    const reportedList = (gwRes?.reported || []) as Array<Record<string, unknown>>
    const pendingList = (gwRes?.pending || []) as Array<Record<string, unknown>>
    let patientName = 'ไม่ระบุชื่อ'
    if (reportedList.length > 0 && reportedList[0].ptname) {
      patientName = String(reportedList[0].ptname)
    } else if (pendingList.length > 0 && pendingList[0].ptname) {
      patientName = String(pendingList[0].ptname)
    }

    return {
      hn: trimmedHn,
      patientName,
      reported: reportedList.map((r) => ({
        formName: r.form_name ? String(r.form_name) : null,
        itemName: String(r.lab_items_name || ''),
        result: String(r.lab_order_result || ''),
        refValue: r.lab_items_normal_value ? String(r.lab_items_normal_value) : null,
      })),
      pending: pendingList.map((r) => ({
        formName: r.form_name ? String(r.form_name) : null,
        itemName: String(r.lab_items_name || ''),
        isOutLab: String(r.items_is_outlab || 'N'),
      })),
    }
  },

  /**
   * Fetch Loratadine dispensing monitor data
   */
  async getLoratadineDispenseSummary(
    ageFilter: string = 'adult',
    gateway: Partial<ClinicalRecordsGatewayAdapter> = defaultClinicalRecordsGateway
  ): Promise<LoratadineDispenseSummary> {
    const gw: ClinicalRecordsGatewayAdapter = { ...defaultClinicalRecordsGateway, ...gateway }
    const rows = ((await gw.getLoratadineMonitor(ageFilter)) || []) as Array<Record<string, unknown>>

    const totalCount = rows.length
    const totalQty = rows.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
    const opdCount = rows.filter((item) => item.status === 'OPD').length
    const ipdCount = rows.filter((item) => item.status === 'IPD').length
    const adultCount = rows.filter((item) => Number(item.age) > 19).length

    return {
      items: rows.map((r) => ({
        hn: String(r.hn || ''),
        fullname: String(r.fullname || ''),
        age: (r.age as number | string) ?? 0,
        status: String(r.status || ''),
        vstdate: String(r.vstdate || ''),
        rxdate: String(r.rxdate || ''),
        rxtime: r.rxtime ? String(r.rxtime).substring(0, 5) + ' น.' : '-',
        qty: Number(r.qty) || 0,
        doctorName: String(r.doctor_name || ''),
        department: String(r.department || ''),
      })),
      summary: {
        totalCount,
        totalQty,
        opdCount,
        ipdCount,
        adultCount,
      },
    }
  },

  /**
   * Fetch appointment mismatches (wrong examination room)
   */
  async getAppointmentMismatches(
    fetcher: () => Promise<Array<Record<string, unknown>>> = () =>
      apiGateway.clinical.getAppointmentMismatches()
  ): Promise<{
    totalMismatches: number
    updatedAt: string
    mismatches: AppointmentMismatchRecord[]
  }> {
    const rows = (await fetcher()) || []
    const mismatches: AppointmentMismatchRecord[] = rows.map((row) => ({
      hn: row.hn != null ? String(row.hn).trim() : '',
      department: row.department != null ? String(row.department).trim() : '',
      vstdate: row.vstdate != null ? String(row.vstdate) : '',
      nextdate: row.nextdate != null ? String(row.nextdate) : '',
      appUser: (row.appUser ?? row.app_user) != null ? String(row.appUser ?? row.app_user).trim() : '',
    }))
    return {
      totalMismatches: mismatches.length,
      updatedAt: new Date().toISOString(),
      mismatches,
    }
  },
}
