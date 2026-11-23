'use client'

import { useState } from 'react'
import { Calendar, Images, ChevronRight, Pin } from 'lucide-react'
import { formatThaiDate } from '@/lib/formatters'
import type { PhotoAlbumItem } from '@/types/album'
import PhotoAlbumLightbox from './PhotoAlbumLightbox'
import './PhotoAlbumGrid.css'

interface PhotoAlbumGridProps {
  albums: PhotoAlbumItem[]
  variant?: 'homepage' | 'archive'
  initialOpenAlbum?: PhotoAlbumItem | null
  emptyMessage?: string
}

export default function PhotoAlbumGrid({
  albums,
  variant = 'homepage',
  initialOpenAlbum = null,
  emptyMessage = 'ยังไม่มีภาพข่าวและกิจกรรมในขณะนี้',
}: PhotoAlbumGridProps) {
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbumItem | null>(initialOpenAlbum)

  if (!albums || albums.length === 0) {
    return (
      <>
        <div className="photoAlbumEmpty">
          <p>{emptyMessage}</p>
        </div>
        {selectedAlbum && (
          <PhotoAlbumLightbox album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
        )}
      </>
    )
  }

  return (
    <>
      <div
        className={`photoAlbumGrid ${
          variant === 'homepage' ? 'homepageVariant' : 'archiveVariant'
        }`}
      >
        {albums.map((album) => {
          const coverUrl = album.coverImageUrl || album.images?.[0]?.imageUrl || ''
          const photoCount = album.imageCount || album.images?.length || 0

          return (
            <button
              key={album.id}
              type="button"
              className="photoAlbumCard touch-target"
              onClick={() => setSelectedAlbum(album)}
              aria-label={`เปิดดูอัลบั้มภาพ: ${album.title} (${photoCount} ภาพ)`}
            >
              <div className="photoAlbumCoverWrap">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt={album.title}
                    className="photoAlbumCoverImg"
                    loading="lazy"
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--gray-400)',
                    }}
                  >
                    <Images size={32} />
                  </div>
                )}

                {album.isPinned && (
                  <span className="photoAlbumPinBadge">
                    <Pin size={12} aria-hidden="true" />
                    <span>เด่น</span>
                  </span>
                )}

                <span className="photoAlbumCountBadge">
                  <Images size={13} aria-hidden="true" />
                  <span>{photoCount} ภาพ</span>
                </span>
              </div>

              <div className="photoAlbumBody">
                <div className="photoAlbumDate">
                  <Calendar size={14} aria-hidden="true" />
                  <time dateTime={album.eventDate}>{formatThaiDate(album.eventDate)}</time>
                </div>

                <h3 className="photoAlbumTitle">{album.title}</h3>

                {variant === 'archive' && album.description && (
                  <p className="photoAlbumDesc">{album.description}</p>
                )}

                <div className="photoAlbumFooter">
                  <span className="photoAlbumFooterAction">
                    <span>ดูอัลบั้มภาพ</span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {variant === 'homepage' && albums.length > 1 && (
        <div className="photoAlbumSwipeHint" aria-hidden="true">
          <span>เลื่อนซ้าย-ขวาเพื่อดูอัลบั้มอื่น</span>
          <ChevronRight size={14} />
        </div>
      )}

      {selectedAlbum && (
        <PhotoAlbumLightbox
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
        />
      )}
    </>
  )
}
