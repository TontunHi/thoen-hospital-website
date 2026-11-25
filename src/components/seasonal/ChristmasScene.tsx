'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import * as THREE from 'three'
import styles from './ChristmasScene.module.css'

/**
 * Checks if the given date falls into the annual Christmas & New Year window
 * (Nov 25 through Jan 5) in Thailand local time (UTC+7).
 */
export function isChristmasSeason(now: Date = new Date()): boolean {
  const bangkokDateStr = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Bangkok',
    month: 'numeric',
    day: 'numeric',
  })
  const [monthStr, dayStr] = bangkokDateStr.split('/')
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (month === 11 && day >= 25) return true
  if (month === 12) return true
  if (month === 1 && day <= 5) return true
  return false
}

export interface ChristmasSceneProps {
  /** Force render regardless of calendar date (unless overridden by `?theme=` query param) */
  forceActive?: boolean
}

/**
 * Creates a soft radial glow texture on an offscreen 2D canvas for Three.js sprites/particles
 */
function createRadialGlowTexture(
  innerColor: string,
  midColor: string,
  outerColor: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32)
  gradient.addColorStop(0, innerColor)
  gradient.addColorStop(0.38, midColor)
  gradient.addColorStop(1, outerColor)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * Creates a delicate 6-pointed crystalline snowflake texture for crisp snow particles
 */
function createSnowflakeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const radial = ctx.createRadialGradient(32, 32, 1, 32, 32, 30)
  radial.addColorStop(0, 'rgba(255, 255, 255, 1)')
  radial.addColorStop(0.45, 'rgba(224, 242, 254, 0.8)')
  radial.addColorStop(1, 'rgba(224, 242, 254, 0)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, 64, 64)

  ctx.save()
  ctx.translate(32, 32)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'

  for (let i = 0; i < 6; i++) {
    ctx.save()
    ctx.rotate((Math.PI / 3) * i)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -18)
    ctx.moveTo(0, -9)
    ctx.lineTo(-4.5, -13.5)
    ctx.moveTo(0, -9)
    ctx.lineTo(4.5, -13.5)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

interface PineTreeAssets {
  trunkGeo: THREE.CylinderGeometry
  tierGeos: THREE.ConeGeometry[]
  snowCapGeos: THREE.ConeGeometry[]
  starGeo: THREE.OctahedronGeometry
  ornamentGeo: THREE.SphereGeometry
  trunkMat: THREE.MeshStandardMaterial
  foliageDarkMat: THREE.MeshStandardMaterial
  foliageMidMat: THREE.MeshStandardMaterial
  snowCapMat: THREE.MeshStandardMaterial
  starMat: THREE.MeshBasicMaterial
  ornamentMats: THREE.MeshBasicMaterial[]
  glowTex: THREE.CanvasTexture | null
}

function createSharedPineTreeAssets(glowTex: THREE.CanvasTexture | null): PineTreeAssets {
  return {
    trunkGeo: new THREE.CylinderGeometry(0.14, 0.22, 0.72, 8),
    tierGeos: [
      new THREE.ConeGeometry(1.18, 1.38, 10),
      new THREE.ConeGeometry(0.92, 1.24, 10),
      new THREE.ConeGeometry(0.65, 1.05, 10),
    ],
    snowCapGeos: [
      new THREE.ConeGeometry(1.06, 0.45, 10),
      new THREE.ConeGeometry(0.82, 0.4, 10),
      new THREE.ConeGeometry(0.56, 0.36, 10),
    ],
    starGeo: new THREE.OctahedronGeometry(0.18, 0),
    ornamentGeo: new THREE.SphereGeometry(0.068, 8, 8),
    trunkMat: new THREE.MeshStandardMaterial({ color: 0x3f2414, roughness: 0.9 }),
    foliageDarkMat: new THREE.MeshStandardMaterial({
      color: 0x0b3d2e,
      roughness: 0.82,
      metalness: 0.05,
    }),
    foliageMidMat: new THREE.MeshStandardMaterial({
      color: 0x115e46,
      roughness: 0.76,
      metalness: 0.06,
    }),
    snowCapMat: new THREE.MeshStandardMaterial({
      color: 0xe2f1ff,
      emissive: 0x1e3a5f,
      emissiveIntensity: 0.25,
      roughness: 0.65,
    }),
    starMat: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    ornamentMats: [
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }), // Warm gold
      new THREE.MeshBasicMaterial({ color: 0xf87171 }), // Holly crimson
      new THREE.MeshBasicMaterial({ color: 0x34d399 }), // Mint emerald
      new THREE.MeshBasicMaterial({ color: 0xbae6fd }), // Ice crystal
    ],
    glowTex,
  }
}

interface AnimatedOrnament {
  mesh: THREE.Mesh
  halo: THREE.Sprite | null
  phase: number
  baseScale: number
}

interface PineTreeEntity {
  group: THREE.Group
  starMesh: THREE.Mesh
  starHalo: THREE.Sprite | null
  ornaments: AnimatedOrnament[]
  baseRotY: number
  swayPhase: number
}

