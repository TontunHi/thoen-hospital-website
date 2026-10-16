import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { KpiService } from '@/lib/kpi/kpiService'
import { z } from 'zod'

const targetSchema = z.object({
  indicatorId: z.number().int().positive(),
  targetOperator: z.string().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  targetUnit: z.string().nullable().optional(),
  targetRaw: z.string().nullable().optional(),
})

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) return auth.error
    const member = auth.member

    if (!member.isAdmin && !member.can('manage_kpi')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถแก้ไขเป้าหมายได้' } },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = targetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ข้อมูลเป้าหมายไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    await KpiService.updateTarget({
      ...parsed.data,
      targetOperator: parsed.data.targetOperator ?? null,
      targetValue: parsed.data.targetValue ?? null,
      updatedByName: member.name || member.username,
    })

    return NextResponse.json({
      success: true,
      message: 'บันทึกเป้าหมายเรียบร้อยแล้ว',
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message || 'แก้ไขเป้าหมายไม่สำเร็จ' } },
      { status: 500 }
    )
  }
}
