import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhotoAlbumGrid from '../PhotoAlbumGrid'
import type { PhotoAlbumItem } from '@/types/album'

const sampleAlbums: PhotoAlbumItem[] = [
  {
    id: 1,
    title: 'กิจกรรมรณรงค์ฉีดวัคซีนไข้หวัดใหญ่',
    slug: 'flu-vaccine-2569',
    description: 'ให้บริการฉีดวัคซีนแก่ผู้สูงอายุและกลุ่มเสี่ยง',
    eventDate: '2026-11-20',
    coverImageUrl: '/uploads/2026/11/cover1.webp',
    status: 'PUBLISHED',
    isPinned: true,
    viewCount: 12,
    createdBy: 'admin',
    createdAt: '2026-11-20',
    updatedAt: '2026-11-20',
    imageCount: 2,
    images: [
      { id: 101, albumId: 1, imageUrl: '/uploads/2026/11/cover1.webp', caption: 'ภาพที่หนึ่ง', displayOrder: 0 },
      { id: 102, albumId: 1, imageUrl: '/uploads/2026/11/img2.webp', caption: null, displayOrder: 1 },
    ],
  },
]

describe('PhotoAlbumGrid & PhotoAlbumLightbox', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as any
  })

  it('renders album cards with Thai Buddhist date, pinned badge, and photo count', () => {
    render(<PhotoAlbumGrid albums={sampleAlbums} variant="homepage" />)

    expect(screen.getByText('กิจกรรมรณรงค์ฉีดวัคซีนไข้หวัดใหญ่')).toBeInTheDocument()
    expect(screen.getByText('20 พ.ย. 2569')).toBeInTheDocument()
    expect(screen.getByText('2 ภาพ')).toBeInTheDocument()
    expect(screen.getByText('เด่น')).toBeInTheDocument()
  })

  it('opens lightbox modal when clicking an album card and navigates images', () => {
    render(<PhotoAlbumGrid albums={sampleAlbums} variant="homepage" />)

    const cardBtn = screen.getByRole('button', { name: /กิจกรรมรณรงค์ฉีดวัคซีนไข้หวัดใหญ่/i })
    fireEvent.click(cardBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('ภาพที่ 1 / 2')).toBeInTheDocument()
    expect(screen.getByText('ภาพที่หนึ่ง')).toBeInTheDocument()

    const nextBtn = screen.getByRole('button', { name: 'ภาพถัดไป' })
    fireEvent.click(nextBtn)
    expect(screen.getByText('ภาพที่ 2 / 2')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'ปิดหน้าต่างดูภาพ' })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
