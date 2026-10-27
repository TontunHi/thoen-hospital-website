import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import TbCxrTrackerClient from './TbCxrTrackerClient'

export const metadata = {
  title: 'ระบบติดตามการทำ CXR ในกลุ่มผู้ป่วย TB | โรงพยาบาลเถิน',
  description: 'ระบบติดตามและตรวจสอบการถ่ายภาพรังสีทรวงอก (CXR) ในกลุ่มผู้ป่วยและกลุ่มเสี่ยงวัณโรค โรงพยาบาลเถิน',
}

export default async function TbCxrTrackerPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <TbCxrTrackerClient userRole={session.role} />
}
