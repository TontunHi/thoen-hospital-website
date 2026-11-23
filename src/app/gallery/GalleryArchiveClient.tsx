'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Calendar, Images } from 'lucide-react'
import PhotoAlbumLightbox from '@/components/gallery/PhotoAlbumLightbox'
import { formatThaiMonthYear } from '@/lib/cms/albumFormatters'
import type { AlbumMonthOption, AlbumPagination, PhotoAlbumItem } from '@/types/album'

const THAI_MONTH_NAMES_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

interface GalleryArchiveClientProps {
  albums: PhotoAlbumItem[]
  availableMonths: AlbumMonthOption[]
  pagination: AlbumPagination
  selectedYear: number | null
  selectedMonth: number | null
  initialSearch: string
  initialOpenAlbum: PhotoAlbumItem | null
}

export default function GalleryArchiveClient({
  albums,
  availableMonths,
  pagination,
  selectedYear,
  selectedMonth,
  initialSearch,
  initialOpenAlbum,
}: GalleryArchiveClientProps) {
  const router = useRouter()
  const [searchText, setSearchText] = useState(initialSearch)
  const [lightboxState, setLightboxState] = useState<{
    album: PhotoAlbumItem | null
    index: number
  }>({
    album: initialOpenAlbum,
    index: 0,
  })

  const availableYears = useMemo(() => {
    return Array.from(new Set(availableMonths.map((m) => m.year))).sort((a, b) => b - a)
  }, [availableMonths])

  const monthsForYear = useMemo(() => {
    const filtered = selectedYear
      ? availableMonths.filter((m) => m.year === selectedYear)
      : availableMonths
    return [...filtered].sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))
  }, [availableMonths, selectedYear])

  const navigateWithParams = (next: {
    year?: number | null
    month?: number | null
    search?: string
    page?: number
  }) => {
    const params = new URLSearchParams()
    const y = next.year !== undefined ? next.year : selectedYear
    const m = next.month !== undefined ? next.month : selectedMonth
    const s = next.search !== undefined ? next.search : searchText.trim()
    const p = next.page ?? 1

    if (y && m) {
      params.set('month', `${y}-${String(m).padStart(2, '0')}`)
    } else if (y) {
      params.set('year', String(y))
    }
    if (s) params.set('search', s)
    if (p > 1) params.set('page', String(p))

    const qs = params.toString()
    router.push(qs ? `/gallery?${qs}` : '/gallery')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigateWithParams({ search: searchText.trim(), page: 1 })
  }

  const handleYearChange = (val: string) => {
    if (!val) {
      navigateWithParams({ year: null, month: null, page: 1 })
      return
    }
    const y = parseInt(val, 10)
    navigateWithParams({ year: y, month: null, page: 1 })
  }

  const handleMonthChange = (val: string) => {
    if (!val) {
      navigateWithParams({ month: null, page: 1 })
      return
    }
    const [yStr, mStr] = val.split('-')
    if (yStr && mStr) {
      navigateWithParams({ year: parseInt(yStr, 10), month: parseInt(mStr, 10), page: 1 })
    }
  }

  const handleReset = () => {
    setSearchText('')
    router.push('/gallery')
  }

  const hasFilters = Boolean(selectedYear || selectedMonth || initialSearch)
  const selectedMonthSelectVal =
    selectedYear && selectedMonth
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      : ''

  // Filter individual photos if user typed a search term that matches captions
  const qLower = initialSearch.toLowerCase().trim()

  return (
    <div>
      {/* Compact Year + Month Filter Bar (OpenDesigner Note N-01) */}
      <div className="galleryFilterBar">
        <div className="galleryMonthSelectWrap">
          <label htmlFor="gallery-year-select" className="galleryMonthLabel">
            ปี พ.ศ.:
          </label>
          <select
            id="gallery-year-select"
            className="galleryMonthSelect galleryYearSelect"
            value={selectedYear ? String(selectedYear) : ''}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">ทุกปี พ.ศ.</option>
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>
                {y > 2400 ? y : y + 543}
              </option>
            ))}
          </select>
        </div>

        <div className="galleryMonthSelectWrap">
          <label htmlFor="gallery-month-select" className="galleryMonthLabel">
            เดือน:
          </label>
          <select
            id="gallery-month-select"
            className="galleryMonthSelect"
            value={selectedMonthSelectVal}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            <option value="">ทุกเดือน</option>
            {monthsForYear.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {selectedYear
                  ? THAI_MONTH_NAMES_FULL[opt.month - 1]
                  : opt.label}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="gallerySearchForm">
          <div className="gallerySearchInputWrap">
            <Search size={16} className="gallerySearchIcon" aria-hidden="true" />
            <input
              type="search"
              className="gallerySearchInput"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ค้นหากิจกรรมหรือคำบรรยาย..."
              aria-label="ค้นหาภาพข่าว"
            />
          </div>
          <button type="submit" className="galleryFilterBtn touch-target">
            ค้นหา
          </button>
        </form>

        {hasFilters && (
          <button type="button" className="galleryResetBtn touch-target" onClick={handleReset}>
            <X size={15} aria-hidden="true" />
            <span>ล้างตัวกรอง</span>
          </button>
        )}
      </div>

      {/* Monthly Photo Sections */}
      {albums.length > 0 ? (
        <div className="galleryMonthlySections">
          {albums.map((album) => {
            const albumYear = parseInt(album.eventDate.slice(0, 4), 10) || new Date().getFullYear()
            const albumMonth = parseInt(album.eventDate.slice(5, 7), 10) || 1
            const monthYearText = formatThaiMonthYear(albumYear, albumMonth)
            const allImages = album.images || []
            const isSingleMonthFocused = Boolean(selectedMonth) || albums.length === 1
            const visibleImages = isSingleMonthFocused ? allImages : allImages.slice(0, 6)
            const hiddenCount = Math.max(0, allImages.length - visibleImages.length)

            return (
              <section key={album.id} className="galleryMonthSection">
                <div className="galleryMonthSectionHeader">
                  <div>
                    <h2 className="galleryMonthSectionTitle">
                      <Calendar size={20} aria-hidden="true" />
                      <span>ประจำเดือน{monthYearText}</span>
                    </h2>
                    {album.description && (
                      <p className="galleryMonthSectionDesc">{album.description}</p>
                    )}
                  </div>
                  <div className="galleryMonthSectionMeta">
                    <span className="galleryCountPill">
                      <Images size={15} aria-hidden="true" />
                      <span>ทั้งหมด {allImages.length} ภาพ</span>
                    </span>
                    {!isSingleMonthFocused && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="galleryViewMonthBtn touch-target"
                        onClick={() =>
                          navigateWithParams({ year: albumYear, month: albumMonth, page: 1 })
                        }
                      >
                        ดูครบทั้ง {allImages.length} ภาพ
                      </button>
                    )}
                  </div>
                </div>

                <div className="galleryPhotoGrid">
                  {visibleImages.map((img, idx) => {
                    const matchesHighlight =
                      qLower && img.caption?.toLowerCase().includes(qLower)
                    return (
                      <button
                        key={`${img.id}-${idx}`}
                        type="button"
                        className={`galleryPhotoCard touch-target ${
                          matchesHighlight ? 'highlighted' : ''
                        }`}
                        onClick={() => setLightboxState({ album, index: idx })}
                        aria-label={
                          img.caption
                            ? `เปิดดูภาพ: ${img.caption}`
                            : `เปิดดูภาพที่ ${idx + 1} ประจำเดือน${monthYearText}`
                        }
                      >
                        <div className="galleryPhotoCardImgWrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.imageUrl}
                            alt={img.caption || `${album.title} - ภาพที่ ${idx + 1}`}
                            className="galleryPhotoCardImg"
                            loading="lazy"
                          />
                        </div>
                        {img.caption && (
                          <div className="galleryPhotoCardCaption">{img.caption}</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="galleryEmptyBox">
          <p>
            {hasFilters
              ? 'ไม่พบภาพข่าวในเดือน/ปี หรือคำค้นหาที่เลือก'
              : 'ยังไม่มีภาพข่าวและกิจกรรมในระบบ'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <nav className="galleryPagination" aria-label="แบ่งหน้าคลังภาพรายเดือน">
          <button
            type="button"
            className="galleryPageBtn"
            disabled={pagination.page <= 1}
            onClick={() => navigateWithParams({ page: pagination.page - 1 })}
          >
            ก่อนหน้า
          </button>

          {Array.from({ length: pagination.totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={`galleryPageBtn ${pageNum === pagination.page ? 'active' : ''}`}
              aria-current={pageNum === pagination.page ? 'page' : undefined}
              onClick={() => navigateWithParams({ page: pageNum })}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            className="galleryPageBtn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => navigateWithParams({ page: pagination.page + 1 })}
          >
            ถัดไป
          </button>
        </nav>
      )}

      {lightboxState.album && (
        <PhotoAlbumLightbox
          album={lightboxState.album}
          initialIndex={lightboxState.index}
          onClose={() => setLightboxState({ album: null, index: 0 })}
        />
      )}
    </div>
  )
}
