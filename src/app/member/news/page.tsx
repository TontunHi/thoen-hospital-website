'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Newspaper, 
  Eye, 
  Edit3, 
  Award, 
  Calendar, 
  Image as ImageIcon, 
  Plus, 
  ArrowRight,
  Clock,
  ExternalLink,
  Loader2
} from 'lucide-react'
import './page.css'

interface Stats {
  totalNews: number
  publishedNews: number
  draftNews: number
  totalSlides: number
}

interface NewsItem {
  id: number
  title: string
  publishedAt: string
  views: number
  category?: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentNews, setRecentNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [newsRes, slidesRes] = await Promise.all([
          fetch(`/api/news?all=true&limit=100&t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/hero-slides?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
        ])

        const newsData = await newsRes.json()
        const slidesData = slidesRes ? await slidesRes.json().catch(() => null) : null

        const allNews = newsData.news || []
        const totalN = newsData.pagination?.total || allNews.length
        
        // Count based on active dates
        const now = new Date()
        const published = allNews.filter((n: any) => {
          const start = new Date(n.publishedAt)
          const end = n.expiredAt ? new Date(n.expiredAt) : new Date()
          if (!n.expiredAt) {
            end.setFullYear(end.getFullYear() + 50)
          }
          return start <= now && end >= now
        }).length

        const draft = allNews.filter((n: any) => {
          const start = new Date(n.publishedAt)
          return start > now
        }).length

        const totalSlides = Array.isArray(slidesData?.slides) ? slidesData.slides.length : 0

        // Map recent news
        const mappedRecent = allNews.slice(0, 5).map((n: any) => ({
          id: n.id,
          title: n.title,
          publishedAt: n.publishedAt,
          views: n.views || 0,
          category: n.category || 'PR'
        }))

        setRecentNews(mappedRecent)

        setStats({
          totalNews: totalN,
          publishedNews: published,
          draftNews: draft,
          totalSlides
        })
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="dashboardLoading card">
        <Loader2 size={36} className="spinner" />
        <p>กำลังโหลดข้อมูลภาพรวม CMS...</p>
      </div>
    )
  }

  return (
    <div className="dashboardPage">
      {/* 4 Crisp KPI Cards */}
      <section className="statsGrid" aria-label="สรุปสถิติข่าวสารและสื่อประชาสัมพันธ์">
        <div className="statCard total">
          <div className="statCardInfo">
            <span className="statLabel">ข่าวสารทั้งหมด</span>
            <span className="statValue">{stats?.totalNews || 0} รายการ</span>
          </div>
          <div className="statCardIcon total">
            <Newspaper size={22} />
          </div>
        </div>

        <div className="statCard published">
          <div className="statCardInfo">
            <span className="statLabel">กำลังเผยแพร่</span>
            <span className="statValue">{stats?.publishedNews || 0} ข่าว</span>
          </div>
          <div className="statCardIcon published">
            <Award size={22} />
          </div>
        </div>

        <div className="statCard draft">
          <div className="statCardInfo">
            <span className="statLabel">รอเผยแพร่ / ฉบับร่าง</span>
            <span className="statValue">{stats?.draftNews || 0} ฉบับ</span>
          </div>
          <div className="statCardIcon draft">
            <Clock size={22} />
          </div>
        </div>

        <div className="statCard slides">
          <div className="statCardInfo">
            <span className="statLabel">ป้ายสไลด์หน้าแรก</span>
            <span className="statValue">{stats?.totalSlides || 0} สไลด์</span>
          </div>
          <div className="statCardIcon slides">
            <ImageIcon size={22} />
          </div>
        </div>
      </section>

      {/* Quick Action Shortcuts Banner */}
      <section className="quickActionsPanel" aria-label="เมนูด่วน">
        <div className="quickActionsLeft">
          <span className="quickActionsTitle">เมนูลัดการจัดการ:</span>
          <div className="quickActionChips">
            <Link href="/member/news/news/create" className="quickActionChip primary">
              <Plus size={14} />
              <span>เขียนข่าวประชาสัมพันธ์ใหม่</span>
            </Link>
            <Link href="/member/news/slides" className="quickActionChip">
              <ImageIcon size={14} />
              <span>จัดการสไลด์แบนเนอร์</span>
            </Link>
          </div>
        </div>

        <div className="currentDateBadge">
          <Calendar size={13} />
          <span>
            {new Date().toLocaleDateString('th-TH', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
      </section>

      {/* Main Grid: Recent News & Hospital Publishing Guide */}
      <div className="dashboardGrid">
        {/* Recent News Table Card */}
        <section className="recentNewsCard card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h2>ข่าวประชาสัมพันธ์ล่าสุด</h2>
              <span className="sectionSubtitle">5 ข่าวสารที่สร้างและอัปเดตล่าสุด</span>
            </div>
            <Link href="/member/news/news" className="viewAllLink">
              <span>ดูข่าวทั้งหมด</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {recentNews.length > 0 ? (
            <div className="tableWrapper">
              <table className="recentTable">
                <thead>
                  <tr>
                    <th>หัวข้อข่าว</th>
                    <th style={{ width: '130px' }}>วันที่เผยแพร่</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>ยอดเข้าชม</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentNews.map((news) => (
                    <tr key={news.id}>
                      <td className="recentTitleCell">
                        <Link href={`/member/news/news/${news.id}/edit`} className="newsTitleLink" title={news.title}>
                          {news.title}
                        </Link>
                      </td>
                      <td className="dateCell">
                        {new Date(news.publishedAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="viewsCell">
                        <span className="viewsBadge">
                          <Eye size={12} />
                          <span>{news.views.toLocaleString('th-TH')}</span>
                        </span>
                      </td>
                      <td className="actionCell">
                        <Link 
                          href={`/member/news/news/${news.id}/edit`} 
                          className="editActionBtn"
                          title="แก้ไขข่าว"
                          aria-label={`แก้ไขข่าว ${news.title}`}
                        >
                          <Edit3 size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="emptyState">
              <Newspaper size={36} className="emptyIcon" />
              <p>ยังไม่มีข่าวสารในระบบ</p>
              <Link href="/member/news/news/create" className="emptyCtaBtn">
                <Plus size={14} />
                <span>เขียนข่าวแรกเลย</span>
              </Link>
            </div>
          )}
        </section>

        {/* CMS Guidelines Card */}
        <section className="guidelinesCard card">
          <div className="sectionHeader">
            <div className="sectionTitle">
              <h2>แนวทางการเผยแพร่สื่อ</h2>
              <span className="sectionSubtitle">ข้อแนะนำสำหรับผู้ดูแลเว็บไซต์</span>
            </div>
          </div>

          <div className="guidelineItems">
            <div className="guidelineItem">
              <div className="guidelineBullet">1</div>
              <div className="guidelineContent">
                <h4>รูปภาพประกอบข่าวสาร</h4>
                <p>รองรับไฟล์ JPG, PNG, WEBP แนะนำขนาดอัตราส่วน 16:9 เพื่อความสวยงามทั้งบนมือถือและจอคอมพิวเตอร์</p>
              </div>
            </div>

            <div className="guidelineItem">
              <div className="guidelineBullet">2</div>
              <div className="guidelineContent">
                <h4>วิดีโอและเอกสารแนบ</h4>
                <p>สามารถวางลิงก์ YouTube เพื่อให้ระบบแสดงวิดีโอทันที และแนบเอกสาร PDF เพื่อให้ประชาชนดาวน์โหลดได้</p>
              </div>
            </div>

            <div className="guidelineItem">
              <div className="guidelineBullet">3</div>
              <div className="guidelineContent">
                <h4>สไลด์โชว์หน้าแรก (Hero Slide)</h4>
                <p>รองรับทั้งภาพความละเอียดสูง (1920x800px) และไฟล์วิดีโอ MP4 พร้อมระบบตั้งเวลาเปิด-ปิดอัตโนมัติ</p>
              </div>
            </div>
          </div>

          <div className="publicSiteBox">
            <div className="publicSiteInfo">
              <span className="publicSiteLabel">หน้าเว็บข่าวสำหรับประชาชน:</span>
              <span className="publicSiteUrl">/news</span>
            </div>
            <Link href="/news" target="_blank" className="publicSiteLink">
              <span>เปิดดู</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
