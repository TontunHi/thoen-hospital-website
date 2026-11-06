import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { RcmDashboardService, getDefaultFiscalYearDateRange, type OpdDepartmentSummaryItem } from '@/lib/clinical/rcmDashboardService'
import OpdClient from './OpdClient'

export const metadata = {
  title: 'สรุปผู้ป่วยนอก OPD (2.1.1.3) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปการให้บริการผู้ป่วยนอกโรงพยาบาลเถิน (OPD) จำแนกตามแผนกการรักษา',
}

export default async function OpdPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  const defaultRange = getDefaultFiscalYearDateRange()
  let initialData: OpdDepartmentSummaryItem[] = []
  try {
    initialData = await RcmDashboardService.getOpdDepartmentSummary({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
    })
  } catch {
    initialData = []
  }

  return <OpdClient initialData={initialData} initialRange={defaultRange} />
}
