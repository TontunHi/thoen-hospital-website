'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutDashboard, Newspaper, Mail, ArrowLeft, LogOut, Image as ImageIcon } from 'lucide-react'
import './layout.css'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Login page gets no sidebar
  if (pathname === '/news-login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    if (!confirm('ยืนยันว่าต้องการออกจากระบบใช่หรือไม่?')) return
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/news-login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const navItems = [
    { href: '/admin-news', label: 'แดชบอร์ด', icon: LayoutDashboard },
    { href: '/admin-news/news', label: 'ข่าวสาร', icon: Newspaper },
    { href: '/admin-news/slides', label: 'สไลด์โชว์', icon: ImageIcon },
  ]

  return (
    <div className="adminLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarLogoContainer">
            <Image
              src="/images/logo-website.webp"
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
              item.href === '/admin-news'
                ? pathname === '/admin-news'
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


        </nav>

        <div className="sidebarFooter">
          <button onClick={handleLogout} className="logoutButton">
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
    </div>
  )
}
