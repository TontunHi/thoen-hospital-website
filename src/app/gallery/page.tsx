import type { Metadata } from 'next'
import { Images } from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { photoAlbumService } from '@/lib/cms/PhotoAlbumService'
import { siteConfig } from '@/config/site'
import GalleryArchiveClient from './GalleryArchiveClient'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ภาพข่าวและกิจกรรม',
  description: 'ประมวลภาพข่าว กิจกรรม รายเดือน โรงพยาบาลเถิน จังหวัดลำปาง',
  openGraph: {
    title: `ภาพข่าวและกิจกรรม | ${siteConfig.name}`,
    description: 'ประมวลภาพข่าวและกิจกรรมรายเดือนของโรงพยาบาลเถิน จังหวัดลำปาง',
  },
}

export default async function GalleryPage(props: {
  searchParams: Promise<{
    page?: string
    month?: string
    year?: string
    search?: string
    album?: string
  }>
}) {
  const searchParams = await props.searchParams
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const monthParam = searchParams.month || ''
  const yearParam = searchParams.year || ''
  const search = searchParams.search || ''
  const albumSlug = searchParams.album || ''

  let year: number | undefined
  let month: number | undefined

  const ymMatch = monthParam.match(/^(\d{4})-(\d{1,2})$/)
  if (ymMatch) {
    year = parseInt(ymMatch[1], 10)
    month = parseInt(ymMatch[2], 10)
  } else if (yearParam && /^\d{4}$/.test(yearParam)) {
    year = parseInt(yearParam, 10)
    if (monthParam && /^\d{1,2}$/.test(monthParam)) {
      month = parseInt(monthParam, 10)
    }
  } else if (albumSlug && /^\d{4}-\d{1,2}$/.test(albumSlug)) {
    const [ay, am] = albumSlug.split('-')
    year = parseInt(ay, 10)
    month = parseInt(am, 10)
  }

  const [listResult, directAlbum] = await Promise.all([
    photoAlbumService
      .listAlbums({
        all: false,
        page,
        limit: 12,
        year,
        month,
        search: search || undefined,
      })
      .catch(() => ({
        albums: [],
        availableMonths: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
      })),
    albumSlug ? photoAlbumService.getAlbum(albumSlug) : Promise.resolve(null),
  ])

  const initialOpenAlbum =
    directAlbum && directAlbum.status === 'PUBLISHED' ? directAlbum : null

  return (
    <div className="galleryArchivePage">
      <div className="container">
        <Breadcrumb items={[{ label: 'ภาพข่าวและกิจกรรม' }]} />

        <header className="galleryHeader">
          <div className="galleryTitleRow">
            <span className="galleryTitleIcon" aria-hidden="true">
              <Images size={24} />
            </span>
            <h1>ภาพข่าวและกิจกรรมโรงพยาบาลเถิน</h1>
          </div>
          <p>
            ประมวลภาพกิจกรรม การลงพื้นที่ดูแลสุขภาพชุมชน และการอบรมประจำเดือนของโรงพยาบาลเถิน
          </p>
        </header>

        <GalleryArchiveClient
          albums={listResult.albums}
          availableMonths={listResult.availableMonths}
          pagination={listResult.pagination}
          selectedYear={year ?? null}
          selectedMonth={month ?? null}
          initialSearch={search}
          initialOpenAlbum={initialOpenAlbum}
        />
      </div>
    </div>
  )
}
