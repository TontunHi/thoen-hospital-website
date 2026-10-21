import { NextResponse } from 'next/server'
import { verifyMemberSession } from '@/lib/memberAuth'
import { Rh1BudgetService, THOEN_HOSPITAL_CODE, PeerScope } from '@/lib/budget/rh1BudgetService'

export async function GET(request: Request) {
  const session = await verifyMemberSession()
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' } }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || ''
  const source = searchParams.get('source') || (view === 'l1' ? 'L1' : view === 'l2' ? 'L2' : 'EXEC')
  const year = searchParams.get('year') || Rh1BudgetService.getAvailableFiscalYears()[0] || '2570'
  const hospitalCode = parseInt(searchParams.get('hospitalCode') || String(THOEN_HOSPITAL_CODE), 10)
  const peerScope = (searchParams.get('peerScope') || 'm2') as PeerScope
  const search = searchParams.get('search') || undefined

  try {
    if (view === 'years') {
      const years = Rh1BudgetService.getAvailableFiscalYears()
      return NextResponse.json({ success: true, data: { years } })
    }

    if (view === 'hospitals') {
      const hospitals = Rh1BudgetService.getAllHospitals(year)
      return NextResponse.json({ success: true, data: { hospitals } })
    }

    // Single unified API endpoint:
    if (source === 'EXEC') {
      const summary = Rh1BudgetService.getExecutiveSummary(year, hospitalCode, peerScope)
      return NextResponse.json({ success: true, data: { summary } })
    }

    // Source L1..L8 items
    const items = Rh1BudgetService.getSourceItems(year, source, hospitalCode, {
      peerScope,
      search,
      limit: 150,
    })

    // Also get peer summary stats for this source
    const summary = Rh1BudgetService.getExecutiveSummary(year, hospitalCode, peerScope)

    return NextResponse.json({
      success: true,
      data: {
        source,
        items,
        l1: source === 'L1' ? items : undefined,
        summary,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลงบประมาณ' } },
      { status: 500 }
    )
  }
}
