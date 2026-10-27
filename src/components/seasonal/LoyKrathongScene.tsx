'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './LoyKrathongScene.module.css'

/**
 * Checks if the given date falls into the annual Loy Krathong window (Nov 10 - Nov 30).
 * Evaluation is based on Thailand local time (UTC+7).
 */
export function isLoyKrathongSeason(now: Date = new Date()): boolean {
  // Convert UTC time to Asia/Bangkok time
  const bangkokDateStr = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Bangkok',
    month: 'numeric',
    day: 'numeric',
  })
  const [monthStr, dayStr] = bangkokDateStr.split('/')
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Active during festival season: Late October (from Oct 25) through end of November (Nov 30)
  if (month === 10 && day >= 25) return true
  if (month === 11 && day <= 30) return true
  return false
}

/**
 * Yee Peng (โคมลอย) SVG Icon - Lightweight & Beautiful Lanna Paper Lantern
 */
function YeePengLantern({ size = 32 }: { size?: number }) {
  const width = size
  const height = size * 1.3
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lanternGrad" x1="16" y1="2" x2="16" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#fed7aa" stopOpacity="0.9" />
          <stop offset="85%" stopColor="#f97316" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="fireLight" cx="16" cy="35" r="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fef08a" />
          <stop offset="90%" stopColor="#ea580c" />
        </radialGradient>
      </defs>

      {/* Outer Halo Glow */}
      <circle cx="16" cy="24" r="14" fill="#fbbf24" fillOpacity="0.25" />

      {/* Main Lantern Silhouette */}
      <path
        d="M8 7C8 4.2 11.5 2 16 2C20.5 2 24 4.2 24 7L26 31C26 34 21.5 36 16 36C10.5 36 6 34 6 31L8 7Z"
        fill="url(#lanternGrad)"
        stroke="#fdba74"
        strokeWidth="0.8"
      />

      {/* Traditional Frame Rims */}
      <ellipse cx="16" cy="7" rx="8" ry="2" stroke="#ea580c" strokeWidth="0.7" fill="none" opacity="0.6" />
      <ellipse cx="16" cy="20" rx="9.5" ry="2.2" stroke="#ea580c" strokeWidth="0.6" fill="none" opacity="0.4" />
      <ellipse cx="16" cy="31" rx="10" ry="2.5" stroke="#9a3412" strokeWidth="0.8" fill="none" opacity="0.7" />

      {/* Bamboo Rim at the base */}
      <ellipse cx="16" cy="35.5" rx="7.5" ry="1.8" fill="#78350f" />

      {/* Flame Light Source */}
      <circle cx="16" cy="34" r="4.5" fill="url(#fireLight)" />
      <ellipse cx="16" cy="35" rx="2" ry="1" fill="#ffffff" />
    </svg>
  )
}

/**
 * Krathong (กระทงประทีป) SVG - Banana Leaf, Lotus Petals & Flickering Candle
 */
