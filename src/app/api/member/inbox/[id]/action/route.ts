import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  TaskInboxApiError,
  TaskInboxApiService,
} from '@/lib/inbox/taskInboxApiService'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'SEND_BACK', 'HOLD', 'RESUME', 'COMPLETE']),
  comment: z.string().optional(),
  nextAssigneeId: z.number().nullable().optional(),
  partialEdits: z.any().optional(),
  holdReason: z.string().optional(),
  holdDetails: z.string().optional(),
  targetStepNo: z.number().int().positive().nullable().optional(),
  sendToRequester: z.boolean().optional(),
})

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
    const body = await request.json()
    const parsed = actionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Action ไม่ถูกต้อง' }, { status: 400 })
    }

    const result = await TaskInboxApiService.performTaskWorkflowAction({
      username: session.username,
      taskId,
      ...parsed.data,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const msg = error instanceof Error ? error.message : ''
    logger.error({ err: error }, 'Task action error')
    if (msg.includes('ไม่มีสิทธิ์')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    if (msg.includes('ไม่พบ')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.includes('ไม่อยู่ในสถานะ')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการประมวลผลคำสั่ง' }, { status: 500 })
  }
}
