'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutDashboard, Newspaper, LogOut, Image as ImageIcon, ArrowLeft } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import './layout.css'

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/member/logout', { method: 'POST' })
      router.push('/member/login')
    } catch (error) {
      console.error('Logout error:', error)
      setIsLoggingOut(false)
      setShowLogoutConfirm(false)
    }
  }

  const navItems = [
    { href: '/member/news', label: 'แดชบอร์ด', icon: LayoutDashboard },
    { href: '/member/news/news', label: 'ข่าวสาร', icon: Newspaper },
    { href: '/member/news/slides', label: 'สไลด์โชว์', icon: ImageIcon },
  ]

  return (
    <div className="adminLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarLogoContainer">
            <Image
              src="/images/common/logo-website.webp"
              alt="โรงพยาบาลเถิน"
              width={64}
              height={64}
              className="sidebarLogo"
              priority
            />
            <div className="sidebarHospitalName">โรงพยาบาลเถิน</div>
          </div>
          <h2>ระบบจัดการเว็บไซต์</h2>
          <p>Thoen Hospital Admin Panel</p>
        </div>

        <nav className="sidebarNav">
          {navItems.map((item) => {
            const isActive =
              item.href === '/member/news'
                ? pathname === '/member/news'
                : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navLink ${isActive ? 'navLinkActive' : ''}`}
              >
                <Icon size={18} className="navIcon" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <div className="navDivider" />

          <Link href="/member" className="navLink navLinkBack">
            <ArrowLeft size={18} className="navIcon" />
            <span>กลับหน้าหลักสมาชิก</span>
          </Link>
        </nav>

        <div className="sidebarFooter">
          <button type="button" onClick={() => setShowLogoutConfirm(true)} className="logoutButton">
            <LogOut size={18} className="navIcon" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <main className="mainContent">
        <div className="mainContentWrapper">
          {children}
        </div>
      </main>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="ยืนยันการออกจากระบบ"
        description="คุณต้องการออกจากระบบจัดการเว็บไซต์ใช่หรือไม่?"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        type="warning"
        loading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}
