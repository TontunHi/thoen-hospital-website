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
  ChevronDown,
  Menu,
  X,
  ArrowLeft,
  TrendingUp,
  HeartHandshake,
  HeartPulse,
  ShieldCheck,
  Baby,
  Droplet,
  TestTube2,
  Heart,
} from 'lucide-react'

export interface NavSubItem {
  href: string
  label: string
  badge: string
}

export interface NavItem {
  href: string
  label: string
  badge: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  children?: NavSubItem[]
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
    id: 'rep-funds',
    title: '3.1 ข้อมูลการชดเชยค่าบริการ (REP)',
    items: [
      {
        href: '/service/dashboard-rcm/rep-funds',
        label: 'ข้อมูล Rep แต่ละกองทุน',
        badge: '3.1.1',
        icon: ReceiptText,
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
  {
    id: 'palliative-care',
    title: 'Palliative Care',
    items: [
      {
        href: '/service/dashboard-rcm/palliative-care/pc-1',
        label: 'End Of Life',
        badge: 'PC.1',
        icon: HeartHandshake,
      },
      {
        href: '/service/dashboard-rcm/palliative-care/pc-3',
        label: 'ตามกลุ่มโรค',
        badge: 'PC.3',
        icon: HeartHandshake,
      },
      {
        href: '/service/dashboard-rcm/palliative-care/registry',
        label: 'ทะเบียน Palliative Care',
        badge: 'ทะเบียน',
        icon: HeartPulse,
      },
    ],
  },
  {
    id: 'funds',
    title: 'กองทุน',
    items: [
      {
        href: '/service/dashboard-rcm/funds/ccs',
        label: 'คัดกรองมะเร็งปากมดลูก (CCS)',
        badge: 'CCS',
        icon: ShieldCheck,
        children: [
          {
            href: '/service/dashboard-rcm/funds/ccs/2',
            label: 'รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก',
            badge: '1.2',
          },
          {
            href: '/service/dashboard-rcm/funds/ccs/10',
            label: 'บริการ 1B005',
            badge: '1.10',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/anc',
        label: 'บริการฝากครรภ์ (ANC)',
        badge: 'ANC',
        icon: Baby,
        children: [
          {
            href: '/service/dashboard-rcm/funds/anc/3',
            label: 'US - ตรวจช่องปาก - ขัดฟัน',
            badge: '2.3',
          },
          {
            href: '/service/dashboard-rcm/funds/anc/4',
            label: 'บริการ 30011',
            badge: '2.4',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/thalassemia',
        label: 'ธาลัสซีเมียในหญิงตั้งครรภ์',
        badge: 'THAL',
        icon: Droplet,
        children: [
          {
            href: '/service/dashboard-rcm/funds/thalassemia/1',
            label: 'คัดกรองธาลัสซีเมีย',
            badge: '3.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/postpartum',
        label: 'การตรวจหลังคลอด',
        badge: 'PNC',
        icon: HeartPulse,
        children: [
          {
            href: '/service/dashboard-rcm/funds/postpartum/2',
            label: 'การตรวจหลังคลอด ADP',
            badge: '7.2',
          },
          {
            href: '/service/dashboard-rcm/funds/postpartum/3',
            label: 'การจ่ายยา Triforine ADP',
            badge: '7.3',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/pregnancy-test',
        label: 'การทดสอบการตั้งครรภ์',
        badge: '8.1',
        icon: TestTube2,
        children: [
          {
            href: '/service/dashboard-rcm/funds/pregnancy-test/1',
            label: 'การทดสอบการตั้งครรภ์',
            badge: '8.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/family-planning',
        label: 'วางแผนครอบครัว & คุมกำเนิด (FP)',
        badge: 'FP',
        icon: Heart,
        children: [
          {
            href: '/service/dashboard-rcm/funds/family-planning/1',
            label: 'วางแผนครอบครัวและการป้องกันการตั้งครรภ์',
            badge: '9.1',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/2',
            label: 'บริการใส่ห่วงอนามัย',
            badge: '9.2',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-3-1',
            label: 'รายการฝังยาคุม',
            badge: '9.3.1',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-3-2',
            label: 'รายการถอดยาคุม',
            badge: '9.3.2',
          },
        ],
      },
    ],
  },
]

function isPathMatch(pathname: string | null, targetHref: string): boolean {
  if (!pathname) return false
  return pathname === targetHref || pathname.startsWith(targetHref + '/')
}

interface DashboardRcmShellProps {
  children: React.ReactNode
  userRole?: string
}

export default function DashboardRcmShell({
  children,
}: DashboardRcmShellProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const group of RCM_NAV_GROUPS) {
      initial[group.id] = true
    }
    return initial
  })
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const group of RCM_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children && item.children.length > 0) {
          initial[item.href] =
            isPathMatch(pathname, item.href) ||
            item.children.some((c) => isPathMatch(pathname, c.href)) ||
            true
        }
      }
    }
    return initial
  })

  // Hydrate collapsed & expanded group/submenu states from localStorage
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem('rcm_sidebar_collapsed')
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === 'true')
      }

      const savedGroups = localStorage.getItem('rcm_sidebar_expanded_groups')
      if (savedGroups) {
        const parsed = JSON.parse(savedGroups) as Record<string, boolean>
        if (parsed && typeof parsed === 'object') {
          setExpandedGroups((prev) => {
            const next = { ...prev, ...parsed }
            for (const group of RCM_NAV_GROUPS) {
              const hasActiveChild = group.items.some(
                (item) =>
                  isPathMatch(pathname, item.href) ||
                  Boolean(item.children?.some((c) => isPathMatch(pathname, c.href)))
              )
              if (hasActiveChild) {
                next[group.id] = true
              }
            }
            return next
          })
        }
      }

      const savedMenus = localStorage.getItem('rcm_sidebar_expanded_menus')
      if (savedMenus) {
        const parsedMenus = JSON.parse(savedMenus) as Record<string, boolean>
        if (parsedMenus && typeof parsedMenus === 'object') {
          setExpandedMenus((prev) => {
            const next = { ...prev, ...parsedMenus }
            for (const group of RCM_NAV_GROUPS) {
              for (const item of group.items) {
                if (
                  item.children &&
                  (isPathMatch(pathname, item.href) ||
                    item.children.some((c) => isPathMatch(pathname, c.href)))
                ) {
                  next[item.href] = true
                }
              }
            }
            return next
          })
        }
      }
    } catch {
      // Ignore localStorage read errors in private browsing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-expand active main group and submenu if user navigates into one of its routes
  useEffect(() => {
    for (const group of RCM_NAV_GROUPS) {
      const groupHasActive = group.items.some(
        (item) =>
          isPathMatch(pathname, item.href) ||
          Boolean(item.children?.some((c) => isPathMatch(pathname, c.href)))
      )
      if (groupHasActive) {
        setExpandedGroups((prev) => (prev[group.id] ? prev : { ...prev, [group.id]: true }))
      }

      for (const item of group.items) {
        if (
          item.children &&
          (isPathMatch(pathname, item.href) || item.children.some((c) => isPathMatch(pathname, c.href)))
        ) {
          setExpandedMenus((prev) => (prev[item.href] ? prev : { ...prev, [item.href]: true }))
        }
      }
    }
  }, [pathname])

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

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = {
        ...prev,
        [groupId]: !(prev[groupId] ?? true),
      }
      try {
        localStorage.setItem('rcm_sidebar_expanded_groups', JSON.stringify(next))
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }

  const toggleSubmenu = (href: string) => {
    setExpandedMenus((prev) => {
      const next = {
        ...prev,
        [href]: !prev[href],
      }
      try {
        localStorage.setItem('rcm_sidebar_expanded_menus', JSON.stringify(next))
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }

  // Find active group, item, and sub-item for breadcrumbs
  const activeGroup = RCM_NAV_GROUPS.find((g) =>
    g.items.some(
      (item) =>
        isPathMatch(pathname, item.href) ||
        (item.children && item.children.some((c) => isPathMatch(pathname, c.href)))
    )
  )
  const activeItem = activeGroup?.items.find(
    (item) =>
      isPathMatch(pathname, item.href) ||
      (item.children && item.children.some((c) => isPathMatch(pathname, c.href)))
  )
  const activeSubItem = activeItem?.children?.find((c) => isPathMatch(pathname, c.href))

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
          {RCM_NAV_GROUPS.map((group) => {
            const isGroupExpanded = expandedGroups[group.id] ?? true
            const isGroupActive = group.items.some(
              (item) =>
                isPathMatch(pathname, item.href) ||
                Boolean(item.children?.some((c) => isPathMatch(pathname, c.href)))
            )

            return (
              <div
                key={group.id}
                className={`rcm-nav-group ${
                  !isCollapsed && !isGroupExpanded ? 'is-group-collapsed' : ''
                }`}
              >
                {!isCollapsed && (
                  <button
                    type="button"
                    className={`rcm-nav-group-toggle ${
                      isGroupActive && !isGroupExpanded ? 'has-active' : ''
                    }`}
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isGroupExpanded}
                    aria-controls={`rcm-group-${group.id}`}
                  >
                    <span className="rcm-nav-group-title-text">{group.title}</span>
                    <span className="rcm-nav-group-chevron" aria-hidden="true">
                      {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                )}
                {isCollapsed && <div className="rcm-nav-divider" />}
                {(isCollapsed || isGroupExpanded) && (
                  <ul id={`rcm-group-${group.id}`} className="rcm-nav-list">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const hasChildren = Boolean(item.children && item.children.length > 0)
                      const isBranchActive =
                        isPathMatch(pathname, item.href) ||
                        Boolean(item.children?.some((c) => isPathMatch(pathname, c.href)))
                      const isExpanded = Boolean(expandedMenus[item.href])

                      if (hasChildren && item.children) {
                        const firstChildHref = item.children[0].href

                        if (isCollapsed) {
                          return (
                            <li key={item.href} className="rcm-nav-list-item">
                              <Link
                                href={firstChildHref}
                                onClick={() => setIsMobileOpen(false)}
                                className={`rcm-nav-link ${isBranchActive ? 'active' : ''}`}
                                title={`${item.label} — ${item.children[0].badge} ${item.children[0].label}`}
                              >
                                <div className="rcm-nav-icon-wrapper">
                                  <Icon size={18} />
                                </div>
                              </Link>
                            </li>
                          )
                        }

                        return (
                          <li key={item.href} className="rcm-nav-list-item">
                            <button
                              type="button"
                              onClick={() => toggleSubmenu(item.href)}
                              aria-expanded={isExpanded}
                              className={`rcm-nav-link rcm-nav-parent-btn ${
                                isBranchActive ? 'branch-active' : ''
                              }`}
                            >
                              <div className="rcm-nav-icon-wrapper">
                                <Icon size={18} />
                              </div>
                              <div className="rcm-nav-label-wrapper">
                                <span className="rcm-nav-label">{item.label}</span>
                                <span className="rcm-nav-chevron">
                                  {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                </span>
                              </div>
                            </button>
                            {isExpanded && (
                              <ul className="rcm-nav-sublist">
                                {item.children.map((sub) => {
                                  const isSubActive = isPathMatch(pathname, sub.href)
                                  return (
                                    <li key={sub.href}>
                                      <Link
                                        href={sub.href}
                                        onClick={() => setIsMobileOpen(false)}
                                        className={`rcm-nav-sublink ${isSubActive ? 'active' : ''}`}
                                      >
                                        <span className="rcm-nav-subbadge">{sub.badge}</span>
                                        <span className="rcm-nav-sublabel">{sub.label}</span>
                                      </Link>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      }

                      return (
                        <li key={item.href} className="rcm-nav-list-item">
                          <Link
                            href={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={`rcm-nav-link ${isBranchActive ? 'active' : ''}`}
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
                )}
              </div>
            )
          })}
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
                  <span className={activeSubItem ? 'rcm-crumb-subtle' : 'rcm-crumb-active'}>
                    {activeItem.label}
                  </span>
                </>
              )}
              {activeSubItem && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className="rcm-crumb-active">
                    {activeSubItem.badge} {activeSubItem.label}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="rcm-topbar-right">
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
