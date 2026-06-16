import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
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

  if (session.role !== 'admin') {
    const settingsRows = await queryMemberDb("SELECT config_value FROM member_system_settings WHERE config_key = 'feature_salary'")
    const isEnabled = settingsRows.length === 0 || settingsRows[0].config_value !== '0'
    if (!isEnabled) {
      redirect('/unauthorized')
    }
  }

  return <SalaryDashboardPage />
}
