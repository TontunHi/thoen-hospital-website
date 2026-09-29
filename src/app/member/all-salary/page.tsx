import { getAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AllSalaryClient from './AllSalaryClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบสลิปเงินเดือนบุคลากรทั้งหมด | โรงพยาบาลเถิน',
  description: 'ระบบตรวจสอบข้อมูลสลิปเงินเดือนและค่าล่วงเวลาของบุคลากรโรงพยาบาลเถิน สำหรับเจ้าพนักงานธุรการ',
}

export default async function AllSalaryPage() {
  const member = await getAuthenticatedMember({
    requiredPermission: 'view_all_salary',
    redirectTo: '/unauthorized',
  })

  if (member.role === 'subdistrict') {
    redirect('/member')
  }

  return <AllSalaryClient />
}
