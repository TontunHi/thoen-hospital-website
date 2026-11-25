import { NextResponse } from 'next/server'
import { requireMemberApi } from '@/lib/memberAuth'
import { EventLeaderboardService, type LeaderboardFilterOptions } from '@/lib/events/eventLeaderboardService'
import { getErrorMessage } from '@/lib/http/apiResponse'

const leaderboardService = new EventLeaderboardService()

export async function GET(request: Request) {
  const auth = await requireMemberApi()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = searchParams.get('fiscalYear') || undefined
    const rawTimeframe = searchParams.get('timeframe')
    const timeframe: LeaderboardFilterOptions['timeframe'] =
      rawTimeframe === 'monthly' || rawTimeframe === 'all' ? rawTimeframe : 'fiscal_year'
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, 'เกิดข้อผิดพลาดในการดึงข้อมูลกระดานอันดับ') },
      { status: 500 }
    )
  }
}
