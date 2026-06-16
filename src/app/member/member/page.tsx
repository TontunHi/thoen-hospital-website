import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import MembersAdminClient from './MembersAdminClient'

export const metadata = {
  title: 'แดชบอร์ดจัดการสมาชิก | โรงพยาบาลเถิน',
  description: 'ระบบจัดการสมาชิก สิทธิ์การใช้งาน และข้อมูลบัญชีเงินเดือนบุคลากร โรงพยาบาลเถิน',
}

export default async function MembersAdminPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    redirect('/unauthorized')
  }

  return <MembersAdminClient />
}
