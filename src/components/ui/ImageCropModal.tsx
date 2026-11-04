'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Crop as CropIcon,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  Check,
  RotateCcw as ResetIcon,
  Loader2,
  Move
} from 'lucide-react'
import styles from './ImageCropModal.module.css'

export interface ImageCropModalProps {
  isOpen: boolean
  imageSrc: string
  title?: string
  subtitle?: string
  initialAspectRatio?: number // 0.75 for 3:4, 1 for square, 0 for free
  fileName?: string
  onClose: () => void
  onSave: (file: File, previewUrl: string) => void | Promise<void>
}

interface CropBox {
  x: number // 0 to 1 relative to displayed image
  y: number // 0 to 1 relative to displayed image
  width: number // 0 to 1 relative to displayed image
  height: number // 0 to 1 relative to displayed image
}

interface ImageLayout {
  effW: number
  effH: number
  displayW: number
  displayH: number
  imgLeft: number
  imgTop: number
  scaleToFit: number
}

// Helper to compute layout of image inside canvas viewport
function computeImageLayout(
  viewportW: number,
  viewportH: number,
  img: HTMLImageElement,
  rotation: number,
  zoom: number
): ImageLayout {
  const isSideways = rotation === 90 || rotation === 270
  const effW = isSideways ? img.naturalHeight : img.naturalWidth
  const effH = isSideways ? img.naturalWidth : img.naturalHeight

  // Image fills 90% of viewport area so it is large, prominent and easy to crop
  const scaleToFit = Math.min((viewportW * 0.90) / effW, (viewportH * 0.90) / effH)
  const baseW = effW * scaleToFit
  const baseH = effH * scaleToFit

  const displayW = baseW * zoom
  const displayH = baseH * zoom

  const imgLeft = (viewportW - displayW) / 2
  const imgTop = (viewportH - displayH) / 2

  return {
    effW,
    effH,
    displayW,
    displayH,
    imgLeft,
    imgTop,
    scaleToFit
  }
}

// Convert relative crop box to screen pixel rectangle
function getCropScreenRect(layout: ImageLayout, crop: CropBox) {
  return {
    x: layout.imgLeft + crop.x * layout.displayW,
    y: layout.imgTop + crop.y * layout.displayH,
    width: crop.width * layout.displayW,
    height: crop.height * layout.displayH
  }
}

// Hit-test on screen pixel coordinates with generous grab targets
type DragType = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'

function hitTestCrop(
  mx: number,
  my: number,
  cropRect: { x: number; y: number; width: number; height: number }
): DragType | null {
  const cornerRadius = 18 // 36px touch / click radius
  const edgeTolerance = 14 // 28px hit zone along borders

  // 1. Check 4 corners first (highest priority)
  if (Math.hypot(mx - cropRect.x, my - cropRect.y) <= cornerRadius) return 'nw'
  if (Math.hypot(mx - (cropRect.x + cropRect.width), my - cropRect.y) <= cornerRadius) return 'ne'
  if (Math.hypot(mx - (cropRect.x + cropRect.width), my - (cropRect.y + cropRect.height)) <= cornerRadius) return 'se'
  if (Math.hypot(mx - cropRect.x, my - (cropRect.y + cropRect.height)) <= cornerRadius) return 'sw'

  // 2. Check 4 edges
  if (
    Math.abs(my - cropRect.y) <= edgeTolerance &&
    mx >= cropRect.x - edgeTolerance &&
    mx <= cropRect.x + cropRect.width + edgeTolerance
  ) return 'n'

  if (
    Math.abs(my - (cropRect.y + cropRect.height)) <= edgeTolerance &&
    mx >= cropRect.x - edgeTolerance &&
    mx <= cropRect.x + cropRect.width + edgeTolerance
  ) return 's'

  if (
    Math.abs(mx - cropRect.x) <= edgeTolerance &&
    my >= cropRect.y - edgeTolerance &&
    my <= cropRect.y + cropRect.height + edgeTolerance
  ) return 'w'

  if (
    Math.abs(mx - (cropRect.x + cropRect.width)) <= edgeTolerance &&
    my >= cropRect.y - edgeTolerance &&
    my <= cropRect.y + cropRect.height + edgeTolerance
  ) return 'e'

  // 3. Check inside box for moving/dragging the whole box
  if (
    mx >= cropRect.x &&
    mx <= cropRect.x + cropRect.width &&
    my >= cropRect.y &&
    my <= cropRect.y + cropRect.height
  ) {
    return 'move'
  }

  return null
}

