import { getAuthenticatedMember } from '@/lib/memberAuth'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import SettingsClient from './SettingsClient'
import './settings.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ตั้งค่าและควบคุมระบบ | โรงพยาบาลเถิน',
  description: 'ระบบตั้งค่าโมดูลบริการและกำหนดสิทธิ์ตามตำแหน่งงานบุคลากร โรงพยาบาลเถิน',
}

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
        {/* Top Header */}
        <header className="adminSettingsHeader">
          <div className="adminSettingsHeaderTop">
            <Link href="/member" className="backLinkBtn">
              <ArrowLeft size={16} />
              <span>กลับสู่แดชบอร์ด</span>
            </Link>

            <div className="adminSecurityBadge">
              <Shield size={14} className="shieldIcon" />
              <span>สิทธิ์ผู้ดูแลระบบ (Admin Only)</span>
            </div>
          </div>

          <div className="adminSettingsHeaderMain">
            <h1>ตั้งค่าและควบคุมระบบสารสนเทศ</h1>
            <p>
              ควบคุมการเปิด/ปิดโมดูลระบบบริการสำหรับบุคลากร และกำหนดสิทธิ์การเข้าถึงเชิงลึกตามตำแหน่งงานของโรงพยาบาลเถิน
            </p>
          </div>
        </header>

        <SettingsClient initialSettings={member.settings} />
      </div>
    </div>
  )
}
