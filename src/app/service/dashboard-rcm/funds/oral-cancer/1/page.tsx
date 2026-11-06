import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import OralCancerScreeningClient from './OralCancerScreeningClient'

export const metadata: Metadata = {
  title: '12.1 คัดกรองรอยโรคมะเร็งช่องปาก (40 ปี+) | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'บริการคัดกรองรอยโรคเสี่ยงมะเร็งและมะเร็งช่องปาก ในผู้มีอายุ 40 ปีขึ้นไป รหัส ADP 90004 ระบบบริหารการเงินและชดเชยค่าบริการทางการแพทย์ RCM โรงพยาบาลเถิน',
}

export default async function OralCancerScreeningPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/oral-cancer/1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <OralCancerScreeningClient />
}
