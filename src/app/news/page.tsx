import Link from 'next/link'
import './page.css'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getNewsList(page: number, limit: number, category?: string) {
  try {
    const skip = (page - 1) * limit
    const now = new Date()

    const where: any = {
      startDate: { lte: now },
      endDate: { gte: now }
    }

    if (category) {
      where.category = category
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        include: {
          attachments: {
            orderBy: { id: 'asc' }
          }
        }
      }),
      prisma.news.count({ where }),
    ])

    const adaptedNews = news.map((item: any) => {
      const imageAttachments = item.attachments.filter((att: any) => 
        att.fileType && att.fileType.startsWith('image/')
      )
      const images = imageAttachments.map((att: any) => ({
        id: att.id,
        imageUrl: att.filePath,
        order: 0
      }))

      const pdfAttachment = item.attachments.find((att: any) => 
        att.fileType === 'application/pdf'
      )

      let status = 'PUBLISHED'
      if (item.startDate > now) {
        status = 'DRAFT'
      } else if (item.endDate < now) {
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
        images
      }
    })

    return {
      news: adaptedNews,
      total
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

  return (
    <div className="container newsListPage">
      <div className="newsListHeader">
        <h1>{categoryTitle}</h1>
        <p>ติดตามข่าวสารกิจกรรม ผลงาน และข้อมูลข่าวประชาสัมพันธ์ล่าสุดจากโรงพยาบาลเถิน</p>
      </div>

      {news.length > 0 ? (
        <>
          <div className="newsListForum">
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
                <Link key={item.id} href={`/news/${item.slug}`} className="newsForumRow">
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </span>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1
                const isActive = pageNum === page
                return (
                  <Link
                    key={pageNum}
                    href={`/news?page=${pageNum}${category ? `&category=${category}` : ''}`}
                    className={`pageButton ${isActive ? 'pageButtonActive' : ''}`}
                  >
                    {pageNum}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="newsEmptyState">
          <h3>ยังไม่มีข่าวประชาสัมพันธ์</h3>
          <p>ในขณะนี้ยังไม่มีข้อมูลข่าวสารเผยแพร่ กรุณากลับมาติดตามข่าวสารใหม่ในภายหลัง</p>
        </div>
      )}
    </div>
  )
}
