'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import * as THREE from 'three'
import styles from './LoyKrathongScene.module.css'

/**
 * Checks if the given date falls into the annual Loy Krathong window (Nov 1 - Nov 30).
 * Evaluation is based on Thailand local time (UTC+7).
 */
export function isLoyKrathongSeason(now: Date = new Date()): boolean {
  const bangkokDateStr = now.toLocaleDateString('en-US', {
    timeZone: 'Asia/Bangkok',
    month: 'numeric',
    day: 'numeric',
  })
  const [monthStr, dayStr] = bangkokDateStr.split('/')
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (month === 11 && day <= 30) return true
  return false
}

export type LoyKrathongCameraView = 'river' | 'sky'

export interface LoyKrathongLaunchDetail {
  wish?: string
}

/**
 * Helper to dispatch a new 3D Krathong & Yee Peng lantern launch into the Three.js scene
 */
export function triggerLoyKrathongLaunch(detail?: LoyKrathongLaunchDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('loy-krathong:launch', { detail }))
  }
}

/**
 * Helper to switch the 3D camera perspective between Riverbank and Yee Peng Sky
 */
export function setLoyKrathongCameraView(view: LoyKrathongCameraView): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('loy-krathong:camera', { detail: { view } }))
  }
}

/**
 * Evaluates wave elevation at world (x, z) and time t so 3D Krathongs bob and tilt accurately on the shader water
 */
function sampleRiverWaveHeight(x: number, z: number, t: number): number {
  const w1 = Math.sin(x * 0.45 + t * 1.65) * 0.12
  const w2 = Math.cos(z * 0.58 - t * 1.25) * 0.09
  const w3 = Math.sin(x * 0.72 + z * 0.48 + t * 2.1) * 0.055
  return w1 + w2 + w3
}

/**
 * Creates a soft radial glow texture on an offscreen 2D canvas for Three.js sprites/particles
 */
function createRadialGlowTexture(innerColor: string, midColor: string, outerColor: string): THREE.CanvasTexture | null {
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

type KrathongHue = 'rose' | 'gold' | 'emerald'

interface SharedKrathongAssets {
  baseGeo: THREE.CylinderGeometry
  baseMat: THREE.MeshLambertMaterial
  trimGeo: THREE.TorusGeometry
  trimMat: THREE.MeshLambertMaterial
  leafGeo: THREE.ConeGeometry
  leafMat: THREE.MeshLambertMaterial
  petalGeo: THREE.ConeGeometry
  petalMats: Record<KrathongHue, THREE.MeshLambertMaterial>
  marigoldGeo: THREE.SphereGeometry
  marigoldMat: THREE.MeshLambertMaterial
  stickGeo: THREE.CylinderGeometry
  stickMat: THREE.MeshBasicMaterial
  emberGeo: THREE.SphereGeometry
  emberMat: THREE.MeshBasicMaterial
  candleGeo: THREE.CylinderGeometry
  candleMat: THREE.MeshLambertMaterial
  flameGeo: THREE.ConeGeometry
  flameMat: THREE.MeshBasicMaterial
  rippleGeo: THREE.RingGeometry
  glowMat: THREE.SpriteMaterial | null
}

function createSharedKrathongAssets(glowTexture: THREE.Texture | null): SharedKrathongAssets {
  return {
    baseGeo: new THREE.CylinderGeometry(0.68, 0.56, 0.18, 16),
    baseMat: new THREE.MeshLambertMaterial({
      color: 0x14532d,
      emissive: 0x052e16,
      emissiveIntensity: 0.45,
    }),
    trimGeo: new THREE.TorusGeometry(0.64, 0.026, 6, 20),
    trimMat: new THREE.MeshLambertMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.55,
    }),
    leafGeo: new THREE.ConeGeometry(0.22, 0.48, 4),
    leafMat: new THREE.MeshLambertMaterial({
      color: 0x22c55e,
      emissive: 0x064e3b,
      emissiveIntensity: 0.45,
    }),
    petalGeo: new THREE.ConeGeometry(0.19, 0.4, 5),
    petalMats: {
      rose: new THREE.MeshLambertMaterial({ color: 0xfb7185, emissive: 0xbe123c, emissiveIntensity: 0.65 }),
      gold: new THREE.MeshLambertMaterial({ color: 0xfcd34d, emissive: 0xd97706, emissiveIntensity: 0.65 }),
      emerald: new THREE.MeshLambertMaterial({ color: 0x6ee7b7, emissive: 0x059669, emissiveIntensity: 0.65 }),
    },
    marigoldGeo: new THREE.SphereGeometry(0.095, 6, 6),
    marigoldMat: new THREE.MeshLambertMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
    }),
    stickGeo: new THREE.CylinderGeometry(0.011, 0.011, 0.6, 5),
    stickMat: new THREE.MeshBasicMaterial({ color: 0xa16207 }),
    emberGeo: new THREE.SphereGeometry(0.026, 5, 5),
    emberMat: new THREE.MeshBasicMaterial({ color: 0xf87171 }),
    candleGeo: new THREE.CylinderGeometry(0.055, 0.06, 0.48, 8),
    candleMat: new THREE.MeshLambertMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
    }),
    flameGeo: new THREE.ConeGeometry(0.082, 0.28, 8),
    flameMat: new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
    rippleGeo: new THREE.RingGeometry(0.72, 0.92, 20),
    glowMat: glowTexture
      ? new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      : null,
  }
}

