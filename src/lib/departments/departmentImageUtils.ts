import path from 'path'
import { DocumentStorage } from '@/lib/storage/documentStorage'

/**
 * Resolves a member's profile image path to a public URL.
 * If rawPath is already a web URL (/uploads/..., http://, https://), returns it as-is.
 * If rawPath points to private disk storage (e.g. storage/<user>/profile.jpg),
 * it securely copies the image to public/uploads/org-chart/member-<id>.<ext>
 * so that it can be served to public visitors and displayed without broken image errors.
 */
export async function resolvePublicProfilePath(
  rawPath: string | null | undefined,
  memberId?: number | null
): Promise<string | null> {
  if (!rawPath || !rawPath.trim()) return null
  const trimmed = rawPath.trim()

  if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  if (trimmed.startsWith('storage/')) {
    try {
      const buffer = await DocumentStorage.readBuffer(trimmed)
      const ext = path.extname(trimmed).toLowerCase() || '.png'
      const baseName = memberId ? `member-${memberId}` : `member-${Date.now()}`
      const saved = await DocumentStorage.save(buffer, {
        destinationDir: 'public/uploads/org-chart',
        baseName,
        collisionStrategy: 'fixed',
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
      })
      return saved.publicUrl
    } catch (err: any) {
      console.warn(`Failed to resolve storage profile image for "${rawPath}":`, err?.message || err)
      return null
    }
  }

  return trimmed
}
