import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import OralCancerScreeningClient from './OralCancerScreeningClient'
import { RcmOralCancerService } from '@/lib/clinical/rcmOralCancerService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata: Metadata = {
  title: '12.1 คัดกรองรอยโรคมะเร็งช่องปาก (40 ปี+) | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการคัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก ในผู้มีอายุ 40 ปีขึ้นไป รหัส ADP 90004 ระบบบริหารการเงินและชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function OralCancerScreeningPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/oral-cancer/1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null

  try {
    initialData = await RcmOralCancerService.getOralCancerReport({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      cardFilter: 'ALL',
      ucOnly: false,
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch Oral Cancer SSR data:', error)
  }

  return <OralCancerScreeningClient initialData={initialData} initialRange={defaultRange} />
}
