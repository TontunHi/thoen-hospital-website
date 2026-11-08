import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { RcmImcService } from '@/lib/clinical/rcmImcService'
import ImcEligiblePatientsClient from './ImcEligiblePatientsClient'

export const metadata: Metadata = {
  title: 'รายชื่อผู้รับบริการตามเกณฑ์ IMC | กองทุน RCM โรงพยาบาลเถิน',
  description:
    'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์: รายงานบริการผู้ป่วย IMC รายชื่อผู้รับบริการตามเกณฑ์ IMC (ผู้ป่วยใน IPD และ ผู้ป่วยนอก OPD) เปรียบเทียบข้อมูล HOSxP และระบบ Web IMC โรงพยาบาลเถิน',
}

export default async function ImcEligiblePatientsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect(
      '/member/login?returnUrl=/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients'
    )
    return null
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
    return null
  }

  // Pre-fetch initial data on server to eliminate waterfall (Zero Skeleton first paint)
  const initialRange = getDefaultFiscalYearDateRange()
  let initialData = null

  try {
    initialData = await RcmImcService.getImcReport({
      startDate: initialRange.startDate,
      endDate: initialRange.endDate,
      patientType: 'IPD',
      page: 1,
      pageSize: 50,
    })
  } catch {
    // Graceful fallback to client fetch if gateway is momentarily busy
    initialData = null
  }

  return <ImcEligiblePatientsClient initialData={initialData} />
}
