import type { Metadata } from 'next'
import Link from 'next/link'
import { Newspaper, ChevronRight } from 'lucide-react'
import { queryMemberDb } from '@/lib/memberDb'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { siteConfig } from '@/config/site'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ข่าวสารและประชาสัมพันธ์',
  description: 'ข่าวสารประชาสัมพันธ์ ประกาศ กิจกรรม อบรมสัมมนา และรับสมัครงาน โรงพยาบาลเถิน จังหวัดลำปาง',
  openGraph: {
    title: `ข่าวสารและประชาสัมพันธ์ | ${siteConfig.name}`,
    description: 'ข่าวสารประชาสัมพันธ์ ประกาศ กิจกรรม และรับสมัครงาน โรงพยาบาลเถิน',
  },
}

async function getNewsList(page: number, limit: number, category?: string) {
  try {
    const skip = (page - 1) * limit
    const now = new Date()

    const whereClauses = ['start_date <= NOW()', 'end_date >= NOW()']
    const params: any[] = []

    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }

    const whereSql = whereClauses.join(' AND ')

    const [rawNews, countRows] = await Promise.all([
      queryMemberDb(`
        SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate, view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt
        FROM news
        WHERE ${whereSql}
        ORDER BY start_date DESC
        LIMIT ${Number(limit)} OFFSET ${Number(skip)}
      `, params),
      queryMemberDb(`
        SELECT COUNT(*) AS total
        FROM news
        WHERE ${whereSql}
      `, params),
    ])

    const total = countRows[0]?.total ? Number(countRows[0].total) : 0

    const attachmentsByNewsId = new Map<number, any[]>()
    if (rawNews.length > 0) {
      const newsIds = rawNews.map((n: any) => n.id)
      const placeholders = newsIds.map(() => '?').join(',')
      const attachments = await queryMemberDb(`
        SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName
        FROM attachments
        WHERE news_id IN (${placeholders})
        ORDER BY id ASC
      `, newsIds)

      for (const att of attachments) {
        const list = attachmentsByNewsId.get(att.newsId) || []
        list.push(att)
        attachmentsByNewsId.set(att.newsId, list)
      }
    }

    const adaptedNews = rawNews.map((item: any) => {
      const atts = attachmentsByNewsId.get(item.id) || []
      const imageAttachments = atts.filter((att: any) =>
        att.fileType && att.fileType.startsWith('image/')
      )
      const images = imageAttachments.map((att: any) => ({
        id: att.id,
        imageUrl: att.filePath,
        order: 0,
      }))

      const pdfAttachment = atts.find((att: any) =>
        att.fileType === 'application/pdf'
      )

      let status = 'PUBLISHED'
      const startD = new Date(item.startDate)
      const endD = new Date(item.endDate)
      if (startD > now) {
        status = 'DRAFT'
      } else if (endD < now) {
        status = 'ARCHIVED'
      }

      return {
        id: item.id,
        title: item.title,
        slug: item.slug,
        excerpt: '',
        content: '',
        youtubeUrl: item.youtubeLink,
        pdfUrl: pdfAttachment ? pdfAttachment.filePath : null,
        status,
        category: item.category,
        views: item.viewCount || 0,
        publishedAt: item.startDate,
        expiredAt: item.endDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        images,
      }
    })

    return {
      news: adaptedNews,
      total,
    }
  } catch (error) {
    console.error('Fetch news error:', error)
    return { news: [], total: 0 }
  }
}

