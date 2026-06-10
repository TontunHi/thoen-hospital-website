'use client'

import { useState } from 'react'
import Image from 'next/image'
import './ImageGallery.css'

interface ImageGalleryProps {
  images: Array<{
    id: number
    imageUrl: string
  }>
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  if (!images || images.length === 0) return null

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setActiveIndex((prev) => (prev + 1) % images.length)
  }

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  // Touch Swipe Support for main slide gallery
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe) {
      setActiveIndex((prev) => (prev + 1) % images.length)
    } else if (isRightSwipe) {
      setActiveIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  return (
    <div className="imageGallery">
      {/* Main Image View */}
      <div 
        className="galleryMain" 
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={images[activeIndex].imageUrl}
          alt={`ภาพประกอบที่ ${activeIndex + 1}`}
          fill
          style={{ objectFit: 'contain', pointerEvents: 'none' }}
          priority
          sizes="(max-width: 1200px) 100vw, 800px"
        />

        {/* Carousel controls if more than 1 image */}
        {images.length > 1 && (
          <>
            <button className="galleryNavBtn prevBtn" onClick={handlePrev} title="รูปภาพก่อนหน้า">
              ‹
            </button>
            <button className="galleryNavBtn nextBtn" onClick={handleNext} title="รูปภาพถัดไป">
              ›
            </button>
            <div className="galleryCounter">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails preview if more than 1 image */}
      {images.length > 1 && (
        <div className="galleryThumbs">
          {images.map((img, idx) => (
            <button
              key={img.id}
              className={`thumbCard ${idx === activeIndex ? 'thumbActive' : ''}`}
              onClick={() => setActiveIndex(idx)}
            >
              <Image
                src={img.imageUrl}
                alt={`Thumbnail ${idx + 1}`}
                width={80}
                height={60}
                style={{ objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
