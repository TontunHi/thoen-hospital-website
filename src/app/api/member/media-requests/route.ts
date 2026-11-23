import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  TaskInboxApiError,
  TaskInboxApiService,
} from '@/lib/inbox/taskInboxApiService'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const MediaRequestWorkTypeSchema = z.object({
  key: z.string(),
  label: z.string(),
  customDetail: z.string().optional().nullable(),
})

const MediaRequestChannelSchema = z.object({
  key: z.string(),
  label: z.string(),
  customDetail: z.string().optional().nullable(),
})

const MediaRequestAttachmentSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  fileType: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
})

const MediaRequestQuotationSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  fileType: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
})

const CreateMediaRequestSchema = z.object({
  title: z.string().min(2, 'กรุณาระบุเรื่อง / หัวข้องาน'),
  urgency: z.enum(['NORMAL', 'URGENT', 'VERY_URGENT']).default('NORMAL'),
  deliveryDate: z.string().min(1, 'กรุณาระบุวันที่ขอรับงาน'),
  costType: z.enum(['NO_COST', 'HAS_COST']).default('NO_COST'),
  workTypes: z
    .array(MediaRequestWorkTypeSchema)
    .min(1, 'กรุณาเลือกลักษณะงานอย่างน้อย 1 รายการ'),
  channels: z
    .array(MediaRequestChannelSchema)
    .min(1, 'กรุณาเลือกช่องทางเผยแพร่อย่างน้อย 1 รายการ'),
  description: z.string().min(5, 'กรุณาระบุรายละเอียดงานให้ชัดเจน'),
  phone: z.string().min(1, 'กรุณาระบุเบอร์โทรส่วนตัว / แผนก'),
  attachments: z.array(MediaRequestAttachmentSchema).optional().default([]),
  quotations: z.array(MediaRequestQuotationSchema).optional().default([]),
  driveLink: z.string().optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const data = await TaskInboxApiService.listMediaRequests({
      username: session.username,
      status: searchParams.get('status'),
      search: searchParams.get('search')?.trim(),
      limit: Math.min(Number(searchParams.get('limit')) || 50, 100),
    })

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Media requests GET error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอสื่อ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = CreateMediaRequestSchema.safeParse(json)
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || 'ข้อมูลที่ส่งมาไม่ถูกต้อง'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const data = await TaskInboxApiService.createMediaRequest(session, parsed.data)

    return NextResponse.json({
      success: true,
      message: 'ยื่นคำขอสื่อประชาสัมพันธ์เรียบร้อยแล้ว',
      data,
    })
  } catch (error) {
    if (error instanceof TaskInboxApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error({ err: error }, 'Create media request error')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างคำขอสื่อ' }, { status: 500 })
  }
}
