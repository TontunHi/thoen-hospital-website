import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PRRequestsDashboard from './PRRequestsClient'

export const metadata = {
  title: 'ระบบร้องขอผลิตสื่อประชาสัมพันธ์ | โรงพยาบาลเถิน',
  description: 'ส่งคำขอผลิตสื่อประเภทต่างๆ และติดตามขั้นตอนการเซ็นอนุมัติเอกสารออนไลน์ โรงพยาบาลเถิน',
}

export default async function PRRequestsPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <PRRequestsDashboard />
}
