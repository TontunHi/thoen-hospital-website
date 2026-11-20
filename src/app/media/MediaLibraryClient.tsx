'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  PlayCircle,
  Play,
  Image as ImageIcon,
  FileText,
  Search,
  X,
  Lock,
  Globe,
  Eye,
  Paperclip,
  LogIn,
  Settings,
  Video,
  Film,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronRight,
  ChevronDown,
  Check,
  RotateCcw,
  FolderOpen,
} from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { formatThaiDate } from '@/lib/formatters'
import type {
  OnlineMediaCategoryRecord,
  OnlineMediaViewerItem,
  MediaType,
} from '@/lib/media/onlineMediaService'
import './media.css'

export interface MediaLibraryClientProps {
  initialCategories: OnlineMediaCategoryRecord[]
  initialItems: OnlineMediaViewerItem[]
  isAuthenticated: boolean
  canManage: boolean
  initialScope: 'ALL' | 'PUBLIC' | 'INTERNAL'
  initialCategoryId?: number
  initialMediaType?: MediaType | 'ALL'
  initialSearch?: string
}

function getYoutubeThumbUrl(youtubeUrl?: string | null): string | null {
  if (!youtubeUrl) return null
  const match = youtubeUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  const id = match?.[1] || (/^[a-zA-Z0-9_-]{11}$/.test(youtubeUrl.trim()) ? youtubeUrl.trim() : null)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

function getMediaTypeLabel(item: OnlineMediaViewerItem): string {
  if (item.sourceType === 'YOUTUBE') return 'YouTube'
  if (item.mediaType === 'VIDEO') return 'วิดีโอ'
  if (item.mediaType === 'INFOGRAPHIC') return 'อินโฟกราฟิก'
  return 'เอกสาร PDF'
}

function formatCompactBytes(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function MediaLibraryClient({
  initialCategories,
  initialItems,
  isAuthenticated,
  canManage,
  initialScope,
  initialCategoryId,
  initialMediaType = 'ALL',
  initialSearch = '',
}: MediaLibraryClientProps) {
  const [scope, setScope] = useState<'ALL' | 'PUBLIC' | 'INTERNAL'>(
    isAuthenticated ? initialScope : 'PUBLIC'
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>(
    initialCategoryId || 'ALL'
  )
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | 'ALL'>(initialMediaType)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'title'>('latest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [openDropdown, setOpenDropdown] = useState<'category' | 'sort' | null>(null)
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null)
  const sortDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openDropdown) return
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (
        openDropdown === 'category' &&
        categoryDropdownRef.current &&
        target &&
        !categoryDropdownRef.current.contains(target)
      ) {
        setOpenDropdown(null)
      } else if (
        openDropdown === 'sort' &&
        sortDropdownRef.current &&
        target &&
        !sortDropdownRef.current.contains(target)
      ) {
        setOpenDropdown(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openDropdown])

  const scopedItems = useMemo(() => {
    return initialItems.filter((item) => {
      if (!isAuthenticated && item.visibility === 'INTERNAL') return false
      if (scope !== 'ALL' && item.visibility !== scope) return false
      return true
    })
  }, [initialItems, isAuthenticated, scope])

  const typeCounts = useMemo(() => {
    const counts = { ALL: scopedItems.length, VIDEO: 0, INFOGRAPHIC: 0, DOCUMENT: 0 }
    for (const item of scopedItems) {
      if (item.mediaType === 'VIDEO') counts.VIDEO += 1
      else if (item.mediaType === 'INFOGRAPHIC') counts.INFOGRAPHIC += 1
      else if (item.mediaType === 'DOCUMENT') counts.DOCUMENT += 1
    }
    return counts
  }, [scopedItems])

  const categoryCounts = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of scopedItems) {
      map.set(item.categoryId, (map.get(item.categoryId) || 0) + 1)
    }
    return map
  }, [scopedItems])

  const visibleCategories = useMemo(() => {
    return initialCategories.filter((cat) => {
      if (!isAuthenticated && cat.visibility === 'INTERNAL') return false
      if (scope === 'PUBLIC' && cat.visibility === 'INTERNAL') return false
      if (scope === 'INTERNAL' && cat.visibility === 'PUBLIC') return false
      return true
    })
  }, [initialCategories, isAuthenticated, scope])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matched = scopedItems.filter((item) => {
      if (selectedCategoryId !== 'ALL' && item.categoryId !== selectedCategoryId) return false
      if (selectedMediaType !== 'ALL' && item.mediaType !== selectedMediaType) return false
      if (q) {
        const hay = `${item.title} ${item.description || ''} ${item.categoryName || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    return [...matched].sort((a, b) => {
      if (sortBy === 'popular') {
        return b.viewCount - a.viewCount || b.id - a.id
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'th')
      }
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id
      )
    })
  }, [scopedItems, selectedCategoryId, selectedMediaType, searchQuery, sortBy])

  const publicCount = useMemo(
    () => initialItems.filter((i) => i.visibility === 'PUBLIC').length,
    [initialItems]
  )
  const internalCount = useMemo(
    () => initialItems.filter((i) => i.visibility === 'INTERNAL').length,
    [initialItems]
  )

  const hasActiveFilters =
    selectedCategoryId !== 'ALL' ||
    selectedMediaType !== 'ALL' ||
    searchQuery.trim().length > 0 ||
    (isAuthenticated && scope !== 'ALL')

  const resetAllFilters = () => {
    setScope(isAuthenticated ? 'ALL' : 'PUBLIC')
    setSelectedCategoryId('ALL')
    setSelectedMediaType('ALL')
    setSearchQuery('')
    setOpenDropdown(null)
  }

  const selectedCategoryObj =
    selectedCategoryId === 'ALL'
      ? null
      : visibleCategories.find((c) => c.id === selectedCategoryId) || null
  const selectedCategoryLabel = selectedCategoryObj ? selectedCategoryObj.name : 'ทุกหมวดหมู่'
  const selectedCategoryCount =
    selectedCategoryId === 'ALL'
      ? scopedItems.length
      : categoryCounts.get(selectedCategoryId) || 0

  const sortOptions: Array<{ value: 'latest' | 'popular' | 'title'; label: string }> = [
    { value: 'latest', label: 'ล่าสุดก่อน' },
    { value: 'popular', label: 'ยอดเข้าชมสูงสุด' },
    { value: 'title', label: 'ชื่อเรื่อง (ก-ฮ)' },
  ]
  const currentSortLabel =
    sortOptions.find((o) => o.value === sortBy)?.label || 'ล่าสุดก่อน'

  return (
    <div className="container mediaLibraryPage">
      <Breadcrumb
        items={[
          { label: 'ข่าวสาร', href: '/news' },
          { label: 'คลังสื่อออนไลน์' },
        ]}
      />

      <header className="mediaPageHeader">
        <div className="mediaPageHeaderTop">
          <div>
            <span className="mediaHeaderBadge">
              <Film size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>ศูนย์สื่อออนไลน์ โรงพยาบาลเถิน</span>
            </span>
            <h1>คลังสื่อออนไลน์และสื่อความรู้</h1>
            <p>
              รวมวิดีโอสื่อความรู้ อินโฟกราฟิก และเอกสารเผยแพร่สำหรับประชาชนทั่วไป
              {isAuthenticated
                ? ' พร้อมคลังสื่ออบรมและคู่มือภายในสำหรับบุคลากรโรงพยาบาล'
                : ' (บุคลากรสามารถเข้าสู่ระบบเพื่อรับชมคลังสื่อภายในเพิ่มเติม)'}
            </p>
          </div>

          <div className="mediaHeaderActions">
            {!isAuthenticated && (
              <Link href="/member/login" className="mediaActionBtn mediaActionBtnPrimary">
                <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>เข้าสู่ระบบบุคลากร</span>
              </Link>
            )}
            {isAuthenticated && canManage && (
              <Link href="/member/online-media" className="mediaActionBtn mediaActionBtnPrimary">
                <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>จัดการคลังสื่อออนไลน์</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mediaControlsPanel" aria-label="ตัวกรองคลังสื่อออนไลน์">
        {isAuthenticated && (
          <div className="mediaScopeTabs" role="tablist" aria-label="ขอบเขตการเข้าถึงสื่อ">
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'ALL'}
              className={`mediaScopeTab ${scope === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setScope('ALL')
                setSelectedCategoryId('ALL')
              }}
            >
              <span>ทั้งหมด</span>
              <span className="mediaTabCount">{initialItems.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'PUBLIC'}
              className={`mediaScopeTab ${scope === 'PUBLIC' ? 'active' : ''}`}
              onClick={() => {
                setScope('PUBLIC')
                setSelectedCategoryId('ALL')
              }}
            >
              <Globe size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>สื่อสาธารณะ</span>
              <span className="mediaTabCount">{publicCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'INTERNAL'}
              className={`mediaScopeTab internalTab ${scope === 'INTERNAL' ? 'active' : ''}`}
              onClick={() => {
                setScope('INTERNAL')
                setSelectedCategoryId('ALL')
              }}
            >
              <Lock size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>สื่อภายในบุคลากร</span>
              <span className="mediaTabCount">{internalCount}</span>
            </button>
          </div>
        )}

        <div className="mediaFilterRow">
          <div className="mediaSearchBox">
            <Search size={16} className="mediaSearchIcon" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อเรื่อง คำอธิบาย หรือหมวดหมู่..."
              className="mediaSearchInput"
              aria-label="ค้นหาสื่อออนไลน์"
            />
            {searchQuery && (
              <button
                type="button"
                className="mediaSearchClear"
                onClick={() => setSearchQuery('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="mediaUtilityControls">
            {/* Custom OpenDesigner Category Dropdown */}
            <div className="mediaDropdown" ref={categoryDropdownRef}>
              <button
                type="button"
                className={`mediaDropdownTrigger ${
                  selectedCategoryId !== 'ALL' ? 'isFiltered' : ''
                } ${openDropdown === 'category' ? 'isOpen' : ''}`}
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'category' ? null : 'category'))
                }
                aria-haspopup="listbox"
                aria-expanded={openDropdown === 'category'}
                aria-label="กรองตามหมวดหมู่สื่อ"
              >
                <FolderOpen size={15} className="mediaDropdownIcon" aria-hidden="true" />
                <span className="mediaDropdownLabel">{selectedCategoryLabel}</span>
                <span className="mediaDropdownTriggerCount">{selectedCategoryCount}</span>
                <ChevronDown
                  size={15}
                  className={`mediaDropdownChevron ${
                    openDropdown === 'category' ? 'open' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {openDropdown === 'category' && (
                <div
                  className="mediaDropdownPopover"
                  role="listbox"
                  aria-label="เลือกหมวดหมู่สื่อ"
                >
                  <div className="mediaDropdownHeader">หมวดหมู่สื่อ</div>
                  <div className="mediaDropdownList">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCategoryId === 'ALL'}
                      className={`mediaDropdownOption ${
                        selectedCategoryId === 'ALL' ? 'isSelected' : ''
                      }`}
                      onClick={() => {
                        setSelectedCategoryId('ALL')
                        setOpenDropdown(null)
                      }}
                    >
                      <span className="mediaDropdownOptionMain">
                        <span className="mediaDropdownOptionCheck" aria-hidden="true">
                          {selectedCategoryId === 'ALL' && (
                            <Check size={14} strokeWidth={2.25} />
                          )}
                        </span>
                        <span className="mediaDropdownOptionText">ทุกหมวดหมู่</span>
                      </span>
                      <span className="mediaDropdownOptionBadge">{scopedItems.length}</span>
                    </button>

                    {visibleCategories.length > 0 && (
                      <div className="mediaDropdownDivider" role="separator" />
                    )}

                    {visibleCategories.map((cat) => {
                      const count = categoryCounts.get(cat.id) || 0
                      const isSelected = selectedCategoryId === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`mediaDropdownOption ${isSelected ? 'isSelected' : ''}`}
                          onClick={() => {
                            setSelectedCategoryId(cat.id)
                            setOpenDropdown(null)
                          }}
                        >
                          <span className="mediaDropdownOptionMain">
                            <span className="mediaDropdownOptionCheck" aria-hidden="true">
                              {isSelected && <Check size={14} strokeWidth={2.25} />}
                            </span>
                            <span className="mediaDropdownOptionText">{cat.name}</span>
                          </span>
                          <span
                            className={`mediaDropdownOptionBadge ${
                              count === 0 ? 'isZero' : ''
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom OpenDesigner Sort Dropdown */}
            <div className="mediaDropdown" ref={sortDropdownRef}>
              <button
                type="button"
                className={`mediaDropdownTrigger ${
                  openDropdown === 'sort' ? 'isOpen' : ''
                }`}
                onClick={() => setOpenDropdown((prev) => (prev === 'sort' ? null : 'sort'))}
                aria-haspopup="listbox"
                aria-expanded={openDropdown === 'sort'}
                aria-label="เรียงลำดับรายการสื่อ"
              >
                <ArrowUpDown size={15} className="mediaDropdownIcon" aria-hidden="true" />
                <span className="mediaDropdownLabel">{currentSortLabel}</span>
                <ChevronDown
                  size={15}
                  className={`mediaDropdownChevron ${openDropdown === 'sort' ? 'open' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {openDropdown === 'sort' && (
                <div
                  className="mediaDropdownPopover mediaDropdownPopoverCompact"
                  role="listbox"
                  aria-label="เรียงลำดับรายการสื่อ"
                >
                  <div className="mediaDropdownHeader">เรียงลำดับตาม</div>
                  <div className="mediaDropdownList">
                    {sortOptions.map((opt) => {
                      const isSelected = sortBy === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`mediaDropdownOption ${isSelected ? 'isSelected' : ''}`}
                          onClick={() => {
                            setSortBy(opt.value)
                            setOpenDropdown(null)
                          }}
                        >
                          <span className="mediaDropdownOptionMain">
                            <span className="mediaDropdownOptionCheck" aria-hidden="true">
                              {isSelected && <Check size={14} strokeWidth={2.25} />}
                            </span>
                            <span className="mediaDropdownOptionText">{opt.label}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mediaViewToggle" role="group" aria-label="รูปแบบการแสดงผล">
              <button
                type="button"
                className={`mediaViewToggleBtn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="มุมมองการ์ด"
                aria-label="มุมมองการ์ด"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                className={`mediaViewToggleBtn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="มุมมองรายการ"
                aria-label="มุมมองรายการ"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mediaTypeRow">
          <div className="mediaTypePills" role="group" aria-label="กรองตามประเภทสื่อ">
            <button
              type="button"
              className={`mediaChipBtn ${selectedMediaType === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedMediaType('ALL')}
            >
              <span>ทุกประเภท</span>
              <span className="mediaChipCount">{typeCounts.ALL}</span>
            </button>
            <button
              type="button"
              className={`mediaChipBtn ${selectedMediaType === 'VIDEO' ? 'active' : ''}`}
              onClick={() => setSelectedMediaType('VIDEO')}
            >
              <PlayCircle size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>วิดีโอ</span>
              <span className="mediaChipCount">{typeCounts.VIDEO}</span>
            </button>
            <button
              type="button"
              className={`mediaChipBtn ${selectedMediaType === 'INFOGRAPHIC' ? 'active' : ''}`}
              onClick={() => setSelectedMediaType('INFOGRAPHIC')}
            >
              <ImageIcon size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>อินโฟกราฟิก</span>
              <span className="mediaChipCount">{typeCounts.INFOGRAPHIC}</span>
            </button>
            <button
              type="button"
              className={`mediaChipBtn ${selectedMediaType === 'DOCUMENT' ? 'active' : ''}`}
              onClick={() => setSelectedMediaType('DOCUMENT')}
            >
              <FileText size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>เอกสาร PDF</span>
              <span className="mediaChipCount">{typeCounts.DOCUMENT}</span>
            </button>
          </div>
        </div>

        <div className="mediaResultBar">
          <span className="mediaResultCount">
            แสดงผล <strong>{filteredItems.length.toLocaleString()}</strong> รายการ
          </span>
          {hasActiveFilters && (
            <button type="button" className="mediaResetBtn" onClick={resetAllFilters}>
              <RotateCcw size={14} aria-hidden="true" />
              <span>ล้างตัวกรองทั้งหมด</span>
            </button>
          )}
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="mediaEmptyState">
          <Film size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} aria-hidden="true" />
          <h3>ไม่พบสื่อออนไลน์ที่ตรงกับเงื่อนไข</h3>
          <p>ลองเปลี่ยนคำค้นหา หมวดหมู่ หรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p>
          {hasActiveFilters && (
            <button
              type="button"
              className="mediaActionBtn mediaActionBtnPrimary"
              style={{ marginTop: '1rem' }}
              onClick={resetAllFilters}
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>แสดงสื่อทั้งหมด</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="mediaGrid">
          {filteredItems.map((item) => {
            const thumbSrc =
              item.thumbnailUrl ||
              (item.mediaType === 'INFOGRAPHIC' ? item.streamUrl : null) ||
              (item.sourceType === 'YOUTUBE' ? getYoutubeThumbUrl(item.youtubeUrl) : null)
            const sizeLabel = formatCompactBytes(item.fileSize)

            return (
              <Link
                key={item.id}
                href={`/media/${encodeURIComponent(item.slug)}`}
                className="mediaCard"
              >
                <div className="mediaCardThumb">
                  {thumbSrc ? (
                    <img src={thumbSrc} alt={item.title} loading="lazy" />
                  ) : (
                    <div
                      className={`mediaThumbPlaceholder ${
                        item.mediaType === 'INFOGRAPHIC'
                          ? 'typeInfographic'
                          : item.mediaType === 'DOCUMENT'
                          ? 'typeDocument'
                          : ''
                      }`}
                    >
                      {item.mediaType === 'VIDEO' ? (
                        <PlayCircle size={42} strokeWidth={1.5} aria-hidden="true" />
                      ) : item.mediaType === 'INFOGRAPHIC' ? (
                        <ImageIcon size={42} strokeWidth={1.5} aria-hidden="true" />
                      ) : (
                        <FileText size={42} strokeWidth={1.5} aria-hidden="true" />
                      )}
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {getMediaTypeLabel(item)}
                      </span>
                    </div>
                  )}

                  {item.mediaType === 'VIDEO' && thumbSrc && (
                    <div className="mediaCardPlayCenter" aria-hidden="true">
                      <Play size={20} fill="currentColor" />
                    </div>
                  )}

                  <div className="mediaCardBadges">
                    <span
                      className={`mediaBadgePill ${
                        item.visibility === 'INTERNAL' ? 'badgeInternal' : 'badgePublic'
                      }`}
                    >
                      {item.visibility === 'INTERNAL' ? (
                        <>
                          <Lock size={12} aria-hidden="true" />
                          <span>เฉพาะบุคลากร</span>
                        </>
                      ) : (
                        <>
                          <Globe size={12} aria-hidden="true" />
                          <span>สาธารณะ</span>
                        </>
                      )}
                    </span>

                    <span className="mediaBadgePill badgeType">
                      {item.sourceType === 'YOUTUBE' && <Video size={12} aria-hidden="true" />}
                      <span>{getMediaTypeLabel(item)}</span>
                    </span>
                  </div>
                </div>

                <div className="mediaCardBody">
                  <div className="mediaCardTopMeta">
                    {item.categoryName && (
                      <span className="mediaCardCategory">{item.categoryName}</span>
                    )}
                    {sizeLabel && <span className="mediaSizeTag">{sizeLabel}</span>}
                  </div>
                  <h2 className="mediaCardTitle">{item.title}</h2>
                  {item.description && (
                    <p className="mediaCardDesc">{item.description}</p>
                  )}

                  <div className="mediaCardFooter">
                    <span className="mediaCardMetaItem">
                      {formatThaiDate(item.createdAt)}
                    </span>
                    <div className="mediaCardStats">
                      {item.attachments.length > 0 && (
                        <span className="mediaCardMetaItem" title="ไฟล์เอกสารประกอบ">
                          <Paperclip size={13} aria-hidden="true" />
                          <span>{item.attachments.length}</span>
                        </span>
                      )}
                      <span className="mediaCardMetaItem">
                        <Eye size={13} aria-hidden="true" />
                        <span>{item.viewCount.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="mediaListContainer">
          {filteredItems.map((item) => {
            const thumbSrc =
              item.thumbnailUrl ||
              (item.mediaType === 'INFOGRAPHIC' ? item.streamUrl : null) ||
              (item.sourceType === 'YOUTUBE' ? getYoutubeThumbUrl(item.youtubeUrl) : null)
            const sizeLabel = formatCompactBytes(item.fileSize)

            return (
              <Link
                key={item.id}
                href={`/media/${encodeURIComponent(item.slug)}`}
                className="mediaListRow"
              >
                <div className="mediaListThumb">
                  {thumbSrc ? (
                    <img src={thumbSrc} alt="" loading="lazy" />
                  ) : item.mediaType === 'VIDEO' ? (
                    <PlayCircle size={24} strokeWidth={1.5} />
                  ) : item.mediaType === 'INFOGRAPHIC' ? (
                    <ImageIcon size={24} strokeWidth={1.5} />
                  ) : (
                    <FileText size={24} strokeWidth={1.5} />
                  )}
                </div>

                <div className="mediaListMain">
                  <div className="mediaListBadges">
                    <span
                      className={`mediaDetailPill ${
                        item.visibility === 'INTERNAL'
                          ? 'mediaDetailPillInternal'
                          : 'mediaDetailPillPublic'
                      }`}
                    >
                      {item.visibility === 'INTERNAL' ? (
                        <>
                          <Lock size={12} aria-hidden="true" />
                          <span>เฉพาะบุคลากร</span>
                        </>
                      ) : (
                        <>
                          <Globe size={12} aria-hidden="true" />
                          <span>สาธารณะ</span>
                        </>
                      )}
                    </span>
                    <span className="mediaDetailPill mediaDetailPillCategory">
                      {getMediaTypeLabel(item)}
                    </span>
                    {item.categoryName && (
                      <span className="mediaListCategoryText">{item.categoryName}</span>
                    )}
                  </div>
                  <h2 className="mediaListTitle">{item.title}</h2>
                  {item.description && (
                    <p className="mediaListDesc">{item.description}</p>
                  )}
                </div>

                <div className="mediaListMeta">
                  {sizeLabel && <span className="mediaSizeTag">{sizeLabel}</span>}
                  {item.attachments.length > 0 && (
                    <span className="mediaCardMetaItem" title="ไฟล์เอกสารประกอบ">
                      <Paperclip size={13} aria-hidden="true" />
                      <span>{item.attachments.length} แนบ</span>
                    </span>
                  )}
                  <span className="mediaCardMetaItem">
                    <Eye size={14} aria-hidden="true" />
                    <span>{item.viewCount.toLocaleString()}</span>
                  </span>
                  <span className="mediaCardMetaItem">{formatThaiDate(item.createdAt)}</span>
                  <ChevronRight size={18} className="mediaListArrow" aria-hidden="true" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
