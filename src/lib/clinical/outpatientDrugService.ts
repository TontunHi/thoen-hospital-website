import { queryClinicalDb } from '@/lib/clinicalDb'
import { maskPatientName } from '@/lib/clinical/ipdWardService'

export interface OutpatientDrugQueueItem {
  hn: string
  ptname: string
  service_time: string
  timelast: string
  department?: string
}

export interface OutpatientDrugQueueResult {
  paidPatients: OutpatientDrugQueueItem[]
  printedPatients: OutpatientDrugQueueItem[]
  updatedAt: string
}

type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

export class OutpatientDrugService {
  constructor(private clinicalDb: QueryExecutor = queryClinicalDb) {}

  async getDrugDispenseQueue(): Promise<OutpatientDrugQueueResult> {
    // 1. ผู้ป่วยนอก ที่ผ่านห้องการเงินแล้ว (รอพิมพ์ใบสั่งยา/รอจัดยา)
    const queryPaid = `
      SELECT 
        pt.hn,
        TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''), ' ', COALESCE(pt.lname, ''))) AS ptname,
        TIME_FORMAT(st.service7, '%H:%i:%s') AS service_time,
        TIMEDIFF(CURRENT_TIME(), st.service7) AS timelast,
        COALESCE(k.department, 'ไม่ระบุ') AS department
      FROM opitemrece o
      LEFT OUTER JOIN patient pt ON o.hn = pt.hn
      LEFT OUTER JOIN service_time st ON o.vn = st.vn
      LEFT OUTER JOIN kskdepartment k ON o.dep_code = k.depcode
      WHERE o.vstdate = CURRENT_DATE()
        AND o.icode LIKE '1%'
        AND (st.service6 IS NULL AND st.service7 IS NOT NULL)
        AND o.vn IS NOT NULL
        AND (st.service12_dep IS NULL OR st.service12_dep NOT IN ('028', '029', '042', '037', '045', '098'))
      GROUP BY o.hn, pt.pname, pt.fname, pt.lname, st.service7, k.department
      ORDER BY TIMEDIFF(CURRENT_TIME(), st.service7) DESC
    `

    // 2. ผู้ป่วยนอก ที่พิมพ์ใบสั่งยาแล้ว แต่ยังไม่บันทึกการจ่ายยา (กำลังจัดยา/รอรับยา)
    const queryPrinted = `
      SELECT 
        pt.hn,
        TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''), ' ', COALESCE(pt.lname, ''))) AS ptname,
        TIME_FORMAT(st.service6, '%H:%i:%s') AS service_time,
        TIMEDIFF(CURRENT_TIME(), st.service6) AS timelast
      FROM opitemrece o
      LEFT OUTER JOIN patient pt ON o.hn = pt.hn
      LEFT OUTER JOIN service_time st ON o.vn = st.vn
      WHERE o.vstdate = CURRENT_DATE()
        AND o.icode LIKE '1%'
        AND (st.service6 IS NOT NULL AND st.service7 IS NOT NULL AND st.service16 IS NULL)
      GROUP BY o.hn, pt.pname, pt.fname, pt.lname, st.service6
      ORDER BY TIMEDIFF(CURRENT_TIME(), st.service6) DESC
    `

    const [paidList, printedList] = await Promise.all([
      this.clinicalDb(queryPaid),
      this.clinicalDb(queryPrinted),
    ])

    // Mask patient names for PDPA compliance
    const maskItems = (list: any[]): OutpatientDrugQueueItem[] =>
      (list || []).map((row) => ({
        hn: String(row.hn || ''),
        ptname: maskPatientName(String(row.ptname || '')),
        service_time: String(row.service_time || ''),
        timelast: String(row.timelast || ''),
        ...(row.department ? { department: String(row.department) } : {}),
      }))

    return {
      paidPatients: maskItems(paidList),
      printedPatients: maskItems(printedList),
      updatedAt: new Date().toISOString(),
    }
  }
}

export const outpatientDrugService = new OutpatientDrugService()
