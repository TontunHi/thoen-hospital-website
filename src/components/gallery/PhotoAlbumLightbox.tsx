'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Download, Share2, Check } from 'lucide-react'
import { formatThaiDate } from '@/lib/formatters'
import type { PhotoAlbumItem } from '@/types/album'
import './PhotoAlbumLightbox.css'

interface PhotoAlbumLightboxProps {
  album: PhotoAlbumItem
  initialIndex?: number
  onClose: () => void
}

export default function PhotoAlbumLightbox({
  album,
  initialIndex = 0,
  onClose,
}: PhotoAlbumLightboxProps) {
  const images = album.images && album.images.length > 0
    ? album.images
    : album.coverImageUrl
      ? [{ id: 0, albumId: album.id, imageUrl: album.coverImageUrl, caption: null, displayOrder: 0 }]
      : []

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1))
  )
  const [copied, setCopied] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([])
  const viewedAlbumRef = useRef<number | null>(null)

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const handleNext = useCallback(() => {
    if (images.length <= 1) return
    setActiveIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  // Record view once per opened album
  useEffect(() => {
    if (viewedAlbumRef.current === album.id) return
    viewedAlbumRef.current = album.id
    fetch(`/api/albums/${album.id}/view`, { method: 'POST' }).catch(() => {})
  }, [album.id])

  // Lock body scroll & bind keyboard navigation
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [handleNext, handlePrev, onClose])

  // Keep active thumbnail visible in strip
  useEffect(() => {
    const activeThumb = thumbRefs.current[activeIndex]
    if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeIndex])

  const handleCopyShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/gallery?album=${encodeURIComponent(album.slug)}`
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for restricted clipboard contexts
    }
  }

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null)
    setTouchStartX(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return
    const delta = touchStartX - touchEndX
    if (delta > 50) handleNext()
    else if (delta < -50) handlePrev()
  }

  if (images.length === 0) return null

  const currentImage = images[activeIndex] || images[0]
  const captionText = currentImage.caption || album.description

  return (
    <div
      className="albumLightboxBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`ภาพข่าว: ${album.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top Bar */}
      <header className="albumLightboxHeader">
        <div className="albumLightboxTitleGroup">
          <h2 className="albumLightboxTitle">{album.title}</h2>
          <div className="albumLightboxMeta">
            <span>{formatThaiDate(album.eventDate)}</span>
            <span>•</span>
            <span className="albumLightboxCounter">
              ภาพที่ {activeIndex + 1} / {images.length}
            </span>
          </div>
        </div>

        <div className="albumLightboxActions">
          <button
            type="button"
            className={`albumLightboxActionBtn ${copied ? 'copied' : ''}`}
            onClick={handleCopyShareLink}
            title="คัดลอกลิงก์แชร์อัลบั้มภาพนี้"
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span className="albumLightboxActionLabel">
              {copied ? 'คัดลอกลิงก์แล้ว' : 'แชร์อัลบั้ม'}
            </span>
          </button>

          <a
            href={currentImage.imageUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="albumLightboxActionBtn"
            title="ดาวน์โหลดภาพนี้"
          >
            <Download size={16} />
            <span className="albumLightboxActionLabel">ดาวน์โหลดภาพ</span>
          </a>

          <button
            type="button"
            className="albumLightboxCloseBtn"
            onClick={onClose}
            aria-label="ปิดหน้าต่างดูภาพ"
            title="ปิด (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <div
        className="albumLightboxStage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {images.length > 1 && (
          <button
            type="button"
            className="albumLightboxNavBtn prev"
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            aria-label="ภาพก่อนหน้า"
            title="ภาพก่อนหน้า (ลูกศรซ้าย)"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div className="albumLightboxImageWrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage.imageUrl}
            alt={currentImage.caption || `${album.title} - ภาพที่ ${activeIndex + 1}`}
            className="albumLightboxImg"
          />
        </div>

        {images.length > 1 && (
          <button
            type="button"
            className="albumLightboxNavBtn next"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            aria-label="ภาพถัดไป"
            title="ภาพถัดไป (ลูกศรขวา)"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Caption / Description (if present) */}
      {captionText && (
        <div className="albumLightboxCaptionBar">
          {captionText}
        </div>
      )}

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div className="albumLightboxThumbs" role="tablist" aria-label="เลือกดูรูปภาพในอัลบั้ม">
          {images.map((img, idx) => (
            <button
              key={`${img.id}-${idx}`}
              ref={(el) => {
                thumbRefs.current[idx] = el
              }}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`ภาพที่ ${idx + 1}`}
              className={`albumLightboxThumbBtn ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(idx)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={`ตัวอย่างภาพที่ ${idx + 1}`}
                className="albumLightboxThumbImg"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
