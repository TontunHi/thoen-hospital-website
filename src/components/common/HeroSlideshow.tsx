'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import './HeroSlideshow.css'

interface Slide {
  id: number
  imagePath: string
  title: string | null
  linkUrl: string | null
}

interface HeroSlideshowProps {
  slides: Slide[]
}

export default function HeroSlideshow({ slides }: HeroSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check prefers-reduced-motion (A4)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    if (mediaQuery.matches) {
      setIsPlaying(false)
    }

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
      if (e.matches) setIsPlaying(false)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Autoplay management (A5)
  useEffect(() => {
    if (slides.length <= 1 || !isPlaying || isHovered || prefersReducedMotion) return

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length)
    }, 5500)

    return () => clearInterval(timer)
  }, [slides.length, isPlaying, isHovered, prefersReducedMotion])

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length)
  }

  const selectSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const togglePlay = () => {
    setIsPlaying((prev) => !prev)
  }

  // Fallback: If no scheduled slides exist, show default banner
  if (slides.length === 0) {
    return (
      <div className="hero__bg">
        <Image
          src="/images/home/main-banner.webp"
          alt="โรงพยาบาลเถิน จังหวัดลำปาง"
          fill
          priority
          style={{ objectFit: 'cover' }}
          sizes="100vw"
        />
      </div>
    )
  }

  return (
    <div
      className="heroSlideshow"
      role="region"
      aria-roledescription="carousel"
      aria-label="ภาพกิจกรรมและประชาสัมพันธ์โรงพยาบาลเถิน"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <div aria-live={isPlaying ? 'off' : 'polite'} className="slideshowContainer">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex
          const isExternal = slide.linkUrl?.startsWith('http://') || slide.linkUrl?.startsWith('https://')

          const SlideInner = (
            <div
              className={`slideshowItem ${isActive ? 'active' : ''}`}
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`สไลด์ ${index + 1} จาก ${slides.length}: ${slide.title || 'ประชาสัมพันธ์โรงพยาบาลเถิน'}`}
              aria-hidden={!isActive}
            >
              <Image
                src={slide.imagePath}
                alt={slide.title || 'โรงพยาบาลเถิน จังหวัดลำปาง'}
                fill
                priority={index === 0}
                style={{ objectFit: 'cover' }}
                sizes="100vw"
              />
              {slide.title && (
                <div className="slideTitleOverlay container">
                  <div className="slideTitleCard">
                    <h2>{slide.title}</h2>
                  </div>
                </div>
              )}
            </div>
          )

          if (slide.linkUrl) {
            return isExternal ? (
              <a
                key={slide.id}
                href={slide.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="slideLinkWrapper"
                title={`${slide.title || 'เปิดลิงก์'} (เปิดในแท็บใหม่)`}
                tabIndex={isActive ? 0 : -1}
              >
                {SlideInner}
              </a>
            ) : (
              <Link
                key={slide.id}
                href={slide.linkUrl}
                className="slideLinkWrapper"
                title={slide.title || 'ดูรายละเอียด'}
                tabIndex={isActive ? 0 : -1}
              >
                {SlideInner}
              </Link>
            )
          }

          return SlideInner
        })}
      </div>

      {/* Navigation Arrows & Play/Pause Controls */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            className="navBtn prev touch-target"
            aria-label="สไลด์ก่อนหน้า"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            onClick={nextSlide}
            className="navBtn next touch-target"
            aria-label="สไลด์ถัดไป"
          >
            <ChevronRight size={20} />
          </button>

          <div className="heroBottomControls">
            <button
              type="button"
              onClick={togglePlay}
              className="playPauseBtn touch-target"
              aria-label={isPlaying ? 'หยุดเล่นสไลด์อัตโนมัติ' : 'เล่นสไลด์อัตโนมัติ'}
              title={isPlaying ? 'หยุดเล่นสไลด์อัตโนมัติ' : 'เล่นสไลด์อัตโนมัติ'}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>

            <div className="indicatorDots" role="tablist" aria-label="เลือกสไลด์">
              {slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === currentIndex}
                  className={`dot ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => selectSlide(index)}
                  aria-label={`ไปยังสไลด์ที่ ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
