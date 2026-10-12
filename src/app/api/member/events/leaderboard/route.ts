import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { EventLeaderboardService } from '@/lib/events/eventLeaderboardService'

const leaderboardService = new EventLeaderboardService()

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const timeframe = (searchParams.get('timeframe') as any) || 'fiscal_year'
    const search = searchParams.get('search') || undefined

    const [individual, department, fiscalYears] = await Promise.all([
      leaderboardService.getIndividualLeaderboard({ fiscalYear, timeframe, search }),
      leaderboardService.getDepartmentLeaderboard({ fiscalYear, timeframe }),
      leaderboardService.getDistinctFiscalYears(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        individual,
        department,
        fiscalYears,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกระดานอันดับ' },
      { status: 500 }
    )
  }
}
