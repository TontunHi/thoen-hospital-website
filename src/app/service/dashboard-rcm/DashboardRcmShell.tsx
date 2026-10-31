'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Stethoscope,
  Users,
  BedDouble,
  Activity,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ArrowLeft,
  TrendingUp,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  badge: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

export interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

export const RCM_NAV_GROUPS: NavGroup[] = [
  {
    id: 'opd-dental',
    title: '2.1 ผู้ป่วยนอก & ทันตกรรม',
    items: [
      {
        href: '/service/dashboard-rcm/sss-dental',
        label: 'ประกันสังคมทำฟัน',
        badge: '2.1.1.1',
        icon: Stethoscope,
      },
      {
        href: '/service/dashboard-rcm/opd-doctor',
        label: 'OPD ตามสิทธิ์',
        badge: '2.1.1.2',
        icon: Users,
      },
      {
        href: '/service/dashboard-rcm/opd',
        label: 'สรุปผู้ป่วยนอก (OPD)',
        badge: '2.1.1.3',
        icon: Activity,
      },
    ],
  },
  {
    id: 'ipd',
    title: '2.2 บริการผู้ป่วยใน',
    items: [
      {
        href: '/service/dashboard-rcm/ipd',
        label: 'สรุปผู้ป่วยใน (IPD)',
        badge: '2.1.2.1',
        icon: BedDouble,
      },
    ],
  },
  {
    id: 'finance',
    title: '5.2 การเงิน & รายรับ',
    items: [
      {
        href: '/service/dashboard-rcm/invoice-summary',
        label: 'สรุปรายรับจาก Invoice',
        badge: '5.2.2.1',
        icon: ReceiptText,
      },
    ],
  },
]

interface DashboardRcmShellProps {
  children: React.ReactNode
  userRole?: string
}

export default function DashboardRcmShell({
  children,
  userRole,
}: DashboardRcmShellProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('rcm_sidebar_collapsed')
      if (saved !== null) {
        setIsCollapsed(saved === 'true')
      }
    } catch {
      // Ignore localStorage read errors in private browsing
    }
  }, [])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('rcm_sidebar_collapsed', String(next))
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }

  // Find active item & group for breadcrumbs
  const activeItem = RCM_NAV_GROUPS.flatMap((g) => g.items).find(
    (item) => pathname === item.href || pathname?.startsWith(item.href + '/')
  )
  const activeGroup = RCM_NAV_GROUPS.find((g) =>
    g.items.some((item) => pathname === item.href || pathname?.startsWith(item.href + '/'))
  )

  return (
    <div className={`rcm-layout-shell ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="rcm-sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`rcm-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="Dashboard RCM Navigation"
      >
        {/* Sidebar Header */}
        <div className="rcm-sidebar-header">
          <div className="rcm-sidebar-brand">
            <div className="rcm-brand-icon">
              <TrendingUp size={20} />
            </div>
            {!isCollapsed && (
              <div className="rcm-brand-text">
                <span className="rcm-brand-title">Dashboard-RCM</span>
                <span className="rcm-brand-sub">โรงพยาบาลเถิน</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="rcm-collapse-toggle desktop-only"
            onClick={toggleCollapse}
            title={isCollapsed ? 'ขยายเมนูด้านข้าง' : 'ย่อเมนูด้านข้าง'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            className="rcm-mobile-close mobile-only"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Categories */}
        <nav className="rcm-sidebar-nav">
          {RCM_NAV_GROUPS.map((group) => (
            <div key={group.id} className="rcm-nav-group">
              {!isCollapsed && (
                <div className="rcm-nav-group-title">
                  <span>{group.title}</span>
                </div>
              )}
              {isCollapsed && <div className="rcm-nav-divider" />}
              <ul className="rcm-nav-list">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <li key={item.href} className="rcm-nav-list-item">
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`rcm-nav-link ${isActive ? 'active' : ''}`}
                        title={isCollapsed ? `${item.badge} ${item.label}` : undefined}
                      >
                        <div className="rcm-nav-icon-wrapper">
                          <Icon size={18} />
                        </div>
                        {!isCollapsed && (
                          <div className="rcm-nav-label-wrapper">
                            <span className="rcm-nav-label">{item.label}</span>
                            <span className="rcm-nav-badge">{item.badge}</span>
                          </div>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="rcm-sidebar-footer">
          <Link
            href="/service"
            className="rcm-sidebar-back-link"
            title="กลับสู่หน้าบริการหลัก"
          >
            <ArrowLeft size={16} />
            {!isCollapsed && <span>กลับหน้าบริการ</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="rcm-main-wrapper">
        {/* Top Control Bar */}
        <header className="rcm-topbar">
          <div className="rcm-topbar-left">
            <button
              type="button"
              className="rcm-hamburger-btn mobile-only"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <nav className="rcm-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/service" className="rcm-crumb-link">
                บริการ
              </Link>
              <span className="rcm-crumb-sep">/</span>
              <span className="rcm-crumb-current">Dashboard-RCM</span>
              {activeGroup && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className="rcm-crumb-subtle">{activeGroup.title}</span>
                </>
              )}
              {activeItem && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className="rcm-crumb-active">{activeItem.label}</span>
                </>
              )}
            </nav>
          </div>

          <div className="rcm-topbar-right">
            <span className="rcm-env-badge">
              <span className="rcm-live-dot" />
              เชื่อมต่อ HOSxP สด
            </span>
            <Link
              href="/service"
              className="rcm-topbar-return-btn desktop-only"
              title="กลับหน้าบริการหลัก"
            >
              ← หน้าบริการ
            </Link>
          </div>
        </header>

        {/* Page Main Content */}
        <div className="rcm-main-body rcm-main-content">{children}</div>
      </div>
    </div>
  )
}
