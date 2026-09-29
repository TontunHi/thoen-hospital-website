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
})
