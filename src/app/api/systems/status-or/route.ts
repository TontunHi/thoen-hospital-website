import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { getCachedData } from '@/lib/cache'

export async function GET() {
  try {
    const cacheKey = 'or-room-status-data'

    const data = await getCachedData(cacheKey, async () => {
      // Query according to C:\Users\Tontun\Downloads\q\htdocs\status\or\index.php
      // 1. รอผ่าตัด (status_id = '1')
      const waitingQuery = `
        SELECT DISTINCT
          op.hn,
          TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''))) AS ptname,
          TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age_text,
          COALESCE(opr.room_name, '-') AS room_name,
          TIME_FORMAT(op.request_time, '%H:%i') AS request_time,
          COALESCE(ops.status_name, 'รอผ่าตัด') AS status_name
        FROM operation_list op
        LEFT OUTER JOIN patient pt ON op.hn = pt.hn
        LEFT OUTER JOIN operation_room opr ON op.room_id = opr.room_id
        LEFT OUTER JOIN operation_status ops ON op.status_id = ops.status_id
        WHERE op.operation_date = CURRENT_DATE()
          AND op.status_id IN ('1')
        ORDER BY op.request_time ASC
      `

      // 2. กำลังผ่าตัด (status_id = '2')
      const inProgressQuery = `
        SELECT DISTINCT
          op.hn,
          TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''))) AS ptname,
          TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age_text,
          COALESCE(opr.room_name, '-') AS room_name,
          TIME_FORMAT(op.request_time, '%H:%i') AS request_time,
          COALESCE(ops.status_name, 'กำลังผ่าตัด') AS status_name
        FROM operation_list op
        LEFT OUTER JOIN patient pt ON op.hn = pt.hn
        LEFT OUTER JOIN operation_room opr ON op.room_id = opr.room_id
        LEFT OUTER JOIN operation_status ops ON op.status_id = ops.status_id
        WHERE op.operation_date = CURRENT_DATE()
          AND op.status_id IN ('2')
        ORDER BY op.request_time ASC
      `

      // 3. ผ่าตัดเสร็จ/พักฟื้น (status_id = '3')
      const recoveryQuery = `
        SELECT DISTINCT
          op.hn,
          TRIM(CONCAT(COALESCE(pt.pname, ''), COALESCE(pt.fname, ''))) AS ptname,
          TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age_text,
          COALESCE(opr.room_name, '-') AS room_name,
          TIME_FORMAT(op.request_time, '%H:%i') AS request_time,
          COALESCE(ops.status_name, 'ผ่าตัดเสร็จ/พักฟื้น') AS status_name
        FROM operation_list op
        LEFT OUTER JOIN patient pt ON op.hn = pt.hn
        LEFT OUTER JOIN operation_room opr ON op.room_id = opr.room_id
        LEFT OUTER JOIN operation_status ops ON op.status_id = ops.status_id
        WHERE op.operation_date = CURRENT_DATE()
          AND op.status_id IN ('3')
        ORDER BY op.request_time ASC
      `

      const [waitingList, inProgressList, recoveryList] = await Promise.all([
        queryHosDb(waitingQuery),
        queryHosDb(inProgressQuery),
        queryHosDb(recoveryQuery),
      ])

      return {
        waiting: waitingList || [],
        inProgress: inProgressList || [],
        recovery: recoveryList || [],
        total: (waitingList?.length || 0) + (inProgressList?.length || 0) + (recoveryList?.length || 0),
        updatedAt: new Date().toISOString(),
      }
    }, 10000) // 10 seconds cache

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('OR status API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะห้องผ่าตัด',
      },
      { status: 500 }
    )
  }
}