/**
 * Builds a detailed 3D Krathong (กระทงใบตองดอกบัว) Group reusing shared geometries & materials
 */
function create3DKrathong(
  assets: SharedKrathongAssets,
  scale = 1,
  variantHue: KrathongHue = 'rose'
): {
  group: THREE.Group
  flameMesh: THREE.Mesh
  haloSprite: THREE.Sprite | null
  rippleRing: THREE.Mesh
} {
  const group = new THREE.Group()

  const baseMesh = new THREE.Mesh(assets.baseGeo, assets.baseMat)
  baseMesh.position.y = 0.09
  group.add(baseMesh)

  const trimMesh = new THREE.Mesh(assets.trimGeo, assets.trimMat)
  trimMesh.rotation.x = Math.PI / 2
  trimMesh.position.y = 0.14
  group.add(trimMesh)

  // Outer Folded Banana Leaf Cones (8 petals)
  const outerCount = 8
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2
    const leaf = new THREE.Mesh(assets.leafGeo, assets.leafMat)
    leaf.position.set(Math.cos(angle) * 0.54, 0.28, Math.sin(angle) * 0.54)
    leaf.rotation.y = -angle
    leaf.rotation.z = -0.38
    group.add(leaf)
  }

  // Inner Lotus Petals (6 petals)
  const petalMat = assets.petalMats[variantHue]
  const innerCount = 6
  for (let i = 0; i < innerCount; i++) {
    const angle = ((i + 0.5) / innerCount) * Math.PI * 2
    const petal = new THREE.Mesh(assets.petalGeo, petalMat)
    petal.position.set(Math.cos(angle) * 0.36, 0.35, Math.sin(angle) * 0.36)
    petal.rotation.y = -angle
    petal.rotation.z = -0.22
    group.add(petal)
  }

  // Marigold Inner Ring (4 flowers)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const flower = new THREE.Mesh(assets.marigoldGeo, assets.marigoldMat)
    flower.position.set(Math.cos(angle) * 0.2, 0.27, Math.sin(angle) * 0.2)
    group.add(flower)
  }

  // Three Incense Sticks
  const stickAngles = [-0.14, 0, 0.14]
  stickAngles.forEach((tilt, idx) => {
    const stick = new THREE.Mesh(assets.stickGeo, assets.stickMat)
    stick.position.set((idx - 1) * 0.05, 0.49, -0.06)
    stick.rotation.z = tilt
    group.add(stick)

    const ember = new THREE.Mesh(assets.emberGeo, assets.emberMat)
    ember.position.set((idx - 1) * 0.088, 0.78, -0.06)
    group.add(ember)
  })

  // Central Beeswax Candle & Flame
  const candleMesh = new THREE.Mesh(assets.candleGeo, assets.candleMat)
  candleMesh.position.y = 0.45
  group.add(candleMesh)

  const flameMesh = new THREE.Mesh(assets.flameGeo, assets.flameMat)
  flameMesh.position.y = 0.81
  group.add(flameMesh)

  let haloSprite: THREE.Sprite | null = null
  if (assets.glowMat) {
    haloSprite = new THREE.Sprite(assets.glowMat)
    haloSprite.scale.set(1.85, 1.85, 1)
    haloSprite.position.set(0, 0.82, 0)
    group.add(haloSprite)
  }

  // Per-krathong ripple material so opacity animates independently
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const rippleRing = new THREE.Mesh(assets.rippleGeo, rippleMat)
  rippleRing.rotation.x = -Math.PI / 2
  rippleRing.position.y = 0.04
  group.add(rippleRing)

  group.scale.setScalar(scale)
  return { group, flameMesh, haloSprite, rippleRing }
}

interface SharedLanternAssets {
  bodyGeo: THREE.CylinderGeometry
  bodyMat: THREE.MeshLambertMaterial
  capGeo: THREE.SphereGeometry
  capMat: THREE.MeshLambertMaterial
  rimGeo: THREE.TorusGeometry
  rimMat: THREE.MeshBasicMaterial
  coreGeo: THREE.SphereGeometry
  coreMat: THREE.MeshBasicMaterial
  glowMat: THREE.SpriteMaterial | null
}