export default function ImageCropModal({
  isOpen,
  imageSrc,
  title = 'ตัดครอบรูปถ่ายบุคลากร (Crop Staff Photo)',
  subtitle = 'ปรับสัดส่วนภาพและเลือกตำแหน่งที่ต้องการแสดงผลบนเว็บไซต์',
  initialAspectRatio = 3 / 4,
  fileName = 'staff-photo.png',
  onClose,
  onSave
}: ImageCropModalProps) {
  // Crop & Transform state
  const [aspectRatio, setAspectRatio] = useState<number>(initialAspectRatio)
  const [zoom, setZoom] = useState<number>(1)
  const [rotation, setRotation] = useState<number>(0) // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false)

  // Relative crop box (0 to 1)
  const [crop, setCrop] = useState<CropBox>({ x: 0.15, y: 0.1, width: 0.7, height: 0.8 })

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const previewCanvasCircleRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRectRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // Active dragging state
  const [dragAction, setDragAction] = useState<{
    type: DragType
    startMouseX: number
    startMouseY: number
    initialCrop: CropBox
    layout: ImageLayout
  } | null>(null)

  // Reset crop box based on aspect ratio
  const resetCropBox = useCallback((imgW: number, imgH: number, ar: number, rot: number = 0) => {
    const isSideways = rot === 90 || rot === 270
    const effW = isSideways ? imgH : imgW
    const effH = isSideways ? imgW : imgH

    if (ar === 0) {
      // Free aspect ratio - give a generous 70% box in the center
      setCrop({ x: 0.15, y: 0.15, width: 0.7, height: 0.7 })
      return
    }

    const imgAspect = effW / effH
    let newW = 0.7
    let newH = 0.7

    if (ar > imgAspect) {
      newW = 0.78
      newH = (newW * effW) / (ar * effH)
    } else {
      newH = 0.78
      newW = (newH * effH * ar) / effW
    }

    newW = Math.min(0.92, Math.max(0.2, newW))
    newH = Math.min(0.92, Math.max(0.2, newH))

    setCrop({
      x: (1 - newW) / 2,
      y: (1 - newH) / 2,
      width: newW,
      height: newH
    })
  }, [])

  // Load original image safely
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      originalImageRef.current = null
      setLoadError(null)
      return
    }

    setLoadError(null)
    const img = new Image()

    // Only set crossOrigin for remote http(s) URLs, NEVER for blob: or data: URLs (prevents CORS security block in WebKit/Safari)
    const isRemote = imageSrc.startsWith('http://') || imageSrc.startsWith('https://')
    if (isRemote) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      originalImageRef.current = img
      setLoadError(null)
      resetCropBox(img.naturalWidth, img.naturalHeight, initialAspectRatio, 0)
    }

    img.onerror = () => {
      // If remote image failed with crossOrigin, retry once without crossOrigin
      if (isRemote && img.crossOrigin) {
        const fallbackImg = new Image()
        fallbackImg.onload = () => {
          originalImageRef.current = fallbackImg
          setLoadError(null)
          resetCropBox(fallbackImg.naturalWidth, fallbackImg.naturalHeight, initialAspectRatio, 0)
        }
        fallbackImg.onerror = () => {
          setLoadError('ไม่สามารถโหลดรูปภาพได้ กรุณาตรวจสอบไฟล์รูปภาพหรือเลือกรูปใหม่')
        }
        fallbackImg.src = imageSrc
        return
      }
      setLoadError('ไม่สามารถโหลดรูปภาพได้ กรุณาตรวจสอบไฟล์รูปภาพหรือเลือกรูปใหม่')
    }

    img.src = imageSrc

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [isOpen, imageSrc, initialAspectRatio, resetCropBox])

  // Change aspect ratio
  const handleAspectRatioChange = (newAr: number) => {
    setAspectRatio(newAr)
    if (originalImageRef.current) {
      resetCropBox(
        originalImageRef.current.naturalWidth,
        originalImageRef.current.naturalHeight,
        newAr,
        rotation
      )
    }
  }

  // Create offscreen rotated & flipped canvas for preview/export
  const getTransformedCanvas = useCallback((img: HTMLImageElement, rot: number, isFlipH: boolean) => {
    const isSideways = rot === 90 || rot === 270
    const effW = isSideways ? img.naturalHeight : img.naturalWidth
    const effH = isSideways ? img.naturalWidth : img.naturalHeight

    const offscreen = document.createElement('canvas')
    offscreen.width = effW
    offscreen.height = effH
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null

    ctx.translate(effW / 2, effH / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.scale(isFlipH ? -1 : 1, 1)

    const drawW = isSideways ? effH : effW
    const drawH = isSideways ? effW : effH
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)

    return offscreen
  }, [])

  // Render live side preview cards
  const renderSidePreviews = useCallback((img: HTMLImageElement, currentCrop: CropBox) => {
    const isSideways = rotation === 90 || rotation === 270
    const effW = isSideways ? img.naturalHeight : img.naturalWidth
    const effH = isSideways ? img.naturalWidth : img.naturalHeight

    const transformedCanvas = getTransformedCanvas(img, rotation, flipH) || img

    const cropPxX = Math.round(currentCrop.x * effW)
    const cropPxY = Math.round(currentCrop.y * effH)
    const cropPxW = Math.max(1, Math.round(currentCrop.width * effW))
    const cropPxH = Math.max(1, Math.round(currentCrop.height * effH))

    // Circle preview canvas
    const circleCanvas = previewCanvasCircleRef.current
    if (circleCanvas) {
      const cCtx = circleCanvas.getContext('2d')
      if (cCtx) {
        cCtx.clearRect(0, 0, circleCanvas.width, circleCanvas.height)
        cCtx.drawImage(
          transformedCanvas,
          cropPxX,
          cropPxY,
          cropPxW,
          cropPxH,
          0,
          0,
          circleCanvas.width,
          circleCanvas.height
        )
      }
    }

    // Rect preview canvas
    const rectCanvas = previewCanvasRectRef.current
    if (rectCanvas) {
      const rCtx = rectCanvas.getContext('2d')
      if (rCtx) {
        rCtx.clearRect(0, 0, rectCanvas.width, rectCanvas.height)
        rCtx.drawImage(
          transformedCanvas,
          cropPxX,
          cropPxY,
          cropPxW,
          cropPxH,
          0,
          0,
          rectCanvas.width,
          rectCanvas.height
        )
      }
    }
  }, [rotation, flipH, getTransformedCanvas])

  // Draw main viewport canvas and live previews
  const renderViewport = useCallback(() => {
    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const viewportW = canvas.clientWidth || 700
    const viewportH = canvas.clientHeight || 540

    if (canvas.width !== viewportW * dpr || canvas.height !== viewportH * dpr) {
      canvas.width = viewportW * dpr
      canvas.height = viewportH * dpr
    }

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, viewportW, viewportH)

    const layout = computeImageLayout(viewportW, viewportH, img, rotation, zoom)
    const cropRect = getCropScreenRect(layout, crop)

    // 1. Draw Image (centered, rotated, zoomed)
    ctx.save()
    ctx.translate(layout.imgLeft + layout.displayW / 2, layout.imgTop + layout.displayH / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(flipH ? -1 : 1, 1)

    const isSideways = rotation === 90 || rotation === 270
    const drawW = isSideways ? layout.displayH : layout.displayW
    const drawH = isSideways ? layout.displayW : layout.displayH
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()

    // 2. Dark mask outside crop box
    ctx.fillStyle = 'rgba(11, 17, 32, 0.70)'

    // Top
    if (cropRect.y > 0) {
      ctx.fillRect(0, 0, viewportW, cropRect.y)
    }
    // Bottom
    if (cropRect.y + cropRect.height < viewportH) {
      ctx.fillRect(
        0,
        cropRect.y + cropRect.height,
        viewportW,
        viewportH - (cropRect.y + cropRect.height)
      )
    }
    // Left
    if (cropRect.x > 0) {
      ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.height)
    }
    // Right
    if (cropRect.x + cropRect.width < viewportW) {
      ctx.fillRect(
        cropRect.x + cropRect.width,
        cropRect.y,
        viewportW - (cropRect.x + cropRect.width),
        cropRect.height
      )
    }

    // 3. Crop box border
    ctx.strokeStyle = '#3B82F6'
    ctx.lineWidth = 2.5
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)

    // 4. Rule of thirds grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    // Vertical grid
    ctx.moveTo(cropRect.x + cropRect.width / 3, cropRect.y)
    ctx.lineTo(cropRect.x + cropRect.width / 3, cropRect.y + cropRect.height)
    ctx.moveTo(cropRect.x + (2 * cropRect.width) / 3, cropRect.y)
    ctx.lineTo(cropRect.x + (2 * cropRect.width) / 3, cropRect.y + cropRect.height)
    // Horizontal grid
    ctx.moveTo(cropRect.x, cropRect.y + cropRect.height / 3)
    ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + cropRect.height / 3)
    ctx.moveTo(cropRect.x, cropRect.y + (2 * cropRect.height) / 3)
    ctx.lineTo(cropRect.x + cropRect.width, cropRect.y + (2 * cropRect.height) / 3)
    ctx.stroke()

    // 5. 8 Resize handles
    const handleSize = 10
    const handles = [
      { x: cropRect.x, y: cropRect.y }, // nw
      { x: cropRect.x + cropRect.width, y: cropRect.y }, // ne
      { x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height }, // se
      { x: cropRect.x, y: cropRect.y + cropRect.height }, // sw
      { x: cropRect.x + cropRect.width / 2, y: cropRect.y }, // n
      { x: cropRect.x + cropRect.width / 2, y: cropRect.y + cropRect.height }, // s
      { x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height / 2 }, // e
      { x: cropRect.x, y: cropRect.y + cropRect.height / 2 }, // w
    ]

    for (const h of handles) {
      ctx.fillStyle = '#FFFFFF'
      ctx.strokeStyle = '#2563EB'
      ctx.lineWidth = 2
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
    }

    ctx.restore()

    // Render Side Live Previews
    renderSidePreviews(img, crop)
  }, [crop, zoom, rotation, flipH, renderSidePreviews])

  useEffect(() => {
    renderViewport()
  }, [renderViewport])

  // Window resize listener to keep viewport sharp and big
  useEffect(() => {
    const handleResize = () => renderViewport()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [renderViewport])

  // Cursor updates on hover
  const updateCursor = (action: DragType | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    switch (action) {
      case 'nw':
      case 'se':
        canvas.style.cursor = 'nwse-resize'
        break
      case 'ne':
      case 'sw':
        canvas.style.cursor = 'nesw-resize'
        break
      case 'n':
      case 's':
        canvas.style.cursor = 'ns-resize'
        break
      case 'e':
      case 'w':
        canvas.style.cursor = 'ew-resize'
        break
      case 'move':
        canvas.style.cursor = 'move'
        break
      default:
        canvas.style.cursor = 'default'
        break
    }
  }

  // Pointer Down (Start move or resize)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return

    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const layout = computeImageLayout(canvas.clientWidth, canvas.clientHeight, img, rotation, zoom)
    const cropRect = getCropScreenRect(layout, crop)
    const action = hitTestCrop(mx, my, cropRect)

    if (action) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}

      setDragAction({
        type: action,
        startMouseX: mx,
        startMouseY: my,
        initialCrop: { ...crop },
        layout
      })
    }
  }

  // Pointer Move (Active move/resize or hover cursor)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return

    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (!dragAction) {
      // Hover mode - update cursor
      const layout = computeImageLayout(canvas.clientWidth, canvas.clientHeight, img, rotation, zoom)
      const cropRect = getCropScreenRect(layout, crop)
      const action = hitTestCrop(mx, my, cropRect)
      updateCursor(action)
      return
    }

    // Active drag mode
    const deltaX_px = mx - dragAction.startMouseX
    const deltaY_px = my - dragAction.startMouseY

    const deltaX_rel = deltaX_px / dragAction.layout.displayW
    const deltaY_rel = deltaY_px / dragAction.layout.displayH
    const init = dragAction.initialCrop

    let nextCrop = { ...init }

    if (dragAction.type === 'move') {
      // Moving whole crop box
      const maxLeft = 1 - init.width
      const maxTop = 1 - init.height
      nextCrop.x = Math.max(0, Math.min(maxLeft, init.x + deltaX_rel))
      nextCrop.y = Math.max(0, Math.min(maxTop, init.y + deltaY_rel))
    } else {
      // Resizing
      const minSize = 0.15
      const effAspect =
        aspectRatio === 0
          ? 0
          : (aspectRatio * dragAction.layout.effH) / dragAction.layout.effW

      if (aspectRatio === 0) {
        // Free resize mode
        if (dragAction.type.includes('e')) {
          nextCrop.width = Math.max(minSize, Math.min(1 - init.x, init.width + deltaX_rel))
        }
        if (dragAction.type.includes('s')) {
          nextCrop.height = Math.max(minSize, Math.min(1 - init.y, init.height + deltaY_rel))
        }
        if (dragAction.type.includes('w')) {
          const targetX = Math.max(0, Math.min(init.x + init.width - minSize, init.x + deltaX_rel))
          nextCrop.width = init.width + (init.x - targetX)
          nextCrop.x = targetX
        }
        if (dragAction.type.includes('n')) {
          const targetY = Math.max(0, Math.min(init.y + init.height - minSize, init.y + deltaY_rel))
          nextCrop.height = init.height + (init.y - targetY)
          nextCrop.y = targetY
        }
      } else {
        // Fixed aspect ratio resize (3:4 or 1:1)
        if (dragAction.type === 'se' || dragAction.type === 'e' || dragAction.type === 's') {
          const targetW = Math.max(minSize, Math.min(1 - init.x, init.width + deltaX_rel))
          const targetH = targetW / effAspect
          if (init.y + targetH <= 1) {
            nextCrop.width = targetW
            nextCrop.height = targetH
          }
        } else if (dragAction.type === 'sw') {
          const targetW = Math.max(minSize, Math.min(init.x + init.width, init.width - deltaX_rel))
          const targetH = targetW / effAspect
          if (init.y + targetH <= 1) {
            nextCrop.x = init.x + (init.width - targetW)
            nextCrop.width = targetW
            nextCrop.height = targetH
          }
        } else if (dragAction.type === 'ne') {
          const targetW = Math.max(minSize, Math.min(1 - init.x, init.width + deltaX_rel))
          const targetH = targetW / effAspect
          if (init.y + init.height - targetH >= 0) {
            nextCrop.y = init.y + (init.height - targetH)
            nextCrop.width = targetW
            nextCrop.height = targetH
          }
        } else if (dragAction.type === 'nw') {
          const targetW = Math.max(minSize, Math.min(init.x + init.width, init.width - deltaX_rel))
          const targetH = targetW / effAspect
          if (init.y + init.height - targetH >= 0) {
            nextCrop.x = init.x + (init.width - targetW)
            nextCrop.y = init.y + (init.height - targetH)
            nextCrop.width = targetW
            nextCrop.height = targetH
          }
        }
      }
    }

    setCrop(nextCrop)
  }

  // Pointer Up (End drag)
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragAction) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}
      setDragAction(null)
    }
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setZoom((prev) => {
      const next = prev - e.deltaY * 0.001
      return Math.min(3, Math.max(1, parseFloat(next.toFixed(2))))
    })
  }

  // Reset transforms
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    if (originalImageRef.current) {
      resetCropBox(
        originalImageRef.current.naturalWidth,
        originalImageRef.current.naturalHeight,
        initialAspectRatio,
        0
      )
    }
    handleAspectRatioChange(initialAspectRatio)
  }

  // Save & Apply cropped photo
  const handleSave = async () => {
    const img = originalImageRef.current
    if (!img) {
      alert(loadError || 'กำลังเตรียมรูปภาพหรือรูปภาพยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง')
      return
    }

    try {
      setIsSaving(true)

      const isSideways = rotation === 90 || rotation === 270
      const effW = isSideways ? img.naturalHeight : img.naturalWidth
      const effH = isSideways ? img.naturalWidth : img.naturalHeight

      const transformedCanvas = getTransformedCanvas(img, rotation, flipH) || img

      const cropPxX = Math.round(crop.x * effW)
      const cropPxY = Math.round(crop.y * effH)
      const cropPxW = Math.max(1, Math.round(crop.width * effW))
      const cropPxH = Math.max(1, Math.round(crop.height * effH))

      // Cap maximum dimensions for avatar/staff photo (1000px max)
      // This prevents massive 25MB uncompressed PNGs that crash mobile canvas or exceed server upload limits,
      // while preserving crystal-clear sharpness for 300px retina displays.
      const MAX_OUTPUT_DIM = 1000
      let outW = cropPxW
      let outH = cropPxH
      if (outW > MAX_OUTPUT_DIM || outH > MAX_OUTPUT_DIM) {
        if (outW >= outH) {
          outH = Math.max(1, Math.round((outH * MAX_OUTPUT_DIM) / outW))
          outW = MAX_OUTPUT_DIM
        } else {
          outW = Math.max(1, Math.round((outW * MAX_OUTPUT_DIM) / outH))
          outH = MAX_OUTPUT_DIM
        }
      }

      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = outW
      exportCanvas.height = outH
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) throw new Error('Cannot create export context')

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      ctx.drawImage(
        transformedCanvas,
        cropPxX,
        cropPxY,
        cropPxW,
        cropPxH,
        0,
        0,
        outW,
        outH
      )

      // Export as JPEG with 0.92 quality (or PNG if requested) to achieve 150KB - 300KB high quality
      const isPngRequested = fileName.toLowerCase().endsWith('.png')
      const exportMime = isPngRequested ? 'image/png' : 'image/jpeg'
      const exportExt = isPngRequested ? '.png' : '.jpg'

      const blob = await new Promise<Blob | null>((res) =>
        exportCanvas.toBlob(res, exportMime, 0.92)
      )
      if (!blob) throw new Error('ไม่สามารถประมวลผลรูปภาพที่ตัดครอบได้')

      const cleanBase = fileName.replace(/\.[^/.]+$/, '') || 'staff-photo'
      const cleanFileName = `${cleanBase}${exportExt}`
      const file = new File([blob], cleanFileName, { type: exportMime })
      const previewUrl = URL.createObjectURL(blob)

      await onSave(file, previewUrl)
      onClose()
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกรูปภาพ')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <h3 className={styles.modalTitle}>
              <CropIcon size={19} color="#2563EB" />
              <span>{title}</span>
            </h3>
            <p className={styles.modalSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            disabled={isSaving}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Large Main Viewport */}
          <div className={styles.canvasViewport} ref={viewportRef}>
            <div className={styles.viewportPattern} />
            {loadError && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  padding: '12px 18px',
                  borderRadius: '8px',
                  border: '1px solid #FCA5A5',
                  fontSize: '0.85rem',
                  zIndex: 10,
                  textAlign: 'center',
                  maxWidth: '85%'
                }}
              >
                {loadError}
              </div>
            )}
            <canvas
              ref={canvasRef}
              className={styles.canvasElement}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            />
            <div className={styles.viewportHint}>
              <Move size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              คลิกลากในกรอบเพื่อย้ายตำแหน่ง • ลากจุดตามมุมหรือขอบเพื่อปรับขนาด
            </div>
          </div>

          {/* Right Controls Panel */}
          <div className={styles.controlsPanel}>
            {/* Live Avatar Preview */}
            <div className={styles.livePreviewCard}>
              <div className={styles.livePreviewHeader}>
                <span className={styles.livePreviewTitle}>ตัวอย่างการแสดงผล</span>
              </div>
              <div className={styles.previewContainersRow}>
                <div className={styles.previewBox}>
                  <div className={styles.previewCircleWrap}>
                    <canvas
                      ref={previewCanvasCircleRef}
                      width={180}
                      height={180}
                      className={styles.previewCanvas}
                    />
                  </div>
                  <span className={styles.previewLabel}>อวาตาร์วงกลม</span>
                </div>
                <div className={styles.previewBox}>
                  <div className={styles.previewRectWrap}>
                    <canvas
                      ref={previewCanvasRectRef}
                      width={144}
                      height={192}
                      className={styles.previewCanvas}
                    />
                  </div>
                  <span className={styles.previewLabel}>รูปติดบัตร 3:4</span>
                </div>
              </div>
            </div>

            {/* Aspect Ratio Presets */}
            <div className={styles.sectionBox}>
              <label className={styles.sectionTitle}>สัดส่วนภาพ</label>
              <div className={styles.aspectGrid}>
                <button
                  type="button"
                  className={`${styles.aspectBtn} ${aspectRatio === 3 / 4 ? styles.aspectBtnActive : ''}`}
                  onClick={() => handleAspectRatioChange(3 / 4)}
                >
                  <span className={styles.aspectRatioLabel}>3 : 4</span>
                  <span className={styles.aspectRatioSub}>รูปติดบัตร (แนะนำ)</span>
                </button>
                <button
                  type="button"
                  className={`${styles.aspectBtn} ${aspectRatio === 1 ? styles.aspectBtnActive : ''}`}
                  onClick={() => handleAspectRatioChange(1)}
                >
                  <span className={styles.aspectRatioLabel}>1 : 1</span>
                  <span className={styles.aspectRatioSub}>จัตุรัส</span>
                </button>
                <button
                  type="button"
                  className={`${styles.aspectBtn} ${aspectRatio === 0 ? styles.aspectBtnActive : ''}`}
                  onClick={() => handleAspectRatioChange(0)}
                >
                  <span className={styles.aspectRatioLabel}>อิสระ</span>
                  <span className={styles.aspectRatioSub}>ปรับขนาดเอง</span>
                </button>
              </div>
            </div>

            {/* Zoom Slider */}
            <div className={styles.sectionBox}>
              <label className={styles.sectionTitle}>ซูมภาพ (Zoom)</label>
              <div className={styles.sliderRow}>
                <button
                  type="button"
                  className={styles.iconMiniBtn}
                  onClick={() => setZoom((prev) => Math.max(1, parseFloat((prev - 0.1).toFixed(2))))}
                  title="ย่อขนาด"
                >
                  <ZoomOut size={16} />
                </button>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className={styles.sliderInput}
                />
                <button
                  type="button"
                  className={styles.iconMiniBtn}
                  onClick={() => setZoom((prev) => Math.min(3, parseFloat((prev + 0.1).toFixed(2))))}
                  title="ขยายขนาด"
                >
                  <ZoomIn size={16} />
                </button>
                <span className={styles.sliderValue}>{Math.round(zoom * 100)}%</span>
              </div>
            </div>

            {/* Rotation & Flip */}
            <div className={styles.sectionBox}>
              <label className={styles.sectionTitle}>หมุนและกลับภาพ</label>
              <div className={styles.toolsRow}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => {
                    const nextRot = (rotation + 90) % 360
                    setRotation(nextRot)
                    if (originalImageRef.current) {
                      resetCropBox(
                        originalImageRef.current.naturalWidth,
                        originalImageRef.current.naturalHeight,
                        aspectRatio,
                        nextRot
                      )
                    }
                  }}
                >
                  <RotateCw size={15} />
                  <span>หมุน 90°</span>
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => setFlipH((prev) => !prev)}
                >
                  <FlipHorizontal size={15} />
                  <span>กลับแนวนอน</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnReset}
            onClick={handleReset}
            disabled={isSaving}
          >
            <ResetIcon size={14} />
            <span>รีเซ็ตตำแหน่ง</span>
          </button>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isSaving}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>กำลังบันทึกรูปภาพ...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>ตกลงและบันทึกรูปภาพ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
