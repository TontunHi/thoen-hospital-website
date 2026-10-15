'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2, Edit3, Eye, Calendar, Tag, Filter, X, RefreshCw, ExternalLink } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
import './page.css'

interface NewsItem {
  id: number
  title: string
  slug?: string
  status: string
  publishedAt: string
  createdAt: string
  views: number
  category: string
  images?: { id: number; imageUrl: string }[]
}

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const fetchNews = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/news?all=true&limit=100&t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      setNews(data.news || [])
    } catch (error) {
      console.error('Failed to fetch news:', error)
      addToast('ไม่สามารถโหลดข้อมูลข่าวได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNews((prev) => prev.filter((n) => n.id !== id))
        addToast('ลบข่าวสารเรียบร้อยแล้ว', 'success')
      } else {
        addToast('เกิดข้อผิดพลาดในการลบข่าว', 'error')
      }
    } catch {
      addToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return { label: 'เผยแพร่แล้ว', className: 'statusPublished' }
      case 'DRAFT':
        return { label: 'รอเผยแพร่ / ดราฟ', className: 'statusDraft' }
      case 'ARCHIVED':
        return { label: 'หมดเวลา / ถาวร', className: 'statusArchived' }
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
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q || item.title.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL')

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setCategoryFilter('ALL')
  }

  return (
    <div className="newsAdminPage">
      {/* Action and Filter Toolbar */}
      <section className="filterToolbar" aria-label="ตัวกรองและจัดการข่าวสาร">
        <div className="filterToolbarLeft">
          <div className="searchBox">
            <Search size={16} className="searchIcon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อข่าวหรือหัวข้อประชาสัมพันธ์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="ค้นหาชื่อข่าว"
            />
            {searchQuery && (
              <button
                type="button"
                className="clearSearchBtn"
                onClick={() => setSearchQuery('')}
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filtersGroup">
            <div className="filterSelectWrapper">
              <Filter size={14} className="filterSelectIcon" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filterSelect"
                aria-label="กรองตามสถานะ"
              >
                <option value="ALL">ทุกสถานะการแสดงผล</option>
                <option value="PUBLISHED">เผยแพร่แล้ว</option>
                <option value="DRAFT">รอเผยแพร่ / ดราฟ</option>
                <option value="ARCHIVED">หมดเวลา / เก็บถาวร</option>
              </select>
            </div>

            <div className="filterSelectWrapper">
              <Tag size={14} className="filterSelectIcon" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="filterSelect"
                aria-label="กรองตามหมวดหมู่"
              >
                <option value="ALL">ทุกหมวดหมู่</option>
                <option value="PR">ข่าวประชาสัมพันธ์</option>
                <option value="PROCUREMENT">จัดซื้อจัดจ้าง</option>
                <option value="JOB">สมัครงาน</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="resetFilterBtn"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RefreshCw size={13} />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>
        </div>

        <div className="filterToolbarRight">
          <span className="resultsCountBadge">{filteredNews.length} รายการ</span>
          <Link href="/member/news/news/create" className="createNewsBtn">
            <Plus size={16} />
            <span>เขียนข่าวใหม่</span>
          </Link>
        </div>
      </section>

      {/* Main Table Card */}
      <section className="tableContainer card" aria-label="ตารางรายการข่าวสาร">
        {loading ? (
          <div className="loadingState">
            <RefreshCw size={28} className="animate-spin" />
            <p>กำลังโหลดรายการข่าวสาร...</p>
          </div>
        ) : filteredNews.length > 0 ? (
          <>
            {/* Desktop Table View - Zero Horizontal Scroll Guarantee */}
            <div className="desktopTableContainer">
              <table className="newsTable">
                <thead>
                  <tr>
                    <th className="col-id">#</th>
                    <th className="col-title">หัวข้อข่าว</th>
                    <th className="col-cat">หมวดหมู่</th>
                    <th className="col-status">สถานะ</th>
                    <th className="col-views">ยอดเข้าชม</th>
                    <th className="col-date">กำหนดเผยแพร่</th>
                    <th className="col-actions">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((item, index) => {
                    const statusInfo = getStatusInfo(item.status)
                    const isScheduled = new Date(item.publishedAt) > new Date()
                    const hasImage = item.images && item.images.length > 0

                    return (
                      <tr key={item.id}>
                        <td className="col-id">
                          <span className="indexBadge">{index + 1}</span>
                        </td>
                        <td className="col-title">
                          <div className="titleCellWrapper">
                            <Link 
                              href={`/member/news/news/${item.id}/edit`} 
                              className="newsTitleLink"
                              title={item.title}
                            >
                              {item.title}
                            </Link>
                            <div className="titleSubBadges">
                              {hasImage && (
                                <span className="imageCountBadge" title={`มีรูปภาพแนบ ${item.images!.length} รูป`}>
                                  📷 {item.images!.length} รูป
                                </span>
                              )}
                              {isScheduled && item.status === 'PUBLISHED' && (
                                <span className="scheduledBadge" title="จะเริ่มแสดงผลบนเว็บเมื่อถึงเวลาที่กำหนด">
                                  <Calendar size={11} /> ตั้งเวลาล่วงหน้า
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="col-cat">
                          <span className={`categoryBadge cat-${item.category}`}>
                            {getCategoryLabel(item.category)}
                          </span>
                        </td>
                        <td className="col-status">
                          <span className={`statusBadge ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="col-views">
                          <div className="viewBadge">
                            <Eye size={12} />
                            <span>{(item.views || 0).toLocaleString('th-TH')}</span>
                          </div>
                        </td>
                        <td className="col-date">
                          <span className="dateText">
                            {new Date(item.publishedAt).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="col-actions">
                          <div className="actionButtons">
                            <Link
                              href={`/news/${item.slug || item.id}`}
                              target="_blank"
                              className="viewPublicAction"
                              title="เปิดดูบนหน้าเว็บประชาชน"
                              aria-label={`เปิดดูข่าว ${item.title}`}
                            >
                              <ExternalLink size={13} />
                            </Link>
                            <Link
                              href={`/member/news/news/${item.id}/edit`}
                              className="editButtonAction"
                              title="แก้ไขข่าว"
                              aria-label={`แก้ไขข่าว ${item.title}`}
                            >
                              <Edit3 size={13} />
                              <span>แก้ไข</span>
                            </Link>
                            <button
                              onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                              className="deleteButtonAction"
                              title="ลบข่าว"
                              type="button"
                              aria-label={`ลบข่าว ${item.title}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards View - No Horizontal Scroll */}
            <div className="mobileCardsContainer">
              {filteredNews.map((item) => {
                const statusInfo = getStatusInfo(item.status)
                const isScheduled = new Date(item.publishedAt) > new Date()

                return (
                  <div key={item.id} className="mobileNewsCard">
                    <div className="mobileCardTop">
                      <span className={`categoryBadge cat-${item.category}`}>
                        {getCategoryLabel(item.category)}
                      </span>
                      <span className={`statusBadge ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <Link 
                      href={`/member/news/news/${item.id}/edit`} 
                      className="mobileNewsTitle"
                    >
                      {item.title}
                    </Link>

                    <div className="mobileCardMetaGrid">
                      <div className="mobileMetaItem">
                        <span className="metaLabel">เผยแพร่:</span>
                        <span className="metaValue">
                          {new Date(item.publishedAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="mobileMetaItem">
                        <span className="metaLabel">เข้าชม:</span>
                        <span className="metaValue viewValue">
                          <Eye size={12} />
                          <span>{(item.views || 0).toLocaleString('th-TH')} ครั้ง</span>
                        </span>
                      </div>
                      {isScheduled && item.status === 'PUBLISHED' && (
                        <div className="mobileMetaItem fullWidth">
                          <span className="scheduledBadge">
                            <Calendar size={11} /> สไลด์/ข่าวตั้งเวลาล่วงหน้า
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mobileCardActions">
                      <Link
                        href={`/member/news/news/${item.id}/edit`}
                        className="mobileEditBtn"
                      >
                        <Edit3 size={15} />
                        <span>แก้ไขข่าว</span>
                      </Link>
                      <Link
                        href={`/news/${item.slug || item.id}`}
                        target="_blank"
                        className="mobileViewBtn"
                        title="ดูหน้าเว็บ"
                      >
                        <ExternalLink size={16} />
                      </Link>
                      <button
                        onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                        className="mobileDeleteBtn"
                        type="button"
                        title="ลบข่าว"
                        aria-label={`ลบข่าว ${item.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="emptyState">
            <p>ไม่พบข่าวสารตามเงื่อนไขที่เลือก</p>
            {hasActiveFilters ? (
              <button type="button" onClick={handleResetFilters} className="clearFilterBtn">
                <RefreshCw size={14} />
                <span>ล้างตัวกรองทั้งหมด</span>
              </button>
            ) : (
              <Link href="/member/news/news/create" className="createNewsBtn" style={{ marginTop: '8px' }}>
                <Plus size={16} />
                <span>เพิ่มข่าวแรกของโรงพยาบาล</span>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="ยืนยันการลบข่าวสาร"
        description={`ต้องการลบข่าว "${deleteTarget?.title}" หรือไม่? เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้`}
        confirmText="ยืนยันลบข่าว"
        cancelText="ยกเลิก"
        type="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
