import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeCareClient from './PalliativeCareClient'
import { RcmDashboardService } from '@/lib/clinical/rcmDashboardService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: 'Palliative Care ตามกลุ่มโรค (PC.3) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายชื่อผู้ป่วย Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด (PC.3) โรงพยาบาลเถิน',
}

export default async function PalliativeCarePc3Page() {
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
    initialData = await RcmDashboardService.getPalliativeCareReport({
      ds1: defaultRange.startDate,
      ds2: defaultRange.endDate,
      ucOnly: true,
      filterType: 'ALL',
      deathStatus: 'ALL',
    })
  } catch (error) {
    console.error('Failed to prefetch Palliative Care PC.3 SSR data:', error)
  }

  return <PalliativeCareClient initialData={initialData} initialRange={defaultRange} />
}
