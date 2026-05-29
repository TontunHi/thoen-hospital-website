'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Newspaper, Mail, Eye, Archive, Edit, Award } from 'lucide-react'
import './page.css'

interface Stats {
  totalNews: number
  publishedNews: number
  draftNews: number
}

interface NewsItem {
  id: number
  title: string
  publishedAt: string
  views: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentNews, setRecentNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const newsRes = await fetch('/api/news?all=true&limit=100')
        const newsData = await newsRes.json()

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

        const archived = allNews.filter((n: any) => {
          if (n.expiredAt) {
            const end = new Date(n.expiredAt)
            return end < now
          }
          return false
        }).length

        // Map recent news
        const mappedRecent = allNews.slice(0, 5).map((n: any) => ({
          id: n.id,
          title: n.title,
          publishedAt: n.publishedAt,
          views: n.views || 0
        }))

        setRecentNews(mappedRecent)

        setStats({
          totalNews: totalN,
          publishedNews: published,
          draftNews: draft, // Showing pending drafts
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
      <div className="loadingState">
        <div className="spinner" />
        <p>กำลังโหลดข้อมูลแดชบอร์ด...</p>
      </div>
    )
  }

  return (
    <div className="dashboardPage">
      <div className="dashboardHeader">
        <div>
          <h1>แดชบอร์ดผู้บริหาร</h1>
          <p>ภาพรวมสถิติการใช้งาน และเนื้อหาข่าวประชาสัมพันธ์ของโรงพยาบาลเถิน</p>
        </div>
        <div className="currentDateBadge">
          {new Date().toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      <div className="statsGrid">
        <div className="statCard cardPrimary">
          <div className="statIconContainer">
            <Newspaper size={24} className="statIcon" />
          </div>
          <div className="statInfo">
            <h3>ข่าวทั้งหมด</h3>
            <p className="statNumber">{stats?.totalNews || 0}</p>
          </div>
        </div>

        <div className="statCard cardSuccess">
          <div className="statIconContainer">
            <Award size={24} className="statIcon" />
          </div>
          <div className="statInfo">
            <h3>เผยแพร่แล้ว</h3>
            <p className="statNumber">{stats?.publishedNews || 0}</p>
          </div>
        </div>

        <div className="statCard cardWarning">
          <div className="statIconContainer">
            <Edit size={24} className="statIcon" />
          </div>
          <div className="statInfo">
            <h3>ข่าวสารรอเผยแพร่ / ดราฟ</h3>
            <p className="statNumber">{stats?.draftNews || 0}</p>
          </div>
        </div>
      </div>

      <div className="dashboardSecondaryGrid">
        <div className="recentSection card">
          <div className="sectionHeader">
            <h2>ข่าวประชาสัมพันธ์ล่าสุด</h2>
            <Link href="/admin/news" className="btnText">ดูข่าวทั้งหมด →</Link>
          </div>
          {recentNews.length > 0 ? (
            <div className="tableResponsive">
              <table className="recentTable">
                <thead>
                  <tr>
                    <th>หัวข้อข่าว</th>
                    <th>วันที่เผยแพร่</th>
                    <th>ยอดการเข้าชม (Views)</th>
                  </tr>
                </thead>
                <tbody>
                  {recentNews.map((news) => (
                    <tr key={news.id}>
                      <td className="recentTitleCol">{news.title}</td>
                      <td>
                        {new Date(news.publishedAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="viewsCol">
                        <div className="viewBadge">
                          <Eye size={14} />
                          <span>{news.views.toLocaleString('th-TH')} ครั้ง</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="emptyState">ยังไม่มีข่าวสาร</div>
          )}
        </div>
      </div>
    </div>
  )
}
