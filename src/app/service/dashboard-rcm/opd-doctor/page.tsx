import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import OpdDoctorClient from './OpdDoctorClient'

export const metadata = {
  title: 'OPD ตามสิทธิ์ (2.1.1.2) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปค่าบริการผู้ป่วยนอก OPD ตามสิทธิ์การรักษา จำแนกรายแพทย์ โรงพยาบาลเถิน',
}

export default async function OpdDoctorPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  return <OpdDoctorClient />
}
