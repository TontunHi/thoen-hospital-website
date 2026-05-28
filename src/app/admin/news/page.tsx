'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import './page.css'

interface NewsItem {
  id: number
  title: string
  status: string
  publishedAt: string
  createdAt: string
}

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news?all=true&limit=100')
      const data = await res.json()
      setNews(data.news || [])
    } catch (error) {
      console.error('Failed to fetch news:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`ต้องการลบข่าว "${title}" หรือไม่?`)) return

    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNews(news.filter((n) => n.id !== id))
      } else {
        alert('เกิดข้อผิดพลาดในการลบข่าว')
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return { label: 'ลงข่าว', className: 'statusPublished' }
      case 'DRAFT':
        return { label: 'ฉบับร่าง', className: 'statusDraft' }
      case 'ARCHIVED':
        return { label: 'เก็บในคลัง', className: 'statusArchived' }
      default:
        return { label: 'ไม่ทราบสถานะ', className: 'statusDraft' }
    }
  }

  if (loading) {
    return <div className="loadingState">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="newsAdminPage">
      <div className="pageHeader">
        <h1>📰 จัดการข่าวสาร</h1>
        <Link href="/admin/news/create" className="createButton">
          ➕ เพิ่มข่าวใหม่
        </Link>
      </div>

      <div className="tableContainer">
        {news.length > 0 ? (
          <table className="newsTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>หัวข้อ</th>
                <th>สถานะ</th>
                <th>วันที่เผยแพร่</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {news.map((item) => {
                const statusInfo = getStatusInfo(item.status)
                const isScheduled = new Date(item.publishedAt) > new Date()
                return (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td className="newsTitle">
                      {item.title}
                      {isScheduled && item.status === 'PUBLISHED' && (
                        <span className="scheduledTip" title="จะแสดงบนเว็บเมื่อถึงเวลา"> ⏰ ตั้งเวลาล่วงหน้า</span>
                      )}
                    </td>
                    <td>
                      <span className={`statusBadge ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      {new Date(item.publishedAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })} น.
                    </td>
                    <td>
                      <div className="actionButtons">
                        <Link
                          href={`/admin/news/${item.id}/edit`}
                          className="editButton"
                        >
                          ✏️ แก้ไข
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id, item.title)}
                          className="deleteButton"
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="emptyState">
            <p>ยังไม่มีข่าวสาร</p>
            <Link href="/admin/news/create" className="createButton" style={{ marginTop: '1rem', display: 'inline-flex' }}>
              ➕ เพิ่มข่าวแรก
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
