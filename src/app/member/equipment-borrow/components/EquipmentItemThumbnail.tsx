'use client'

import React, { useState, useEffect } from 'react'
import { HeartPulse, Monitor, Package, Zap, ZoomIn } from 'lucide-react'

function getCategoryIcon(category?: string, size = 20) {
  switch (category) {
    case 'IT':
      return <Monitor size={size} strokeWidth={1.5} aria-hidden="true" />
    case 'MEDICAL':
      return <HeartPulse size={size} strokeWidth={1.5} aria-hidden="true" />
    case 'ELECTRICAL':
      return <Zap size={size} strokeWidth={1.5} aria-hidden="true" />
    default:
      return <Package size={size} strokeWidth={1.5} aria-hidden="true" />
  }
}

export function EquipmentItemThumbnail({
  imageUrl,
  name,
  category,
  variant = 'thumb',
  onClick,
  ariaLabel,
}: {
  imageUrl?: string | null
  name: string
  category?: string
  variant?: 'thumb' | 'thumb-sm' | 'card' | 'preview'
  onClick?: () => void
  ariaLabel?: string
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [imageUrl])

  const showImage = Boolean(imageUrl && !hasError)

  if (variant === 'card') {
    const content = showImage ? (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl!}
          alt={`ภาพประกอบ ${name}`}
          className="catalogMediaImg"
          loading="lazy"
          onError={() => setHasError(true)}
        />
        <span className="catalogMediaZoomHint" aria-hidden="true">
          <ZoomIn size={14} strokeWidth={1.5} />
          ดูภาพขยาย
        </span>
      </>
    ) : (
      <div className="catalogMediaPlaceholder">
        <div className="catalogMediaPlaceholderIcon">{getCategoryIcon(category, 28)}</div>
        <span className="catalogMediaPlaceholderText">ยังไม่มีรูปภาพตัวอย่าง</span>
      </div>
    )

    if (onClick) {
      return (
        <button
          type="button"
          className={`catalogMediaFrame ${showImage ? 'catalogMediaInteractive' : 'catalogMediaStaticBtn'}`}
          onClick={onClick}
          aria-label={ariaLabel || `ดูรายละเอียดรูปภาพ ${name}`}
        >
          {content}
        </button>
      )
    }

    return <div className="catalogMediaFrame">{content}</div>
  }

  if (variant === 'preview') {
    return (
      <div className="lightboxMediaFrame">
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl!}
            alt={`ภาพขยาย ${name}`}
            className="lightboxMediaImg"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="catalogMediaPlaceholder">
            <div className="catalogMediaPlaceholderIcon">{getCategoryIcon(category, 40)}</div>
            <span className="catalogMediaPlaceholderText">ยังไม่ได้แนบรูปภาพสำหรับรายการนี้</span>
          </div>
        )}
      </div>
    )
  }

  const sizeClass = variant === 'thumb-sm' ? 'itemThumbBox itemThumbSm' : 'itemThumbBox'

  const inner = showImage ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={imageUrl!}
      alt={name}
      className="itemThumbImg"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  ) : (
    <span className="itemThumbFallback">{getCategoryIcon(category, variant === 'thumb-sm' ? 16 : 18)}</span>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`${sizeClass} itemThumbButton`}
        onClick={onClick}
        title={showImage ? `ดูรูปภาพ ${name}` : `แนบ/แก้ไขรูปภาพ ${name}`}
        aria-label={ariaLabel || `ดูหรือแก้ไขรูปภาพ ${name}`}
      >
        {inner}
      </button>
    )
  }

  return <div className={sizeClass}>{inner}</div>
}
