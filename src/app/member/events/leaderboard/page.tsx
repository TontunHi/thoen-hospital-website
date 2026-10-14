import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { EventLeaderboardService } from '@/lib/events/eventLeaderboardService'
import LeaderboardClient from './LeaderboardClient'

export const metadata = {
  title: 'กระดานคะแนนกิจกรรม | โรงพยาบาลเถิน',
  description: 'กระดานอันดับการเข้าร่วมกิจกรรมบุคลากรโรงพยาบาลเถิน รายบุคคลและระดับแผนก',
}

const leaderboardService = new EventLeaderboardService()

export default async function LeaderboardPage() {
  const member = await getAuthenticatedMember()
  if (!member) {
    redirect('/member/login')
  }

  // Pre-fetch initial leaderboard data
  let initialIndividual: any[] = []
  let initialDepartment: any[] = []
  let fiscalYears: string[] = []

  try {
    const [indRes, deptRes, years] = await Promise.all([
      leaderboardService.getIndividualLeaderboard({ timeframe: 'fiscal_year' }),
      leaderboardService.getDepartmentLeaderboard({ timeframe: 'fiscal_year' }),
      leaderboardService.getDistinctFiscalYears(),
    ])

    initialIndividual = indRes
    initialDepartment = deptRes
    fiscalYears = years
  } catch (err) {
    console.error('Error loading leaderboard:', err)
  }

  return (
    <LeaderboardClient
      initialIndividual={initialIndividual}
      initialDepartment={initialDepartment}
      fiscalYears={fiscalYears}
      currentMemberId={member.id}
    />
  )
}
