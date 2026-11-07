import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
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

  return <FastingPlasmaGlucoseClient />
}
