'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react'
import './HeroSlideshow.css'

interface Slide {
  id: number
  imagePath: string
  title: string | null
  linkUrl: string | null
}

interface HeroSlideshowProps {
  slides: Slide[]
  slideDuration?: number
}

function SlideVideo({
  src,
  title,
  isActive,
  isPlaying,
  isMuted,
  onEnded,
}: {
  src: string
  title?: string | null
  isActive: boolean
  isPlaying: boolean
  isMuted: boolean
  onEnded: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isActive) {
      video.currentTime = 0
      if (isPlaying) {
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [isActive, isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted={isMuted}
      playsInline
      preload="auto"
      onEnded={onEnded}
      className="slideshowVideo"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      aria-label={title || 'วิดีโอประชาสัมพันธ์โรงพยาบาลเถิน'}
    />
  )
}

export default function HeroSlideshow({ slides, slideDuration = 6 }: HeroSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
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

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
  }, [slides.length])

  const selectSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const togglePlay = () => {
    setIsPlaying((prev) => !prev)
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMuted((prev) => !prev)
  }

  const currentSlide = slides[currentIndex]
  const currentIsVideo = Boolean(
    currentSlide?.imagePath?.toLowerCase().includes('.mp4') ||
    currentSlide?.imagePath?.toLowerCase().endsWith('.mp4')
  )
  const hasAnyVideo = slides.some((s) => s.imagePath?.toLowerCase().includes('.mp4'))

  const effectiveDuration = Math.max(2, Math.min(30, slideDuration || 6))

  // Autoplay timer for static image slides
  useEffect(() => {
    if (slides.length <= 1 || !isPlaying || isHovered || prefersReducedMotion || currentIsVideo) {
      return
    }

    const timer = setInterval(() => {
      nextSlide()
    }, effectiveDuration * 1000)

    return () => clearInterval(timer)
  }, [slides.length, isPlaying, isHovered, prefersReducedMotion, currentIsVideo, nextSlide, effectiveDuration])

  // Handle video completion: when the video finishes, advance to the next slide
  const handleVideoEnded = useCallback(() => {
    if (slides.length > 1 && isPlaying && !isHovered) {
      nextSlide()
    }
  }, [slides.length, isPlaying, isHovered, nextSlide])

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
          const isVideo = slide.imagePath?.toLowerCase().includes('.mp4') || slide.imagePath?.toLowerCase().endsWith('.mp4')
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
              {isVideo ? (
                <SlideVideo
                  src={slide.imagePath}
                  title={slide.title}
                  isActive={isActive}
                  isPlaying={isPlaying}
                  isMuted={isMuted}
                  onEnded={handleVideoEnded}
                />
              ) : (
                <Image
                  src={slide.imagePath}
                  alt={slide.title || 'โรงพยาบาลเถิน จังหวัดลำปาง'}
                  fill
                  priority={index === 0}
                  style={{ objectFit: 'cover' }}
                  sizes="100vw"
                />
              )}
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

      {/* Floating Sound Toggle Button when current slide is a Video */}
      {currentIsVideo && (
        <button
          type="button"
          onClick={toggleMute}
          className="heroSoundToggleBtn"
          aria-label={isMuted ? 'เปิดเสียงวิดีโอ' : 'ปิดเสียงวิดีโอ'}
          title={isMuted ? 'แตะเพื่อเปิดเสียง (Unmute)' : 'แตะเพื่อปิดเสียง (Mute)'}
        >
          {isMuted ? (
            <>
              <VolumeX size={15} />
              <span>แตะเพื่อเปิดเสียง</span>
            </>
          ) : (
            <>
              <Volume2 size={15} />
              <span>เปิดเสียงอยู่</span>
            </>
          )}
        </button>
      )}

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

            {hasAnyVideo && (
              <button
                type="button"
                onClick={toggleMute}
                className="playPauseBtn touch-target"
                aria-label={isMuted ? 'เปิดเสียงวิดีโอ' : 'ปิดเสียงวิดีโอ'}
                title={isMuted ? 'เปิดเสียงวิดีโอ (Unmute)' : 'ปิดเสียงวิดีโอ (Mute)'}
                style={{ width: '20px', opacity: 0.85, pointerEvents: 'auto', marginRight: '0.25rem' }}
              >
                {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            )}

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
