'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './HalloweenScene.module.css'

/**
 * Checks if the given date falls into the Halloween window (Oct 27 - Oct 31).
 * Evaluation is based on Thailand local time (UTC+7).
 */
export function isHalloweenSeason(now: Date = new Date()): boolean {
  const bangkokDateStr = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Bangkok',
    month: 'numeric',
    day: 'numeric',
  })
  const [monthStr, dayStr] = bangkokDateStr.split('/')
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Active from Oct 27 through end of October (Oct 31)
  if (month === 10 && day >= 27 && day <= 31) return true
  return false
}

/**
 * Cute & Spooky Ghost SVG (ผีน้อยน่ารักปนหลอน)
 */
function CuteGhost({ withHat = false, size = 95 }: { withHat?: boolean; size?: number }) {
  const width = size
  const height = size * 1.2
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`ghostGrad-${withHat ? 'hat' : 'plain'}`} x1="50" y1="20" x2="50" y2="115" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#f3e8ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d8b4fe" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {/* Main Ghost Body */}
      <path
        d="M26 50 C26 24 36 18 50 18 C64 18 74 24 74 50 C74 72 78 88 78 100 C74 104 68 96 64 100 C60 104 56 96 50 100 C44 96 40 104 36 100 C32 96 26 104 22 100 C22 88 26 72 26 50 Z"
        fill={`url(#ghostGrad-${withHat ? 'hat' : 'plain'})`}
        stroke="#c084fc"
        strokeWidth="1.2"
      />

      {/* Left Little Arm */}
      <path
        d="M26 54 C16 52 10 58 12 66 C14 70 20 66 26 62"
        fill="#f3e8ff"
        stroke="#c084fc"
        strokeWidth="1"
      />

      {/* Right Little Arm */}
      <path
        d="M74 54 C84 50 92 56 90 64 C88 68 82 66 74 62"
        fill="#f3e8ff"
        stroke="#c084fc"
        strokeWidth="1"
      />

      {/* Blushing Cheeks */}
      <ellipse cx="38" cy="54" rx="4" ry="2.5" fill="#f472b6" fillOpacity="0.55" />
      <ellipse cx="62" cy="54" rx="4" ry="2.5" fill="#f472b6" fillOpacity="0.55" />

      {/* Cute Eyes with Sparkles */}
      <ellipse cx="40" cy="46" rx="4" ry="5.5" fill="#1e1b4b" />
      <ellipse cx="60" cy="46" rx="4" ry="5.5" fill="#1e1b4b" />
      <circle cx="38.5" cy="44" r="1.6" fill="#ffffff" />
      <circle cx="58.5" cy="44" r="1.6" fill="#ffffff" />

      {/* Cute Smile / Spooky Mouth */}
      <path
        d="M45 52 Q50 58 55 52"
        stroke="#1e1b4b"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Optional Tiny Witch Hat */}
      {withHat && (
        <g transform="translate(18, -4) rotate(-12 50 30)">
          {/* Hat Brim */}
          <ellipse cx="50" cy="27" rx="22" ry="5" fill="#3b0764" stroke="#6b21a8" strokeWidth="0.8" />
          {/* Hat Cone */}
          <path d="M34 26 Q46 6 56 1 Q52 14 62 26 Z" fill="#581c87" stroke="#6b21a8" strokeWidth="0.8" />
          {/* Hat Ribbon */}
          <path d="M36 24 C44 26 56 26 64 24" stroke="#f97316" strokeWidth="3" fill="none" />
          {/* Gold Buckle */}
          <rect x="47" y="21.5" width="5" height="5" rx="1" fill="#facc15" stroke="#ca8a04" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  )
}

/**
 * Jack-o'-lantern (ฟักทองฮาโลวีนยิ้มหลอนน่ารัก แสงเทียนวูบวาบ)
 */
