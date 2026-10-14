import { getAuthenticatedMember } from '@/lib/memberAuth'
import ScreeningDashboardClient from './ScreeningDashboardClient'

export const metadata = {
  title: 'ระบบคัดกรองตรวจนอกพื้นที่ - โรงพยาบาลเถิน',
  description: 'ระบบติดตามคิวผู้รับบริการจากเครื่องอ่านบัตรประชาชน Smart Card สำหรับหน่วยคัดกรองตรวจสุขภาพนอกสถานที่ โรงพยาบาลเถิน',
}

export default async function ScreeningDashboardPage() {
  const member = await getAuthenticatedMember()

  return (
    <ScreeningDashboardClient
      user={{
        id: member.id,
        name: member.name || member.username,
        username: member.username,
        role: member.role,
        department: member.department,
      }}
    />
  )
}
