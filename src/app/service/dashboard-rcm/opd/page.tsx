import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import OpdClient from './OpdClient'

export const metadata = {
  title: 'สรุปผู้ป่วยนอก OPD (2.1.1.3) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปการให้บริการผู้ป่วยนอกโรงพยาบาลเถิน (OPD) จำแนกตามแผนกการรักษา',
}

export default async function OpdPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <OpdClient />
}
