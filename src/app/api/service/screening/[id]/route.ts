import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMemberApi } from '@/lib/memberAuth'
import { screeningQueueService } from '@/lib/screening/screeningService'

const updateQueueSchema = z.object({
  status: z.enum(['WAITING', 'VISIT_OPENED', 'NO_RECORD', 'CANCELLED']),
  vn: z.string().optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error

    const { id } = await params
    const queueId = parseInt(id, 10)
    if (isNaN(queueId)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'รหัสคิวไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const item = await screeningQueueService.getQueueById(queueId)
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลคิว' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_QUEUE_ERROR',
          message: error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลคิว',
        },
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    const { id } = await params
    const queueId = parseInt(id, 10)
    if (isNaN(queueId)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'รหัสคิวไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const body = await req.json()
    const parsed = updateQueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'ข้อมูลสถานะไม่ถูกต้อง',
          },
        },
        { status: 400 }
      )
    }

    const updated = await screeningQueueService.updateQueueStatus(queueId, parsed.data, {
      id: member.id,
      name: member.name,
      username: member.username,
      role: member.role,
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_QUEUE_ERROR',
          message: error?.message || 'เกิดข้อผิดพลาดในการปรับปรุงสถานะคิว',
        },
      },
      { status: 500 }
    )
  }
}

// Proxies or hospital WAFs often block HTTP PATCH; provide POST and DELETE fallbacks
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(req, context)
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    const { id } = await context.params
    const queueId = parseInt(id, 10)
    if (isNaN(queueId)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'รหัสคิวไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const updated = await screeningQueueService.updateQueueStatus(
      queueId,
      { status: 'CANCELLED' },
      {
        id: member.id,
        name: member.name,
        username: member.username,
        role: member.role,
      }
    )

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CANCEL_QUEUE_ERROR',
          message: error?.message || 'เกิดข้อผิดพลาดในการยกเลิกคิว',
        },
      },
      { status: 500 }
    )
  }
}
