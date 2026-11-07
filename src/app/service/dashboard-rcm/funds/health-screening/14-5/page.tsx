import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import {
  RcmHealthScreeningService,
  type HealthScreeningReportResult,
} from '@/lib/clinical/rcmHealthScreeningService'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import FastingPlasmaGlucoseClient from './FastingPlasmaGlucoseClient'

export const metadata: Metadata = {
  title: '14.5 Fasting Plasma Glucose (12003) | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการตรวจระดับน้ำตาลในเลือด Fasting Plasma Glucose (FPG) รหัส ADP 12003 ระบบบริหารการเงินและชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function FastingPlasmaGlucosePage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/health-screening/14-5')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  logThrottledAudit(
    'READ',
    'rcm_funds_health_screening_14_5',
    'Viewed FPG report (14.5 ADP 12003) (default fiscal year, filter: ALL, export: false)',
    { username: session.username, email: session.email }
  ).catch((err) => logger.error({ err }, 'FPG 14.5 SSR audit log failed'))

  let initialData: HealthScreeningReportResult | null = null
  try {
    initialData = await RcmHealthScreeningService.getHealthScreeningReport({
      adpCode: '12003',
    })
  } catch (err) {
    logger.error({ err }, 'Failed to prefetch initial data for FPG 14.5')
  }

  return <FastingPlasmaGlucoseClient initialData={initialData} />
}
