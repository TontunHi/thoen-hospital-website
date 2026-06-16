import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import './settings.css'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    redirect('/unauthorized')
  }

  const settingsRows = await queryMemberDb('SELECT config_key, config_value FROM member_system_settings')
  const settings: Record<string, string> = {}
  settingsRows.forEach((row) => {
    settings[row.config_key] = row.config_value
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

        <SettingsClient initialSettings={settings} />
      </div>
    </div>
  )
}
