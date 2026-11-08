import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { RcmCancerFundService } from '@/lib/clinical/rcmCancerFundService'
import CancerFundAdpClient from './CancerFundAdpClient'

export const metadata: Metadata = {
  title: 'รายชื่อผู้ป่วย จาก ADP (CANCER) | กองทุนมะเร็ง | Dashboard-RCM โรงพยาบาลเถิน',
  description:
    'รายงานรายชื่อผู้ป่วยกองทุนมะเร็ง จากรหัส ADP (CANCER) และการติดตามการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function CancerFundAdpPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/cancer/adp')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_funds_cancer_adp_page',
    'Loaded SSR page for Cancer Fund ADP patient report',
    { username: session.username, email: session.email }
  ).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData = null
  try {
    initialData = await RcmCancerFundService.getCancerPatientsReport({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      page: 1,
      pageSize: 50,
    })
  } catch {
    initialData = null
  }

  return <CancerFundAdpClient initialData={initialData} />
}
