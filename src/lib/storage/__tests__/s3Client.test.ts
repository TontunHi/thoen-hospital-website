import { describe, it, expect, vi } from 'vitest'
import { normalizeS3Key } from '../s3Client'

describe('s3Client normalizeS3Key', () => {
  it('leaves standard short keys unchanged', () => {
    const key = 'uploads/08-10-2026/test-file.pdf'
    expect(normalizeS3Key(key)).toBe('uploads/08-10-2026/test-file.pdf')
  })

  it('strips leading slashes', () => {
    const key = '///uploads/image.png'
    expect(normalizeS3Key(key)).toBe('uploads/image.png')
  })

  it('normalizes oversized Thai segments deterministically without exceeding POSIX 255-byte limit', () => {
    const longThaiTitle = 'ประกาศจังหวัดลำปาง ประกวดราคาซื้อจัดซื้อยาและเวชภัณฑ์ จำนวน ๓ รายการ ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)-1791457450165-xqf6.pdf'
    const key = `uploads/08-10-2026/${longThaiTitle}`

    const normalized = normalizeS3Key(key)
    const segments = normalized.split('/')

    expect(segments.length).toBe(3)
    const lastSegment = segments[2]

    // Verify POSIX limit compliance
    const byteLen = Buffer.byteLength(lastSegment, 'utf8')
    expect(byteLen).toBeLessThanOrEqual(255)
    expect(lastSegment.endsWith('.pdf')).toBe(true)

    // Verify determinism: calling it multiple times gives exact same result
    expect(normalizeS3Key(key)).toBe(normalized)
  })

  it('does not treat long Thai folder names with dots as file extensions', () => {
    const folderSegment = 'ประกาศจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ. ๒๕๗๐ สำหรับโรงพยาบาลเถิน'
    const key = `uploads/${folderSegment}/file.pdf`

    const normalized = normalizeS3Key(key)
    const segments = normalized.split('/')
    expect(segments.length).toBe(3)

    for (const seg of segments) {
      expect(Buffer.byteLength(seg, 'utf8')).toBeLessThanOrEqual(255)
    }
  })
})

describe('s3Client MinIO pure API management', () => {
  it('checks MinIO health successfully when S3 endpoint is reachable', async () => {
    const { checkMinioHealth, getS3Client } = await import('../s3Client')
    const client = getS3Client()
    const sendSpy = vi.spyOn(client, 'send').mockResolvedValueOnce({ Buckets: [] } as any)

    const health = await checkMinioHealth()
    expect(health.healthy).toBe(true)
    expect(sendSpy).toHaveBeenCalled()
    sendSpy.mockRestore()
  })

  it('reports unhealthy when MinIO connection fails', async () => {
    const { checkMinioHealth, getS3Client } = await import('../s3Client')
    const client = getS3Client()
    const sendSpy = vi.spyOn(client, 'send').mockRejectedValueOnce(new Error('Connection refused'))

    const health = await checkMinioHealth()
    expect(health.healthy).toBe(false)
    expect(health.error).toContain('Connection refused')
    sendSpy.mockRestore()
  })

  it('ensures storage buckets exist by creating missing ones and setting public policy', async () => {
    const { ensureStorageBucketsExist, getS3Client } = await import('../s3Client')
    const client = getS3Client()
    
    // Simulate HeadBucket failing (404), then CreateBucket succeeding, then PutBucketPolicy succeeding
    const sendSpy = vi.spyOn(client, 'send').mockImplementation(async (command: any) => {
      const cmdName = command.constructor.name
      if (cmdName === 'HeadBucketCommand') {
        throw new Error('NotFound')
      }
      return {} as any
    })

    const result = await ensureStorageBucketsExist()
    expect(result.publicBucket).toBeDefined()
    expect(result.privateBucket).toBeDefined()
    expect(result.created.length).toBe(2)
    sendSpy.mockRestore()
  })
})
