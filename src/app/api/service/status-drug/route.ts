import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getCachedData } from '@/lib/cache'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    logAudit(
      'READ',
      'opitemrece',
      'Viewed drug dispensing status and outpatient prescription queue',
      { username: session.username, email: session.email }
    ).catch(err => logger.error({ err }, 'Drug status audit log failed'))

    const cacheKey = 'drug-dispense-status-data'

    const data = await getCachedData(cacheKey, async () => {
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
        queryHosDb(queryPaid),
        queryHosDb(queryPrinted),
      ])

      return {
        paidPatients: paidList || [],
        printedPatients: printedList || [],
        updatedAt: new Date().toISOString(),
      }
    }, 10000) // 10s TTL cache

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Drug status API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะการจ่ายยา',
      },
      { status: 500 }
    )
  }
}
