import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logAudit } from '@/lib/audit'
import {
  MisHosService,
  MIS_HOS_MENU_CATEGORIES,
  THOEN_HOSPITAL_CODE,
} from '@/lib/budget/misHosService'

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' } },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { action, ssid, stId, hcode, year, province, subfund, forceRefresh } = body

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
      const template = await MisHosService.getTemplateConfig(String(stId), {
        year: year ? String(year) : undefined,
        hcode: hcode ? String(hcode) : undefined,
        subfund: subfund ? String(subfund) : undefined,
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

    const result = await MisHosService.getTableData(String(ssid), {
      hcode: hcode ? String(hcode) : THOEN_HOSPITAL_CODE,
      year: year ? String(year) : undefined,
      province: province ? String(province) : undefined,
      subfund: subfund ? String(subfund) : undefined,
      forceRefresh: Boolean(forceRefresh),
    })

    await logAudit(
      'READ',
      'budget_mishos',
      `ดูรายงาน MIS HOS สปสช. ssid=${ssid} รหัสหน่วยบริการ=${hcode || THOEN_HOSPITAL_CODE}`,
      session
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      },
      { status: 500 }
    )
  }
}
