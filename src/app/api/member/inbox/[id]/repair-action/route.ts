import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  TaskInboxApiError,
  TaskInboxApiService,
} from '@/lib/inbox/taskInboxApiService'
import { logger } from '@/lib/logger'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { id: taskId } = await params
    const body = (await request.json()) as { action?: string } & Record<string, unknown>
    const { action, ...payload } = body

    if (!action) {
      return NextResponse.json(
        { error: 'กรุณาระบุ Action ที่ต้องการดำเนินการ' },
        { status: 400 }
      )
    }

    const result = await TaskInboxApiService.performTaskRepairAction({
      username: session.username,
      taskId,
      action,
      payload,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    })
  } catch (error: unknown) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Repair action error')
    const msg = error instanceof Error ? error.message : ''
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการทำรายการ: ' + msg },
      { status: 500 }
    )
  }
}
