import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMemberApi } from '@/lib/memberAuth'
import { screeningQueueService } from '@/lib/screening/screeningService'

const createQueueSchema = z.object({
  cid: z.string().min(13, 'เลขประจำตัวประชาชนต้องมี 13 หลัก').max(20),
  title: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  photoBase64: z.string().optional().nullable(),
  rawPayload: z.any().optional().nullable(),
  status: z.enum(['WAITING', 'VISIT_OPENED', 'NO_RECORD', 'CANCELLED']).optional(),
  vn: z.string().optional().nullable(),
})

const updateQueueBodySchema = z.object({
  id: z.coerce.number().int().positive('รหัสคิวไม่ถูกต้อง'),
  status: z.enum(['WAITING', 'VISIT_OPENED', 'NO_RECORD', 'CANCELLED']),
  vn: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || 'today'
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const includePhoto = searchParams.get('includePhoto') === 'true'
    const includeRawPayload = searchParams.get('includeRawPayload') === 'true'

    const result = await screeningQueueService.getQueues({
      date,
      search,
      status,
      includePhoto,
      includeRawPayload,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_QUEUES_ERROR',
          message: error?.message || 'เกิดข้อผิดพลาดในการดึงรายการคิว',
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    const body = await req.json()

    // Status update fallback path (prevents proxy / reverse proxy issues with [id] or HTTP PATCH)
    if (body.action === 'UPDATE_STATUS' || (body.id && body.status && !body.cid)) {
      const parsedUpdate = updateQueueBodySchema.safeParse(body)
      if (!parsedUpdate.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: parsedUpdate.error.issues[0]?.message || 'ข้อมูลสถานะไม่ถูกต้อง',
            },
          },
          { status: 400 }
        )
      }

      const updated = await screeningQueueService.updateQueueStatus(
        parsedUpdate.data.id,
        {
          status: parsedUpdate.data.status,
          vn: parsedUpdate.data.vn,
        },
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
    }

    const parsed = createQueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง',
          },
        },
        { status: 400 }
      )
    }

    const item = await screeningQueueService.addToQueue(parsed.data, {
      id: member.id,
      name: member.name,
      username: member.username,
      role: member.role,
    })

    return NextResponse.json(
      {
        success: true,
        data: item,
      },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_QUEUE_ERROR',
          message: error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลคิว',
        },
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  return POST(req)
}
