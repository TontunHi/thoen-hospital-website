'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { MemberPortalServiceItem, ServiceCategory } from './types'

interface MemberHubClientProps {
  services: MemberPortalServiceItem[]
  pendingInboxCount: number
  pendingRegistrationsCount: number
  isAdmin: boolean
}

const PINNED_STORAGE_KEY = 'thoen_member_pinned_services_v1'

export default function MemberHubClient({
  services,
  pendingInboxCount,
  pendingRegistrationsCount,
  isAdmin,
}: MemberHubClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  // Default to 'daily' for a clean, calm, and uncluttered first impression!
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('daily')
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [isClientLoaded, setIsClientLoaded] = useState(false)

  // Load pinned services from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_STORAGE_KEY)
      if (stored) {
        setPinnedIds(JSON.parse(stored))
      }
    } catch (err) {
      console.warn('Failed to read pinned services from localStorage:', err)
    }
    setIsClientLoaded(true)
  }, [])

  // Toggle pinning a service
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next))
      } catch (err) {
        console.warn('Failed to save pinned services to localStorage:', err)
      }
      return next
    })
  }

  // Count items per category
  const counts = useMemo(() => {
    return {
      all: services.length,
      favorites: services.filter((s) => pinnedIds.includes(s.id)).length,
      daily: services.filter((s) => s.category === 'daily').length,
      system: services.filter((s) => s.category === 'system').length,
      admin: services.filter((s) => s.category === 'admin').length,
    }
  }, [services, pinnedIds])

  // Filter services by search query and category
  const isSearching = searchQuery.trim().length > 0
  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return services.filter((srv) => {
      // 1. If user is actively searching, search across all categories
      if (q) {
        const matchesTitle = srv.title.toLowerCase().includes(q)
        const matchesDesc = srv.description.toLowerCase().includes(q)
        const matchesKeywords = srv.keywords.some((k) => k.toLowerCase().includes(q))
        return matchesTitle || matchesDesc || matchesKeywords
      }

      // 2. Otherwise, filter strictly by selected category tab
      if (selectedCategory === 'favorites') {
        return pinnedIds.includes(srv.id)
      }
      if (selectedCategory === 'daily') {
        return srv.category === 'daily'
      }
      if (selectedCategory === 'system') {
        return srv.category === 'system'
      }
      if (selectedCategory === 'admin') {
        return srv.category === 'admin'
      }

      // 'all' shows all
      return true
    })
  }, [services, searchQuery, selectedCategory, pinnedIds])

  // Section title & icon based on active view
  const sectionMeta = useMemo(() => {
    if (isSearching) {
      return {
        title: `ผลการค้นหาสำหรับ "${searchQuery}" (${filteredServices.length})`,
        icon: 'search',
        subtitle: 'แสดงบริการที่ตรงกับคำค้นหาของคุณ',
      }
    }
    switch (selectedCategory) {
      case 'daily':
        return {
          title: 'งานและบริการหลักประจำวัน',
          icon: 'task_alt',
          subtitle: 'บริการยื่นคำร้อง กล่องงาน สลิปเงินเดือน และกิจกรรมที่ใช้งานเป็นประจำ',
        }
      case 'system':
        return {
          title: 'ระบบงานสารสนเทศและบริหารจัดการข้อมูล',
          icon: 'folder_open',
          subtitle: 'ระบบข้อมูลครุภัณฑ์ ข่าวสาร เอกสาร RDU/ITA และงานสารสนเทศตามสิทธิ์',
        }
      case 'admin':
        return {
          title: 'ระบบควบคุมและตั้งค่า (ผู้ดูแลระบบ)',
          icon: 'admin_panel_settings',
          subtitle: 'ศูนย์ควบคุมสิทธิ์สมาชิก อนุมัติการลงทะเบียน และความปลอดภัยระบบ',
        }
      case 'favorites':
        return {
          title: 'รายการที่คุณปักหมุดไว้ (Favorites)',
          icon: 'star',
          subtitle: 'บริการลัดที่คุณเข้าใช้งานบ่อยที่สุด',
        }
      default:
        return {
          title: 'บริการและระบบงานทั้งหมด',
          icon: 'apps',
          subtitle: 'สารบัญรวมบริการและฟังก์ชันทั้งหมดของโรงพยาบาลเถิน',
        }
    }
  }, [isSearching, searchQuery, selectedCategory, filteredServices.length])

  return (
    <div className="memberHubContainer">
      {/* ── Control Strip: Calm & Breathable ── */}
      <div className="hubControlStrip">
        {/* Search Bar */}
        <div className="hubSearchBox">
          <span className="material-symbols-outlined hubSearchIcon" aria-hidden="true">
            search
          </span>
          <input
            type="text"
            className="hubSearchInput"
            placeholder="ค้นหาบริการหรือโมดูล... (เช่น ซ่อม, สลิป, ยืม, rdu)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="ค้นหาบริการหรือโมดูลในระบบ"
          />
          {searchQuery && (
            <button
              type="button"
              className="hubSearchClearBtn"
              onClick={() => setSearchQuery('')}
              aria-label="ล้างข้อความค้นหา"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          )}
        </div>

        {/* Category Tabs (Segmented Switcher) */}
        {!isSearching && (
          <div className="hubTabsContainer" role="tablist" aria-label="หมวดหมู่บริการ">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'daily'}
              className={`hubTab ${selectedCategory === 'daily' ? 'hubTabActive' : ''}`}
              onClick={() => setSelectedCategory('daily')}
            >
              <span className="material-symbols-outlined hubTabIcon" aria-hidden="true">
                task_alt
              </span>
              <span>งานประจำวัน</span>
              <span className="hubTabCount">{counts.daily}</span>
            </button>

            {counts.system > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'system'}
                className={`hubTab ${selectedCategory === 'system' ? 'hubTabActive' : ''}`}
                onClick={() => setSelectedCategory('system')}
              >
                <span className="material-symbols-outlined hubTabIcon" aria-hidden="true">
                  folder_open
                </span>
                <span>ระบบสารสนเทศ</span>
                <span className="hubTabCount">{counts.system}</span>
              </button>
            )}

            {isAdmin && counts.admin > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'admin'}
                className={`hubTab ${selectedCategory === 'admin' ? 'hubTabActive' : ''}`}
                onClick={() => setSelectedCategory('admin')}
              >
                <span className="material-symbols-outlined hubTabIcon" aria-hidden="true">
                  admin_panel_settings
                </span>
                <span>ผู้ดูแลระบบ</span>
                <span className="hubTabCount">{counts.admin}</span>
              </button>
            )}

            {isClientLoaded && counts.favorites > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'favorites'}
                className={`hubTab hubTabFav ${selectedCategory === 'favorites' ? 'hubTabActive' : ''}`}
                onClick={() => setSelectedCategory('favorites')}
              >
                <span className="material-symbols-outlined hubTabFavIcon" aria-hidden="true">
                  star
                </span>
                <span>ที่ปักหมุด</span>
                <span className="hubTabCount">{counts.favorites}</span>
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              className={`hubTab ${selectedCategory === 'all' ? 'hubTabActive' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              <span>ทั้งหมด</span>
              <span className="hubTabCount">{counts.all}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Empty State ── */}
      {filteredServices.length === 0 && (
        <div className="hubEmptyState" role="status">
          <div className="hubEmptyIconWrapper">
            <span className="material-symbols-outlined" aria-hidden="true">
              search_off
            </span>
          </div>
          <h4>ไม่พบบริการที่ตรงกับ "{searchQuery}"</h4>
          <p>ลองค้นหาด้วยคำอื่น เช่น แจ้งซ่อม, สลิปเงินเดือน, ลายเซ็น หรือครุภัณฑ์</p>
          <button
            type="button"
            className="hubEmptyResetBtn"
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('daily')
            }}
          >
            ล้างคำค้นหาและแสดงทั้งหมด
          </button>
        </div>
      )}

      {/* ── Services Section: Calm, Clean 3-Column Grid ── */}
      {filteredServices.length > 0 && (
        <section className="hubServicesSection" aria-label={sectionMeta.title}>
          <div className="hubSectionHeader">
            <div className="hubSectionTitleWrap">
              <div className="hubSectionHeadingRow">
                <span className="material-symbols-outlined hubSectionTitleIcon" aria-hidden="true">
                  {sectionMeta.icon}
                </span>
                <h3>{sectionMeta.title}</h3>
              </div>
              <p className="hubSectionSubtitle">{sectionMeta.subtitle}</p>
            </div>
          </div>

          <div className="hubCardsGrid">
            {filteredServices.map((service) => {
              const isPinned = pinnedIds.includes(service.id)
              const hasAlert =
                (service.id === 'inbox' && pendingInboxCount > 0) ||
                (service.id === 'admin_registrations' && pendingRegistrationsCount > 0)

              return (
                <Link
                  key={service.id}
                  href={service.href}
                  className={`hubCard ${hasAlert ? 'hubCardAlert' : ''}`}
                >
                  <div className="hubCardTop">
                    <div className={`hubIconTile category-${service.category}`}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {service.icon}
                      </span>
                    </div>

                    <div className="hubCardActions">
                      {service.badge ? (
                        <span
                          className={`hubBadge ${
                            service.badge.variant === 'alert'
                              ? 'badgeAlert'
                              : service.badge.variant === 'ok'
                              ? 'badgeOk'
                              : 'badgeNeutral'
                          }`}
                        >
                          {service.badge.pulse && <span className="badgePulseDot" />}
                          {service.badge.text}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        className={`hubPinBtn ${isPinned ? 'isPinned' : ''}`}
                        onClick={(e) => handleTogglePin(service.id, e)}
                        aria-label={isPinned ? `ยกเลิกปักหมุด ${service.title}` : `ปักหมุด ${service.title}`}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {isPinned ? 'star' : 'star_border'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="hubCardContent">
                    <h4 className="hubCardTitle">{service.title}</h4>
                    <p className="hubCardDesc">{service.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
