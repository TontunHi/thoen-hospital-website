import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
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

  return <TotalCholesterolClient />
}
