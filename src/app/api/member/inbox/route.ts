import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  TaskInboxApiError,
  TaskInboxApiService,
} from '@/lib/inbox/taskInboxApiService'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const data = await TaskInboxApiService.listUnifiedInboxTasks({
      username: session.username,
      tab: searchParams.get('tab') || 'inbox',
      type: searchParams.get('type'),
      status: searchParams.get('status'),
      search: searchParams.get('search')?.trim(),
    })

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Unified inbox GET error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงรายการงาน' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const body = await request.json()
    const data = await TaskInboxApiService.createGenericInboxTask(session, body)

    return NextResponse.json({
      success: true,
      message: 'สร้างงานและส่งเข้าสู่กระบวนการเรียบร้อยแล้ว',
      data,
    })
  } catch (error) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Create task error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างคำขอ' }, { status: 500 })
  }
}