function createSharedLanternAssets(glowTexture: THREE.Texture | null): SharedLanternAssets {
  return {
    bodyGeo: new THREE.CylinderGeometry(0.36, 0.25, 0.88, 12, 1, true),
    bodyMat: new THREE.MeshLambertMaterial({
      color: 0xffedd5,
      emissive: 0xf97316,
      emissiveIntensity: 0.95,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
    }),
    capGeo: new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.48),
    capMat: new THREE.MeshLambertMaterial({
      color: 0xfff7ed,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
    }),
    rimGeo: new THREE.TorusGeometry(0.25, 0.02, 6, 14),
    rimMat: new THREE.MeshBasicMaterial({ color: 0x78350f }),
    coreGeo: new THREE.SphereGeometry(0.095, 6, 6),
    coreMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    glowMat: glowTexture
      ? new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      : null,
  }
}

/**
 * Builds a 3D Yee Peng Sky Lantern (โคมลอยยี่เป็งล้านนา) Group reusing shared geometries & materials
 */
function create3DLantern(
  assets: SharedLanternAssets,
  scale = 1
): { group: THREE.Group; haloSprite: THREE.Sprite | null } {
  const group = new THREE.Group()

  group.add(new THREE.Mesh(assets.bodyGeo, assets.bodyMat))

  const capMesh = new THREE.Mesh(assets.capGeo, assets.capMat)
  capMesh.position.y = 0.43
  capMesh.scale.y = 0.42
  group.add(capMesh)

  const rimMesh = new THREE.Mesh(assets.rimGeo, assets.rimMat)
  rimMesh.rotation.x = Math.PI / 2
  rimMesh.position.y = -0.44
  group.add(rimMesh)

  const coreMesh = new THREE.Mesh(assets.coreGeo, assets.coreMat)
  coreMesh.position.y = -0.32
  group.add(coreMesh)

  let haloSprite: THREE.Sprite | null = null
  if (assets.glowMat) {
    haloSprite = new THREE.Sprite(assets.glowMat)
    haloSprite.scale.set(2.1, 2.1, 1)
    haloSprite.position.y = -0.1
    group.add(haloSprite)
  }

  group.scale.setScalar(scale)
  return { group, haloSprite }
}

/**
 * Builds a 3D Firework Burst Particle System in the Night Sky
 */
interface FireworkBurstEntity {
  points: THREE.Points
  velocities: Float32Array
  age: number
  lifetime: number
  material: THREE.PointsMaterial
}

function create3DFireworkBurst(
  origin: THREE.Vector3,
  colorHex: number,
  glowTexture: THREE.Texture | null,
  particleCount = 40
): FireworkBurstEntity {
  const positions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = origin.x
    positions[i * 3 + 1] = origin.y
    positions[i * 3 + 2] = origin.z

    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const speed = 1.6 + Math.random() * 2.4

    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.cos(phi) * speed * 0.85 + 0.5
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.45
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: colorHex,
    size: 0.45,
    map: glowTexture || undefined,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const points = new THREE.Points(geo, material)
  return {
    points,
    velocities,
    age: 0,
    lifetime: 2.0 + Math.random() * 0.7,
    material,
  }
}

/**
 * Subtle Lanna Gold Corner Filigree SVG
 */
