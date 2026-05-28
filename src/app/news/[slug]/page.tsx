import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ImageGallery from '@/components/ImageGallery'
import ViewCounter from '@/components/ViewCounter'
import './page.css'

export const revalidate = 60 // Cache page for 60 seconds

// Extract YouTube ID from various YouTube URL formats
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

async function getNewsBySlug(slug: string) {
  try {
    // Only allow active published news
    return await prisma.news.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })
  } catch (error) {
    console.error('Failed to get news detail:', error)
    return null
  }
}

// Generate dynamic SEO metadata
export async function generateMetadata(
  props: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await props.params
  const news = await getNewsBySlug(slug)
  
  if (!news || news.status !== 'PUBLISHED') {
    return {
      title: 'ไม่พบข่าวสาร | โรงพยาบาลเถิน'
    }
  }

  return {
    title: `${news.title} | โรงพยาบาลเถิน`,
    description: news.excerpt || 'ข่าวสารประชาสัมพันธ์โรงพยาบาลเถิน จังหวัดลำปาง',
  }
}

export default async function NewsDetailPage(
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params
  const news = await getNewsBySlug(slug)

  // Verify news exists and is published
  if (!news || news.status !== 'PUBLISHED' || new Date(news.publishedAt) > new Date()) {
    notFound()
  }

  const youtubeId = news.youtubeUrl ? getYouTubeId(news.youtubeUrl) : null

  return (
    <div className="container newsDetailPage">
      {/* Trigger Client View Counter (anti-spam) */}
      <ViewCounter newsId={news.id} />

      <div className="newsDetailBack">
        <Link href="/news" className="backLink">
          ‹ กลับไปหน้ารายการข่าว
        </Link>
      </div>

      <article className="newsContentCard card">
        <header className="newsDetailHeader">
          <h1 className="newsDetailTitle">{news.title}</h1>
          <div className="newsDetailMeta">
            <time>
              เผยแพร่เมื่อ: {new Date(news.publishedAt).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })} น.
            </time>
            <span className="viewsBadge">👁️ {news.views} ผู้เข้าชม</span>
          </div>
        </header>

        {/* 1. Image Gallery Carousel */}
        {news.images.length > 0 && (
          <ImageGallery images={news.images} />
        )}

        {/* 2. Full Article text */}
        {news.content && (
          <div className="newsDetailBody">
            {news.content.split('\n').map((paragraph: string, idx: number) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        )}

        {/* 3. YouTube Embed section */}
        {youtubeId && (
          <div className="youtubeSection">
            <h3>🎥 วิดีโอที่เกี่ยวข้อง</h3>
            <div className="youtubeWrapper">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none', borderRadius: '8px' }}
              />
            </div>
          </div>
        )}

        {/* 4. PDF Embedded Reader & Controls */}
        {news.pdfUrl && (
          <div className="pdfSection">
            <div className="pdfHeader">
              <h3>📄 เอกสารแนบประชาสัมพันธ์ (PDF)</h3>
              <div className="pdfActions">
                <a
                  href={news.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  🌐 เปิดอ่านแยกหน้า
                </a>
                <a
                  href={news.pdfUrl}
                  download
                  className="btn btn-primary btn-sm"
                >
                  📥 ดาวน์โหลด PDF
                </a>
              </div>
            </div>
            
            <div className="pdfEmbedWrapper">
              <iframe
                src={`${news.pdfUrl}#toolbar=0`}
                width="100%"
                height="550px"
                style={{ border: 'none', borderRadius: '8px' }}
                title="PDF Document Viewer"
              />
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
