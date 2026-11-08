import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import CcsScreenedRecipientsClient from './CcsScreenedRecipientsClient'
import { RcmCervicalCancerService } from '@/lib/clinical/rcmCervicalCancerService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก | คัดกรองมะเร็งปากมดลูก (CCS) กองทุน Dashboard-RCM',
  description:
    'รายงาน 1.2 รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก (CCS) ตรวจสอบรหัสบริการ ผลการตรวจ และการชดเชย Seamless / สปสช. โรงพยาบาลเถิน',
}

export default async function CcsScreenedRecipientsPage() {
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
    initialData = await RcmCervicalCancerService.getScreenedRecipientsReport({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      methodFilter: 'ALL',
      okFilter: 'ALL',
      resultStatusFilter: 'ALL',
      compensationFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch CCS screened recipients SSR data:', error)
  }

  return <CcsScreenedRecipientsClient initialData={initialData} initialRange={defaultRange} />
}
