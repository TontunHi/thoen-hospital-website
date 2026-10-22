import { describe, it, expect, afterEach } from 'vitest'
import { DocumentStorage, StorageValidationError, sanitizeName } from '../storage/documentStorage'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

describe('DocumentStorage Module', () => {
  const testFilesToClean: string[] = []

  afterEach(async () => {
    for (const p of testFilesToClean) {
      await DocumentStorage.delete(p).catch(() => {})
    }
    testFilesToClean.length = 0
  })

  it('sanitizes unsafe filename characters', () => {
    expect(sanitizeName('test/file:name*?><|.pdf')).toBe('test_file_name_____.pdf')
    expect(sanitizeName('..\\..\\secret.txt')).toBe('____secret.txt')
  })

  it('rejects path traversal in destinationDir', async () => {
    const dummyBuffer = Buffer.from('test content')
    await expect(
      DocumentStorage.save(dummyBuffer, {
        destinationDir: 'public/uploads/../../../etc',
        baseName: 'exploit',
      })
    ).rejects.toThrow(StorageValidationError)
  })

  it('rejects forbidden file extensions', async () => {
    const dummyBuffer = Buffer.from('test executable')
    await expect(
      DocumentStorage.save(dummyBuffer, {
        destinationDir: 'public/uploads/test',
        baseName: 'hack.exe',
      })
    ).rejects.toThrow(StorageValidationError)
  })

  it('normalizes allowedExtensions without leading dot (e.g. ["jpg", "png"]) and accepts .jpg file', async () => {
    const dummyBuffer = Buffer.from('test jpg')
    const result = await DocumentStorage.save(dummyBuffer, {
      destinationDir: 'public/uploads/test-dotless',
      baseName: 'photo.jpg',
      allowedExtensions: ['jpg', 'png'],
    })
    testFilesToClean.push(result.publicUrl)
    expect(result.fileName.endsWith('.jpg')).toBe(true)
  })

  it('rejects files exceeding max size', async () => {
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB
    await expect(
      DocumentStorage.save(bigBuffer, {
        destinationDir: 'public/uploads/test',
        baseName: 'toolarge.jpg',
        maxSizeBytes: 5 * 1024 * 1024, // 5MB limit
      })
    ).rejects.toThrow('ขนาดไฟล์เกินกำหนด')
  })

  it('saves and deletes a file with timestamp strategy', async () => {
    const testContent = Buffer.from('hello pdf world')
    const result = await DocumentStorage.save(testContent, {
      destinationDir: 'public/uploads/test-docs',
      baseName: 'sample.pdf',
      allowedExtensions: ['.pdf'],
    })

    testFilesToClean.push(result.publicUrl)

    expect(result.publicUrl).toMatch(/^\/uploads\/test-docs\/sample-/)
    expect(result.publicUrl.endsWith('.pdf')).toBe(true)
    expect(fsSync.existsSync(result.diskPath)).toBe(true)

    const deleted = await DocumentStorage.delete(result.publicUrl)
    expect(deleted).toBe(true)
    expect(fsSync.existsSync(result.diskPath)).toBe(false)
  })

  it('handles fixed collision strategy and replace atomically', async () => {
    const initialContent = Buffer.from('version 1')
    const firstSave = await DocumentStorage.save(initialContent, {
      destinationDir: 'public/uploads/test-fixed',
      baseName: 'custom_doc.pdf',
      collisionStrategy: 'fixed',
    })
    testFilesToClean.push(firstSave.publicUrl)

    expect(firstSave.fileName).toBe('custom_doc.pdf')

    const newContent = Buffer.from('version 2')
    const secondSave = await DocumentStorage.replace(firstSave.publicUrl, newContent, {
      destinationDir: 'public/uploads/test-fixed',
      baseName: 'custom_doc.pdf',
      collisionStrategy: 'fixed',
    })

    const readData = await fs.readFile(secondSave.diskPath, 'utf8')
    expect(readData).toBe('version 2')
  })

  it('formats date directory with daily, monthly, and yearly modes', () => {
    const fixedDate = new Date('2026-09-15T10:00:00Z')
    expect(DocumentStorage.formatDateDirectory('public/uploads/news', fixedDate, 'daily')).toBe('public/uploads/news/15-09-2026')
    expect(DocumentStorage.formatDateDirectory('public/uploads/repairs', fixedDate, 'monthly')).toBe('public/uploads/repairs/2026/09')
    expect(DocumentStorage.formatDateDirectory('public/documents/ethics', fixedDate, 'yearly')).toBe('public/documents/ethics/2026')
  })

  it('saves multiple files in a batch with saveBatch', async () => {
    const file1 = Buffer.from('photo 1')
    const file2 = Buffer.from('photo 2')

    const results = await DocumentStorage.saveBatch([file1, file2], {
      destinationDir: 'public/uploads/test-batch',
      baseName: 'batch_item',
      allowedExtensions: ['.jpg', '.png'],
    })

    expect(results).toHaveLength(2)
    for (const res of results) {
      testFilesToClean.push(res.publicUrl)
      expect(fsSync.existsSync(res.diskPath)).toBe(true)
      expect(res.publicUrl).toMatch(/^\/uploads\/test-batch\/batch_item-/)
    }
  })

  it('rejects filenames exceeding 80 characters with StorageValidationError', async () => {
    const dummyBuffer = Buffer.from('pdf content')
    const longName = 'a'.repeat(81) + '.pdf'
    await expect(
      DocumentStorage.save(dummyBuffer, {
        destinationDir: 'public/uploads/test-docs',
        baseName: longName,
        allowedExtensions: ['.pdf'],
      })
    ).rejects.toThrow('ไม่อนุญาตให้ตั้งชื่อไฟล์ยาวเกิน 80 ตัวอักษร')
  })

  it('safely caps baseName to 50 characters on disk to prevent path overflow', async () => {
    const dummyBuffer = Buffer.from('pdf content')
    const name70chars = 'a'.repeat(70) + '.pdf'
    const result = await DocumentStorage.save(dummyBuffer, {
      destinationDir: 'public/uploads/test-docs',
      baseName: name70chars,
      allowedExtensions: ['.pdf'],
      collisionStrategy: 'fixed',
    })
    testFilesToClean.push(result.publicUrl)
    expect(result.fileName.replace('.pdf', '').length).toBe(50)
  })
})
