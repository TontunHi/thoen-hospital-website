import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AncService30011Client from './AncService30011Client'

export const metadata = {
  title: '2.4 บริการฝากครรภ์ (ANC 30011) | กองทุน Dashboard-RCM',
  description:
    'รายงาน 2.4 บริการฝากครรภ์ (ANC) รหัส ADP 30011 ตรวจสอบการสั่งใช้รหัส ADP การวินิจฉัย หัตถการ และการชดเชยค่าบริการ E-Claim / สปสช. โรงพยาบาลเถิน',
}

export default async function AncService30011Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <AncService30011Client />
}