function KrathongSVG({ width = 110 }: { width?: number }) {
  const height = width * 0.72
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.krathongGlow}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="leafGradDark" x1="60" y1="52" x2="60" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#052e16" />
        </linearGradient>
        <linearGradient id="leafGradLight" x1="60" y1="45" x2="60" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="60%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
        <linearGradient id="lotusPetal" x1="60" y1="28" x2="60" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="50%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="candleGrad" x1="60" y1="22" x2="64" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="40%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
        <radialGradient id="flameGlow" cx="60" cy="14" r="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fef08a" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Water reflection under the krathong */}
      <ellipse cx="60" cy="79" rx="42" ry="5" fill="#facc15" fillOpacity="0.28" filter="blur(2px)" />

      {/* Bottom Banana Trunk Disc Base */}
      <ellipse cx="60" cy="73" rx="48" ry="8" fill="url(#leafGradDark)" />

      {/* Outer Banana Leaf Folded Petals */}
      <path d="M12 68C22 55 35 60 40 70C30 73 18 72 12 68Z" fill="url(#leafGradLight)" stroke="#14532d" strokeWidth="0.8" />
      <path d="M108 68C98 55 85 60 80 70C90 73 102 72 108 68Z" fill="url(#leafGradLight)" stroke="#14532d" strokeWidth="0.8" />
      <path d="M26 67C34 52 48 56 54 69C44 72 32 71 26 67Z" fill="url(#leafGradLight)" stroke="#14532d" strokeWidth="0.8" />
      <path d="M94 67C86 52 72 56 66 69C76 72 88 71 94 67Z" fill="url(#leafGradLight)" stroke="#14532d" strokeWidth="0.8" />
      <path d="M44 68C52 48 68 48 76 68C66 73 54 73 44 68Z" fill="url(#leafGradLight)" stroke="#14532d" strokeWidth="0.8" />

      {/* Inner Decorative Lotus Flower Petals */}
      <path d="M36 62C40 45 50 46 54 60C46 64 39 63 36 62Z" fill="url(#lotusPetal)" opacity="0.9" />
      <path d="M84 62C80 45 70 46 66 60C74 64 81 63 84 62Z" fill="url(#lotusPetal)" opacity="0.9" />
      <path d="M48 60C54 40 66 40 72 60C64 64 56 64 48 60Z" fill="url(#lotusPetal)" />

      {/* Golden Center Petals */}
      <circle cx="53" cy="55" r="4.5" fill="#facc15" />
      <circle cx="67" cy="55" r="4.5" fill="#facc15" />
      <circle cx="60" cy="56" r="5" fill="#fbbf24" />

      {/* Incense Sticks */}
      <line x1="56" y1="48" x2="52" y2="18" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="59" y1="48" x2="58" y2="14" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="62" y1="48" x2="64" y2="17" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="52" cy="18" r="0.9" fill="#ef4444" />
      <circle cx="58" cy="14" r="0.9" fill="#ef4444" />
      <circle cx="64" cy="17" r="0.9" fill="#ef4444" />

      {/* Center Candle */}
      <rect x="58.5" y="28" width="5" height="24" rx="1.5" fill="url(#candleGrad)" stroke="#ca8a04" strokeWidth="0.5" />
      <line x1="61" y1="28" x2="61" y2="24" stroke="#451a03" strokeWidth="1" strokeLinecap="round" />

      {/* Animated Candle Flame */}
      <g className={styles.candleFlame}>
        <circle cx="61" cy="16" r="11" fill="url(#flameGlow)" />
        <path
          d="M61 7C64 12 65.5 16 64.5 19C63.5 22 58.5 22 57.5 19C56.5 16 58 12 61 7Z"
          fill="#f97316"
        />
        <path
          d="M61 10C63 13.5 64 16 63 18C62.2 19.5 59.8 19.5 59 18C58 16 59 13.5 61 10Z"
          fill="#fef08a"
        />
        <ellipse cx="61" cy="18.5" rx="1" ry="1.5" fill="#ffffff" />
      </g>
    </svg>
  )
}

/**
 * Organic Spark Particles Data for Fireworks (กระจายตัวแบบดาวประกายไฟ ไร้เส้นตรงแข็ง)
 */
