import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardRcmNavTabs from './DashboardRcmNavTabs'
import './layout.css'

export const metadata = {
  title: 'Dashboard-RCM | โรงพยาบาลเถิน',
  description: 'ระบบนำเสนอและกำกับติดตามรายได้โรงพยาบาล สิทธิเบิกชดเชย e-Claim และลูกหนี้คงค้าง โรงพยาบาลเถิน',
}

export default async function DashboardRcmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role === 'subdistrict') {
    redirect('/service')
  }

  return (
    <div className="rcm-page-container">
      <header className="rcm-header">
        <div className="rcm-header-top">
          <div className="rcm-title-area">
            <Link href="/service" className="rcm-back-btn" title="กลับหน้าบริการหลัก">
              ← กลับ
            </Link>
            <div>
              <h1 className="rcm-main-title">Dashboard-RCM</h1>
              <p className="rcm-subtitle">Hospital Revenue Cycle Management • โรงพยาบาลเถิน</p>
            </div>
          </div>
        </div>
        <DashboardRcmNavTabs />
      </header>
      <main className="rcm-main-content">
        {children}
      </main>
    </div>
  )
}
