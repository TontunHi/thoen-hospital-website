import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HomepagePhotoShowcase from '../HomepagePhotoShowcase'
import type { AlbumMonthOption, PhotoAlbumItem } from '@/types/album'

const novAlbum: PhotoAlbumItem = {
  id: 1,
  title: 'ภาพข่าวและกิจกรรม ประจำเดือนพฤศจิกายน 2569',
  slug: '2026-11',
  description: null,
  eventDate: '2026-11-01',
  coverImageUrl: '/uploads/2026/11/1.webp',
  status: 'PUBLISHED',
  isPinned: false,
  viewCount: 5,
  createdBy: 'admin',
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
  imageCount: 5,
  images: [
    { id: 1, albumId: 1, imageUrl: '/uploads/2026/11/1.webp', caption: 'กิจกรรมที่ 1', displayOrder: 0 },
    { id: 2, albumId: 1, imageUrl: '/uploads/2026/11/2.webp', caption: 'กิจกรรมที่ 2', displayOrder: 1 },
    { id: 3, albumId: 1, imageUrl: '/uploads/2026/11/3.webp', caption: 'กิจกรรมที่ 3', displayOrder: 2 },
    { id: 4, albumId: 1, imageUrl: '/uploads/2026/11/4.webp', caption: 'กิจกรรมที่ 4', displayOrder: 3 },
    { id: 5, albumId: 1, imageUrl: '/uploads/2026/11/5.webp', caption: 'กิจกรรมที่ 5', displayOrder: 4 },
  ],
}

const octAlbum: PhotoAlbumItem = {
  id: 2,
  title: 'ภาพข่าวและกิจกรรม ประจำเดือนตุลาคม 2569',
  slug: '2026-10',
  description: null,
  eventDate: '2026-10-01',
  coverImageUrl: '/uploads/2026/10/1.webp',
  status: 'PUBLISHED',
  isPinned: false,
  viewCount: 3,
  createdBy: 'admin',
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
  imageCount: 2,
  images: [
    { id: 11, albumId: 2, imageUrl: '/uploads/2026/10/1.webp', caption: 'ต.ค. ภาพ 1', displayOrder: 0 },
    { id: 12, albumId: 2, imageUrl: '/uploads/2026/10/2.webp', caption: 'ต.ค. ภาพ 2', displayOrder: 1 },
  ],
}

const availableMonths: AlbumMonthOption[] = [
  { year: 2026, month: 11, count: 1, value: '2026-11', label: 'พฤศจิกายน 2569' },
  { year: 2026, month: 10, count: 1, value: '2026-10', label: 'ตุลาคม 2569' },
]

describe('HomepagePhotoShowcase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 3 preview photos, +remaining badge, and opens lightbox when clicked', () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as any

    render(
      <HomepagePhotoShowcase initialAlbum={novAlbum} availableMonths={availableMonths} />
    )

    expect(screen.getByText('กิจกรรมที่ 1')).toBeInTheDocument()
    expect(screen.getByText('กิจกรรมที่ 2')).toBeInTheDocument()
    expect(screen.getByText('กิจกรรมที่ 3')).toBeInTheDocument()
    expect(screen.queryByText('กิจกรรมที่ 4')).not.toBeInTheDocument()
    expect(screen.getByText('+อีก 2 ภาพ')).toBeInTheDocument()
    expect(screen.getByText('ดูภาพเพิ่มเติมในเดือนนี้ (ทั้งหมด 5 ภาพ)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ดูภาพเพิ่มเติมในเดือนนี้/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('ภาพที่ 4 / 5')).toBeInTheDocument()
  })

  it('fetches past month album when month dropdown changes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, albums: [octAlbum] }),
    }) as any

    render(
      <HomepagePhotoShowcase initialAlbum={novAlbum} availableMonths={availableMonths} />
    )

    const monthSelect = screen.getByLabelText('เดือน:')
    fireEvent.change(monthSelect, { target: { value: '10' } })

    await waitFor(() => {
      expect(screen.getByText('ต.ค. ภาพ 1')).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/albums?year=2026&month=10&limit=1', {
      cache: 'no-store',
    })
  })
})