const FIREWORK_SPARKS = [
  // Outer layer - 12 glowing spark points with natural radius variance
  { deg: 0, r: 62, size: 2.8 },
  { deg: 30, r: 58, size: 2.5 },
  { deg: 60, r: 64, size: 2.9 },
  { deg: 90, r: 60, size: 2.6 },
  { deg: 120, r: 63, size: 2.8 },
  { deg: 150, r: 57, size: 2.4 },
  { deg: 180, r: 62, size: 2.8 },
  { deg: 210, r: 59, size: 2.5 },
  { deg: 240, r: 65, size: 2.9 },
  { deg: 270, r: 60, size: 2.7 },
  { deg: 300, r: 63, size: 2.8 },
  { deg: 330, r: 57, size: 2.5 },

  // Middle layer - 12 staggered sparks
  { deg: 15, r: 40, size: 2.2 },
  { deg: 48, r: 44, size: 2.4 },
  { deg: 78, r: 38, size: 2.1 },
  { deg: 108, r: 43, size: 2.3 },
  { deg: 138, r: 39, size: 2.2 },
  { deg: 168, r: 44, size: 2.4 },
  { deg: 198, r: 38, size: 2.1 },
  { deg: 228, r: 42, size: 2.3 },
  { deg: 258, r: 39, size: 2.2 },
  { deg: 288, r: 43, size: 2.4 },
  { deg: 318, r: 37, size: 2.1 },
  { deg: 348, r: 41, size: 2.3 },

  // Inner core sparks - 6 soft glowing embers
  { deg: 22, r: 22, size: 1.8 },
  { deg: 82, r: 24, size: 1.9 },
  { deg: 142, r: 21, size: 1.7 },
  { deg: 202, r: 25, size: 2.0 },
  { deg: 262, r: 22, size: 1.8 },
  { deg: 322, r: 24, size: 1.9 },
]

/**
 * Firework (พลุเฉลิมฉลองทรงพุ่มดอกไม้ไฟ) SVG - Organic Particle Sparks & Trails
 */
