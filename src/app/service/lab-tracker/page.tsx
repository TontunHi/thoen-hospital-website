import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import LabTrackerClient from './LabTrackerClient'

export const metadata = {
  title: 'ระบบติดตามผลแลป รพ.สต. | โรงพยาบาลเถิน',
  description: 'ระบบติดตามรายงานผลแลปและประวัติการสั่งตรวจประจำวัน เครือข่าย รพ.สต. โรงพยาบาลเถิน',
}

export default async function LabTrackerPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <LabTrackerClient />
}
