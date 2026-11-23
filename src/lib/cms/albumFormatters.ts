import type { AlbumMonthOption, PhotoAlbumImage, PhotoAlbumItem } from '@/types/album'

export const THAI_MONTH_NAMES_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

export function formatThaiMonthYear(year: number, month: number): string {
  const beYear = year > 2400 ? year : year + 543
  const monthLabel = THAI_MONTH_NAMES_FULL[month - 1] || ''
  return `${monthLabel} ${beYear}`.trim()
}

export function formatAvailableMonthsThai(
  rows: Array<{ year: number; month: number; count: number }> = []
): AlbumMonthOption[] {
  return rows
    .filter((r) => Number(r.year) > 0 && Number(r.month) >= 1 && Number(r.month) <= 12)
    .map((r) => {
      const year = Number(r.year)
      const month = Number(r.month)
      const count = Number(r.count || 0)
      return {
        year,
        month,
        count,
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: formatThaiMonthYear(year, month),
      }
    })
}

export function normalizeAlbumItem(raw: Record<string, any>): PhotoAlbumItem {
  const images: PhotoAlbumImage[] = Array.isArray(raw.images)
    ? raw.images.map((img: any, index: number) => ({
        id: Number(img.id || index + 1),
        albumId: Number(img.albumId || raw.id || 0),
        imageUrl: String(img.imageUrl || ''),
        caption: img.caption ? String(img.caption) : null,
        displayOrder: typeof img.displayOrder === 'number' ? img.displayOrder : index,
      }))
    : []

  const coverImageUrl = raw.coverImageUrl
    ? String(raw.coverImageUrl)
    : images[0]?.imageUrl || null

  const eventDateRaw = raw.eventDate ? String(raw.eventDate).slice(0, 10) : ''

  return {
    id: Number(raw.id),
    title: String(raw.title || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    eventDate: eventDateRaw,
    coverImageUrl,
    status: raw.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    isPinned: Boolean(raw.isPinned),
    viewCount: Number(raw.viewCount || 0),
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : '',
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : '',
    imageCount: typeof raw.imageCount === 'number' ? raw.imageCount : images.length,
    images,
  }
}
