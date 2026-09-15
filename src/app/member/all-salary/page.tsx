import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AllSalaryClient from './AllSalaryClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบสลิปเงินเดือนบุคลากรทั้งหมด | โรงพยาบาลเถิน',
  description: 'ระบบตรวจสอบข้อมูลสลิปเงินเดือนและค่าล่วงเวลาของบุคลากรโรงพยาบาลเถิน สำหรับเจ้าพนักงานธุรการ',
}

export default async function AllSalaryPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role === 'subdistrict') {
    redirect('/member')
  }

  const isAuthorized = session.role === 'admin' || (await checkPositionPermission(session.username, 'view_all_salary'))

  if (!isAuthorized) {
    redirect('/unauthorized')
  }

  return <AllSalaryClient />
}
