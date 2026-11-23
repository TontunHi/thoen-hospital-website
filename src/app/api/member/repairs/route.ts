import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  TaskInboxApiError,
  TaskInboxApiService,
} from '@/lib/inbox/taskInboxApiService'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const body = await request.json()
    const data = await TaskInboxApiService.createRepairTicket(session, body)

    return NextResponse.json({
      success: true,
      message: 'ยื่นใบแจ้งซ่อมสำเร็จเรียบร้อยแล้ว',
      data,
    })
  } catch (error: unknown) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Create repair ticket error')
    const msg = error instanceof Error ? error.message : ''
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างใบแจ้งซ่อม: ' + msg },
      { status: 500 }
    )
  }
}