function createDecoratedPineTree(
  assets: PineTreeAssets,
  scale: number,
  seed: number
): PineTreeEntity {
  const group = new THREE.Group()

  const trunk = new THREE.Mesh(assets.trunkGeo, assets.trunkMat)
  trunk.position.y = 0.36
  group.add(trunk)

  const tierHeights = [1.18, 2.02, 2.78]
  tierHeights.forEach((yPos, idx) => {
    const foliage = new THREE.Mesh(
      assets.tierGeos[idx],
      idx % 2 === 0 ? assets.foliageDarkMat : assets.foliageMidMat
    )
    foliage.position.y = yPos
    foliage.rotation.y = idx * 0.45
    group.add(foliage)

    const snowCap = new THREE.Mesh(assets.snowCapGeos[idx], assets.snowCapMat)
    snowCap.position.y = yPos + 0.32
    snowCap.rotation.y = idx * 0.45
    group.add(snowCap)
  })

  // Golden star topper
  const starMesh = new THREE.Mesh(assets.starGeo, assets.starMat)
  starMesh.position.y = 3.44
  starMesh.scale.set(1, 1.3, 0.55)
  group.add(starMesh)

  let starHalo: THREE.Sprite | null = null
  if (assets.glowTex) {
    const starHaloMat = new THREE.SpriteMaterial({
      map: assets.glowTex,
      color: 0xfde68a,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    starHalo = new THREE.Sprite(starHaloMat)
    starHalo.position.y = 3.44
    starHalo.scale.set(1.15, 1.15, 1)
    group.add(starHalo)
  }

  // Spiraled twinkling ornaments
  const ornaments: AnimatedOrnament[] = []
  const ornamentCount = 11
  for (let i = 0; i < ornamentCount; i++) {
    const t = i / (ornamentCount - 1)
    const y = 0.85 + t * 2.15
    const radius = (1 - t * 0.72) * 0.92
    const angle = i * 2.15 + seed

    const mat = assets.ornamentMats[i % assets.ornamentMats.length]
    const mesh = new THREE.Mesh(assets.ornamentGeo, mat)
    mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    group.add(mesh)

    let halo: THREE.Sprite | null = null
    if (assets.glowTex && i % 2 === 0) {
      const spriteMat = new THREE.SpriteMaterial({
        map: assets.glowTex,
        color: mat.color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      halo = new THREE.Sprite(spriteMat)
      halo.position.copy(mesh.position)
      halo.scale.set(0.42, 0.42, 1)
      group.add(halo)
    }

    ornaments.push({
      mesh,
      halo,
      phase: seed + i * 0.9,
      baseScale: 0.38 + (i % 3) * 0.06,
    })
  }

  group.scale.setScalar(scale)

  return {
    group,
    starMesh,
    starHalo,
    ornaments,
    baseRotY: seed * 0.3,
    swayPhase: seed,
  }
}

interface ReindeerEntity {
  group: THREE.Group
  frontLegs: THREE.Mesh[]
  backLegs: THREE.Mesh[]
  rudolphHalo: THREE.Sprite | null
  phase: number
}

interface SantaSleighEntity {
  group: THREE.Group
  santaBody: THREE.Group
  santaArmPivot: THREE.Group
  giftSack: THREE.Mesh
  reindeers: ReindeerEntity[]
  lanternHalo: THREE.Sprite | null
}

/**
 * Creates a 3D Santa Claus on his Sleigh pulled by 3 galloping reindeer (with glowing-nose Rudolph)
 */
function createSantaSleigh(
  warmGlowTex: THREE.CanvasTexture | null,
  crimsonGlowTex: THREE.CanvasTexture | null
): SantaSleighEntity {
  const group = new THREE.Group()

  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x450a0a,
    emissiveIntensity: 0.35,
    roughness: 0.45,
  })
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0x78350f,
    emissiveIntensity: 0.35,
    metalness: 0.55,
    roughness: 0.3,
  })
  const whiteFurMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0x1e293b,
    emissiveIntensity: 0.2,
    roughness: 0.8,
  })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.7 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  const sackMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.75 })
  const deerMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.75 })
  const antlerMat = new THREE.MeshStandardMaterial({ color: 0xd6b084, roughness: 0.7 })

  // --- Sleigh Group (facing +X) ---
  const sleighGroup = new THREE.Group()

  // Golden runners (left & right)
  const runnerGeo = new THREE.BoxGeometry(1.75, 0.06, 0.06)
  const runnerTipGeo = new THREE.TorusGeometry(0.18, 0.03, 6, 12, Math.PI)
  ;[-0.36, 0.36].forEach((zOff) => {
    const rail = new THREE.Mesh(runnerGeo, goldMat)
    rail.position.set(0, -0.32, zOff)
    sleighGroup.add(rail)

    const curl = new THREE.Mesh(runnerTipGeo, goldMat)
    curl.position.set(0.86, -0.14, zOff)
    curl.rotation.z = -Math.PI / 2
    sleighGroup.add(curl)

    ;[-0.45, 0.45].forEach((xOff) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), goldMat)
      strut.position.set(xOff, -0.2, zOff)
      sleighGroup.add(strut)
    })
  })

  // Sleigh body
  const sleighBase = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.42, 0.78), crimsonMat)
  sleighBase.position.set(-0.05, 0.08, 0)
  sleighGroup.add(sleighBase)

  const sleighTrim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.82), goldMat)
  sleighTrim.position.set(-0.05, 0.3, 0)
  sleighGroup.add(sleighTrim)

  const sleighBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.78), crimsonMat)
  sleighBack.position.set(-0.72, 0.44, 0)
  sleighBack.rotation.z = 0.2
  sleighGroup.add(sleighBack)

  // Gift sack & festive parcels
  const giftSack = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), sackMat)
  giftSack.scale.set(1.05, 1.15, 0.95)
  giftSack.position.set(-0.44, 0.44, 0)
  sleighGroup.add(giftSack)

  const miniGift = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), goldMat)
  miniGift.position.set(-0.32, 0.56, 0.18)
  miniGift.rotation.y = 0.4
  sleighGroup.add(miniGift)

  // --- Santa Claus ---
  const santaGroup = new THREE.Group()
  santaGroup.position.set(0.12, 0.42, 0)

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.44, 10), crimsonMat)
  torso.position.y = 0.14
  santaGroup.add(torso)

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.225, 0.07, 10), darkMat)
  belt.position.y = 0.08
  santaGroup.add(belt)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), skinMat)
  head.position.y = 0.46
  santaGroup.add(head)

  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), whiteFurMat)
  beard.scale.set(0.95, 1.05, 0.88)
  beard.position.set(0.07, 0.37, 0)
  santaGroup.add(beard)

  const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.04, 6, 12), whiteFurMat)
  hatBrim.rotation.x = Math.PI / 2
  hatBrim.position.y = 0.56
  santaGroup.add(hatBrim)

  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 10), crimsonMat)
  hatCone.position.set(-0.05, 0.69, 0)
  hatCone.rotation.z = 0.32
  santaGroup.add(hatCone)

  const hatPom = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), whiteFurMat)
  hatPom.position.set(-0.14, 0.82, 0)
  santaGroup.add(hatPom)

  // Waving Santa arm (pivoted at shoulder for joyful waving)
  const santaArmPivot = new THREE.Group()
  santaArmPivot.position.set(0.06, 0.3, 0.22)
  const santaArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 8), crimsonMat)
  santaArm.position.set(0, 0.14, 0)
  santaArmPivot.add(santaArm)
  const armCuff = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), whiteFurMat)
  armCuff.position.set(0, 0.29, 0)
  santaArmPivot.add(armCuff)
  santaGroup.add(santaArmPivot)

  sleighGroup.add(santaGroup)

  const sleighMagicLight = new THREE.PointLight(0xfde68a, 2.2, 16, 1.3)
  sleighMagicLight.position.set(0.6, 0.4, 0.5)
  group.add(sleighMagicLight)

  // Front golden sleigh lantern
  let lanternHalo: THREE.Sprite | null = null
  const lanternBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  )
  lanternBulb.position.set(0.7, 0.38, 0)
  sleighGroup.add(lanternBulb)
  if (warmGlowTex) {
    lanternHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: warmGlowTex,
        color: 0xfde68a,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    lanternHalo.position.set(0.7, 0.38, 0)
    lanternHalo.scale.set(0.85, 0.85, 1)
    sleighGroup.add(lanternHalo)
  }

  group.add(sleighGroup)

  // --- Golden Reins ---
  const reinGeo = new THREE.BoxGeometry(3.25, 0.018, 0.018)
  ;[-0.14, 0.14].forEach((zOff) => {
    const rein = new THREE.Mesh(reinGeo, goldMat)
    rein.position.set(2.25, 0.22, zOff)
    group.add(rein)
  })

  // --- Reindeer Team (3 reindeer ahead of sleigh; front lead is Rudolph) ---
  const reindeers: ReindeerEntity[] = []
  const deerOffsets = [
    { x: 1.75, y: 0.05, z: -0.22, isRudolph: false },
    { x: 2.75, y: 0.12, z: 0.2, isRudolph: false },
    { x: 3.75, y: 0.2, z: 0, isRudolph: true },
  ]

  const bodyGeo = new THREE.BoxGeometry(0.62, 0.28, 0.24)
  const neckGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.26, 8)
  const deerHeadGeo = new THREE.BoxGeometry(0.24, 0.16, 0.16)
  const legGeo = new THREE.CylinderGeometry(0.032, 0.025, 0.28, 6)
  const antlerGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6)
  const noseGeo = new THREE.SphereGeometry(0.048, 8, 8)

  deerOffsets.forEach((spec, idx) => {
    const deer = new THREE.Group()
    deer.position.set(spec.x, spec.y, spec.z)

    const body = new THREE.Mesh(bodyGeo, deerMat)
    deer.add(body)

    const neck = new THREE.Mesh(neckGeo, deerMat)
    neck.position.set(0.26, 0.17, 0)
    neck.rotation.z = -0.45
    deer.add(neck)

    const dHead = new THREE.Mesh(deerHeadGeo, deerMat)
    dHead.position.set(0.38, 0.29, 0)
    deer.add(dHead)

    ;[-0.06, 0.06].forEach((zAnt) => {
      const antler = new THREE.Mesh(antlerGeo, antlerMat)
      antler.position.set(0.34, 0.44, zAnt)
      antler.rotation.z = 0.25
      antler.rotation.x = zAnt > 0 ? 0.3 : -0.3
      deer.add(antler)
    })

    const frontLegs: THREE.Mesh[] = []
    const backLegs: THREE.Mesh[] = []
    ;[-0.08, 0.08].forEach((zLeg) => {
      const fLeg = new THREE.Mesh(legGeo, deerMat)
      fLeg.position.set(0.2, -0.2, zLeg)
      deer.add(fLeg)
      frontLegs.push(fLeg)

      const bLeg = new THREE.Mesh(legGeo, deerMat)
      bLeg.position.set(-0.2, -0.2, zLeg)
      deer.add(bLeg)
      backLegs.push(bLeg)
    })

    let rudolphHalo: THREE.Sprite | null = null
    if (spec.isRudolph) {
      const redNose = new THREE.Mesh(
        noseGeo,
        new THREE.MeshBasicMaterial({ color: 0xff2e2e })
      )
      redNose.position.set(0.51, 0.29, 0)
      deer.add(redNose)

      if (crimsonGlowTex) {
        rudolphHalo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: crimsonGlowTex,
            color: 0xff3b3b,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
        rudolphHalo.position.set(0.52, 0.29, 0)
        rudolphHalo.scale.set(1.05, 1.05, 1)
        deer.add(rudolphHalo)
      }
    }

    group.add(deer)
    reindeers.push({
      group: deer,
      frontLegs,
      backLegs,
      rudolphHalo,
      phase: idx * 1.15,
    })
  })

  group.scale.setScalar(1.04)

  return {
    group,
    santaBody: santaGroup,
    santaArmPivot,
    giftSack,
    reindeers,
    lanternHalo,
  }
}