function LannaCornerOrnament({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8 112V28C8 16.9543 16.9543 8 28 8H112"
        stroke="url(#lannaGold)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 96V34C16 24.0589 24.0589 16 34 16H96"
        stroke="url(#lannaGold)"
        strokeWidth="0.9"
        strokeDasharray="3 3"
      />
      <path
        d="M28 28L42 18L36 36L18 42L28 28Z"
        fill="#FBBF24"
        fillOpacity="0.45"
      />
      <circle cx="28" cy="28" r="3" fill="#FEF08A" />
      <defs>
        <linearGradient id="lannaGold" x1="8" y1="8" x2="112" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/**
 * LoyKrathongScene Component
 * Renders a GPU-optimized Three.js 3D Night River, Floating Krathongs, Fireworks & Ascending Yee Peng Lanterns
 * during the annual festival window (Nov 1-30) or when `?theme=loy-krathong` is active.
 */
export default function LoyKrathongScene() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const themeParam = searchParams.get('theme')
  const isDisabledByParam = themeParam === 'normal' || themeParam === 'halloween'
  const isQueryActive = themeParam === 'loy-krathong'
  const isDateActive = isLoyKrathongSeason()
  const isActive = mounted && !isDisabledByParam && (isQueryActive || isDateActive)

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

      // 1. Initialize Scene, Fog & Camera
      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x040914, 0.018)

      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 160)
      camera.position.set(0, 1.55, 13.2)
      const cameraLookTarget = new THREE.Vector3(0, -0.35, -3.5)
      camera.lookAt(cameraLookTarget)

      // Cap pixel ratio at 1.5 (1.0 on <=4 CPU core machines) to keep office/integrated GPUs smooth
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
      renderer.toneMappingExposure = 1.25

      host.innerHTML = ''
      host.appendChild(renderer.domElement)

      // 2. Scene Lighting
      scene.add(new THREE.AmbientLight(0x334155, 1.3))

      const moonDirLight = new THREE.DirectionalLight(0xfef08a, 1.65)
      moonDirLight.position.set(20, 12.6, -20)
      scene.add(moonDirLight)

      const riverCandleLight = new THREE.PointLight(0xf59e0b, 3.6, 30, 1.2)
      riverCandleLight.position.set(-1.5, 0.4, 5.5)
      scene.add(riverCandleLight)

      // Shared radial glow textures
      const goldGlowTex = createRadialGlowTexture(
        'rgba(255, 255, 255, 1)',
        'rgba(251, 191, 36, 0.62)',
        'rgba(234, 88, 12, 0)'
      )
      const moonGlowTex = createRadialGlowTexture(
        'rgba(255, 253, 240, 0.98)',
        'rgba(254, 240, 138, 0.42)',
        'rgba(234, 179, 8, 0)'
      )

      // Helper to position the 3D moon cleanly in the top-right sky across any viewport aspect
      const computeTopRightMoonPos = (aspect: number): THREE.Vector3 => {
        const distToMoon = 38.2 // camera z (13.2) - moon z (-25)
        const halfH = Math.tan(THREE.MathUtils.degToRad(24)) * distToMoon
        const halfW = halfH * Math.max(aspect, 0.5)
        const moonX = Math.max(5.8, halfW * 0.76)
        const moonY = 10.6
        return new THREE.Vector3(moonX, moonY, -25)
      }

      const initialMoonPos = computeTopRightMoonPos(width / height)

      // 3. 3D Full Moon & Volumetric Corona
      const moonGroup = new THREE.Group()
      moonGroup.position.copy(initialMoonPos)
      moonDirLight.position.set(initialMoonPos.x, initialMoonPos.y + 2, -20)

      const moonGeo = new THREE.SphereGeometry(2.15, 24, 24)
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb })
      moonGroup.add(new THREE.Mesh(moonGeo, moonMat))

      let moonOuterHalo: THREE.Sprite | null = null
      if (moonGlowTex) {
        const innerHaloMat = new THREE.SpriteMaterial({
          map: moonGlowTex,
          color: 0xfef08a,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const innerHalo = new THREE.Sprite(innerHaloMat)
        innerHalo.scale.set(12, 12, 1)
        moonGroup.add(innerHalo)

        const outerHaloMat = new THREE.SpriteMaterial({
          map: moonGlowTex,
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.44,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        moonOuterHalo = new THREE.Sprite(outerHaloMat)
        moonOuterHalo.scale.set(24, 24, 1)
        moonGroup.add(moonOuterHalo)
      }
      scene.add(moonGroup)

      // 4. Distant Lanna Mountain Range Silhouette
      const createMountainRidge = (zPos: number, yBase: number, colorHex: number, seedOffset: number) => {
        const shape = new THREE.Shape()
        shape.moveTo(-48, -6)
        const steps = 24
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const x = -48 + t * 96
          const peak =
            Math.sin(t * Math.PI * 3 + seedOffset) * 1.65 +
            Math.cos(t * Math.PI * 7 + seedOffset * 1.7) * 0.75 +
            Math.sin(t * Math.PI) * 1.4
          shape.lineTo(x, yBase + Math.max(0.2, peak))
        }
        shape.lineTo(48, -6)
        shape.closePath()

        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.94 })
        )
        mesh.position.z = zPos
        return mesh
      }

      scene.add(createMountainRidge(-23, -1.5, 0x061024, 0.4))
      scene.add(createMountainRidge(-17.5, -2.0, 0x030814, 2.1))

      // 5. 3D Animated Water Surface (56x40 segments & 6 krathong light pools for low GPU overhead)
      const MAX_KRATHONG_LIGHTS = 6
      const krathongLightUniforms: THREE.Vector3[] = Array.from(
        { length: MAX_KRATHONG_LIGHTS },
        () => new THREE.Vector3(999, -2.3, 999)
      )

      const waterGeo = new THREE.PlaneGeometry(80, 46, 56, 40)
      const waterMat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uMoonPos: { value: initialMoonPos.clone() },
          uKrathongLights: { value: krathongLightUniforms },
        },
        vertexShader: `
          uniform float uTime;
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vCustomNormal;

          float waveHeight(vec2 p, float t) {
            float w1 = sin(p.x * 0.45 + t * 1.65) * 0.12;
            float w2 = cos(p.y * 0.58 - t * 1.25) * 0.09;
            float w3 = sin((p.x * 0.72 + p.y * 0.48) + t * 2.1) * 0.055;
            return w1 + w2 + w3;
          }

          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            float h = waveHeight(worldPosition.xz, uTime);
            worldPosition.y += h;

            float eps = 0.16;
            float hx = waveHeight(worldPosition.xz + vec2(eps, 0.0), uTime);
            float hz = waveHeight(worldPosition.xz + vec2(0.0, eps), uTime);
            vCustomNormal = normalize(vec3(h - hx, eps * 2.0, h - hz));

            vWorldPos = worldPosition.xyz;
            vWaveHeight = h;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uMoonPos;
          uniform vec3 uKrathongLights[${MAX_KRATHONG_LIGHTS}];
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vCustomNormal;

          void main() {
            vec3 deepWater = vec3(0.020, 0.058, 0.122);
            vec3 midWater = vec3(0.045, 0.145, 0.240);
            vec3 emeraldCrest = vec3(0.09, 0.48, 0.38);

            float crestFactor = smoothstep(-0.16, 0.20, vWaveHeight);
            vec3 color = mix(deepWater, midWater, crestFactor);
            color = mix(color, emeraldCrest, smoothstep(0.08, 0.24, vWaveHeight) * 0.42);

            vec2 toMoon = normalize(uMoonPos.xz - vWorldPos.xz);
            float moonAlign = max(0.0, dot(normalize(vCustomNormal.xz), toMoon));
            float moonReflectX = uMoonPos.x * clamp((13.2 - vWorldPos.z) / 38.2, 0.15, 1.0);
            float moonColumn = exp(-pow((vWorldPos.x - moonReflectX) * 0.19, 2.0));
            float shimmer = pow(max(0.0, vCustomNormal.y), 5.0) * (0.5 + 0.5 * sin(vWorldPos.z * 3.8 - uTime * 4.2));
            color += vec3(0.99, 0.92, 0.54) * moonColumn * (0.34 + shimmer * 0.65 + moonAlign * 0.32);

            vec3 candleGlowTotal = vec3(0.0);
            for (int i = 0; i < ${MAX_KRATHONG_LIGHTS}; i++) {
              vec3 kPos = uKrathongLights[i];
              float dist = length(vWorldPos.xz - kPos.xz);
              float atten = exp(-dist * dist * 0.45);
              float rippleGlint = 0.72 + 0.28 * sin(dist * 9.5 - uTime * 5.2);
              candleGlowTotal += vec3(0.99, 0.68, 0.16) * atten * rippleGlint * 1.05;
            }
            color += candleGlowTotal;

            float distFromCenter = length(vWorldPos.xz * vec2(0.025, 0.04));
            float alpha = clamp(1.0 - smoothstep(0.68, 1.15, distFromCenter), 0.0, 0.96);

            gl_FragColor = vec4(color, alpha);
          }
        `,
      })

      const waterMesh = new THREE.Mesh(waterGeo, waterMat)
      waterMesh.rotation.x = -Math.PI / 2
      waterMesh.position.set(0, -2.35, -2)
      scene.add(waterMesh)

      // 6. Floating 3D Krathongs on the River (6 krathongs with shared geometries/materials)
      const sharedKrathongAssets = createSharedKrathongAssets(goldGlowTex)
      interface KrathongEntity {
        group: THREE.Group
        flameMesh: THREE.Mesh
        haloSprite: THREE.Sprite | null
        rippleRing: THREE.Mesh
        speed: number
        baseZ: number
        phase: number
      }

      const krathongs: KrathongEntity[] = []
      const initialKrathongSpecs: Array<{
        x: number
        z: number
        scale: number
        speed: number
        hue: KrathongHue
      }> = [
        { x: -9.5, z: 5.8, scale: 1.42, speed: 1.12, hue: 'gold' },
        { x: -4.2, z: 6.8, scale: 1.55, speed: 1.24, hue: 'rose' },
        { x: 2.6, z: 5.4, scale: 1.28, speed: 1.02, hue: 'emerald' },
        { x: 7.5, z: 4.0, scale: 1.14, speed: 0.94, hue: 'rose' },
        { x: -6.5, z: 2.0, scale: 1.02, speed: 0.84, hue: 'emerald' },
        { x: 4.8, z: 0.6, scale: 0.92, speed: 0.76, hue: 'gold' },
      ]

      initialKrathongSpecs.forEach((spec, idx) => {
        const { group, flameMesh, haloSprite, rippleRing } = create3DKrathong(
          sharedKrathongAssets,
          spec.scale,
          spec.hue
        )
        group.position.set(spec.x, -2.32, spec.z)
        scene.add(group)
        krathongs.push({
          group,
          flameMesh,
          haloSprite,
          rippleRing,
          speed: spec.speed,
          baseZ: spec.z,
          phase: idx * 1.37,
        })
      })

      // 7. Ascending 3D Yee Peng Sky Lanterns (18 lanterns sharing geometries/materials)
      const sharedLanternAssets = createSharedLanternAssets(goldGlowTex)
      interface LanternEntity {
        group: THREE.Group
        haloSprite: THREE.Sprite | null
        speedY: number
        swayAmp: number
        swayFreq: number
        rotSpeed: number
        phase: number
        baseX: number
      }

      const lanterns: LanternEntity[] = []
      const lanternCount = 18
      for (let i = 0; i < lanternCount; i++) {
        const depthFactor = (i % 6) / 5
        const scale = 0.68 + depthFactor * 0.62
        const { group: lanternGroup, haloSprite } = create3DLantern(sharedLanternAssets, scale)

        const startX = -16 + ((i * 3.8) % 32)
        const startY = -1.6 + ((i * 2.1) % 14.5)
        const startZ = -14 + depthFactor * 13

        lanternGroup.position.set(startX, startY, startZ)
        scene.add(lanternGroup)

        lanterns.push({
          group: lanternGroup,
          haloSprite,
          speedY: 0.78 + depthFactor * 0.62,
          swayAmp: 0.36 + (i % 3) * 0.16,
          swayFreq: 0.65 + (i % 4) * 0.14,
          rotSpeed: (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 3) * 0.1),
          phase: i * 0.95,
          baseX: startX,
        })
      }

      // 8. Twinkling 3D Starfield & Rising Golden Fireflies
      const starCount = 120
      const starPositions = new Float32Array(starCount * 3)
      for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 76
        starPositions[i * 3 + 1] = 0.2 + Math.random() * 22
        starPositions[i * 3 + 2] = -28 + Math.random() * 14
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
      const starMat = new THREE.PointsMaterial({
        color: 0xfef9c3,
        size: 0.24,
        map: goldGlowTex || undefined,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const starParticles = new THREE.Points(starGeo, starMat)
      scene.add(starParticles)

      // Golden Fireflies & River Embers
      const fireflyCount = 65
      const fireflyPositions = new Float32Array(fireflyCount * 3)
      const fireflySpeeds = new Float32Array(fireflyCount)
      for (let i = 0; i < fireflyCount; i++) {
        fireflyPositions[i * 3] = (Math.random() - 0.5) * 32
        fireflyPositions[i * 3 + 1] = -2.2 + Math.random() * 11
        fireflyPositions[i * 3 + 2] = -8 + Math.random() * 17
        fireflySpeeds[i] = 0.55 + Math.random() * 0.95
      }
      const fireflyGeo = new THREE.BufferGeometry()
      fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3))
      const fireflyMat = new THREE.PointsMaterial({
        color: 0xfbbf24,
        size: 0.38,
        map: goldGlowTex || undefined,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const fireflyParticles = new THREE.Points(fireflyGeo, fireflyMat)
      scene.add(fireflyParticles)

      // 9. 3D Sky Firework Bursts
      const fireworks: FireworkBurstEntity[] = []
      const fireworkColors = [0xfbbf24, 0xfb7185, 0x34d399, 0xfde047]
      let fireworkTimer = 0.8

      const spawnFirework = (customOrigin?: THREE.Vector3, customColor?: number) => {
        const origin =
          customOrigin ||
          new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            3.2 + Math.random() * 4.5,
            -12 - Math.random() * 6
          )
        const color = customColor ?? fireworkColors[Math.floor(Math.random() * fireworkColors.length)]
        const burst = create3DFireworkBurst(origin, color, goldGlowTex)
        scene.add(burst.points)
        fireworks.push(burst)
      }

      spawnFirework(new THREE.Vector3(-4.5, 4.8, -13), 0xfbbf24)

      // 10. Interactive Mouse Parallax & Camera View State
      const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
      let activeCameraMode: LoyKrathongCameraView = 'river'

      const handlePointerMove = (e: PointerEvent) => {
        const nx = (e.clientX / (window.innerWidth || 1)) * 2 - 1
        const ny = (e.clientY / (window.innerHeight || 1)) * 2 - 1
        pointer.targetX = nx
        pointer.targetY = ny
      }

      const hues: KrathongHue[] = ['gold', 'rose', 'emerald']
      let launchCounter = 0

      const handleLaunchKrathong = () => {
        const hue = hues[launchCounter % hues.length]
        launchCounter += 1

        const spawnX = -5.2 + (Math.random() - 0.5) * 3.0
        const spawnZ = 6.2 + Math.random() * 1.4
        const { group, flameMesh, haloSprite, rippleRing } = create3DKrathong(
          sharedKrathongAssets,
          1.52,
          hue
        )
        group.position.set(spawnX, -2.32, spawnZ)
        scene.add(group)

        if (krathongs.length >= MAX_KRATHONG_LIGHTS) {
          const oldest = krathongs.shift()
          if (oldest) {
            scene.remove(oldest.group)
            ;(oldest.rippleRing.material as THREE.Material).dispose()
          }
        }

        krathongs.push({
          group,
          flameMesh,
          haloSprite,
          rippleRing,
          speed: 1.25,
          baseZ: spawnZ,
          phase: performance.now() * 0.002,
        })

        const { group: newLantern, haloSprite: newHalo } = create3DLantern(sharedLanternAssets, 1.08)
        const lx = spawnX + (Math.random() - 0.5) * 2
        newLantern.position.set(lx, -1.5, 2.5)
        scene.add(newLantern)
        lanterns.push({
          group: newLantern,
          haloSprite: newHalo,
          speedY: 1.25,
          swayAmp: 0.4,
          swayFreq: 0.75,
          rotSpeed: 0.35,
          phase: performance.now() * 0.001,
          baseX: lx,
        })

        spawnFirework(new THREE.Vector3(lx * 0.8, 4.4, -12), 0xfde047)
      }

      const handleCameraViewChange = (e: Event) => {
        const customEvent = e as CustomEvent<{ view?: LoyKrathongCameraView }>
        if (customEvent.detail?.view) {
          activeCameraMode = customEvent.detail.view
        }
      }

      const handleResize = () => {
        if (!renderer || !host) return
        const w = host.clientWidth || window.innerWidth || 1280
        const h = host.clientHeight || window.innerHeight || 800
        if (w <= 0 || h <= 0) return
        const aspect = w / h
        camera.aspect = aspect
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)

        const nextMoonPos = computeTopRightMoonPos(aspect)
        moonGroup.position.copy(nextMoonPos)
        moonDirLight.position.set(nextMoonPos.x, nextMoonPos.y + 2, -20)
        waterMat.uniforms.uMoonPos.value.copy(nextMoonPos)
      }

      // 11. Animation Loop (Paused automatically when browser tab is hidden to save CPU/GPU)
      const clock = new THREE.Clock()

      const animate = () => {
        if (!isPageVisible) return

        const delta = Math.min(clock.getDelta(), 0.05) || 0.016
        const elapsed = clock.elapsedTime
        waterMat.uniforms.uTime.value = elapsed

        pointer.x += (pointer.targetX - pointer.x) * Math.min(1, delta * 5.5)
        pointer.y += (pointer.targetY - pointer.y) * Math.min(1, delta * 5.5)

        const baseCamY = activeCameraMode === 'sky' ? 2.8 : 1.55
        const baseLookY = activeCameraMode === 'sky' ? 3.2 : -0.35

        camera.position.x += (pointer.x * 2.1 - camera.position.x) * Math.min(1, delta * 3.8)
        camera.position.y += (baseCamY - pointer.y * 0.85 - camera.position.y) * Math.min(1, delta * 3.8)
        cameraLookTarget.x += (pointer.x * 0.85 - cameraLookTarget.x) * Math.min(1, delta * 3.8)
        cameraLookTarget.y += (baseLookY - pointer.y * 0.45 - cameraLookTarget.y) * Math.min(1, delta * 3.8)
        camera.lookAt(cameraLookTarget)

        if (moonOuterHalo) {
          const haloPulse = 23 + Math.sin(elapsed * 1.4) * 2.2
          moonOuterHalo.scale.set(haloPulse, haloPulse, 1)
        }

        krathongs.forEach((item, idx) => {
          item.group.position.x += item.speed * delta
          if (item.group.position.x > 14.5) {
            item.group.position.x = -14.5
          }

          const kx = item.group.position.x
          const kz = item.baseZ + Math.sin(elapsed * 0.75 + item.phase) * 0.35
          const waveY = sampleRiverWaveHeight(kx, kz, elapsed)

          item.group.position.z = kz
          item.group.position.y = -2.32 + waveY
          item.group.rotation.z = Math.sin(elapsed * 1.85 + item.phase) * 0.08
          item.group.rotation.x = Math.cos(elapsed * 1.45 + item.phase) * 0.065
          item.group.rotation.y += 0.22 * delta

          const flicker = 0.88 + Math.sin(elapsed * 12 + item.phase * 3) * 0.18
          item.flameMesh.scale.set(flicker, 0.9 + Math.cos(elapsed * 16 + item.phase) * 0.22, flicker)

          if (item.haloSprite) {
            const haloSize = 1.75 + Math.sin(elapsed * 9 + item.phase) * 0.28
            item.haloSprite.scale.set(haloSize, haloSize, 1)
          }

          const rippleCycle = (elapsed * 0.8 + item.phase) % 1
          const rippleScale = 1 + rippleCycle * 0.85
          item.rippleRing.scale.set(rippleScale, rippleScale, 1)
          const rippleMat = item.rippleRing.material as THREE.MeshBasicMaterial
          rippleMat.opacity = (1 - rippleCycle) * 0.45

          if (idx < MAX_KRATHONG_LIGHTS) {
            krathongLightUniforms[idx].set(kx, item.group.position.y, kz)
          }
        })

        for (let i = krathongs.length; i < MAX_KRATHONG_LIGHTS; i++) {
          krathongLightUniforms[i].set(999, -2.3, 999)
        }

        lanterns.forEach((lantern) => {
          lantern.group.position.y += lantern.speedY * delta
          if (lantern.group.position.y > 14.2) {
            lantern.group.position.y = -2.4
          }
          lantern.group.position.x =
            lantern.baseX + Math.sin(elapsed * lantern.swayFreq + lantern.phase) * lantern.swayAmp
          lantern.group.rotation.y += lantern.rotSpeed * delta
          lantern.group.rotation.z = Math.sin(elapsed * 1.2 + lantern.phase) * 0.08

          if (lantern.haloSprite) {
            const lPulse = 1.95 + Math.sin(elapsed * 6 + lantern.phase) * 0.25
            lantern.haloSprite.scale.set(lPulse, lPulse, 1)
          }
        })

        starParticles.rotation.y = Math.sin(elapsed * 0.08) * 0.03
        starMat.opacity = 0.72 + Math.sin(elapsed * 2.2) * 0.18

        const posAttr = fireflyGeo.getAttribute('position') as THREE.BufferAttribute
        for (let i = 0; i < fireflyCount; i++) {
          let py = posAttr.getY(i) + fireflySpeeds[i] * delta
          const px = posAttr.getX(i) + Math.sin(elapsed * 1.6 + i) * 0.45 * delta
          if (py > 9.0) py = -2.2
          posAttr.setXY(i, px, py)
        }
        posAttr.needsUpdate = true

        fireworkTimer -= delta
        if (fireworkTimer <= 0) {
          spawnFirework()
          fireworkTimer = 2.6 + Math.random() * 2.2
        }

        for (let i = fireworks.length - 1; i >= 0; i--) {
          const fw = fireworks[i]
          fw.age += delta
          const progress = fw.age / fw.lifetime

          if (progress >= 1) {
            scene.remove(fw.points)
            fw.points.geometry.dispose()
            fw.material.dispose()
            fireworks.splice(i, 1)
            continue
          }

          const fwPos = fw.points.geometry.getAttribute('position') as THREE.BufferAttribute
          for (let j = 0; j < fwPos.count; j++) {
            const vx = fw.velocities[j * 3]
            const vy = fw.velocities[j * 3 + 1] - 1.35 * delta
            const vz = fw.velocities[j * 3 + 2]

            fw.velocities[j * 3] = vx * (1 - 0.85 * delta)
            fw.velocities[j * 3 + 1] = vy * (1 - 0.65 * delta)
            fw.velocities[j * 3 + 2] = vz * (1 - 0.85 * delta)

            fwPos.setXYZ(
              j,
              fwPos.getX(j) + vx * delta,
              fwPos.getY(j) + vy * delta,
              fwPos.getZ(j) + vz * delta
            )
          }
          fwPos.needsUpdate = true
          fw.material.opacity = Math.max(0, 1 - Math.pow(progress, 1.5))
        }

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
      window.addEventListener('loy-krathong:launch', handleLaunchKrathong)
      window.addEventListener('loy-krathong:camera', handleCameraViewChange)
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
        window.removeEventListener('loy-krathong:launch', handleLaunchKrathong)
        window.removeEventListener('loy-krathong:camera', handleCameraViewChange)
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
        goldGlowTex?.dispose()
        moonGlowTex?.dispose()
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
    <div className={styles.seasonWrapper} aria-hidden="true" data-testid="loy-krathong-scene">
      {/* Horizon warm mist glow */}
      <div className={styles.horizonMist} />

      {/* Three.js 3D WebGL Canvas Stage */}
      <div
        ref={containerRef}
        className={styles.webglCanvasHost}
        data-testid="loy-krathong-3d-stage"
      />

      {/* Atmospheric vignette & Lanna ornamental corner frames */}
      <div className={styles.atmosphericVignette} />
      <LannaCornerOrnament className={styles.lannaCornerTopLeft} />
      <LannaCornerOrnament className={styles.lannaCornerBottomRight} />
    </div>
  )
}
