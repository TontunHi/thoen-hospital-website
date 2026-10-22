'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  ChevronRight,
  Coins,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import BudgetTrackerSidebar from './BudgetTrackerSidebar'
import { BUDGET_NAV_GROUPS } from './budgetNavConfig'

interface BudgetTrackerShellProps {
  children: React.ReactNode
}

export default function BudgetTrackerShell({ children }: BudgetTrackerShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()

  // Load collapse preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bt_sidebar_collapsed')
      if (saved !== null) {
        setIsCollapsed(saved === 'true')
      }
    } catch {
      // Ignore localStorage read errors in SSR/strict contexts
    }
  }, [])

  // Toggle collapse and save preference
  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('bt_sidebar_collapsed', String(next))
      } catch {
        // Ignore
      }
      return next
    })
  }

  // Find active item info for top bar breadcrumb/title
  const currentItem = React.useMemo(() => {
    for (const group of BUDGET_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.href === '/service/budget-tracker/rh1') {
          if (
            pathname === '/service/budget-tracker/rh1' ||
            pathname === '/service/budget-tracker' ||
            pathname === '/service/budget-tracker/'
          ) {
            return item
          }
        } else if (pathname?.startsWith(item.href)) {
          return item
        }
      }
    }
    return null
  }, [pathname])

  return (
    <div className={`bt-shell ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Sidebar Component */}
      <BudgetTrackerSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="bt-main-viewport">
        {/* Top Header Bar */}
        <header className="bt-viewport-header">
          <div className="bt-viewport-header-left">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="bt-mobile-menu-trigger mobile-only"
              onClick={() => setIsMobileOpen(true)}
              aria-label="เปิดเมนูเลือกรายงานงบประมาณ"
            >
              <Menu size={20} />
            </button>

            {/* Desktop Quick Toggle Icon */}
            <button
              type="button"
              className="bt-desktop-collapse-trigger desktop-only"
              onClick={handleToggleCollapse}
              title={isCollapsed ? 'ขยายแถบเมนู (Expand)' : 'ย่อแถบเมนู (Collapse)'}
              aria-label={isCollapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            {/* Breadcrumb Trail */}
            <div className="bt-breadcrumb-trail">
              <Link href="/service" className="bt-breadcrumb-link">
                บริการสารสนเทศ
              </Link>
              <ChevronRight size={13} className="bt-breadcrumb-sep" />
              <Link href="/service/budget-tracker/rh1" className="bt-breadcrumb-link">
                ติดตามงบประมาณ
              </Link>
              {currentItem && (
                <>
                  <ChevronRight size={13} className="bt-breadcrumb-sep" />
                  <span className="bt-breadcrumb-current">{currentItem.shortTitle}</span>
                </>
              )}
            </div>
          </div>

          <div className="bt-viewport-header-right">
            <span className="bt-system-tag">
              <Coins size={14} />
              <span>รพ.เถิน • บริหารงบประมาณ</span>
            </span>
          </div>
        </header>

        {/* Inner Page Content */}
        <main className="bt-viewport-content">
          <div className="bt-wrap">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
