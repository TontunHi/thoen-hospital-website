'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import './layout.css'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Login page gets no sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const navItems = [
    { href: '/admin', label: 'แดชบอร์ด', icon: '📊' },
    { href: '/admin/slideshow', label: 'จัดการสไลด์โชว์', icon: '🖼️' },
    { href: '/admin/banner', label: 'จัดการแบนเนอร์', icon: '🎏' },
    { href: '/admin/news', label: 'ข่าวสาร', icon: '📰' },
    { href: '/admin/contacts', label: 'ข้อความติดต่อ', icon: '✉️' },
  ]

  return (
    <div className="adminLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <h2>🏥 รพ.เถิน</h2>
          <p>ระบบจัดการเว็บไซต์</p>
        </div>

        <nav className="sidebarNav">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navLink ${isActive ? 'navLinkActive' : ''}`}
              >
                <span className="navIcon">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}

          <div className="navDivider" />

          <Link href="/" className="navLink">
            <span className="navIcon">🌐</span>
            กลับหน้าเว็บ
          </Link>
        </nav>

        <div className="sidebarFooter">
          <button onClick={handleLogout} className="logoutButton">
            <span className="navIcon">🚪</span>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="mainContent">
        {children}
      </main>
    </div>
  )
}
