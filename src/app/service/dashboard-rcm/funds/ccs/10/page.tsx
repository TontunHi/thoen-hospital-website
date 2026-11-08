import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import CcsService1B005Client from './CcsService1B005Client'
import { RcmCervicalCancerService } from '@/lib/clinical/rcmCervicalCancerService'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'

export const metadata = {
  title: '1.10 บริการเก็บสิ่งส่งตรวจมะเร็งปากมดลูก (1B005) | คัดกรองมะเร็งปากมดลูก (CCS) กองทุน Dashboard-RCM',
  description:
    'รายงาน 1.10 บริการเก็บและส่งสิ่งส่งตรวจ Pap smear / HPV DNA test (รหัส 1B005) ตรวจสอบการผูกรหัส ADP และสถานะชดเชยค่าบริการ กองทุนบริการสร้างเสริมสุขภาพและป้องกันโรค รพ.เถิน',
}

export default async function CcsService1B005Page() {
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
    initialData = await RcmCervicalCancerService.getService1B005Report({
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate,
      compensationFilter: 'ALL',
      searchField: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
      page: 1,
      pageSize: 50,
    })
  } catch (error) {
    console.error('Failed to prefetch CCS 1B005 SSR data:', error)
  }

  return <CcsService1B005Client initialData={initialData} initialRange={defaultRange} />
}
