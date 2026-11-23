/**
 * Client-side image optimization helper for hospital photo albums.
 * Resizes oversized photos and encodes as WebP so homepage & gallery load fast on 4G mobile.
 * Falls back safely to the original File if the browser cannot decode it or it is an animated GIF.
 */
export interface ImageOptimizeOptions {
  maxDimension?: number
  quality?: number
}

export async function optimizeImageFileToWebP(
  file: File,
  options: ImageOptimizeOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1600
  const quality = options.quality ?? 0.85

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file
  }

  // Keep GIFs intact (in case of animation) and skip non-image files
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file
  }

  let objectUrl: string | null = null
  try {
    objectUrl = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Image decode failed'))
      image.src = objectUrl!
    })

    const { naturalWidth, naturalHeight } = img
    if (!naturalWidth || !naturalHeight) {
      return file
    }

    const longestSide = Math.max(naturalWidth, naturalHeight)
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1
    const targetWidth = Math.max(1, Math.round(naturalWidth * scale))
    const targetHeight = Math.max(1, Math.round(naturalHeight * scale))

    // If already WebP within dimension limit and small (< 300KB), keep original
    if (file.type === 'image/webp' && scale === 1 && file.size <= 300 * 1024) {
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    const webpBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', quality)
    })

    if (!webpBlob) {
      return file
    }

    // Use original if WebP ended up larger than original small file
    if (scale === 1 && webpBlob.size >= file.size) {
      return file
    }

    const baseName = file.name.includes('.')
      ? file.name.slice(0, file.name.lastIndexOf('.'))
      : file.name
    const safeBase = baseName.slice(0, 60)
    return new File([webpBlob], `${safeBase}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } catch {
    return file
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }
  }
}
