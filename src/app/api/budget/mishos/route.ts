import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'
import {
  MisHosService,
  MIS_HOS_MENU_CATEGORIES,
  THOEN_HOSPITAL_CODE,
} from '@/lib/budget/misHosService'

const MisHosRequestSchema = z.object({
  action: z.enum(['getCategories', 'getHospitalInfo', 'getTemplate', 'getTableData']).default('getTableData'),
  ssid: z.string().optional(),
  stId: z.string().optional(),
  hcode: z.string().optional(),
  year: z.string().optional(),
  province: z.string().optional(),
  subfund: z.string().optional(),
  forceRefresh: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' } },
        { status: 401 }
      )
    }

    const rawBody = await req.json().catch(() => ({}))
    const parsed = MisHosRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'พารามิเตอร์ไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const { action, ssid, stId, hcode, year, province, subfund, forceRefresh } = parsed.data

    if (action === 'getCategories') {
      return NextResponse.json({ success: true, data: MIS_HOS_MENU_CATEGORIES })
    }

    if (action === 'getHospitalInfo') {
      const info = await MisHosService.getHospitalInfo(hcode || THOEN_HOSPITAL_CODE)
      return NextResponse.json({ success: true, data: info })
    }

    if (action === 'getTemplate') {
      if (!stId) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_INPUT', message: 'ระบุ stId ของเทมเพลต' } },
          { status: 400 }
        )
      }
      const template = await MisHosService.getTemplateConfig(stId, {
        year,
        hcode,
        subfund,
      })
      return NextResponse.json({ success: true, data: template })
    }

    // Default action: getTableData
    if (!ssid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'ระบุ ssid ของรายงาน' } },
        { status: 400 }
      )
    }

    const result = await MisHosService.getTableData(ssid, {
      hcode: hcode || THOEN_HOSPITAL_CODE,
      year,
      province,
      subfund,
      forceRefresh: Boolean(forceRefresh),
    })

    await logAudit(
      'READ',
      'budget_mishos',
      `ดูรายงาน MIS HOS สปสช. ssid=${ssid} รหัสหน่วยบริการ=${hcode || THOEN_HOSPITAL_CODE}`,
      session
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      },
      { status: 500 }
    )
  }
}
