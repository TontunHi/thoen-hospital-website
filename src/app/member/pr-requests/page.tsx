import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import PRRequestsDashboard from './PRRequestsClient'

export const metadata = {
  title: 'ระบบร้องขอผลิตสื่อประชาสัมพันธ์ | โรงพยาบาลเถิน',
  description: 'ส่งคำขอผลิตสื่อประเภทต่างๆ และติดตามขั้นตอนการเซ็นอนุมัติเอกสารออนไลน์ โรงพยาบาลเถิน',
}

export default async function PRRequestsPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    const settingsRows = await queryMemberDb("SELECT config_value FROM member_system_settings WHERE config_key = 'feature_pr_requests'")
    const isEnabled = settingsRows.length === 0 || settingsRows[0].config_value !== '0'
    if (!isEnabled) {
      redirect('/unauthorized')
    }
  }

  return <PRRequestsDashboard />
}
