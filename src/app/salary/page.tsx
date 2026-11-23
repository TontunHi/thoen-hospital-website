import { verifyMemberSession } from '@/lib/memberAuth'
import { SalaryPortalService } from '@/lib/salary/salaryPortalService'
import { redirect } from 'next/navigation'
import SalaryDashboardPage from './SalaryDashboardClient'

export const metadata = {
  title: 'ระบบสลิปเงินเดือนออนไลน์ | โรงพยาบาลเถิน',
  description: 'ระบบตรวจสอบข้อมูลสลิปเงินเดือน ค่าล่วงเวลา (OT) และสวัสดิการบุคลากร โรงพยาบาลเถิน',
}

export default async function SalaryPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role === 'subdistrict') {
    redirect('/member')
  }

  const isEnabled = await SalaryPortalService.isSalaryFeatureEnabled(session.role)
  if (!isEnabled) {
    redirect('/unauthorized')
  }

  return <SalaryDashboardPage />
}
