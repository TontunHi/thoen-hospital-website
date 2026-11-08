import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import EmergencyContraceptiveClient from './EmergencyContraceptiveClient'

export const metadata = {
  title: '9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการให้บริการยาเม็ดคุมกำเนิดฉุกเฉิน โรงพยาบาลเถิน',
}

export default async function EmergencyContraceptivePage() {
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
      reportType: '9.6',
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
    })
  } catch {
    initialData = null
  }

  return <EmergencyContraceptiveClient initialData={initialData} initialRange={defaultRange} />
}
