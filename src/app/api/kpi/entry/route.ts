import { NextRequest, NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { KpiService } from '@/lib/kpi/kpiService'
import { z } from 'zod'

const entrySchema = z.object({
  indicatorId: z.number().int().positive(),
  fiscalYear: z.string().min(1),
  periodKey: z.string().min(1),
  periodLabel: z.string().min(1),
  numeratorValue: z.number().nullable().optional(),
  denominatorValue: z.number().nullable().optional(),
  resultValue: z.number().nullable().optional(),
  resultText: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMemberApi()
    if (auth.error) {
      return auth.error
    }
    const member = auth.member

    const body = await req.json()
    const parsed = entrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const entry = await KpiService.saveEntry({
      ...parsed.data,
      recordedById: member.id,
      recordedByName: member.name || member.username,
      isAdmin: member.isAdmin,
    })

    return NextResponse.json({
      success: true,
      data: entry,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SAVE_FAILED', message: err.message || 'บันทึกข้อมูลไม่สำเร็จ' } },
      { status: 400 }
    )
  }
}
