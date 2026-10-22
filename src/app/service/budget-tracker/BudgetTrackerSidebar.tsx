'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Coins,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import { BUDGET_NAV_GROUPS, BudgetNavItem } from './budgetNavConfig'

interface BudgetTrackerSidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export default function BudgetTrackerSidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: BudgetTrackerSidebarProps) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')

  // Determine active item
  const isItemActive = (href: string) => {
    if (href === '/service/budget-tracker/rh1') {
      return (
        pathname === '/service/budget-tracker/rh1' ||
        pathname === '/service/budget-tracker' ||
        pathname === '/service/budget-tracker/'
      )
    }
    return pathname?.startsWith(href)
  }

  // Filter items based on search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return BUDGET_NAV_GROUPS

    return BUDGET_NAV_GROUPS.map((group) => {
      const matchedItems = group.items.filter((item) => {
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchShort = item.shortTitle.toLowerCase().includes(q)
        const matchDesc = item.description?.toLowerCase().includes(q)
        const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q))
        return matchTitle || matchShort || matchDesc || matchKeywords
      })
      return {
        ...group,
        items: matchedItems,
      }
    }).filter((group) => group.items.length > 0)
  }, [searchQuery])

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="bt-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`bt-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="เมนูระบบติดตามงบประมาณ"
      >
        {/* Sidebar Header */}
        <div className="bt-sidebar-header">
          <Link
            href="/service/budget-tracker/rh1"
            className="bt-sidebar-brand"
            onClick={onCloseMobile}
            title="ระบบติดตามงบประมาณประจำปี"
          >
            <div className="bt-sidebar-brand-icon">
              <Coins size={20} />
            </div>
            {!isCollapsed && (
              <div className="bt-sidebar-brand-text">
                <span className="bt-sidebar-title">ติดตามงบประมาณ</span>
                <span className="bt-sidebar-subtitle">โรงพยาบาลเถิน</span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="bt-sidebar-toggle-btn desktop-only"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'ขยายแถบเมนู (Expand)' : 'ย่อแถบเมนู (Collapse)'}
            aria-label={isCollapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="bt-sidebar-close-btn mobile-only"
            onClick={onCloseMobile}
            aria-label="ปิดเมนู"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Search (Only shown when not collapsed) */}
        {!isCollapsed && (
          <div className="bt-sidebar-search">
            <div className="bt-search-box">
              <Search size={14} className="bt-search-icon" />
              <input
                type="text"
                placeholder="ค้นหารายงาน / เมนู..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bt-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="bt-search-clear"
                  aria-label="ล้างการค้นหา"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="bt-sidebar-nav" role="navigation">
          {filteredGroups.length === 0 ? (
            <div className="bt-sidebar-empty">
              <span>ไม่พบเมนูที่ตรงกับ "{searchQuery}"</span>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="bt-nav-group">
                {!isCollapsed && (
                  <div className="bt-nav-group-title">{group.groupTitle}</div>
                )}
                <div className="bt-nav-group-items">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href)
                    const IconComponent = item.icon
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onCloseMobile}
                        className={`bt-nav-item ${active ? 'active' : ''}`}
                        title={isCollapsed ? item.title : undefined}
                        role="tab"
                        aria-selected={active}
                      >
                        <div className="bt-nav-item-icon">
                          <IconComponent size={18} />
                        </div>
                        {!isCollapsed && (
                          <div className="bt-nav-item-info">
                            <span className="bt-nav-item-title">{item.shortTitle}</span>
                            {item.description && (
                              <span className="bt-nav-item-desc">{item.description}</span>
                            )}
                          </div>
                        )}
                        {!isCollapsed && item.badge && (
                          <span
                            className={`bt-nav-item-badge ${
                              item.badge.variant || 'default'
                            }`}
                          >
                            {item.badge.text}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="bt-sidebar-footer">
          <Link
            href="/service"
            className="bt-sidebar-back-link"
            title="กลับไปหน้าบริการสารสนเทศ"
          >
            <ArrowLeft size={16} />
            {!isCollapsed && <span>กลับหน้ารวมบริการ</span>}
          </Link>
        </div>
      </aside>
    </>
  )
}
