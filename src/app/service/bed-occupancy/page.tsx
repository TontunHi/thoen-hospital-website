import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import BedOccupancyClient from './BedOccupancyClient'

export const metadata = {
  title: 'อัตราการครองเตียง | โรงพยาบาลเถิน',
  description: 'ระบบแสดงอัตราการครองเตียงผู้ป่วยในแยกตามหอผู้ป่วยแบบเรียลไทม์ โรงพยาบาลเถิน',
}

export default async function BedOccupancyPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role === 'subdistrict') {
    redirect('/service')
  }

  return <BedOccupancyClient />
}
