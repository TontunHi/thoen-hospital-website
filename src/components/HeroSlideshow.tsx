'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

  useEffect(() => {
    if (slides.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(timer)
  }, [slides.length])

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length)
  }

  const selectSlide = (index: number) => {
    setCurrentIndex(index)
  }

  // Fallback: If no scheduled slides exist, show default banner
  if (slides.length === 0) {
    return (
      <div className="hero__bg">
        <Image
          src="/images/main-banner.webp"
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
    <div className="heroSlideshow">
      {slides.map((slide, index) => {
        const isActive = index === currentIndex
        const SlideContent = (
          <div className={`slideshowItem ${isActive ? 'active' : ''}`} key={slide.id}>
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
          return (
            <Link key={slide.id} href={slide.linkUrl} target="_blank" rel="noopener noreferrer" className="slideLinkWrapper">
              {SlideContent}
            </Link>
          )
        }

        return SlideContent
      })}

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button type="button" onClick={prevSlide} className="navBtn prev" aria-label="Previous Slide">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={nextSlide} className="navBtn next" aria-label="Next Slide">
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Indicator Dots */}
      {slides.length > 1 && (
        <div className="indicatorDots">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => selectSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