// Next.js 16 requires searchParams to be a Promise
export default async function NewsListPage(props: {
  searchParams: Promise<{ page?: string; category?: string }>
}) {
  const searchParams = await props.searchParams
  const page = parseInt(searchParams.page || '1')
  const category = searchParams.category
  const limit = 9

  const { news, total } = await getNewsList(page, limit, category)
  const totalPages = Math.ceil(total / limit)

  const getCategoryTitle = (cat?: string) => {
    switch (cat) {
      case 'PR': return 'ข่าวสารประชาสัมพันธ์'
      case 'TRAINING': return 'ข่าวประชุมอบรม / สัมมนา'
      case 'JOBS': return 'ข่าวประกาศรับสมัครงาน'
      case 'ANNOUNCEMENT': return 'ประกาศ'
      default: return 'ข่าวสารประชาสัมพันธ์ทั้งหมด'
    }
  }

  const categoryTitle = getCategoryTitle(category)

  const categories = [
    { key: undefined, label: 'ทั้งหมด', href: '/news' },
    { key: 'PR', label: 'ประชาสัมพันธ์', href: '/news?category=PR' },
    { key: 'TRAINING', label: 'ประชุมอบรม / สัมมนา', href: '/news?category=TRAINING' },
    { key: 'JOBS', label: 'ประกาศรับสมัครงาน', href: '/news?category=JOBS' },
    { key: 'ANNOUNCEMENT', label: 'ประกาศ', href: '/news?category=ANNOUNCEMENT' },
  ]

  return (
    <div className="container newsListPage">
      {/* Breadcrumb (N5) */}
      <Breadcrumb
        items={[
          { label: 'ข่าวสาร', href: '/news' },
          ...(category ? [{ label: categoryTitle }] : []),
        ]}
      />

      <div className="newsListHeader animate-fadeInUp">
        <div className="newsHeaderBadge">
          <Newspaper size={16} />
          <span>News & Announcements</span>
        </div>
        <h1>{category ? categoryTitle : 'ข่าวสารและประชาสัมพันธ์'}</h1>
        <p>ติดตามข่าวสารกิจกรรม ผลงาน และข้อมูลข่าวประชาสัมพันธ์ล่าสุดจากโรงพยาบาลเถิน</p>

        {/* Category Filters Bar */}
        <nav className="newsCategoryFilters" aria-label="กรองประเภทข่าว">
          {categories.map((cat) => {
            const isActive = category === cat.key || (!category && !cat.key)
            return (
              <Link
                key={cat.label}
                href={cat.href}
                className={`categoryFilterBtn touch-target ${isActive ? 'categoryFilterBtnActive' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{cat.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {news.length > 0 ? (
        <>
          <div className="newsListForum animate-fadeInUp">
            {news.map((item: any) => {
              const getCategoryLabel = (cat: string) => {
                switch (cat) {
                  case 'PR': return 'ประชาสัมพันธ์'
                  case 'TRAINING': return 'อบรม/สัมมนา'
                  case 'JOBS': return 'รับสมัครงาน'
                  case 'ANNOUNCEMENT': return 'ประกาศ'
                  default: return 'ข่าวสาร'
                }
              }

              return (
                <Link key={item.id} href={`/news/${item.slug}`} className="newsForumRow touch-target">
                  <div className="newsRowMeta">
                    <span className={`newsRowCategory badge-${item.category.toLowerCase()}`}>
                      {getCategoryLabel(item.category)}
                    </span>
                    <time className="newsRowDate">
                      {new Date(item.publishedAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </div>

                  <h2 className="newsRowTitle">{item.title}</h2>

                  <span className="newsRowChevron">
                    <ChevronRight size={18} />
                  </span>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination" role="navigation" aria-label="การแบ่งหน้าข่าว">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1
                const isActive = pageNum === page
                return (
                  <Link
                    key={pageNum}
                    href={`/news?page=${pageNum}${category ? `&category=${category}` : ''}`}
                    className={`pageButton touch-target ${isActive ? 'pageButtonActive' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`ไปยังหน้าที่ ${pageNum}`}
                  >
                    {pageNum}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="newsEmptyState animate-fadeIn">
          <h3>ยังไม่มีข่าวประชาสัมพันธ์</h3>
          <p>ในขณะนี้ยังไม่มีข้อมูลข่าวสารเผยแพร่ กรุณากลับมาติดตามข่าวสารใหม่ในภายหลัง</p>
        </div>
      )}
    </div>
  )
}
