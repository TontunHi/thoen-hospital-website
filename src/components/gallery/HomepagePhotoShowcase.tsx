'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Images, Loader2, ChevronRight } from 'lucide-react'
import PhotoAlbumLightbox from './PhotoAlbumLightbox'
import type { AlbumMonthOption, PhotoAlbumItem } from '@/types/album'
import './HomepagePhotoShowcase.css'

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

interface HomepagePhotoShowcaseProps {
  initialAlbum: PhotoAlbumItem | null
  availableMonths: AlbumMonthOption[]
}

export default function HomepagePhotoShowcase({
  initialAlbum,
  availableMonths,
}: HomepagePhotoShowcaseProps) {
  const initialDateParts = useMemo(() => {
    if (initialAlbum?.eventDate && /^\d{4}-\d{2}/.test(initialAlbum.eventDate)) {
      return {
        year: parseInt(initialAlbum.eventDate.slice(0, 4), 10),
        month: parseInt(initialAlbum.eventDate.slice(5, 7), 10),
      }
    }
    if (availableMonths.length > 0) {
      return { year: availableMonths[0].year, month: availableMonths[0].month }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }, [availableMonths, initialAlbum])

  const [selectedYear, setSelectedYear] = useState<number>(initialDateParts.year)
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDateParts.month)
  const [currentAlbum, setCurrentAlbum] = useState<PhotoAlbumItem | null>(initialAlbum)
  const [loading, setLoading] = useState(false)
  const [lightboxState, setLightboxState] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  })

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(availableMonths.map((m) => m.year)))
    return years.sort((a, b) => b - a)
  }, [availableMonths])

  const monthsForSelectedYear = useMemo(() => {
    return availableMonths
      .filter((m) => m.year === selectedYear)
      .sort((a, b) => b.month - a.month)
  }, [availableMonths, selectedYear])

  const fetchMonthAlbum = async (year: number, month: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/albums?year=${year}&month=${month}&limit=1`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCurrentAlbum(data.albums?.[0] || null)
      }
    } catch {
      // Keep existing album visible on transient error
    } finally {
      setLoading(false)
    }
  }

  const handleYearChange = (nextYear: number) => {
    setSelectedYear(nextYear)
    const monthsInYear = availableMonths
      .filter((m) => m.year === nextYear)
      .sort((a, b) => b.month - a.month)
    const nextMonth = monthsInYear[0]?.month ?? selectedMonth
    setSelectedMonth(nextMonth)
    fetchMonthAlbum(nextYear, nextMonth)
  }

  const handleMonthChange = (nextMonth: number) => {
    setSelectedMonth(nextMonth)
    fetchMonthAlbum(selectedYear, nextMonth)
  }

  const totalImages = currentAlbum?.images?.length || 0
  const previewImages = (currentAlbum?.images || []).slice(0, 3)
  const remainingCount = Math.max(0, totalImages - 3)
  const monthLabel = THAI_MONTH_NAMES_FULL[selectedMonth - 1] || ''
  const beYear = selectedYear > 2400 ? selectedYear : selectedYear + 543
  const selectedMonthParam = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  return (
    <div>
      {/* Header + Year/Month Selectors */}
      <div className="homepageShowcaseHeader">
        <div className="homepageShowcaseHeading">
          <h2>ภาพข่าวและกิจกรรม</h2>
          <p className="homepageShowcaseSub">
            {currentAlbum
              ? `ประจำเดือน${monthLabel} ${beYear} • ทั้งหมด ${totalImages} ภาพ`
              : 'ประมวลภาพกิจกรรม การอบรม และภารกิจดูแลสุขภาพชุมชนของโรงพยาบาลเถิน'}
          </p>
        </div>

        {availableMonths.length > 0 && (
          <div className="homepageShowcaseFilters" aria-label="เลือกดูภาพข่าวย้อนหลังตามเดือนและปี">
            <div className="homepageShowcaseFilterGroup">
              <label htmlFor="home-gallery-month" className="homepageShowcaseFilterLabel">
                เดือน:
              </label>
              <select
                id="home-gallery-month"
                className="homepageShowcaseSelect"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
              >
                {monthsForSelectedYear.map((m) => (
                  <option key={m.value} value={m.month}>
                    {THAI_MONTH_NAMES_FULL[m.month - 1]}
                  </option>
                ))}
              </select>
            </div>

            <div className="homepageShowcaseFilterGroup">
              <label htmlFor="home-gallery-year" className="homepageShowcaseFilterLabel">
                ปี พ.ศ.:
              </label>
              <select
                id="home-gallery-year"
                className="homepageShowcaseSelect"
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y > 2400 ? y : y + 543}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3-Photo Sample Grid */}
      {loading ? (
        <div className="homepageShowcaseLoading">
          <Loader2 size={24} className="homepageShowcaseSpinner" />
          <span>กำลังโหลดภาพข่าวประจำเดือน{monthLabel} {beYear}...</span>
        </div>
      ) : previewImages.length > 0 && currentAlbum ? (
        <>
          <div className="homepageShowcaseGrid">
            {previewImages.map((img, idx) => {
              const showMoreBadge = idx === previewImages.length - 1 && remainingCount > 0
              return (
                <button
                  key={`${img.id}-${idx}`}
                  type="button"
                  className="homepageShowcaseCard touch-target"
                  onClick={() => setLightboxState({ open: true, index: idx })}
                  aria-label={
                    img.caption
                      ? `เปิดดูภาพ: ${img.caption}`
                      : `เปิดดูภาพข่าวที่ ${idx + 1} ประจำเดือน${monthLabel} ${beYear}`
                  }
                >
                  <div className="homepageShowcaseThumbWrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt={img.caption || `ภาพข่าวโรงพยาบาลเถิน เดือน${monthLabel} ${beYear} ภาพที่ ${idx + 1}`}
                      className="homepageShowcaseThumbImg"
                      loading="lazy"
                    />
                    {showMoreBadge && (
                      <div className="homepageShowcaseMoreOverlay">
                        <span>+อีก {remainingCount} ภาพ</span>
                      </div>
                    )}
                  </div>
                  {img.caption && (
                    <div className="homepageShowcaseCaption">{img.caption}</div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="homepageShowcaseActions">
            {remainingCount > 0 && (
              <button
                type="button"
                className="homepageShowcaseMoreBtn touch-target"
                onClick={() => setLightboxState({ open: true, index: 3 })}
              >
                <Images size={18} />
                <span>ดูภาพเพิ่มเติมในเดือนนี้ (ทั้งหมด {totalImages} ภาพ)</span>
              </button>
            )}
            <Link
              href={`/gallery?month=${selectedMonthParam}`}
              className="btn btn-outline touch-target"
            >
              <span>ดูคลังภาพย้อนหลังทั้งหมด</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </>
      ) : (
        <div className="homepageShowcaseEmpty">
          <p>ยังไม่มีภาพข่าวและกิจกรรมในเดือนนี้</p>
        </div>
      )}

      {lightboxState.open && currentAlbum && (
        <PhotoAlbumLightbox
          album={currentAlbum}
          initialIndex={lightboxState.index}
          onClose={() => setLightboxState({ open: false, index: 0 })}
        />
      )}
    </div>
  )
}
