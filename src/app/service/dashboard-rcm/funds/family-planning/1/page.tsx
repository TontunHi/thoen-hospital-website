import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import FamilyPlanning91Client from './FamilyPlanning91Client'

export const metadata: Metadata = {
  title: '9.1 วางแผนครอบครัวและการป้องกันการตั้งครรภ์ | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานและตรวจสอบข้อมูลบริการวางแผนครอบครัวและการป้องกันการตั้งครรภ์ไม่พึงประสงค์ รหัสบริการ ADP หัตถการ ยาคุมกำเนิด และการชดเชยค่าบริการ โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService91Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/family-planning/1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData = null
  try {
    initialData = await RcmFamilyPlanningService.getFamilyPlanning91Report({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
    })
  } catch {
    initialData = null
  }

  return <FamilyPlanning91Client initialData={initialData} initialRange={defaultRange} />
}
