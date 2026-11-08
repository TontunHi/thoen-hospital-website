import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { logThrottledAudit } from '@/lib/audit'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { RcmDentalImplantService } from '@/lib/clinical/rcmDentalImplantService'
import DentalImplantDensurClient from './DentalImplantDensurClient'

export const metadata: Metadata = {
  title: 'รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR | กองทุนรากฟันเทียม โรงพยาบาลเถิน',
  description:
    'รายงานการให้บริการผ่าตัดใส่รากฟันเทียม DENSUR และการชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function DentalImplantDensurPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/dental-implant/densur')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit('READ', 'RCM_DENTAL_IMPLANT_DENSUR', session.username).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData = null

  try {
    initialData = await RcmDentalImplantService.getDensurReport({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      page: 1,
      pageSize: 50,
    })
  } catch (err: unknown) {
    console.error('SSR Prefetch Error (Dental Implant DENSUR):', err)
    initialData = null
  }

  return (
    <DentalImplantDensurClient
      initialData={initialData}
      initialRange={initialRange}
    />
  )
}
