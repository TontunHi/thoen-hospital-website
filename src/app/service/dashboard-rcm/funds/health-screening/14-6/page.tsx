import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  RcmHealthScreeningService,
  type HealthScreeningReportResult,
} from '@/lib/clinical/rcmHealthScreeningService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import TotalCholesterolClient from './TotalCholesterolClient'

export const metadata: Metadata = {
  title:
    '14.6 เจาะเลือดจากหลอดเลือดดำ หลังอดอาหาร 8 ชม. Total Cholesterol หรือ HDL (อายุ 45-59 ปี) (12004) | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการเจาะเลือดจากหลอดเลือดดำ หลังอดอาหาร 8 ชม. Total Cholesterol หรือ HDL ในผู้มีอายุ 45-59 ปี รหัส ADP 12004 ระบบบริหารการเงินและชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function TotalCholesterolPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/health-screening/14-6')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_funds_health_screening_14_6',
    'Viewed Total Cholesterol / HDL report (14.6 ADP 12004) (default fiscal year, filter: ALL, export: false)',
    { username: session.username, email: session.email }
  ).catch((err) => logger.error({ err }, 'Total Cholesterol 14.6 SSR audit log failed'))

  let initialData: HealthScreeningReportResult | null = null
  try {
    initialData = await RcmHealthScreeningService.getHealthScreeningReport({
      adpCode: '12004',
    })
  } catch (err) {
    logger.error({ err }, 'Failed to prefetch initial data for Total Cholesterol 14.6')
  }

  return <TotalCholesterolClient initialData={initialData} />
}