function JackOLantern({ size = 110, withHat = false }: { size?: number; withHat?: boolean }) {
  const width = size
  const height = size * 0.88
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 105"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`pumpkinShade-${size}`} cx="60" cy="55" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="65%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>
        <radialGradient id={`glowEyes-${size}`} cx="60" cy="55" r="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fef08a" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
      </defs>

      {/* Stem */}
      <path
        d="M58 26 C57 14 65 8 72 6 C70 12 67 18 64 26 Z"
        fill="#15803d"
        stroke="#14532d"
        strokeWidth="1"
      />
      {/* Curly Vine */}
      <path
        d="M65 18 Q75 14 72 24 Q78 22 75 30"
        stroke="#4ade80"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Pumpkin Outer Lobes */}
      <ellipse cx="36" cy="62" rx="28" ry="32" fill={`url(#pumpkinShade-${size})`} stroke="#7c2d12" strokeWidth="0.8" />
      <ellipse cx="84" cy="62" rx="28" ry="32" fill={`url(#pumpkinShade-${size})`} stroke="#7c2d12" strokeWidth="0.8" />

      {/* Pumpkin Mid Lobes */}
      <ellipse cx="46" cy="63" rx="25" ry="34" fill={`url(#pumpkinShade-${size})`} stroke="#7c2d12" strokeWidth="0.8" />
      <ellipse cx="74" cy="63" rx="25" ry="34" fill={`url(#pumpkinShade-${size})`} stroke="#7c2d12" strokeWidth="0.8" />

      {/* Center Lobe */}
      <ellipse cx="60" cy="64" rx="24" ry="35" fill={`url(#pumpkinShade-${size})`} stroke="#7c2d12" strokeWidth="0.8" />

      {/* Carved Glowing Eyes & Mouth */}
      <g className={styles.pumpkinCandleFlame}>
        {/* Left Triangular Eye */}
        <polygon points="42,46 50,56 36,56" fill={`url(#glowEyes-${size})`} stroke="#7c2d12" strokeWidth="0.8" />
        {/* Right Triangular Eye */}
        <polygon points="78,46 84,56 70,56" fill={`url(#glowEyes-${size})`} stroke="#7c2d12" strokeWidth="0.8" />
        {/* Nose */}
        <polygon points="60,56 64,62 56,62" fill={`url(#glowEyes-${size})`} />
        {/* Jagged Tooth Smile */}
        <path
          d="M34 68 Q60 88 86 68 C82 74 78 72 76 76 C72 70 68 76 64 70 C60 76 56 70 52 75 C48 71 44 74 40 70 Z"
          fill={`url(#glowEyes-${size})`}
          stroke="#7c2d12"
          strokeWidth="0.8"
        />
      </g>

      {/* Optional Tiny Witch Hat on Pumpkin */}
      {withHat && (
        <g transform="translate(14, 0) rotate(8 60 20)">
          <ellipse cx="60" cy="22" rx="22" ry="5" fill="#2e1065" stroke="#4c1d95" strokeWidth="0.8" />
          <path d="M46 21 Q57 4 66 0 Q62 11 72 21 Z" fill="#3b0764" stroke="#4c1d95" strokeWidth="0.8" />
          <path d="M48 19 C56 21 66 21 72 19" stroke="#f97316" strokeWidth="2.5" fill="none" />
        </g>
      )}
    </svg>
  )
}

/**
 * Flying Bat SVG (ค้างคาวน้อยน่ารัก บินกระพือปีก)
 */
function BatSVG({ size = 48 }: { size?: number }) {
  const width = size
  const height = size * 0.55
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Left Wing */}
      <g className={styles.batWingLeft}>
        <path
          d="M26 18 C22 12 12 4 4 10 C6 18 12 22 14 28 C18 24 22 24 26 22 Z"
          fill="#1e1b4b"
          stroke="#4338ca"
          strokeWidth="0.6"
        />
      </g>
      {/* Right Wing */}
      <g className={styles.batWingRight}>
        <path
          d="M34 18 C38 12 48 4 56 10 C54 18 48 22 46 28 C42 24 38 24 34 22 Z"
          fill="#1e1b4b"
          stroke="#4338ca"
          strokeWidth="0.6"
        />
      </g>
      {/* Body & Ears */}
      <ellipse cx="30" cy="18" rx="6" ry="8" fill="#0f172a" />
      <polygon points="26,13 28,6 30,12" fill="#0f172a" />
      <polygon points="34,13 32,6 30,12" fill="#0f172a" />
      {/* Tiny Eyes */}
      <circle cx="28" cy="16" r="1.2" fill="#facc15" />
      <circle cx="32" cy="16" r="1.2" fill="#facc15" />
    </svg>
  )
}

/**
 * Hanging Spider SVG (แมงมุมน่ารัก ห้อยใยดุ๊กดิ๊ก)
 */
