import { Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ItaBlogService } from '@/lib/cms/ItaBlogService'
import '../page.css'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props) {
  const params = await props.params
  const slugOrId = decodeURIComponent(params.slug)

  try {
    const blog = await ItaBlogService.getBlogByIdOrSlug(slugOrId)
    if (blog) {
      return {
        title: `${blog.title} | โรงพยาบาลเถิน`,
      }
    }
  } catch (e) {}

  return { title: 'ไม่พบบทความ' }
}

export default async function ItaBlogDetailPage(props: Props) {
  const params = await props.params
  const slugOrId = decodeURIComponent(params.slug)

  let blog = null
  try {
    blog = await ItaBlogService.getBlogByIdOrSlug(slugOrId)
  } catch (error) {
    console.error('Failed to load ITA blog post detail:', error)
  }

  if (!blog) {
    notFound()
  }

  // Format Thai Buddhist Date
  const dateObj = new Date(blog.created_at)
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ]
  const formattedDate = !isNaN(dateObj.getTime())
    ? `${dateObj.getDate()} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`
    : ''

  return (
    <div className="ita-detail-page">
      <div className="container">
        {/* Back Link */}
        <Link href="/ita" className="back-link">
          <ArrowLeft size={18} />
          กลับไปหน้ารวมบทความ ITA
        </Link>

        <article className="ita-article">
          <header className="article-header">
            <h1 className="article-title">{blog.title}</h1>
            <div className="article-meta">
              <span className="meta-item">
                <Calendar size={16} />
                {formattedDate}
              </span>
              <span className="meta-author">
                โดย: <strong>{blog.author_name}</strong>
                {blog.author_position && <span className="author-pos"> ({blog.author_position})</span>}
              </span>
            </div>
          </header>

          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />
        </article>
      </div>
    </div>
  )
}
