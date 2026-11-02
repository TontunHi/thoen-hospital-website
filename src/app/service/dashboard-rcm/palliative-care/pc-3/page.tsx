import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeCareClient from './PalliativeCareClient'

export const metadata = {
  title: 'Palliative Care ตามกลุ่มโรค (PC.3) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายชื่อผู้ป่วย Palliative Care ตามกลุ่มโรคที่กรมการแพทย์กำหนด (PC.3) โรงพยาบาลเถิน',
}

export default async function PalliativeCarePc3Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <PalliativeCareClient />
}
