import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import FamilyPlanning932Client from './FamilyPlanning932Client'
import { RcmFamilyPlanningService } from '@/lib/clinical/rcmFamilyPlanningService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '9.3.2 บริการคุมกำเนิดกึ่งถาวร (ในหญิงอายุ 20 ปีขึ้นไป) | กองทุนบริการวางแผนครอบครัว Dashboard-RCM',
  description:
    'รายงานหัวข้อที่ 9.3.2 บริการคุมกำเนิดกึ่งถาวร ในหญิงอายุ 20 ปีขึ้นไป รหัส ADP: FP001, FP002 ตรวจสอบการลงรหัส Dx, Op, ค่าบริการ, รายการยา และสถานะการชดเชยค่าบริการ E-Claim / REP / สปสช. โรงพยาบาลเถิน',
}

export default async function FamilyPlanningService932Page() {
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
    initialData = await RcmFamilyPlanningService.getFamilyPlanning932Report({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      format: 'NEW_ECLAIM',
      cardFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch Family Planning 9.3.2 SSR data:', error)
  }

  return <FamilyPlanning932Client initialData={initialData} initialRange={defaultRange} />
}
