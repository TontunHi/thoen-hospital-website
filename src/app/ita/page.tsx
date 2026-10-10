import { Calendar, User, ChevronRight, FileText, Award } from 'lucide-react'
import Link from 'next/link'
import { ItaBlogService } from '@/lib/cms/ItaBlogService'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { siteConfig } from '@/config/site'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'บทความการประเมินคุณธรรมและความโปร่งใส (ITA)',
  description: 'ศูนย์รวมบทความสาระ ความโปร่งใส และการดำเนินงานด้านคุณธรรมและความโปร่งใส (ITA) โรงพยาบาลเถิน จังหวัดลำปาง',
  openGraph: {
    title: `บทความ ITA | ${siteConfig.name}`,
    description: 'ศูนย์รวมบทความสาระ ความโปร่งใส และการประเมินคุณธรรมและความโปร่งใส (ITA) โรงพยาบาลเถิน',
  },
}

export default async function ItaPage() {
  let blogs: any[] = []
  try {
    const res = await ItaBlogService.listBlogs({ limit: 50 })
    blogs = res.data
  } catch (error) {
    console.error('Failed to load public ITA blogs:', error)
  }

  // Helper to extract plain text snippet from rich HTML content
  const getExcerpt = (htmlContent: string) => {
    if (!htmlContent) return ''
    const cleanText = htmlContent.replace(/<[^>]*>/g, '')
    return cleanText.length > 150 ? cleanText.substring(0, 150) + '...' : cleanText
  }

  return (
    <div className="ita-page">
      <div className="container">
        {/* Breadcrumb (N5) */}
        <Breadcrumb items={[{ label: 'การประเมินคุณธรรมและความโปร่งใส (ITA)' }]} />

        {/* Header section */}
        <div className="ita-header animate-fadeInUp">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '50px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>
            <Award size={16} />
            <span>Integrity and Transparency Assessment</span>
          </div>
          <h1 className="ita-header__title">ITA & ความโปร่งใส</h1>
          <p className="ita-subtitle">
            ศูนย์รวมบทความ ความรู้ และการประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของโรงพยาบาลเถิน
          </p>
        </div>

        {/* Blog Grid */}
        <div className="ita-content animate-fadeInUp">
          {blogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <FileText size={48} />
              </div>
              <h3>ยังไม่มีบทความในขณะนี้</h3>
              <p>กรุณากลับมาตรวจสอบใหม่อีกครั้งในภายหลัง หรือเข้าสู่ระบบสมาชิกเพื่อเริ่มเขียนบทความ</p>
              <Link href="/member/login" className="btn btn-primary touch-target" style={{ marginTop: '1rem' }}>
                เข้าสู่ระบบสมาชิก
              </Link>
            </div>
          ) : (
            <div className="ita-blog-grid">
              {blogs.map((blog: any) => {
                const pubDate = new Date(blog.created_at).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })

                return (
                  <article key={blog.id} className="ita-blog-card">
                    <div className="ita-blog-card__body">
                      <h2 className="ita-blog-card__title">
                        <Link href={`/ita/${blog.slug || blog.id}`}>{blog.title}</Link>
                      </h2>
                      <p className="ita-blog-card__excerpt">{getExcerpt(blog.content)}</p>
                    </div>
                    <div className="ita-blog-card__footer">
                      <div className="card-action-bar" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>{pubDate}</span>
                        <Link href={`/ita/${blog.slug || blog.id}`} className="read-more-btn touch-target">
                          <span>อ่านต่อ</span>
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
