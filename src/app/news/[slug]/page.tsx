import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import ImageGallery from '@/components/ImageGallery'
import ViewCounter from '@/components/ViewCounter'
import './page.css'

// Extract YouTube ID from various YouTube URL formats
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

async function getNewsBySlug(slug: string) {
  try {
    const decodedSlug = decodeURIComponent(slug)
    // Query from the new schema
    const news = await prisma.news.findUnique({
      where: { slug: decodedSlug },
      include: {
        attachments: true
      }
    })

    if (!news) return null

    // Adapt structure for the views compatibility
    const now = new Date()
    const imageAttachments = news.attachments.filter((att: any) => 
      att.fileType && att.fileType.startsWith('image/')
    )
    const images = imageAttachments.map((att: any) => ({
      id: att.id,
      imageUrl: att.filePath,
      order: 0
    }))

    const pdfAttachment = news.attachments.find((att: any) => 
      att.fileType === 'application/pdf'
    )

    let status = 'PUBLISHED'
    if (news.startDate > now) {
      status = 'DRAFT'
    } else if (news.endDate < now) {
      status = 'ARCHIVED'
    }

    return {
      id: news.id,
      title: news.title,
      slug: news.slug,
      excerpt: '',
      content: '', // No content field in DB
      youtubeUrl: news.youtubeLink,
      pdfUrl: pdfAttachment ? pdfAttachment.filePath : null,
      status,
      category: news.category,
      views: news.viewCount || 0,
      publishedAt: news.startDate,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
      images
    }
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
            
          </div>
        </header>

        {/* 2. Content (เนื้อหา) */}
        {news.content && (
          <div className="newsDetailBody">
            {news.content.split('\n').map((paragraph: string, idx: number) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        )}

        {/* 3. PDF (เอกสารแนบ PDF) */}
        {news.pdfUrl && (
          <div className="pdfSection">
            <div className="pdfHeader">
              <h3>เอกสารแนบประชาสัมพันธ์ (PDF)</h3>
              <div className="pdfActions">
                <a
                  href={news.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  เปิดอ่านแยกหน้า
                </a>
                <a
                  href={news.pdfUrl}
                  download
                  className="btn btn-primary btn-sm"
                >
                  ดาวน์โหลด PDF
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

        {/* 4. Images (รูป) */}
        {news.images.length > 0 && (
          <ImageGallery images={news.images} />
        )}

        {/* 5. Video (vdo - YouTube) */}
        {youtubeId && (
          <div className="youtubeSection">
            <h3>วิดีโอที่เกี่ยวข้อง</h3>
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
      </article>
    </div>
  )
}
