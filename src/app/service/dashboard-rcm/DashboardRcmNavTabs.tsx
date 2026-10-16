'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Stethoscope, Users, BedDouble, Activity, ReceiptText } from 'lucide-react'

interface NavTab {
  href: string
  label: string
  badge: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const TABS: NavTab[] = [
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
  {
    href: '/service/dashboard-rcm/ipd',
    label: 'สรุปผู้ป่วยใน (IPD)',
    badge: '2.1.2.1',
    icon: BedDouble,
  },
  {
    href: '/service/dashboard-rcm/invoice-summary',
    label: 'สรุปรายรับจาก Invoice',
    badge: '5.2.2.1',
    icon: ReceiptText,
  },
]

export default function DashboardRcmNavTabs() {
  const pathname = usePathname()

  return (
    <nav className="rcm-tab-nav" aria-label="Dashboard RCM Tabs">
      <div className="rcm-tab-list">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rcm-tab-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} className="rcm-tab-icon" />
              <span className="rcm-tab-label">{tab.label}</span>
              <span className="rcm-tab-badge">{tab.badge}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
