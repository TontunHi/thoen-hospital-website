import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import OralContraceptivesClient from './OralContraceptivesClient'

export const metadata = {
  title: '9.4 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานการให้บริการยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม โรงพยาบาลเถิน',
}

export default async function OralContraceptivesPage() {
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
      reportType: '9.4',
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
    })
  } catch {
    initialData = null
  }

  return <OralContraceptivesClient initialData={initialData} initialRange={defaultRange} />
}
