'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Edit, Trash2, Search, FileText, Calendar, User, ArrowLeft, ExternalLink } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'

interface Blog {
  id: number
  title: string
  author_name: string
  author_position: string | null
  created_at: string
  updated_at: string
}

interface Props {
  initialBlogs: Blog[]
  currentUserId: number
  isAdmin: boolean
}

export default function ItaManagementClient({ initialBlogs, isAdmin }: Props) {
  const [blogs, setBlogs] = useState<Blog[]>(initialBlogs)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const confirmDelete = (id: number) => {
    setDeleteTargetId(id)
  }

  const handleConfirmDelete = async () => {
    if (deleteTargetId === null) return
    const id = deleteTargetId
    setIsDeleting(id)

    try {
      const res = await fetch(`/api/ita/blogs/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        setBlogs(blogs.filter((blog) => blog.id !== id))
        addToast('ลบบทความเรียบร้อยแล้ว', 'success')
      } else {
        addToast(data.error?.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
      }
    } catch (error) {
      console.error('Delete error:', error)
      addToast('เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setIsDeleting(null)
      setDeleteTargetId(null)
    }
  }

  const filteredBlogs = blogs.filter((blog) =>
    blog.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="ita-management">
      <div className="dashboard-header-container">
        <Link href="/member" className="back-link">
          <ArrowLeft size={16} />
          <span>กลับหน้าหลักสมาชิก</span>
        </Link>
        <div className="header-main">
          <div>
            <h1>ระบบจัดการบทความ ITA</h1>
            <p className="subtitle">
              เขียนบทความ เผยแพร่ความรู้ และข้อมูลประเมินความโปร่งใสของโรงพยาบาลเถิน
            </p>
          </div>
          <Link href="/member/ita/new" className="btn-create-new">
            <Plus size={18} />
            <span>เขียนบทความใหม่</span>
          </Link>
        </div>
      </div>

      {/* Control panel */}
      <div className="control-panel">
        <div className="search-box-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อเรื่องบทความ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Blogs list */}
      <div className="blogs-table-container">
        {filteredBlogs.length === 0 ? (
          <div className="empty-management-state">
            <FileText size={48} className="empty-icon" />
            <h3>ไม่พบบทความ</h3>
            <p>คุณยังไม่ได้เขียนบทความใดๆ หรือไม่มีข้อมูลที่ตรงกับการค้นหา</p>
            <Link href="/member/ita/new" className="btn-create-new-inline">
              เขียนบทความชิ้นแรกของคุณ
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="management-table">
              <thead>
                <tr>
                  <th>ชื่อเรื่องบทความ</th>
                  <th>ผู้เขียน / ตำแหน่ง</th>
                  <th>วันที่เผยแพร่</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredBlogs.map((blog) => {
                  const pubDate = new Date(blog.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr key={blog.id}>
                      <td className="col-title">
                        <div className="title-wrapper">
                          <span className="blog-title-text">{blog.title}</span>
                          <Link
                            href={`/ita/${blog.id}`}
                            target="_blank"
                            className="btn-preview-link"
                            title="ดูหน้าเว็บสาธารณะ"
                          >
                            <ExternalLink size={14} />
                            <span>ดูหน้าเว็บ</span>
                          </Link>
                        </div>
                      </td>
                      <td className="col-author">
                        <div className="author-cell">
                          <User size={18} className="cell-icon" />
                          <div>
                            <div className="author-name">{blog.author_name}</div>
                            <div className="author-pos">
                              {blog.author_position || 'เจ้าพนักงานเครื่องคอมพิวเตอร์'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="col-date">
                        <div className="date-cell">
                          <Calendar size={18} className="cell-icon" />
                          <span>{pubDate} น.</span>
                        </div>
                      </td>
                      <td className="col-actions">
                        <div className="action-buttons-group">
                          <Link href={`/member/ita/edit/${blog.id}`} className="btn-action-edit">
                            <Edit size={16} />
                            <span>แก้ไข</span>
                          </Link>
                          <button
                            onClick={() => confirmDelete(blog.id)}
                            disabled={isDeleting === blog.id}
                            className="btn-action-delete"
                            type="button"
                          >
                            <Trash2 size={16} />
                            <span>{isDeleting === blog.id ? 'กำลังลบ...' : 'ลบ'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="ยืนยันการลบบทความ ITA"
        description="คุณแน่ใจหรือไม่ว่าต้องการลบบทความนี้? เมื่อลบแล้วจะไม่สามารถกู้คืนได้"
        confirmText="ลบบทความ"
        cancelText="ยกเลิก"
        type="danger"
        loading={isDeleting !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
