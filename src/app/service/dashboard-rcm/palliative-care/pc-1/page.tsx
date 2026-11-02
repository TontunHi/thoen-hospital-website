import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeCarePc1Client from './PalliativeCarePc1Client'

export const metadata = {
  title: 'Palliative Care End Of Life (PC.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'บริการ Palliative Care End Of Life (PC.1) โรงพยาบาลเถิน',
}

export default async function PalliativeCarePc1Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <PalliativeCarePc1Client />
}
