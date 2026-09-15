import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import StatusDrugClient from './StatusDrugClient'

export const metadata = {
  title: 'สถานะการรอรับยา งานเภสัชกรรม (OPD Drug Status) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามสถานะการรอรับยาของผู้ป่วยนอก งานเภสัชกรรม โรงพยาบาลเถิน',
}

export default async function StatusDrugPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <StatusDrugClient />
}