function SpiderSVG({ size = 36 }: { size?: number }) {
  const width = size
  const height = size * 2.3
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 50 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Silk Thread */}
      <line x1="25" y1="0" x2="25" y2="72" stroke="#e9d5ff" strokeWidth="0.9" strokeDasharray="3 2" opacity="0.75" />

      {/* Spider Legs */}
      <path d="M20 78 C12 70 8 74 2 82" stroke="#4c1d95" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M20 82 C10 78 6 84 2 92" stroke="#4c1d95" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M30 78 C38 70 42 74 48 82" stroke="#4c1d95" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M30 82 C40 78 44 84 48 92" stroke="#4c1d95" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Spider Body */}
      <ellipse cx="25" cy="85" rx="10" ry="11" fill="#2e1065" stroke="#6b21a8" strokeWidth="1" />
      {/* Spider Head */}
      <circle cx="25" cy="74" r="6" fill="#1e1b4b" />
      {/* Cute Big Eyes */}
      <circle cx="23" cy="73" r="2.2" fill="#ffffff" />
      <circle cx="27" cy="73" r="2.2" fill="#ffffff" />
      <circle cx="23" cy="73" r="1.1" fill="#0f172a" />
      <circle cx="27" cy="73" r="1.1" fill="#0f172a" />
    </svg>
  )
}

/**
 * HalloweenScene Component
 * Renders cute & spooky Halloween atmosphere if within window (Oct 27 - Oct 31) or override `?theme=halloween`.
 * Returns null when not in season.
 */
export default function HalloweenScene() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const themeParam = searchParams.get('theme')
  if (themeParam === 'normal' || themeParam === 'loy-krathong') {
    return null
  }

  const isQueryActive = themeParam === 'halloween'
  const isDateActive = isHalloweenSeason()

  if (!isQueryActive && !isDateActive) {
    return null
  }

  return (
    <div className={styles.seasonWrapper} aria-hidden="true">
      {/* 1. Spooky Harvest Moon */}
      <div className={styles.moonContainer}>
        <div className={styles.moon}>
          <div className={styles.moonCraters} />
        </div>
      </div>

      {/* 2. Dangling Spider from top corner */}
      <div className={styles.spiderContainer}>
        <SpiderSVG size={36} />
      </div>

      {/* 3. Bats flying across the sky */}
      <div className={`${styles.bat} ${styles.batFly1}`}>
        <BatSVG size={46} />
      </div>
      <div className={`${styles.bat} ${styles.batFly2}`}>
        <BatSVG size={38} />
      </div>
      <div className={`${styles.bat} ${styles.batHover}`}>
        <BatSVG size={32} />
      </div>

      {/* 4. Cute Ghosts floating around */}
      <div className={`${styles.ghost} ${styles.ghostLeft}`}>
        <CuteGhost withHat={true} size={92} />
      </div>
      <div className={`${styles.ghost} ${styles.ghostRight}`}>
        <CuteGhost withHat={false} size={84} />
      </div>

      {/* 5. Jack-o'-lantern Pumpkins at bottom corners */}
      <div className={`${styles.pumpkin} ${styles.pumpkinLeft}`}>
        <JackOLantern size={106} withHat={false} />
      </div>
      <div className={`${styles.pumpkin} ${styles.pumpkinRight}`}>
        <JackOLantern size={118} withHat={true} />
      </div>

      {/* 6. Spooky Mist on bottom */}
      <div className={styles.mistLayer} />

      {/* 7. Floating mystical Halloween embers / fireflies */}
      <span className={styles.ember} style={{ top: '35%', left: '16%', width: 3, height: 3, backgroundColor: '#f97316', animationDuration: '4s', animationDelay: '0.2s' }} />
      <span className={styles.ember} style={{ top: '55%', left: '24%', width: 2.5, height: 2.5, backgroundColor: '#c084fc', animationDuration: '5.2s', animationDelay: '1.4s' }} />
      <span className={styles.ember} style={{ top: '22%', left: '42%', width: 3, height: 3, backgroundColor: '#fbbf24', animationDuration: '4.6s', animationDelay: '0.8s' }} />
      <span className={styles.ember} style={{ top: '65%', left: '76%', width: 2.5, height: 2.5, backgroundColor: '#ea580c', animationDuration: '3.8s', animationDelay: '2.1s' }} />
      <span className={styles.ember} style={{ top: '45%', left: '86%', width: 3, height: 3, backgroundColor: '#d8b4fe', animationDuration: '4.8s', animationDelay: '1.2s' }} />
    </div>
  )
}
