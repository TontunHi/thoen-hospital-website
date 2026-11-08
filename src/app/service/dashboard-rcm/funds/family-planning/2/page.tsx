import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import FamilyPlanning92Client from './FamilyPlanning92Client'

export const metadata: Metadata = {
  title: '9.2 บริการใส่ห่วงอนามัย | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานและตรวจสอบข้อมูลบริการใส่ห่วงอนามัยคุมกำเนิด (IUD) รหัสบริการ ADP หัตถการ และการชดเชยค่าบริการ โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService92Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/family-planning/2')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null
  try {
    initialData = await RcmFamilyPlanningService.getIudReport({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
    })
  } catch {
    initialData = null
  }

  return <FamilyPlanning92Client initialData={initialData} initialRange={defaultRange} />
}
