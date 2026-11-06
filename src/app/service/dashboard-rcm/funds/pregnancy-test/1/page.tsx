import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import PregnancyTestClient from './PregnancyTestClient'

export const metadata: Metadata = {
  title: '8.1 การทดสอบการตั้งครรภ์ | ระบบบริหารการเงินและกองทุน RCM โรงพยาบาลเถิน',
  description:
    'รายงานการตรวจการตั้งครรภ์ รหัส ADP 31101, 30014 ติดตามผลตรวจทางห้องปฏิบัติการ UPT และการชดเชยค่าบริการกองทุน โรงพยาบาลเถิน',
}

export default async function PregnancyTestPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/pregnancy-test/1')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <PregnancyTestClient />
}
