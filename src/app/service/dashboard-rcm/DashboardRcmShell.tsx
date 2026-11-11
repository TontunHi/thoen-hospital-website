'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  ArrowLeft,
  Search,
  Pin,
  PinOff,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import { RCM_NAV_CONFIG, NavGroup, NavModule, NavPage } from './nav.config'

export { RCM_NAV_CONFIG }
export type { NavGroup, NavModule, NavPage }

// Backward compatibility alias for tests/components
export const RCM_NAV_GROUPS = RCM_NAV_CONFIG

export interface NavSubItem {
  href: string
  label: string
  badge: string
  children?: NavSubItem[]
}

export interface NavItem {
  href: string
  label: string
  badge: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  children?: NavSubItem[]
}

export function isPathMatch(pathname: string | null, targetHref?: string): boolean {
  if (!pathname || !targetHref) return false
  return pathname === targetHref || pathname.startsWith(targetHref + '/')
}

interface DashboardRcmShellProps {
  children: React.ReactNode
  userRole?: string
}

const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 400
const SNAP_COLLAPSE_THRESHOLD = 200

export interface PinnedItem {
  href: string
  label: string
  code: string
}

export default function DashboardRcmShell({ children }: DashboardRcmShellProps) {
  const pathname = usePathname()

  // Display mode & layout states
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  const sidebarWidthRef = useRef<number>(DEFAULT_SIDEBAR_WIDTH)
  const isResizingRef = useRef<boolean>(false)
  const sidebarNavRef = useRef<HTMLElement | null>(null)

  // Groups and Accordion open states
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  // Pinned & Recent items
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([])
  const [recentItems, setRecentItems] = useState<PinnedItem[]>([])

  // Search states
  const [searchQuery, setSearchQuery] = useState<string>('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Rail mode hover/flyout state
  const [hoveredRailItem, setHoveredRailItem] = useState<{
    id: string
    code: string
    label: string
    href?: string
    children?: NavPage[]
    top: number
  } | null>(null)

  // Flatten all navigable endpoints for real-time search indexing
  const allSearchableItems = useMemo(() => {
    const list: Array<{
      href: string
      code: string
      label: string
      groupTitle: string
      parentLabel?: string
      keywords?: string[]
    }> = []

    RCM_NAV_CONFIG.forEach((group) => {
      group.modules.forEach((mod) => {
        if (!mod.children || mod.children.length === 0) {
          if (mod.href) {
            list.push({
              href: mod.href,
              code: mod.code,
              label: mod.label,
              groupTitle: group.title,
              keywords: mod.keywords,
            })
          }
        } else {
          mod.children.forEach((child) => {
            if (!child.children || child.children.length === 0) {
              list.push({
                href: child.href,
                code: child.badge || mod.code,
                label: child.label,
                groupTitle: group.title,
                parentLabel: mod.label,
                keywords: child.keywords || mod.keywords,
              })
            } else {
              child.children.forEach((subChild) => {
                list.push({
                  href: subChild.href,
                  code: subChild.badge || child.badge || mod.code,
                  label: subChild.label,
                  groupTitle: group.title,
                  parentLabel: `${mod.label} › ${child.label}`,
                  keywords: subChild.keywords || child.keywords || mod.keywords,
                })
              })
            }
          })
        }
      })
    })

    return list
  }, [])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return allSearchableItems.filter((entry) => {
      const labelMatch = entry.label.toLowerCase().includes(q)
      const codeMatch = entry.code.toLowerCase().includes(q)
      const groupMatch = entry.groupTitle.toLowerCase().includes(q)
      const parentMatch = entry.parentLabel ? entry.parentLabel.toLowerCase().includes(q) : false
      const keywordMatch = entry.keywords ? entry.keywords.some((k) => k.toLowerCase().includes(q)) : false
      return labelMatch || codeMatch || groupMatch || parentMatch || keywordMatch
    })
  }, [searchQuery, allSearchableItems])

  // Hydrate preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem('rcm_sidebar_collapsed')
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === 'true')
      }

      const savedDensity = localStorage.getItem('rcm_sidebar_density')
      if (savedDensity === 'compact' || savedDensity === 'comfortable') {
        setDensity(savedDensity)
      }

      const savedWidth = localStorage.getItem('rcm_sidebar_width')
      if (savedWidth) {
        const parsedWidth = parseInt(savedWidth, 10)
        if (!isNaN(parsedWidth) && parsedWidth >= MIN_SIDEBAR_WIDTH && parsedWidth <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(parsedWidth)
          sidebarWidthRef.current = parsedWidth
        }
      }

      const savedGroups = localStorage.getItem('rcm_sidebar_expanded_groups')
      if (savedGroups) {
        const parsed = JSON.parse(savedGroups) as Record<string, boolean>
        if (parsed && typeof parsed === 'object') {
          setExpandedGroups(parsed)
        }
      }

      const savedMenus = localStorage.getItem('rcm_sidebar_expanded_menus')
      if (savedMenus) {
        const parsedMenus = JSON.parse(savedMenus) as Record<string, boolean>
        if (parsedMenus && typeof parsedMenus === 'object') {
          setExpandedMenus(parsedMenus)
        }
      }

      const savedPinned = localStorage.getItem('rcm_sidebar_pinned')
      if (savedPinned) {
        const parsedPinned = JSON.parse(savedPinned) as PinnedItem[]
        if (Array.isArray(parsedPinned)) {
          setPinnedItems(parsedPinned)
        }
      }

      const savedRecent = localStorage.getItem('rcm_sidebar_recent')
      if (savedRecent) {
        const parsedRecent = JSON.parse(savedRecent) as PinnedItem[]
        if (Array.isArray(parsedRecent)) {
          setRecentItems(parsedRecent)
        }
      }
    } catch {
      // Ignore localStorage read errors in private browsing
    }
  }, [])

  // Auto-track recent items when pathname changes
  useEffect(() => {
    if (!pathname) return
    const matched = allSearchableItems.find((it) => it.href === pathname)
    if (matched) {
      setRecentItems((prev) => {
        const filtered = prev.filter((p) => p.href !== matched.href)
        const updated = [{ href: matched.href, label: matched.label, code: matched.code }, ...filtered].slice(0, 3)
        try {
          localStorage.setItem('rcm_sidebar_recent', JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })
    }
  }, [pathname, allSearchableItems])

  // Global keyboard shortcuts (Ctrl+K to search, `[` to toggle rail/expanded, Escape to clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isCollapsed) {
          setIsCollapsed(false)
          try {
            localStorage.setItem('rcm_sidebar_collapsed', 'false')
          } catch {
            // ignore
          }
        }
        setTimeout(() => searchInputRef.current?.focus(), 100)
      } else if (e.key === '[' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        toggleCollapse()
      } else if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('')
        }
        setHoveredRailItem(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCollapsed, searchQuery])

  // Resizing logic with snap to Rail
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isCollapsed) return
    isResizingRef.current = true
    setIsResizing(true)
  }

  const resetWidth = () => {
    if (isCollapsed) return
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
    sidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH
    try {
      localStorage.setItem('rcm_sidebar_width', String(DEFAULT_SIDEBAR_WIDTH))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return

      // Snap collapse if user drags narrower than SNAP_COLLAPSE_THRESHOLD
      if (e.clientX < SNAP_COLLAPSE_THRESHOLD) {
        setIsCollapsed(true)
        try {
          localStorage.setItem('rcm_sidebar_collapsed', 'true')
        } catch {
          // ignore
        }
        return
      }

      if (isCollapsed && e.clientX >= SNAP_COLLAPSE_THRESHOLD) {
        setIsCollapsed(false)
        try {
          localStorage.setItem('rcm_sidebar_collapsed', 'false')
        } catch {
          // ignore
        }
      }

      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(e.clientX, MAX_SIDEBAR_WIDTH))
      setSidebarWidth(newWidth)
      sidebarWidthRef.current = newWidth
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        setIsResizing(false)
        try {
          localStorage.setItem('rcm_sidebar_width', String(sidebarWidthRef.current))
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isCollapsed])

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      setHoveredRailItem(null)
      try {
        localStorage.setItem('rcm_sidebar_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next = prev === 'comfortable' ? 'compact' : 'comfortable'
      try {
        localStorage.setItem('rcm_sidebar_density', next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = {
        ...prev,
        [groupId]: !Boolean(prev[groupId]),
      }
      try {
        localStorage.setItem('rcm_sidebar_expanded_groups', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Accordion rule: Inside a group, expanding a module collapses other open modules
  const toggleSubmenu = (menuHref: string, siblingHrefs?: string[]) => {
    setExpandedMenus((prev) => {
      const willOpen = !Boolean(prev[menuHref])
      const next: Record<string, boolean> = { ...prev }

      if (willOpen && siblingHrefs) {
        siblingHrefs.forEach((sHref) => {
          if (sHref !== menuHref) {
            next[sHref] = false
          }
        })
      }
      next[menuHref] = willOpen

      try {
        localStorage.setItem('rcm_sidebar_expanded_menus', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Pinning items management (up to 5)
  const togglePin = (href: string, label: string, code: string) => {
    setPinnedItems((prev) => {
      const isCurrentlyPinned = prev.some((p) => p.href === href)
      let next: PinnedItem[]
      if (isCurrentlyPinned) {
        next = prev.filter((p) => p.href !== href)
      } else {
        if (prev.length >= 5) {
          next = [...prev.slice(1), { href, label, code }]
        } else {
          next = [...prev, { href, label, code }]
        }
      }
      try {
        localStorage.setItem('rcm_sidebar_pinned', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Active trail resolution for Breadcrumb & Hierarchy
  const activeGroup = RCM_NAV_CONFIG.find((g) =>
    g.modules.some(
      (m) =>
        isPathMatch(pathname, m.href) ||
        Boolean(
          m.children?.some(
            (c) =>
              isPathMatch(pathname, c.href) ||
              Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
          )
        )
    )
  )

  const activeModule = activeGroup?.modules.find(
    (m) =>
      isPathMatch(pathname, m.href) ||
      Boolean(
        m.children?.some(
          (c) =>
            isPathMatch(pathname, c.href) ||
            Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
        )
      )
  )

  const activeChild = activeModule?.children?.find(
    (c) =>
      isPathMatch(pathname, c.href) ||
      Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
  )

  const activeSubChild = activeChild?.children?.find((cc) => isPathMatch(pathname, cc.href))

  // Substring highlight helper for search results
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return text
    const q = query.trim().toLowerCase()
    const idx = text.toLowerCase().indexOf(q)
    if (idx === -1) return text

    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + q.length)
    const after = text.slice(idx + q.length)

    return (
      <>
        {before}
        <mark className="rcm-search-highlight">{match}</mark>
        {after}
      </>
    )
  }

  return (
    <div
      className={`rcm-layout-shell ${isCollapsed ? 'is-collapsed' : ''} ${
        isResizing ? 'is-resizing' : ''
      }`}
    >
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
        suppressHydrationWarning
        className={`rcm-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        } ${isResizing ? 'is-resizing' : ''} density-${density}`}
        style={!isCollapsed ? { width: `${sidebarWidth}px` } : undefined}
        aria-label="Dashboard RCM Navigation"
      >
        {/* Sidebar Header */}
        <div className="rcm-sidebar-header">
          <div className="rcm-sidebar-brand">
            {!isCollapsed ? (
              <div className="rcm-brand-text">
                <span className="rcm-brand-title">Dashboard-RCM</span>
                <span className="rcm-brand-sub">โรงพยาบาลเถิน</span>
              </div>
            ) : (
              <div className="rcm-brand-rail-badge" title="Dashboard-RCM โรงพยาบาลเถิน">
                RCM
              </div>
            )}
          </div>

          <div className="rcm-sidebar-header-actions">
            {!isCollapsed && (
              <button
                type="button"
                className="rcm-header-action-btn desktop-only"
                onClick={toggleDensity}
                title={`สลับขนาดแถว (ปัจจุบัน: ${density === 'comfortable' ? 'สบาย' : 'กระชับ'})`}
                aria-label="Toggle row density"
              >
                <SlidersHorizontal size={14} />
              </button>
            )}

            <button
              type="button"
              className="rcm-collapse-toggle desktop-only"
              onClick={toggleCollapse}
              title={isCollapsed ? 'ขยายเมนู (280px) หรือกด [' : 'ย่อเมนูเพื่อเพิ่มพื้นที่แสดงผล (หรือกด [)'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={15} />}
            </button>

            <button
              type="button"
              className="rcm-mobile-close mobile-only"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Search Bar */}
        {!isCollapsed && (
          <div className="rcm-search-box">
            <div className="rcm-search-input-wrapper">
              <Search size={14} className="rcm-search-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู (OPD, กองทุน, ยา, รหัส)..."
                className="rcm-search-input"
                aria-label="ค้นหาเมนูใน RCM Dashboard"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rcm-search-clear-btn"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="rcm-search-kbd">Ctrl K</span>
              )}
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="rcm-collapsed-search-trigger">
            <button
              type="button"
              onClick={() => {
                setIsCollapsed(false)
                try {
                  localStorage.setItem('rcm_sidebar_collapsed', 'false')
                } catch {
                  // ignore
                }
                setTimeout(() => searchInputRef.current?.focus(), 120)
              }}
              className="rcm-collapsed-search-btn"
              title="ค้นหาเมนู (Ctrl+K)"
              aria-label="ค้นหาเมนู"
            >
              <Search size={15} />
            </button>
          </div>
        )}

        {/* Pinned Section (ปักหมุด) - When Expanded and has items */}
        {!isCollapsed && !searchQuery.trim() && pinnedItems.length > 0 && (
          <div className="rcm-pinned-section">
            <div className="rcm-pinned-header">
              <Pin size={12} className="rcm-pinned-icon" />
              <span>ปักหมุด ({pinnedItems.length}/5)</span>
            </div>
            <ul className="rcm-pinned-list">
              {pinnedItems.map((p) => {
                const isActive = pathname === p.href
                return (
                  <li key={p.href} className="rcm-pinned-item">
                    <Link
                      href={p.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`rcm-nav-row ${isActive ? 'is-active' : ''}`}
                    >
                      <span className="rcm-row-code">{p.code}</span>
                      <span className="rcm-row-label">{p.label}</span>
                    </Link>
                    <button
                      type="button"
                      className="rcm-pin-toggle-btn pinned"
                      onClick={() => togglePin(p.href, p.label, p.code)}
                      title="ยกเลิกปักหมุด"
                      aria-label="Unpin"
                    >
                      <PinOff size={12} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Navigation Categories */}
        <nav
          ref={sidebarNavRef}
          suppressHydrationWarning
          className="rcm-sidebar-nav"
          aria-label="เมนูหลัก"
        >
          {searchQuery.trim().length > 0 ? (
            /* Search Results View */
            <div className="rcm-search-results">
              <div className="rcm-search-results-header">
                <span className="rcm-search-count">ผลการค้นหา ({searchResults.length})</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rcm-search-reset-link"
                >
                  ล้างคำค้น
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="rcm-search-empty">
                  <p className="rcm-search-empty-text">ไม่พบเมนูที่ตรงกับ &ldquo;{searchQuery}&rdquo;</p>
                  <span className="rcm-search-empty-sub">
                    ลองค้นหาด้วยรหัสหรือชื่อ เช่น CCS, ANC, 11, 1B005, ฟลูออไรด์, Telemed
                  </span>
                </div>
              ) : (
                <ul className="rcm-search-list">
                  {searchResults.map((result) => {
                    const isResultActive = pathname === result.href
                    return (
                      <li key={result.href} className="rcm-search-item">
                        <Link
                          href={result.href}
                          onClick={() => {
                            setIsMobileOpen(false)
                            setSearchQuery('')
                          }}
                          className={`rcm-search-link ${isResultActive ? 'active' : ''}`}
                        >
                          <div className="rcm-search-code-badge">
                            {renderHighlightedText(result.code, searchQuery)}
                          </div>
                          <div className="rcm-search-meta">
                            <div className="rcm-search-trail">
                              <span>{result.groupTitle}</span>
                              {result.parentLabel && (
                                <>
                                  <span className="rcm-search-trail-sep">›</span>
                                  <span>{result.parentLabel}</span>
                                </>
                              )}
                            </div>
                            <div className="rcm-search-title-row">
                              <span className="rcm-search-title">
                                {renderHighlightedText(result.label, searchQuery)}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            /* Standard Hierarchical Tree */
            RCM_NAV_CONFIG.map((group) => {
              const isGroupExpanded = Boolean(expandedGroups[group.id])
              const isGroupActive = group.modules.some(
                (m) =>
                  isPathMatch(pathname, m.href) ||
                  Boolean(
                    m.children?.some(
                      (c) =>
                        isPathMatch(pathname, c.href) ||
                        Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
                    )
                  )
              )

              const groupModuleHrefs = group.modules
                .filter((m) => m.children && m.children.length > 0 && m.href)
                .map((m) => m.href!)

              return (
                <div
                  key={group.id}
                  suppressHydrationWarning
                  className={`rcm-nav-group ${
                    !isCollapsed && !isGroupExpanded ? 'is-group-collapsed' : ''
                  }`}
                >
                  {/* Sticky Group Header */}
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
                      {group.modules.map((mod) => {
                        const hasChildren = Boolean(mod.children && mod.children.length > 0)
                        const modHref = mod.href || (mod.children ? mod.children[0].href : '')
                        const isBranchActive =
                          isPathMatch(pathname, mod.href) ||
                          Boolean(
                            mod.children?.some(
                              (c) =>
                                isPathMatch(pathname, c.href) ||
                                Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
                            )
                          )
                        const isDirectActive = pathname === mod.href
                        const isExpanded = Boolean(expandedMenus[modHref])

                        /* Rail (Collapsed) View */
                        if (isCollapsed) {
                          return (
                            <li
                              key={mod.id}
                              className="rcm-rail-item"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setHoveredRailItem({
                                  id: mod.id,
                                  code: mod.code,
                                  label: mod.label,
                                  href: mod.href,
                                  children: mod.children,
                                  top: rect.top,
                                })
                              }}
                              onMouseLeave={() => setHoveredRailItem(null)}
                            >
                              <Link
                                href={modHref}
                                onClick={() => setIsMobileOpen(false)}
                                className={`rcm-rail-link ${isBranchActive ? 'branch-active' : ''} ${
                                  isDirectActive ? 'is-active' : ''
                                }`}
                                aria-label={`${mod.code} ${mod.label}`}
                              >
                                <span className="rcm-rail-code">{mod.code}</span>
                              </Link>
                            </li>
                          )
                        }

                        /* Expanded: Module with Subpages (Accordion Parent) */
                        if (hasChildren && mod.children) {
                          return (
                            <li key={mod.id} className="rcm-nav-list-item">
                              <button
                                type="button"
                                onClick={() => toggleSubmenu(modHref, groupModuleHrefs)}
                                aria-expanded={isExpanded}
                                className={`rcm-nav-row rcm-nav-parent-btn ${
                                  isBranchActive ? 'branch-active' : ''
                                }`}
                              >
                                <span
                                  className={`rcm-row-code ${isBranchActive ? 'active' : ''}`}
                                >
                                  {mod.code}
                                </span>
                                <span className="rcm-row-label" title={mod.label}>{mod.label}</span>
                                <span className="rcm-row-arrow" aria-hidden="true">
                                  {isExpanded ? (
                                    <ChevronDown size={14} />
                                  ) : (
                                    <ChevronRight size={14} />
                                  )}
                                </span>
                              </button>

                              {isExpanded && (
                                <ul className="rcm-nav-sublist">
                                  {mod.children.map((child) => {
                                    const hasSubChildren = Boolean(
                                      child.children && child.children.length > 0
                                    )
                                    const isChildBranchActive =
                                      isPathMatch(pathname, child.href) ||
                                      Boolean(
                                        child.children?.some((cc) => isPathMatch(pathname, cc.href))
                                      )
                                    const isChildDirectActive = pathname === child.href
                                    const isChildExpanded = Boolean(expandedMenus[child.href])

                                    if (hasSubChildren && child.children) {
                                      return (
                                        <li key={child.id} className="rcm-nav-subgroup-item">
                                          <button
                                            type="button"
                                            onClick={() => toggleSubmenu(child.href)}
                                            aria-expanded={isChildExpanded}
                                            className={`rcm-nav-subrow rcm-nav-subparent-btn ${
                                              isChildBranchActive ? 'branch-active' : ''
                                            }`}
                                          >
                                            <div className="rcm-subrow-content">
                                              {child.badge && (
                                                <span className="rcm-row-code-sub">
                                                  {child.badge}
                                                </span>
                                              )}
                                              <span className="rcm-row-label" title={child.label}>{child.label}</span>
                                            </div>
                                            <span className="rcm-row-arrow" aria-hidden="true">
                                              {isChildExpanded ? (
                                                <ChevronDown size={13} />
                                              ) : (
                                                <ChevronRight size={13} />
                                              )}
                                            </span>
                                          </button>

                                          {isChildExpanded && (
                                            <ul className="rcm-nav-subsublist">
                                              {child.children.map((subChild) => {
                                                const isSubActive = pathname === subChild.href
                                                const isPinned = pinnedItems.some(
                                                  (p) => p.href === subChild.href
                                                )
                                                return (
                                                  <li key={subChild.id} className="rcm-nav-leaf-item">
                                                    <Link
                                                      href={subChild.href}
                                                      onClick={() => setIsMobileOpen(false)}
                                                      className={`rcm-nav-subsublink ${
                                                        isSubActive ? 'is-active' : ''
                                                      }`}
                                                      aria-current={isSubActive ? 'page' : undefined}
                                                    >
                                                      {subChild.badge && (
                                                        <span className="rcm-row-code-sub">
                                                          {subChild.badge}
                                                        </span>
                                                      )}
                                                      <span className="rcm-row-label" title={subChild.label}>
                                                        {subChild.label}
                                                      </span>
                                                    </Link>
                                                    <button
                                                      type="button"
                                                      className={`rcm-pin-toggle-btn ${
                                                        isPinned ? 'pinned' : ''
                                                      }`}
                                                      onClick={() =>
                                                        togglePin(
                                                          subChild.href,
                                                          subChild.label,
                                                          subChild.badge || child.badge || mod.code
                                                        )
                                                      }
                                                      title={isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด'}
                                                      aria-label="Pin"
                                                    >
                                                      <Pin size={12} />
                                                    </button>
                                                  </li>
                                                )
                                              })}
                                            </ul>
                                          )}
                                        </li>
                                      )
                                    }

                                    const isPinned = pinnedItems.some((p) => p.href === child.href)
                                    return (
                                      <li key={child.id} className="rcm-nav-leaf-item">
                                        <Link
                                          href={child.href}
                                          onClick={() => setIsMobileOpen(false)}
                                          className={`rcm-nav-sublink ${
                                            isChildDirectActive ? 'is-active' : ''
                                          }`}
                                          aria-current={isChildDirectActive ? 'page' : undefined}
                                        >
                                          {child.badge && (
                                            <span className="rcm-row-code-sub">{child.badge}</span>
                                          )}
                                          <span className="rcm-row-label" title={child.label}>{child.label}</span>
                                        </Link>
                                        <button
                                          type="button"
                                          className={`rcm-pin-toggle-btn ${
                                            isPinned ? 'pinned' : ''
                                          }`}
                                          onClick={() =>
                                            togglePin(
                                              child.href,
                                              child.label,
                                              child.badge || mod.code
                                            )
                                          }
                                          title={isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด'}
                                          aria-label="Pin"
                                        >
                                          <Pin size={12} />
                                        </button>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </li>
                          )
                        }

                        /* Expanded: Module without Subpages (Direct Link) */
                        const isPinned = pinnedItems.some((p) => p.href === modHref)
                        return (
                          <li key={mod.id} className="rcm-nav-list-item rcm-nav-leaf-item">
                            <Link
                              href={modHref}
                              onClick={() => setIsMobileOpen(false)}
                              className={`rcm-nav-row ${isDirectActive ? 'is-active' : ''}`}
                              aria-current={isDirectActive ? 'page' : undefined}
                            >
                              <span
                                className={`rcm-row-code ${isDirectActive ? 'active' : ''}`}
                              >
                                {mod.code}
                              </span>
                              <span className="rcm-row-label" title={mod.label}>{mod.label}</span>
                            </Link>
                            <button
                              type="button"
                              className={`rcm-pin-toggle-btn ${isPinned ? 'pinned' : ''}`}
                              onClick={() => togglePin(modHref, mod.label, mod.code)}
                              title={isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด'}
                              aria-label="Pin"
                            >
                              <Pin size={12} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="rcm-sidebar-footer">
          <Link
            href="/service"
            className="rcm-sidebar-back-link"
            title="กลับสู่หน้าบริการหลัก"
          >
            <ArrowLeft size={15} />
            {!isCollapsed && <span>กลับหน้าบริการ</span>}
          </Link>
        </div>

        {/* Rail Flyout Popover on Hover (Rail Mode) */}
        {isCollapsed && hoveredRailItem && (
          <div
            className="rcm-collapsed-tooltip rcm-rail-flyout"
            style={{
              top: Math.max(76, hoveredRailItem.top - 4),
              left: 68,
            }}
            onMouseEnter={() => {}}
            onMouseLeave={() => setHoveredRailItem(null)}
          >
            <div className="rcm-rail-flyout-header">
              <span className="rcm-rail-flyout-code">{hoveredRailItem.code}</span>
              <span className="rcm-rail-flyout-title">{hoveredRailItem.label}</span>
            </div>

            {hoveredRailItem.children && hoveredRailItem.children.length > 0 ? (
              <ul className="rcm-rail-flyout-list">
                {hoveredRailItem.children.map((child) => {
                  const isActive = pathname === child.href
                  return (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={() => {
                          setHoveredRailItem(null)
                          setIsMobileOpen(false)
                        }}
                        className={`rcm-rail-flyout-link ${isActive ? 'is-active' : ''}`}
                      >
                        {child.badge && (
                          <span className="rcm-row-code-sub">{child.badge}</span>
                        )}
                        <span>{child.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              hoveredRailItem.href && (
                <div style={{ marginTop: 6 }}>
                  <Link
                    href={hoveredRailItem.href}
                    onClick={() => {
                      setHoveredRailItem(null)
                      setIsMobileOpen(false)
                    }}
                    className="rcm-rail-flyout-link"
                  >
                    <span>เปิดหน้า {hoveredRailItem.label} →</span>
                  </Link>
                </div>
              )
            )}
          </div>
        )}

        {/* Drag Resize Handle (Desktop Only) */}
        {!isCollapsed && (
          <div
            className={`rcm-resize-handle ${isResizing ? 'is-active' : ''}`}
            onMouseDown={startResizing}
            onDoubleClick={resetWidth}
            title="ลากเพื่อปรับขนาด (ดับเบิ้ลคลิกเพื่อรีเซ็ต 280px)"
            aria-label="Resize sidebar"
            role="separator"
            aria-orientation="vertical"
          />
        )}
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
              {activeModule && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span
                    className={
                      activeChild ? 'rcm-crumb-subtle' : 'rcm-crumb-active'
                    }
                  >
                    {activeModule.label}
                  </span>
                </>
              )}
              {activeChild && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span
                    className={
                      activeSubChild ? 'rcm-crumb-subtle' : 'rcm-crumb-active'
                    }
                  >
                    {activeChild.label}
                  </span>
                </>
              )}
              {activeSubChild && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className="rcm-crumb-active">
                    {activeSubChild.label}
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
