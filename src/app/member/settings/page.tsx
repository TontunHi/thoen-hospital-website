import { getAuthenticatedMember } from '@/lib/memberAuth'
import Link from 'next/link'
import SettingsClient from './SettingsClient'
import './settings.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ตั้งค่าและควบคุมระบบสารสนเทศ | โรงพยาบาลเถิน',
  description: 'กำหนดสิทธิ์การเข้าถึงระบบตามภารกิจงานและตำแหน่งหน้าที่ ตรวจสอบสิทธิ์รายบุคคล และควบคุมการเปิด/ปิดโมดูลบริการ',
}

export default async function AdminSettingsPage() {
  const member = await getAuthenticatedMember({
    requiredRole: 'admin',
    redirectTo: '/unauthorized',
  })

  return (
    <div className="set-page">
      <div className="set-container">
        {/* 1. แถวบนสุด */}
        <div className="set-top-bar">
          <Link href="/member" className="set-back-link">
            ← กลับสู่แดชบอร์ด
          </Link>
        </div>

        {/* 2. หัวหน้า */}
        <header className="set-header">
          <h1 className="set-title">ตั้งค่าและควบคุมระบบสารสนเทศ</h1>
          <p className="set-subtitle">
            กำหนดสิทธิ์การเข้าถึงระบบตามภารกิจงานและตำแหน่งหน้าที่ ตรวจสอบสิทธิ์รายบุคคล และควบคุมการเปิด/ปิดโมดูลบริการ
          </p>
        </header>

        <SettingsClient initialSettings={member.settings} />
      </div>
    </div>
  )
}
