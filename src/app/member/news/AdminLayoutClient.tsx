'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Newspaper, 
  Image as ImageIcon, 
  ArrowLeft,
  Globe,
  Plus
} from 'lucide-react'
import './layout.css'

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navTabs = [
    { href: '/member/news', label: 'ภาพรวมแดชบอร์ด', icon: LayoutDashboard },
    { href: '/member/news/news', label: 'ข่าวสารและกิจกรรม', icon: Newspaper },
    { href: '/member/news/slides', label: 'ป้ายสไลด์ประชาสัมพันธ์', icon: ImageIcon },
  ]

  return (
    <div className="newsPortalPage">
      <div className="container">
        {/* Executive Hospital CMS Header */}
        <header className="pageHeader">
          <div className="pageHeaderTop">
            <Link href="/member" className="backLinkBtn">
              <ArrowLeft size={16} />
              <span>กลับสู่แดชบอร์ดสมาชิก</span>
            </Link>

            <div className="headerActions">
              <Link 
                href="/news" 
                target="_blank" 
                className="viewPublicBtn"
                title="เปิดดูหน้าเว็บประชาสัมพันธ์ของประชาชน"
              >
                <Globe size={15} />
                <span>ดูหน้าเว็บข่าวจริง</span>
              </Link>
              <Link 
                href="/member/news/news/create" 
                className="addNewsBtn"
              >
                <Plus size={16} />
                <span>เขียนข่าวใหม่</span>
              </Link>
            </div>
          </div>

          <div className="headerText">
            <div className="titleWithBadge">
              <h1>ระบบจัดการข่าวสารและสื่อประชาสัมพันธ์</h1>
              <span className="cmsBadge">โรงพยาบาลเถิน CMS</span>
            </div>
            <p>
              จัดการเนื้อหาข่าวสาร กิจกรรม ประกาศจัดซื้อจัดจ้าง และภาพสไลด์แบนเนอร์หน้าแรกของโรงพยาบาลเถิน
            </p>
          </div>

          {/* Subnav Navigation Tabs */}
          <nav className="newsSubnav" role="tablist" aria-label="หมวดหมู่การจัดการข่าวสาร">
            {navTabs.map((tab) => {
              const isActive =
                tab.href === '/member/news'
                  ? pathname === '/member/news'
                  : pathname.startsWith(tab.href)
              const Icon = tab.icon

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  role="tab"
                  aria-selected={isActive}
                  className={`newsSubnavTab ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} className="tabIcon" />
                  <span>{tab.label}</span>
                </Link>
              )
            })}
          </nav>
        </header>

        {/* Content Area */}
        <main className="newsContentContainer">
          {children}
        </main>
      </div>
    </div>
  )
}
