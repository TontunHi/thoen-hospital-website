import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import WardStatusClient from './WardStatusClient'

export const metadata = {
  title: 'สถานะผู้ป่วยนอนรักษาพยาบาล (IPD Status) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามสถานะเตียงและผู้ป่วยนอนรักษาพยาบาลในแต่ละหอผู้ป่วยแบบเรียลไทม์ โรงพยาบาลเถิน',
}

export default async function WardStatusPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <WardStatusClient />
}
