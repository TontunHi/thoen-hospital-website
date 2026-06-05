import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import LabSearchClient from './LabSearchClient'

export const metadata = {
  title: 'ระบบค้นหาข้อมูลผู้ป่วยและผลแลป | โรงพยาบาลเถิน',
  description: 'ระบบสืบค้นประวัติการรักษาพยาบาล รายการยา และรายงานผลแลป โรงพยาบาลเถิน',
}

export default async function LabServicePage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <LabSearchClient />
}
