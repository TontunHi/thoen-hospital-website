'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2, Edit3, Eye, Calendar, Tag, Filter } from 'lucide-react'
import './page.css'

interface NewsItem {
  id: number
  title: string
  status: string
  publishedAt: string
  createdAt: string
  views: number
  category: string
}

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

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
        return { label: 'เผยแพร่แล้ว', className: 'statusPublished' }
      case 'DRAFT':
        return { label: 'ฉบับร่าง / รอเผยแพร่', className: 'statusDraft' }
      case 'ARCHIVED':
        return { label: 'เก็บถาวร / หมดเวลา', className: 'statusArchived' }
      default:
        return { label: 'ไม่ระบุ', className: 'statusDraft' }
    }
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'PR':
        return 'ข่าวประชาสัมพันธ์'
      case 'PROCUREMENT':
        return 'จัดซื้อจัดจ้าง'
      case 'JOB':
        return 'สมัครงาน'
      default:
        return cat || 'ทั่วไป'
    }
  }

  // Filter logic
  const filteredNews = news.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  if (loading) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>กำลังโหลดข่าวสาร...</p>
      </div>
    )
  }

  return (
    <div className="newsAdminPage">
      <div className="pageHeader">
        <div>
          <h1>จัดการข่าวสารและกิจกรรม</h1>
          <p className="subtext">สร้าง แก้ไข เผยแพร่ และติดตามสถิติจำนวนผู้เข้าชมข่าวสารโรงพยาบาลเถิน</p>
        </div>
        <Link href="/admin-news/news/create" className="createButton">
          <Plus size={18} />
          <span>เพิ่มข่าวใหม่</span>
        </Link>
      </div>

      {/* Filter toolbar */}
      <div className="filterToolbar">
        <div className="searchBox">
          <Search size={18} className="searchIcon" />
          <input
            type="text"
            placeholder="ค้นหาชื่อข่าว..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filtersGroup">
          <div className="filterSelectWrapper">
            <Filter size={14} className="filterSelectIcon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filterSelect"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="PUBLISHED">เผยแพร่แล้ว</option>
              <option value="DRAFT">ฉบับร่าง / รอเผยแพร่</option>
              <option value="ARCHIVED">เก็บถาวร / หมดเวลา</option>
            </select>
          </div>

          <div className="filterSelectWrapper">
            <Tag size={14} className="filterSelectIcon" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filterSelect"
            >
              <option value="ALL">ทุกหมวดหมู่</option>
              <option value="PR">ข่าวประชาสัมพันธ์</option>
              <option value="PROCUREMENT">จัดซื้อจัดจ้าง</option>
              <option value="JOB">สมัครงาน</option>
            </select>
          </div>
        </div>
      </div>

      <div className="tableContainer card">
        {filteredNews.length > 0 ? (
          <div className="tableResponsive">
            <table className="newsTable">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>หัวข้อข่าว</th>
                  <th style={{ width: '150px' }}>หมวดหมู่</th>
                  <th style={{ width: '180px' }}>สถานะการแสดงผล</th>
                  <th style={{ width: '130px' }}>เข้าชม (Views)</th>
                  <th style={{ width: '150px' }}>กำหนดเผยแพร่</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredNews.map((item) => {
                  const statusInfo = getStatusInfo(item.status)
                  const isScheduled = new Date(item.publishedAt) > new Date()
                  return (
                    <tr key={item.id}>
                      <td className="idCell">{item.id}</td>
                      <td className="newsTitleCell">
                        <span className="titleText" title={item.title}>
                          {item.title}
                        </span>
                        {isScheduled && item.status === 'PUBLISHED' && (
                          <span className="scheduledTip" title="จะแสดงบนเว็บเมื่อถึงเวลาที่กำหนด">
                            <Calendar size={10} /> ตั้งเวลาล่วงหน้า
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="categoryBadge">
                          {getCategoryLabel(item.category)}
                        </span>
                      </td>
                      <td>
                        <span className={`statusBadge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        <div className="viewBadge">
                          <Eye size={13} />
                          <span>{(item.views || 0).toLocaleString('th-TH')}</span>
                        </div>
                      </td>
                      <td className="dateCell">
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
                            href={`/admin-news/news/${item.id}/edit`}
                            className="editButtonAction"
                            title="แก้ไขข่าว"
                          >
                            <Edit3 size={15} />
                            <span>แก้ไข</span>
                          </Link>
                          <button
                            onClick={() => handleDelete(item.id, item.title)}
                            className="deleteButtonAction"
                            title="ลบข่าว"
                          >
                            <Trash2 size={15} />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState">
            <p>ไม่พบข่าวสารตามเงื่อนไขการค้นหา</p>
            <Link href="/admin-news/news/create" className="createButton" style={{ marginTop: '1rem', display: 'inline-flex' }}>
              <Plus size={18} /> เพิ่มข่าวแรก
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

