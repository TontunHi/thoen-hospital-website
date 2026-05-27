'use client'

import { useState, useEffect } from 'react'
import './page.css'

interface Stats {
  totalNews: number
  publishedNews: number
  draftNews: number
  totalContacts: number
  unreadContacts: number
}

interface NewsItem {
  id: number
  title: string
  publishedAt: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentNews, setRecentNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/news?all=true&limit=5')
        const data = await res.json()

        const allNews = data.news || []
        const total = data.pagination?.total || 0
        const published = allNews.filter((n: { isPublished: boolean }) => n.isPublished).length
        const draft = allNews.filter((n: { isPublished: boolean }) => !n.isPublished).length

        setRecentNews(allNews.slice(0, 5))

        // We approximate stats from the data we have
        setStats({
          totalNews: total,
          publishedNews: published,
          draftNews: draft,
          totalContacts: 0,
          unreadContacts: 0,
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
    return <div className="loadingState">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="dashboardPage">
      <h1>แดชบอร์ด</h1>
      <p>ภาพรวมของระบบจัดการเว็บไซต์โรงพยาบาลเถิน</p>

      <div className="statsGrid">
        <div className="statCard">
          <div className="statIcon">📰</div>
          <div className="statInfo">
            <h3>ข่าวทั้งหมด</h3>
            <p className="statNumber">{stats?.totalNews || 0}</p>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon">✅</div>
          <div className="statInfo">
            <h3>เผยแพร่แล้ว</h3>
            <p className="statNumber">{stats?.publishedNews || 0}</p>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon">📝</div>
          <div className="statInfo">
            <h3>ฉบับร่าง</h3>
            <p className="statNumber">{stats?.draftNews || 0}</p>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon">✉️</div>
          <div className="statInfo">
            <h3>ข้อความติดต่อ</h3>
            <p className="statNumber">{stats?.totalContacts || 0}</p>
          </div>
        </div>
      </div>

      <div className="recentSection">
        <h2>📋 ข่าวล่าสุด</h2>
        {recentNews.length > 0 ? (
          <ul className="recentList">
            {recentNews.map((news) => (
              <li key={news.id} className="recentItem">
                <span className="itemTitle">{news.title}</span>
                <span className="itemDate">
                  {new Date(news.publishedAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="emptyState">ยังไม่มีข่าวสาร</div>
        )}
      </div>
    </div>
  )
}
