import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeRegistryClient from './PalliativeRegistryClient'

export const metadata = {
  title: 'ทะเบียน Palliative Care | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'ระบบบันทึกและติดตามทะเบียนผู้ป่วย Palliative Care โรงพยาบาลเถิน',
}

export default async function PalliativeRegistryPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <PalliativeRegistryClient userRole={session.role} username={session.username} />
}
