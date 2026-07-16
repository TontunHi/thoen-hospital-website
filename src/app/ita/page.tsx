import { Calendar, User, ChevronRight, FileText } from 'lucide-react'
import Link from 'next/link'
import { queryMemberDb } from '@/lib/memberDb'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'บทความการประเมินคุณธรรมและความโปร่งใส (ITA) | โรงพยาบาลเถิน',
  description: 'ศูนย์รวมบทความสาระ ความโปร่งใส และการดำเนินงานด้านคุณธรรมและความโปร่งใส (ITA) โรงพยาบาลเถิน จังหวัดลำปาง',
}

export default async function ItaPage() {
  let blogs = []
  try {
    blogs = await queryMemberDb(
      'SELECT id, title, content, author_name, author_position, created_at FROM ita_blogs ORDER BY created_at DESC'
    )
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
        
        {/* Header section */}
        <div className="ita-header animate-fade-in">
          <h1 className="ita-header__title">ITA & Integrity Articles</h1>
          <p className="ita-subtitle">
            ศูนย์รวมบทความ ความรู้ และการประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ โรงพยาบาลเถิน
          </p>
        </div>

        {/* Blog Grid */}
        <div className="ita-content">
          {blogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <FileText size={48} />
              </div>
              <h3>ยังไม่มีบทความในขณะนี้</h3>
              <p>กรุณากลับมาตรวจสอบใหม่อีกครั้งในภายหลัง หรือเข้าสู่ระบบสมาชิกเพื่อเริ่มเขียนบทความ</p>
              <Link href="/member/login" className="btn-login-member">
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
                      <div className="card-action-bar" style={{ width: '100%', justifyContent: 'flex-end' }}>
                        <Link href={`/ita/${blog.slug || blog.id}`} className="read-more-btn">
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
