import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentStorage, sanitizeName } from '@/lib/storage/documentStorage'
import fs from 'fs'

describe('Direct DocumentStorage.save test', () => {
  it('saves an image file with title containing dots', async () => {
    const buffer = Buffer.from('fake image content')
    const file = {
      name: 'banner.png',
      type: 'image/png',
      size: buffer.length,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }

    const title = 'วันพยาบาล 21 ต.ค.'
    const cleanTitle = sanitizeName(title) || 'slide'
    const destinationDir = DocumentStorage.formatDateDirectory('public/uploads', '', 'daily')

    const saved = await DocumentStorage.save(file, {
      destinationDir,
      baseName: cleanTitle,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4'],
      maxSizeBytes: 20 * 1024 * 1024,
      collisionStrategy: 'timestamp',
    })

    expect(saved.publicUrl).toBeDefined()
    expect(saved.fileName.endsWith('.png')).toBe(true)
    await DocumentStorage.delete(saved.publicUrl)
  })

  it('saves an image with jfif MIME type and .jpg extension', async () => {
    const buffer = Buffer.from('fake image content')
    const file = {
      name: 'camera_shot.jfif',
      type: 'image/jfif',
      size: buffer.length,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }

    const title = 'รูปกิจกรรม'
    const cleanTitle = sanitizeName(title) || 'slide'
    const destinationDir = DocumentStorage.formatDateDirectory('public/uploads', '', 'daily')

    const saved = await DocumentStorage.save(file, {
      destinationDir,
      baseName: cleanTitle,
      allowedMimeTypes: [
        'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/jfif', 'image/png',
        'image/x-png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
        'image/heic', 'image/heif', 'application/pdf', 'video/mp4', 'video/quicktime',
      ],
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.jfif', '.avif',
        '.heic', '.heif', '.pdf', '.mp4', '.mov', '.m4v', '.webm'
      ],
      maxSizeBytes: 20 * 1024 * 1024,
      collisionStrategy: 'timestamp',
    })

    expect(saved.publicUrl).toBeDefined()
    expect(saved.fileName.endsWith('.jfif')).toBe(true)
    await DocumentStorage.delete(saved.publicUrl)
  })

  it('saves an MP4 video with video/quicktime MIME type', async () => {
    const buffer = Buffer.from('fake mp4 video content')
    const file = {
      name: 'iphone_video.MP4',
      type: 'video/quicktime',
      size: buffer.length,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }

    const title = 'วิดีโอแนะนำ รพ.'
    const cleanTitle = sanitizeName(title) || 'slide'
    const destinationDir = DocumentStorage.formatDateDirectory('public/uploads', '', 'daily')

    const saved = await DocumentStorage.save(file, {
      destinationDir,
      baseName: cleanTitle,
      allowedMimeTypes: [
        'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/jfif', 'image/png',
        'image/x-png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
        'image/heic', 'image/heif', 'application/pdf', 'video/mp4', 'video/quicktime',
      ],
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.jfif', '.avif',
        '.heic', '.heif', '.pdf', '.mp4', '.mov', '.m4v', '.webm'
      ],
      maxSizeBytes: 100 * 1024 * 1024,
      collisionStrategy: 'timestamp',
    })

    expect(saved.publicUrl).toBeDefined()
    expect(saved.fileName.toLowerCase().endsWith('.mp4')).toBe(true)
    await DocumentStorage.delete(saved.publicUrl)
  })
})
