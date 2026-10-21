import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMemberSession } from '@/lib/memberAuth'
import { SmtBudgetService } from '@/lib/budget/smtBudgetService'
import { logAudit } from '@/lib/audit'

const SmtQuerySchema = z.object({
  budgetYears: z.array(z.string()).optional(),
  vendorId5Digit: z.string().optional(),
  transferStartDate: z.string().optional(),
  transferEndDate: z.string().optional(),
  zoneId: z.string().optional(),
  budgetSource: z.string().optional(),
  forceRefresh: z.boolean().optional(),
})

export async function POST(request: Request) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูล' } },
      { status: 401 }
    )
  }

  try {
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = SmtQuerySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'พารามิเตอร์ไม่ถูกต้อง' } },
        { status: 400 }
      )
    }

    const result = await SmtBudgetService.searchBudget(parsed.data)

    // Log audit for sensitive budget view
    await logAudit(
      'READ',
      'budget_smt',
      `สืบค้นงบประมาณ สปสช. SMT (ปี: ${(parsed.data.budgetYears || ['2570']).join(', ')}, รหัส: ${parsed.data.vendorId5Digit || '11152'})`,
      session
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SMT_UPSTREAM_ERROR', message: error?.message || 'ไม่สามารถดึงข้อมูลงบประมาณ สปสช. ได้ในขณะนี้' },
      },
      { status: 502 }
    )
  }
}

export async function GET(request: Request) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูล' } },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const yearsParam = searchParams.get('years')
  const budgetYears = yearsParam ? yearsParam.split(',').map(y => y.trim()) : ['2570']
  const vendorId5Digit = searchParams.get('vendorId') || '11152'
  const forceRefresh = searchParams.get('forceRefresh') === 'true'

  try {
    const result = await SmtBudgetService.searchBudget({
      budgetYears,
      vendorId5Digit,
      forceRefresh,
    })

    await logAudit(
      'READ',
      'budget_smt',
      `สืบค้นงบประมาณ สปสช. SMT (ปี: ${budgetYears.join(', ')}, รหัส: ${vendorId5Digit})`,
      session
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SMT_UPSTREAM_ERROR', message: error?.message || 'ไม่สามารถดึงข้อมูลงบประมาณ สปสช. ได้ในขณะนี้' },
      },
      { status: 502 }
    )
  }
}
