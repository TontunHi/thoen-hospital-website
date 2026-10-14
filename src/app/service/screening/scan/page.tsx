import { getAuthenticatedMember } from '@/lib/memberAuth'
import ScreeningScanClient from './ScreeningScanClient'

export const metadata = {
  title: 'จุดอ่านบัตรประชาชนตรวจนอกพื้นที่ - โรงพยาบาลเถิน',
  description: 'ระบบอ่านบัตรประชาชน Smart Card สำหรับหน่วยคัดกรองตรวจสุขภาพนอกสถานที่ โรงพยาบาลเถิน',
}

export default async function ScreeningScanPage() {
  const member = await getAuthenticatedMember()

  return (
    <ScreeningScanClient
      operator={{
        id: member.id,
        name: member.name || member.username,
        username: member.username,
        role: member.role,
        department: member.department,
      }}
    />
  )
}
