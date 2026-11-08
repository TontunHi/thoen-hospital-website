import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import InjectableContraceptivesClient from './InjectableContraceptivesClient'

export const metadata = {
  title: '9.7 ยาฉีดคุมกำเนิด | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการให้บริการยาฉีดคุมกำเนิด โรงพยาบาลเถิน',
}

export default async function InjectableContraceptivesPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null
  try {
    initialData = await RcmFamilyPlanningService.getFamilyPlanningReport({
      reportType: '9.7',
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
    })
  } catch {
    initialData = null
  }

  return <InjectableContraceptivesClient initialData={initialData} initialRange={defaultRange} />
}
