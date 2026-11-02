import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolvePublicProfilePath } from '../departmentImageUtils'
import { DocumentStorage } from '@/lib/storage/documentStorage'

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    readBuffer: vi.fn(),
    save: vi.fn(),
  }
}))

describe('departmentImageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for null, empty or whitespace strings', async () => {
    expect(await resolvePublicProfilePath(null)).toBeNull()
    expect(await resolvePublicProfilePath('')).toBeNull()
    expect(await resolvePublicProfilePath('   ')).toBeNull()
  })

  it('returns web URLs and /uploads paths as-is without re-saving', async () => {
    expect(await resolvePublicProfilePath('/uploads/org-chart/staff.png')).toBe('/uploads/org-chart/staff.png')
    expect(await resolvePublicProfilePath('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg')
    expect(DocumentStorage.readBuffer).not.toHaveBeenCalled()
    expect(DocumentStorage.save).not.toHaveBeenCalled()
  })

  it('copies private storage profile photo to public uploads and returns public URL', async () => {
    const fakeBuffer = Buffer.from('fake-image-bytes')
    vi.mocked(DocumentStorage.readBuffer).mockResolvedValue(fakeBuffer)
    vi.mocked(DocumentStorage.save).mockResolvedValue({
      publicUrl: '/uploads/org-chart/member-15.jpg',
      relativePath: 'public/uploads/org-chart/member-15.jpg',
      diskPath: '/disk/member-15.jpg',
      fileName: 'member-15.jpg',
      fileSize: 100,
      mimeType: 'image/jpeg'
    })

    const result = await resolvePublicProfilePath('storage/som_nurse/profile.jpg', 15)

    expect(DocumentStorage.readBuffer).toHaveBeenCalledWith('storage/som_nurse/profile.jpg')
    expect(DocumentStorage.save).toHaveBeenCalledWith(fakeBuffer, expect.objectContaining({
      destinationDir: 'public/uploads/org-chart',
      baseName: 'member-15',
      collisionStrategy: 'fixed'
    }))
    expect(result).toBe('/uploads/org-chart/member-15.jpg')
  })

  it('returns null gracefully if storage file cannot be read', async () => {
    vi.mocked(DocumentStorage.readBuffer).mockRejectedValue(new Error('ENOENT: no such file or directory'))

    const result = await resolvePublicProfilePath('storage/deleted_user/profile.jpg', 99)
    expect(result).toBeNull()
  })
})
