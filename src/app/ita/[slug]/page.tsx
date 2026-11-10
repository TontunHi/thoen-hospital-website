import { Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiGateway } from '@/lib/apiGateway'
import '../page.css'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props) {
  const params = await props.params
  const slugOrId = decodeURIComponent(params.slug)
  
  try {
    const blog = await apiGateway.app.getItaBlogById(slugOrId)
    if (blog && blog.title) {
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
    blog = await apiGateway.app.getItaBlogById(slugOrId)
  } catch (error) {
    console.error('Failed to load ITA blog detail:', error)
  }

  if (!blog) {
    notFound()
  }

  return (
    <div className="ita-page">
      <div className="container">
        
        {/* Back Button */}
        <div className="back-nav-wrapper">
          <Link href="/ita" className="back-to-list-btn">
            <ArrowLeft size={16} />
            <span>กลับไปหน้าบทความทั้งหมด</span>
          </Link>
        </div>

        {/* Post Container */}
        <article className="ita-post-container">
          <header className="ita-post-header" style={{ marginBottom: '2rem' }}>
            <h1 className="ita-post-title" style={{ marginBottom: 0 }}>{blog.title}</h1>
          </header>

          {/* Safe Render HTML Content */}
          <div 
            className="blog-content font-sarabun"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />
        </article>

      </div>
    </div>
  )
}
