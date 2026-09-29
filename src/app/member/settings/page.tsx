import { getAuthenticatedMember } from '@/lib/memberAuth'
import SettingsClient from './SettingsClient'
import './settings.css'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const member = await getAuthenticatedMember({
    requiredRole: 'admin',
    redirectTo: '/unauthorized',
  })

  return (
    <div className="adminSettingsContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="adminSettingsWrapper">
        <div className="adminSettingsHeader">
          <h1>ตั้งค่าและควบคุมระบบ (สำหรับ Admin)</h1>
          <p>เปิด/ปิด การเข้าใช้ฟังก์ชันต่าง ๆ ภายในเว็บไซต์สำหรับสมาชิกทั่วไป</p>
        </div>

        <SettingsClient initialSettings={member.settings} />
      </div>
    </div>
  )
}