/**
 * Corner Snowflake SVG Ornament
 */
function FrostCornerOrnament({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 108V30C10 18.9543 18.9543 10 30 10H108"
        stroke="url(#frostSilver)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M18 90V36C18 26.0589 26.0589 18 36 18H90"
        stroke="url(#frostSilver)"
        strokeWidth="0.9"
        strokeDasharray="3 4"
      />
      {/* Delicate 6-point crystal star */}
      <g transform="translate(32 32)" stroke="#BAE6FD" strokeWidth="1.4" strokeLinecap="round">
        <line x1="0" y1="-13" x2="0" y2="13" />
        <line x1="-11.2" y1="-6.5" x2="11.2" y2="6.5" />
        <line x1="-11.2" y1="6.5" x2="11.2" y2="-6.5" />
        <circle cx="0" cy="0" r="2.5" fill="#FEF08A" stroke="none" />
      </g>
      <defs>
        <linearGradient id="frostSilver" x1="10" y1="10" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="50%" stopColor="#34D399" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const FAIRY_BULB_CLASSES = [
  styles.fairyBulbWarm,
  styles.fairyBulbCrimson,
  styles.fairyBulbEmerald,
  styles.fairyBulbIce,
]

const FAIRY_BULB_OFFSETS = [2, 8, 12, 14, 13, 9, 4, 2, 7, 12, 15, 13, 8, 3, 5, 11, 14, 10, 4, 2]

/**
 * ChristmasScene Component
 * Renders a GPU-optimized Three.js 3D Winter Wonderland:
 * - Animated Aurora Borealis sky shader
 * - Glowing Christmas North Star & twinkling starfield
 * - Layered snowy mountain ridges & frosted meadow
 * - Animated 3D decorated pine trees with twinkling ornaments
 * - Multi-depth drifting 3D snow crystals & warm festive bokeh lights
 * - Smooth exponential pointer parallax
 */
export default function ChristmasScene({ forceActive = false }: ChristmasSceneProps) {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const themeParam = searchParams.get('theme')
  const isDisabledByParam =
    themeParam === 'normal' || themeParam === 'loy-krathong' || themeParam === 'halloween'
  const isQueryActive = themeParam === 'christmas'
  const isDateActive = isChristmasSeason()
  const isActive = mounted && !isDisabledByParam && (forceActive || isQueryActive || isDateActive)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const host = containerRef.current
    let animationFrameId = 0
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let isPageVisible = typeof document !== 'undefined' ? !document.hidden : true

    try {
      const width = host.clientWidth || window.innerWidth || 1280
      const height = host.clientHeight || window.innerHeight || 800

      // 1. Scene, Fog & Camera
      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x04101a, 0.022)

      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 160)
      camera.position.set(0, 1.35, 13.4)
      const cameraLookTarget = new THREE.Vector3(0, 0.55, -4)
      camera.lookAt(cameraLookTarget)

      const isLowCoreDevice =
        typeof navigator !== 'undefined' &&
        typeof navigator.hardwareConcurrency === 'number' &&
        navigator.hardwareConcurrency <= 4
      const maxDpr = isLowCoreDevice ? 1 : 1.5

      renderer = new THREE.WebGLRenderer({
        antialias: !isLowCoreDevice,
        alpha: true,
        powerPreference: 'default',
      })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.18

      host.innerHTML = ''
      host.appendChild(renderer.domElement)

      // 2. Scene Lighting
      scene.add(new THREE.AmbientLight(0x64748b, 1.15))

      const moonLight = new THREE.DirectionalLight(0xe0f2fe, 1.45)
      moonLight.position.set(16, 14, -14)
      scene.add(moonLight)

      const warmTreeFill = new THREE.PointLight(0xfbbf24, 2.2, 26, 1.4)
      warmTreeFill.position.set(0, 1.5, 4)
      scene.add(warmTreeFill)

      // Shared Textures
      const warmGlowTex = createRadialGlowTexture(
        'rgba(255, 255, 255, 1)',
        'rgba(253, 224, 71, 0.58)',
        'rgba(245, 158, 11, 0)'
      )
      const iceGlowTex = createRadialGlowTexture(
        'rgba(255, 255, 255, 1)',
        'rgba(186, 230, 253, 0.52)',
        'rgba(56, 189, 248, 0)'
      )
      const crimsonGlowTex = createRadialGlowTexture(
        'rgba(255, 240, 240, 1)',
        'rgba(248, 113, 113, 0.72)',
        'rgba(220, 38, 38, 0)'
      )
      const snowflakeTex = createSnowflakeTexture()

      // 3. Flowing Aurora Borealis Sky Shader Ribbon
      const auroraGeo = new THREE.PlaneGeometry(76, 16, 36, 12)
      const auroraMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            vUv = uv;
            vec3 pos = position;
            float wave = sin(pos.x * 0.16 + uTime * 0.45) * 1.15
                       + cos(pos.x * 0.31 - uTime * 0.32) * 0.65;
            pos.z += wave;
            pos.y += sin(pos.x * 0.22 + uTime * 0.38) * 0.55;
            vWave = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            float verticalFade = smoothstep(0.0, 0.38, vUv.y) * smoothstep(1.0, 0.28, vUv.y);
            float horizontalFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);

            float curtain = 0.55 + 0.45 * sin(vUv.x * 18.0 + uTime * 0.7 + vWave * 0.6);
            float shimmer = 0.6 + 0.4 * cos(vUv.x * 30.0 - uTime * 1.1);

            vec3 emerald = vec3(0.06, 0.82, 0.54);
            vec3 iceCyan = vec3(0.22, 0.74, 0.97);
            vec3 warmGold = vec3(0.98, 0.75, 0.22);

            vec3 col = mix(emerald, iceCyan, smoothstep(0.25, 0.85, vUv.y));
            col = mix(col, warmGold, smoothstep(0.75, 1.0, curtain) * 0.18);

            float alpha = verticalFade * horizontalFade * curtain * shimmer * 0.34;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
      const auroraMesh = new THREE.Mesh(auroraGeo, auroraMat)
      auroraMesh.position.set(0, 7.8, -26)
      auroraMesh.rotation.x = 0.18
      scene.add(auroraMesh)

      // 4. 3D Glowing Christmas North Star (Top-Right Sky)
      const computeStarPos = (aspect: number): THREE.Vector3 => {
        const dist = 37.4
        const halfH = Math.tan(THREE.MathUtils.degToRad(24)) * dist
        const halfW = halfH * Math.max(aspect, 0.5)
        return new THREE.Vector3(Math.max(4.8, halfW * 0.66), 7.9, -24)
      }

      const northStarGroup = new THREE.Group()
      northStarGroup.position.copy(computeStarPos(width / height))

      const northStarCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65, 0),
        new THREE.MeshBasicMaterial({ color: 0xfffbeb })
      )
      northStarCore.scale.set(0.75, 1.55, 0.45)
      northStarGroup.add(northStarCore)

      const northStarCross = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      )
      northStarCross.scale.set(1.65, 0.45, 0.45)
      northStarGroup.add(northStarCross)

      let starCorona: THREE.Sprite | null = null
      if (warmGlowTex) {
        const innerGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: warmGlowTex,
            color: 0xfef08a,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
        innerGlow.scale.set(5.5, 5.5, 1)
        northStarGroup.add(innerGlow)

        starCorona = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: warmGlowTex,
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
        starCorona.scale.set(12.5, 12.5, 1)
        northStarGroup.add(starCorona)
      }
      scene.add(northStarGroup)

      // 5. Distant Snowy Ridges & Frosted Foreground Ground
      const createSnowRidge = (zPos: number, yBase: number, colorHex: number, seedOffset: number) => {
        const shape = new THREE.Shape()
        shape.moveTo(-52, -7)
        const steps = 28
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const x = -52 + t * 104
          const peak =
            Math.sin(t * Math.PI * 3.5 + seedOffset) * 1.55 +
            Math.cos(t * Math.PI * 8 + seedOffset * 1.4) * 0.65 +
            Math.sin(t * Math.PI) * 1.15
          shape.lineTo(x, yBase + Math.max(0.25, peak))
        }
        shape.lineTo(52, -7)
        shape.closePath()

        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.94 })
        )
        mesh.position.z = zPos
        return mesh
      }

      scene.add(createSnowRidge(-22, -1.6, 0x071b2b, 0.6))
      scene.add(createSnowRidge(-16, -2.15, 0x05141e, 2.3))

      // Snowy ground hill
      const groundGeo = new THREE.PlaneGeometry(76, 36, 32, 16)
      const groundPos = groundGeo.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < groundPos.count; i++) {
        const gx = groundPos.getX(i)
        const gy = groundPos.getY(i)
        const undulation = Math.sin(gx * 0.22) * 0.22 + Math.cos(gy * 0.3) * 0.14
        groundPos.setZ(i, undulation)
      }
      groundGeo.computeVertexNormals()
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        emissive: 0x0b2538,
        emissiveIntensity: 0.35,
        roughness: 0.85,
      })
      const groundMesh = new THREE.Mesh(groundGeo, groundMat)
      groundMesh.rotation.x = -Math.PI / 2
      groundMesh.position.set(0, -2.35, -3)
      scene.add(groundMesh)

      // 6. Decorated 3D Christmas Pine Trees framing the left and right flanks
      const pineAssets = createSharedPineTreeAssets(warmGlowTex)
      const treeSpecs = [
        { x: -7.4, z: -2.2, scale: 1.38, seed: 0.5 },
        { x: -10.2, z: -6.4, scale: 1.75, seed: 1.8 },
        { x: -5.4, z: -8.6, scale: 1.25, seed: 3.1 },
        { x: 7.4, z: -2.4, scale: 1.42, seed: 2.4 },
        { x: 10.4, z: -6.8, scale: 1.82, seed: 4.2 },
        { x: 5.2, z: -8.8, scale: 1.18, seed: 5.5 },
      ]

      const pineTrees: PineTreeEntity[] = treeSpecs.map((spec) => {
        const tree = createDecoratedPineTree(pineAssets, spec.scale, spec.seed)
        tree.group.position.set(spec.x, -2.32, spec.z)
        scene.add(tree.group)
        return tree
      })

      // 7. Twinkling Starfield
      const starCount = isLowCoreDevice ? 110 : 190
      const starPositions = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 68
        starPositions[i * 3 + 1] = 1.5 + Math.random() * 18
        starPositions[i * 3 + 2] = -14 - Math.random() * 24
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
      const starFieldMat = new THREE.PointsMaterial({
        color: 0xf8fafc,
        map: iceGlowTex || undefined,
        size: 0.28,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const starField = new THREE.Points(starGeo, starFieldMat)
      scene.add(starField)

      // 8. Multi-Depth 3D Falling Snowflakes (Far + Near Crisp Crystals)
      const snowFarCount = isLowCoreDevice ? 180 : 340
      const snowFarPos = new Float32Array(snowFarCount * 3)
      const snowFarMeta = new Float32Array(snowFarCount * 2) // speed, phase
      for (let i = 0; i < snowFarCount; i++) {
        snowFarPos[i * 3] = (Math.random() - 0.5) * 34
        snowFarPos[i * 3 + 1] = -3 + Math.random() * 16
        snowFarPos[i * 3 + 2] = -12 + Math.random() * 14
        snowFarMeta[i * 2] = 0.55 + Math.random() * 0.65
        snowFarMeta[i * 2 + 1] = Math.random() * Math.PI * 2
      }
      const snowFarGeo = new THREE.BufferGeometry()
      snowFarGeo.setAttribute('position', new THREE.BufferAttribute(snowFarPos, 3))
      const snowFarMat = new THREE.PointsMaterial({
        color: 0xe0f2fe,
        map: iceGlowTex || undefined,
        size: 0.22,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const snowFarPoints = new THREE.Points(snowFarGeo, snowFarMat)
      scene.add(snowFarPoints)

      const snowNearCount = isLowCoreDevice ? 55 : 105
      const snowNearPos = new Float32Array(snowNearCount * 3)
      const snowNearMeta = new Float32Array(snowNearCount * 2)
      for (let i = 0; i < snowNearCount; i++) {
        snowNearPos[i * 3] = (Math.random() - 0.5) * 24
        snowNearPos[i * 3 + 1] = -2.5 + Math.random() * 14
        snowNearPos[i * 3 + 2] = 1 + Math.random() * 9.5
        snowNearMeta[i * 2] = 0.85 + Math.random() * 0.9
        snowNearMeta[i * 2 + 1] = Math.random() * Math.PI * 2
      }
      const snowNearGeo = new THREE.BufferGeometry()
      snowNearGeo.setAttribute('position', new THREE.BufferAttribute(snowNearPos, 3))
      const snowNearMat = new THREE.PointsMaterial({
        color: 0xffffff,
        map: snowflakeTex || iceGlowTex || undefined,
        size: 0.34,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const snowNearPoints = new THREE.Points(snowNearGeo, snowNearMat)
      scene.add(snowNearPoints)

      // 9. Floating Golden & Crimson Festive Bokeh Fairy Dust
      const bokehCount = isLowCoreDevice ? 22 : 40
      const bokehPos = new Float32Array(bokehCount * 3)
      const bokehColors = new Float32Array(bokehCount * 3)
      const bokehMeta = new Float32Array(bokehCount * 2)
      const palette = [
        new THREE.Color(0xfbbf24), // Champagne gold
        new THREE.Color(0xf87171), // Holly crimson
        new THREE.Color(0x34d399), // Pine emerald
      ]
      for (let i = 0; i < bokehCount; i++) {
        bokehPos[i * 3] = (Math.random() - 0.5) * 26
        bokehPos[i * 3 + 1] = -2.4 + Math.random() * 11.5
        bokehPos[i * 3 + 2] = -6 + Math.random() * 14
        bokehMeta[i * 2] = 0.16 + Math.random() * 0.25
        bokehMeta[i * 2 + 1] = Math.random() * Math.PI * 2
        const c = palette[i % palette.length]
        bokehColors[i * 3] = c.r
        bokehColors[i * 3 + 1] = c.g
        bokehColors[i * 3 + 2] = c.b
      }
      const bokehGeo = new THREE.BufferGeometry()
      bokehGeo.setAttribute('position', new THREE.BufferAttribute(bokehPos, 3))
      bokehGeo.setAttribute('color', new THREE.BufferAttribute(bokehColors, 3))
      const bokehMat = new THREE.PointsMaterial({
        size: 0.52,
        map: warmGlowTex || undefined,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const bokehPoints = new THREE.Points(bokehGeo, bokehMat)
      scene.add(bokehPoints)

      // 9b. 3D Flying Santa Claus & Sleigh with Reindeer Team + Stardust Trail
      const santaSleigh = createSantaSleigh(warmGlowTex, crimsonGlowTex)
      scene.add(santaSleigh.group)

      const trailCount = isLowCoreDevice ? 22 : 38
      const trailPositions = new Float32Array(trailCount * 3)
      for (let i = 0; i < trailCount; i++) {
        trailPositions[i * 3] = -30
        trailPositions[i * 3 + 1] = 5
        trailPositions[i * 3 + 2] = -10
      }
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
      const trailMat = new THREE.PointsMaterial({
        color: 0xfef08a,
        map: warmGlowTex || undefined,
        size: 0.42,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const santaTrailPoints = new THREE.Points(trailGeo, trailMat)
      scene.add(santaTrailPoints)
      let trailCursor = 0
      let trailSpawnAccum = 0

      // 10. Smooth Interactive Pointer Parallax
      const pointerTarget = { x: 0, y: 0 }
      const pointerCurrent = { x: 0, y: 0 }

      const handlePointerMove = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return
        const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1
        const ny = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1
        pointerTarget.x = nx * 0.7
        pointerTarget.y = -ny * 0.28
      }

      const handleResize = () => {
        if (!renderer || !host) return
        const nextW = host.clientWidth || window.innerWidth || 1280
        const nextH = host.clientHeight || window.innerHeight || 800
        const nextAspect = nextW / nextH
        camera.aspect = nextAspect
        camera.updateProjectionMatrix()
        renderer.setSize(nextW, nextH)
        northStarGroup.position.copy(computeStarPos(nextAspect))
      }

      // 11. Silky-Smooth Render Loop
      const clock = new THREE.Clock()
      let elapsed = 0

      const updateSnowLayer = (
        geo: THREE.BufferGeometry,
        meta: Float32Array,
        count: number,
        delta: number,
        windStrength: number,
        xWrap: number,
        yTop: number,
        yBottom: number
      ) => {
        const attr = geo.getAttribute('position') as THREE.BufferAttribute
        for (let i = 0; i < count; i++) {
          const speed = meta[i * 2]
          const phase = meta[i * 2 + 1]
          let px = attr.getX(i) + Math.sin(elapsed * 0.9 + phase) * windStrength * delta
          let py = attr.getY(i) - speed * delta
          if (py < yBottom) {
            py = yTop
            px = (Math.random() - 0.5) * xWrap * 2
          }
          if (px > xWrap) px = -xWrap
          if (px < -xWrap) px = xWrap
          attr.setXY(i, px, py)
        }
        attr.needsUpdate = true
      }

      const animate = () => {
        if (!isPageVisible) return

        const delta = Math.min(clock.getDelta(), 0.05)
        elapsed += delta

        auroraMat.uniforms.uTime.value = elapsed

        // Smooth exponential pointer parallax
        const lerpAlpha = 1 - Math.exp(-3.4 * delta)
        pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * lerpAlpha
        pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * lerpAlpha

        camera.position.x = pointerCurrent.x
        camera.position.y = 1.35 + pointerCurrent.y + Math.sin(elapsed * 0.45) * 0.06
        camera.lookAt(cameraLookTarget)

        // North Star gentle pulse & rotation
        northStarCore.rotation.y = elapsed * 0.45
        northStarCross.rotation.z = Math.sin(elapsed * 0.8) * 0.1
        if (starCorona) {
          const coronaScale = 12.2 + Math.sin(elapsed * 1.9) * 1.1
          starCorona.scale.set(coronaScale, coronaScale, 1)
        }

        // Pine trees gentle winter breeze sway + twinkling ornaments
        pineTrees.forEach((tree) => {
          tree.group.rotation.z = Math.sin(elapsed * 0.85 + tree.swayPhase) * 0.018
          tree.starMesh.rotation.y = elapsed * 0.8 + tree.swayPhase
          if (tree.starHalo) {
            const sPulse = 1.12 + Math.sin(elapsed * 2.6 + tree.swayPhase) * 0.16
            tree.starHalo.scale.set(sPulse, sPulse, 1)
          }
          tree.ornaments.forEach((orn) => {
            const twinkle = 0.55 + 0.45 * Math.sin(elapsed * 3.1 + orn.phase)
            orn.mesh.scale.setScalar(0.85 + twinkle * 0.3)
            if (orn.halo) {
              const hScale = orn.baseScale * (0.85 + twinkle * 0.55)
              orn.halo.scale.set(hScale, hScale, 1)
            }
          })
        })

        // Starfield subtle twinkle
        starField.rotation.y = Math.sin(elapsed * 0.06) * 0.025
        starFieldMat.opacity = 0.68 + Math.sin(elapsed * 1.9) * 0.16

        // Snowfall layers
        updateSnowLayer(snowFarGeo, snowFarMeta, snowFarCount, delta, 0.38, 17, 13, -2.6)
        updateSnowLayer(snowNearGeo, snowNearMeta, snowNearCount, delta, 0.62, 12, 11.5, -2.5)

        // Floating festive bokeh
        const bokehAttr = bokehGeo.getAttribute('position') as THREE.BufferAttribute
        for (let i = 0; i < bokehCount; i++) {
          const speed = bokehMeta[i * 2]
          const phase = bokehMeta[i * 2 + 1]
          let by = bokehAttr.getY(i) + speed * delta
          const bx = bokehAttr.getX(i) + Math.sin(elapsed * 0.7 + phase) * 0.25 * delta
          if (by > 9.5) by = -2.4
          bokehAttr.setXY(i, bx, by)
        }
        bokehAttr.needsUpdate = true
        bokehMat.opacity = 0.56 + Math.sin(elapsed * 1.5) * 0.12

        // Santa Sleigh smooth swooping flight across the upper starry aurora sky (clearly above card)
        const distToSanta = 19.2 // camera z (13.4) - santa base z (-5.8)
        const halfHAtSanta = Math.tan(THREE.MathUtils.degToRad(24)) * distToSanta
        const halfWAtSanta = halfHAtSanta * Math.max(camera.aspect, 0.5)
        const xSpan = Math.max(8.5, Math.min(16.5, halfWAtSanta + 4.2))

        const flightDuration = 11.5
        const flightPhase = ((elapsed + 2.2) % flightDuration) / flightDuration
        const sx = -xSpan + flightPhase * (xSpan * 2)
        const sy = 6.45 + Math.sin(flightPhase * Math.PI * 2) * 0.58
        const sz = -6.0 + Math.sin(flightPhase * Math.PI) * 1.4
        const dYdX = (Math.PI * 2 * 0.58 * Math.cos(flightPhase * Math.PI * 2)) / (xSpan * 2)

        santaSleigh.group.position.set(sx, sy, sz)
        santaSleigh.group.rotation.z = Math.atan(dYdX) * 0.88
        santaSleigh.group.rotation.y = -0.14 + Math.cos(flightPhase * Math.PI) * 0.16

        // Lively Santa bounce, head nod & joyful arm wave
        santaSleigh.santaBody.position.y = 0.42 + Math.abs(Math.sin(elapsed * 4.8)) * 0.055
        santaSleigh.santaBody.rotation.z = Math.sin(elapsed * 3.2) * 0.08
        santaSleigh.santaArmPivot.rotation.z = 0.25 + Math.sin(elapsed * 6.8) * 0.65
        santaSleigh.santaArmPivot.rotation.x = 0.35 + Math.cos(elapsed * 6.8) * 0.18
        santaSleigh.giftSack.scale.setScalar(1 + Math.sin(elapsed * 4.8 + 0.6) * 0.04)

        if (santaSleigh.lanternHalo) {
          const lScale = 0.96 + Math.sin(elapsed * 7.5) * 0.16
          santaSleigh.lanternHalo.scale.set(lScale, lScale, 1)
        }

        santaSleigh.reindeers.forEach((deer) => {
          const gallop = Math.sin(elapsed * 10.5 + deer.phase)
          deer.group.position.y = 0.08 + Math.abs(gallop) * 0.11
          deer.group.rotation.z = Math.cos(elapsed * 10.5 + deer.phase) * 0.13
          deer.frontLegs.forEach((leg, lIdx) => {
            leg.rotation.z = 0.65 * Math.sin(elapsed * 10.5 + deer.phase + lIdx * 0.4)
          })
          deer.backLegs.forEach((leg, lIdx) => {
            leg.rotation.z = -0.65 * Math.sin(elapsed * 10.5 + deer.phase + lIdx * 0.4)
          })
          if (deer.rudolphHalo) {
            const rScale = 0.98 + Math.sin(elapsed * 8.5) * 0.2
            deer.rudolphHalo.scale.set(rScale, rScale, 1)
          }
        })

        // Emit sparkling golden stardust trail behind sleigh runners
        const trailAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute
        trailSpawnAccum += delta
        if (trailSpawnAccum >= 0.03) {
          trailSpawnAccum = 0
          trailAttr.setXYZ(
            trailCursor,
            sx - 0.82 + (Math.random() - 0.5) * 0.35,
            sy - 0.15 + (Math.random() - 0.5) * 0.3,
            sz + (Math.random() - 0.5) * 0.35
          )
          trailCursor = (trailCursor + 1) % trailCount
        }
        for (let i = 0; i < trailCount; i++) {
          trailAttr.setXYZ(
            i,
            trailAttr.getX(i) - 0.85 * delta,
            trailAttr.getY(i) - 0.28 * delta,
            trailAttr.getZ(i)
          )
        }
        trailAttr.needsUpdate = true
        trailMat.opacity = 0.72 + Math.sin(elapsed * 4.5) * 0.15

        renderer?.render(scene, camera)
        animationFrameId = window.requestAnimationFrame(animate)
      }

      const handleVisibilityChange = () => {
        isPageVisible = !document.hidden
        if (isPageVisible) {
          clock.getDelta()
          window.cancelAnimationFrame(animationFrameId)
          animationFrameId = window.requestAnimationFrame(animate)
        } else {
          window.cancelAnimationFrame(animationFrameId)
        }
      }

      window.addEventListener('pointermove', handlePointerMove, { passive: true })
      window.addEventListener('resize', handleResize)
      document.addEventListener('visibilitychange', handleVisibilityChange)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(handleResize)
        resizeObserver.observe(host)
      }

      animate()

      return () => {
        window.cancelAnimationFrame(animationFrameId)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('resize', handleResize)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        resizeObserver?.disconnect()

        const geometries = new Set<THREE.BufferGeometry>()
        const materials = new Set<THREE.Material>()

        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
            if (obj.geometry) geometries.add(obj.geometry)
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => materials.add(m))
            } else if (obj.material) {
              materials.add(obj.material)
            }
          } else if (obj instanceof THREE.Sprite && obj.material) {
            materials.add(obj.material)
          }
        })

        geometries.forEach((g) => g.dispose())
        materials.forEach((m) => m.dispose())
        warmGlowTex?.dispose()
        iceGlowTex?.dispose()
        crimsonGlowTex?.dispose()
        snowflakeTex?.dispose()
        renderer?.dispose()
      }
    } catch {
      return undefined
    }
  }, [isActive])

  if (!isActive) {
    return null
  }

  return (
    <div className={styles.seasonWrapper} aria-hidden="true" data-testid="christmas-scene">
      {/* Winter horizon aurora mist */}
      <div className={styles.horizonMist} />

      {/* Top fairy light garland */}
      <div className={styles.fairyGarland}>
        <svg className={styles.fairyGarlandCord} viewBox="0 0 1200 44" preserveAspectRatio="none">
          <path
            d="M0 10 Q 150 38 300 12 T 600 12 T 900 12 T 1200 10"
            fill="none"
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth="1.5"
          />
        </svg>
        {FAIRY_BULB_OFFSETS.map((topOffset, index) => (
          <span
            key={index}
            className={`${styles.fairyBulb} ${FAIRY_BULB_CLASSES[index % FAIRY_BULB_CLASSES.length]}`}
            style={{
              marginTop: `${topOffset}px`,
              animationDelay: `${(index % 5) * 0.55}s`,
            }}
          />
        ))}
      </div>

      {/* Three.js 3D WebGL Canvas Stage */}
      <div
        ref={containerRef}
        className={styles.webglCanvasHost}
        data-testid="christmas-3d-stage"
      />

      {/* Atmospheric vignette & frosted snowflake corner frames */}
      <div className={styles.atmosphericVignette} />
      <FrostCornerOrnament className={styles.cornerFrostTopLeft} />
      <FrostCornerOrnament className={styles.cornerFrostBottomRight} />
    </div>
  )
}
