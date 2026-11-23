export type PhotoAlbumStatus = 'PUBLISHED' | 'DRAFT'

export interface PhotoAlbumImage {
  id: number
  albumId: number
  imageUrl: string
  caption: string | null
  displayOrder: number
}

export interface PhotoAlbumItem {
  id: number
  title: string
  slug: string
  description: string | null
  eventDate: string // YYYY-MM-DD
  coverImageUrl: string | null
  status: PhotoAlbumStatus
  isPinned: boolean
  viewCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  imageCount: number
  images: PhotoAlbumImage[]
}

export interface AlbumMonthOption {
  year: number
  month: number
  count: number
  value: string // e.g. "2026-11"
  label: string // Thai Buddhist label e.g. "พฤศจิกายน 2569 (4)"
}

export interface AlbumPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AlbumListResult {
  albums: PhotoAlbumItem[]
  availableMonths: AlbumMonthOption[]
  pagination: AlbumPagination
}

export interface AlbumImageInput {
  imageUrl: string
  caption?: string | null
  displayOrder?: number
}

export interface CreatePhotoAlbumInput {
  title: string
  slug?: string
  description?: string | null
  eventDate: string
  coverImageUrl?: string | null
  status?: PhotoAlbumStatus
  isPinned?: boolean
  images: AlbumImageInput[]
}

export interface UpdatePhotoAlbumInput {
  title?: string
  description?: string | null
  eventDate?: string
  coverImageUrl?: string | null
  status?: PhotoAlbumStatus
  isPinned?: boolean
  images?: AlbumImageInput[]
}
