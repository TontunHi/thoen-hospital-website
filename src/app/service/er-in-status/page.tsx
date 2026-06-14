import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import ERInStatusClient from './ERInStatusClient'

export const metadata = {
  title: 'ระบบแสดงผลสถานะห้องฉุกเฉิน (ER Live Status) | โรงพยาบาลเถิน',
  description: 'ข้อมูลอัปเดตเรียลไทม์เพื่อบริหารจัดการผู้ป่วย ณ จุดบริการฉุกเฉิน โรงพยาบาลเถิน',
}

export default async function ERInStatusPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <ERInStatusClient />
}
