import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import ImageGallery from '@/features/news/components/ImageGallery'
import ViewCounter from '@/features/news/components/ViewCounter'
import './page.css'
import { DbNews, DbAttachment } from '@/types/news'

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
    const imageAttachments = (news.attachments as unknown as DbAttachment[]).filter((att) => 
      att.fileType && att.fileType.startsWith('image/')
    )
    const images = imageAttachments.map((att) => ({
      id: att.id,
      imageUrl: att.filePath,
      order: 0
    }))

    const pdfAttachment = (news.attachments as unknown as DbAttachment[]).find((att) => 
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  if (!news || news.status !== 'PUBLISHED') {
    return {
      title: 'ไม่พบข่าวสาร | โรงพยาบาลเถิน'
    }
  }

  const firstImage = news.images && news.images.length > 0 ? news.images[0].imageUrl : '/images/common/logo-website.webp'
  const imageUrl = firstImage.startsWith('http') ? firstImage : `${siteUrl}${firstImage}`
  const pageUrl = `${siteUrl}/news/${encodeURIComponent(slug)}`

  return {
    title: `${news.title} | โรงพยาบาลเถิน`,
    description: news.excerpt || 'ข่าวสารประชาสัมพันธ์โรงพยาบาลเถิน จังหวัดลำปาง',
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: news.title,
      description: news.excerpt || 'ข่าวสารประชาสัมพันธ์โรงพยาบาลเถิน จังหวัดลำปาง',
      url: pageUrl,
      type: 'article',
      publishedTime: new Date(news.publishedAt).toISOString(),
      authors: ['โรงพยาบาลเถิน'],
      images: [
        {
          url: imageUrl,
          alt: news.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description: news.excerpt || 'ข่าวสารประชาสัมพันธ์โรงพยาบาลเถิน จังหวัดลำปาง',
      images: [imageUrl],
    },
  }
}

export default async function NewsDetailPage(
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params
  const news = await getNewsBySlug(slug)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  // Verify news exists and is published
  if (!news || news.status !== 'PUBLISHED' || new Date(news.publishedAt) > new Date()) {
    notFound()
  }

  const youtubeId = news.youtubeUrl ? getYouTubeId(news.youtubeUrl) : null
  const firstImage = news.images && news.images.length > 0 ? news.images[0].imageUrl : '/images/common/logo-website.webp'
  const imageUrl = firstImage.startsWith('http') ? firstImage : `${siteUrl}${firstImage}`

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    description: news.excerpt || news.title,
    image: [imageUrl],
    datePublished: new Date(news.publishedAt).toISOString(),
    dateModified: new Date(news.createdAt).toISOString(),
    author: {
      '@type': 'Organization',
      name: 'โรงพยาบาลเถิน',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'โรงพยาบาลเถิน',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/images/common/logo-website.webp`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/news/${encodeURIComponent(slug)}`,
    },
  }

  return (
    <div className="container newsDetailPage">
      {/* Schema.org NewsArticle Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Trigger Client View Counter (anti-spam) */}
      <ViewCounter newsId={news.id} />

      <div className="newsDetailBack">
        <Link href="/news" className="backLink" aria-label="กลับหน้ารายการข่าว">
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
            <span className="viewsBadge">
              👁 {news.views.toLocaleString('th-TH')} ครั้ง
            </span>
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
                aria-label={`เอกสารแนบประชาสัมพันธ์ PDF: ${news.title}`}
              />
            </div>
          </div>
        )}

        {/* 4. Images (รูป) */}
        {news.images.length > 0 && (
          <div className="gallerySection">
            <h3>รูปภาพประกอบ</h3>
            <ImageGallery images={news.images} />
          </div>
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
