import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  TaskInboxApiError,
  TaskInboxApiService,
} from '@/lib/inbox/taskInboxApiService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const data = await TaskInboxApiService.getTaskFullDetailForSession(session, taskId)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Fetch task detail error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลงาน' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = (await request.json()) as Record<string, unknown>

    const result = await TaskInboxApiService.editTaskAsManager(session, taskId, body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลงาน' },
        { status: result.statusCode || 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      diff: result.diff,
    })
  } catch (error) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Manager edit task error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลงาน' }, { status: 500 })
  }
}