function FireworkBurst({
  id,
  color = '#fbbf24',
  secondaryColor = '#fef08a',
}: {
  id: string
  color?: string
  secondaryColor?: string
}) {
  return (
    <svg
      width="170"
      height="170"
      viewBox="0 0 170 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      aria-hidden="true"
    >
      <defs>
        {/* Soft core burst bloom */}
        <radialGradient id={`fwGlow-${id}`} cx="85" cy="85" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="25%" stopColor={secondaryColor} stopOpacity="0.75" />
          <stop offset="60%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Central Flash Bloom */}
      <circle cx="85" cy="85" r="26" fill={`url(#fwGlow-${id})`} />
      <circle cx="85" cy="85" r="4" fill="#ffffff" />

      {/* Scattered Organic Spark Particles and Trails (No straight spoke lines!) */}
      {FIREWORK_SPARKS.map((spark, idx) => {
        const rad = (spark.deg * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)

        // Main outer spark position
        const x = 85 + spark.r * cos
        const y = 85 + spark.r * sin

        // Trailing ember 1 (slightly closer to center)
        const xTrail1 = 85 + spark.r * 0.74 * cos
        const yTrail1 = 85 + spark.r * 0.74 * sin - 1

        // Trailing ember 2
        const xTrail2 = 85 + spark.r * 0.5 * cos
        const yTrail2 = 85 + spark.r * 0.5 * sin - 1.5

        return (
          <g key={idx}>
            {/* Outer main glowing spark with halo */}
            <circle cx={x} cy={y} r={spark.size * 1.9} fill={color} opacity="0.4" />
            <circle cx={x} cy={y} r={spark.size} fill={secondaryColor} />
            <circle cx={x} cy={y} r={spark.size * 0.55} fill="#ffffff" />

            {/* Trailing embers (ละอองประกายดาวทิ้งหาง) */}
            <circle cx={xTrail1} cy={yTrail1} r={spark.size * 0.6} fill={color} opacity="0.75" />
            <circle cx={xTrail2} cy={yTrail2} r={spark.size * 0.4} fill={secondaryColor} opacity="0.5" />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * LoyKrathongScene Component
 * Renders full festive atmosphere if within festival date window (Nov 10-30) or override `?theme=loy-krathong`.
 * Returns null when not in season (zero DOM footprint & pure fallback to original UI).
 */
export default function LoyKrathongScene() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid hydration mismatch by waiting for client mount
  if (!mounted) {
    return null
  }

  // Allows testing normal mode (?theme=normal) or forcing festival (?theme=loy-krathong)
  const themeParam = searchParams.get('theme')
  if (themeParam === 'normal') {
    return null
  }
  const isQueryActive = themeParam === 'loy-krathong'
  const isDateActive = isLoyKrathongSeason()

  if (!isQueryActive && !isDateActive) {
    return null
  }

  return (
    <div className={styles.seasonWrapper} aria-hidden="true">
      {/* 1. Full Moon in top right */}
      <div className={styles.moonContainer}>
        <div className={styles.moon} />
      </div>

      {/* 2. Twinkling Stars (8 points across the night sky) */}
      <span className={styles.star} style={{ top: '12%', left: '15%', width: 3, height: 3, animationDuration: '3.2s', animationDelay: '0.2s' }} />
      <span className={styles.star} style={{ top: '22%', left: '32%', width: 2, height: 2, animationDuration: '4.1s', animationDelay: '1.1s' }} />
      <span className={styles.star} style={{ top: '8%', left: '48%', width: 2.5, height: 2.5, animationDuration: '3.6s', animationDelay: '0.7s' }} />
      <span className={styles.star} style={{ top: '28%', left: '68%', width: 3, height: 3, animationDuration: '4.8s', animationDelay: '1.9s' }} />
      <span className={styles.star} style={{ top: '18%', left: '88%', width: 2, height: 2, animationDuration: '2.9s', animationDelay: '0.4s' }} />
      <span className={styles.star} style={{ top: '38%', left: '10%', width: 2, height: 2, animationDuration: '3.8s', animationDelay: '2.2s' }} />
      <span className={styles.star} style={{ top: '15%', left: '76%', width: 2.5, height: 2.5, animationDuration: '4.3s', animationDelay: '1.4s' }} />
      <span className={styles.star} style={{ top: '42%', left: '84%', width: 2, height: 2, animationDuration: '3.5s', animationDelay: '0.8s' }} />

      {/* 2.5. Festive Fireworks in upper sky (พลุละอองดาวกระจายตัวตามแรงโน้มถ่วง ไร้เส้นตรงแข็ง) */}
      <div className={styles.firework} style={{ top: '15%', left: '18%', animationDuration: '5.5s', animationDelay: '0.8s' }}>
        <FireworkBurst id="fw1" color="#f59e0b" secondaryColor="#fef08a" />
      </div>
      <div className={styles.firework} style={{ top: '23%', left: '80%', animationDuration: '6.8s', animationDelay: '2.8s' }}>
        <FireworkBurst id="fw2" color="#f43f5e" secondaryColor="#fed7aa" />
      </div>
      <div className={styles.firework} style={{ top: '30%', left: '26%', animationDuration: '7.4s', animationDelay: '4.8s' }}>
        <FireworkBurst id="fw3" color="#10b981" secondaryColor="#a7f3d0" />
      </div>

      {/* 3. Floating Yee Peng Lanterns (4 lanterns rising into the sky) */}
      <div className={styles.lantern} style={{ left: '8%', animationDuration: '24s', animationDelay: '0s' }}>
        <YeePengLantern size={30} />
      </div>
      <div className={styles.lantern} style={{ left: '26%', animationDuration: '19s', animationDelay: '6s' }}>
        <YeePengLantern size={24} />
      </div>
      <div className={styles.lantern} style={{ left: '72%', animationDuration: '22s', animationDelay: '11s' }}>
        <YeePengLantern size={28} />
      </div>
      <div className={styles.lantern} style={{ left: '88%', animationDuration: '17s', animationDelay: '3s' }}>
        <YeePengLantern size={34} />
      </div>

      {/* 4. River Water Layer & Reflections */}
      <div className={styles.riverLayer}>
        <div className={styles.riverWave} />
        <div className={styles.riverWave2} />
      </div>

      {/* 5. Floating Krathongs (3 krathongs drifting gently across water) */}
      <div className={styles.krathong} style={{ bottom: '16px', animationDuration: '32s', animationDelay: '0s' }}>
        <KrathongSVG width={118} />
      </div>
      <div className={styles.krathong} style={{ bottom: '26px', animationDuration: '24s', animationDelay: '9s', opacity: 0.85 }}>
        <KrathongSVG width={88} />
      </div>
      <div className={styles.krathong} style={{ bottom: '8px', animationDuration: '38s', animationDelay: '18s' }}>
        <KrathongSVG width={135} />
      </div>
    </div>
  )
}
