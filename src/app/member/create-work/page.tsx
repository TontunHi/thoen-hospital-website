'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Plus, FileText, ClipboardList, Clock, 
  CheckCircle, AlertCircle, Search, Calendar,
  ArrowRight, Upload, X, FileCheck, RefreshCw, BarChart2, ArrowLeft
} from 'lucide-react'
import './page.css'

interface WorkRequest {
  id: number
  request_no: string
  title: string
  description: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'reviewed'
  created_by: number
  created_at: string
  creator_name: string
  creator_dept: string
  assignees: Array<{ id: number; name: string; position: string; role: 'primary' | 'secondary' }>
}

export default function CreateWorkPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create'>('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [workRequests, setWorkRequests] = useState<WorkRequest[]>([])
  
  // Create Work Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<Array<{ name: string; type: 'image' | 'pdf'; path: string }>>([])
  
  // Dashboard & Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // all, today, week, month

  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; position: string; role: string; isWorkAuthorized?: boolean; canCreateWork?: boolean } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchUser()
    fetchWorkRequests()
  }, [])

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/member/me')
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated) {
          setCurrentUser(data.member)
        }
      }
    } catch (err) {
      console.error('Fetch current user error:', err)
    }
  }

  const fetchWorkRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/member/work')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setWorkRequests(data.workRequests)
        }
      }
    } catch (err) {
      console.error('Fetch work requests error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setLoading(true)
    setError('')

    const imageCount = attachments.filter(a => a.type === 'image').length
    const pdfCount = attachments.filter(a => a.type === 'pdf').length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isPdf = file.type === 'application/pdf'
      const type: 'image' | 'pdf' = isPdf ? 'pdf' : 'image'

      if (isPdf && pdfCount + 1 > 10) {
        setError('สามารถแนบไฟล์ PDF ได้สูงสุด 10 ไฟล์เท่านั้น')
        continue
      }
      if (!isPdf && imageCount + 1 > 20) {
        setError('สามารถแนบรูปภาพได้สูงสุด 20 รูปเท่านั้น')
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', 'work-attachment')

      try {
        const res = await fetch('/api/member/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setAttachments(prev => [...prev, { name: data.filename, type, path: data.url }])
        } else {
          setError(data.error || 'ไม่สามารถอัปโหลดบางไฟล์ได้')
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการอัปโหลดไฟล์')
      }
    }
    setLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveAttachment = async (pathToRemove: string) => {
    try {
      await fetch(`/api/member/upload?path=${encodeURIComponent(pathToRemove)}`, {
        method: 'DELETE'
      })
      setAttachments(prev => prev.filter(att => att.path !== pathToRemove))
    } catch (err) {
      console.error('Remove file error:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !description) {
      setError('กรุณากรอกข้อมูลหัวข้อและรายละเอียดให้ครบถ้วน')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/member/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, attachments }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('สร้างคำขอและบันทึกข้อมูลเรียบร้อยแล้ว!')
        setTitle('')
        setDescription('')
        setAttachments([])
        setActiveTab('dashboard')
        fetchWorkRequests()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึกคำขอ')
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  // Check authorization dynamically from currentUser permission flags (bypassed if admin)
  const isAuthorized = currentUser?.role === 'admin' || !!currentUser?.isWorkAuthorized
  const canCreate = currentUser?.role === 'admin' || !!currentUser?.canCreateWork

  // Calculate status counts
  const counts = {
    pending: workRequests.filter(r => r.status === 'pending').length,
    assigned: workRequests.filter(r => r.status === 'assigned').length,
    in_progress: workRequests.filter(r => r.status === 'in_progress').length,
    completed: workRequests.filter(r => r.status === 'completed').length,
    reviewed: workRequests.filter(r => r.status === 'reviewed').length,
  }

  // Filter requests
  const filteredRequests = workRequests.filter(req => {
    // 1. Search filter
    const matchesSearch = 
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      req.request_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.creator_name && req.creator_name.toLowerCase().includes(searchTerm.toLowerCase()))

    // 2. Status filter
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter

    // 3. Date filter
    let matchesDate = true
    if (dateFilter !== 'all') {
      const createdDate = new Date(req.created_at)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - createdDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (dateFilter === 'today') {
        matchesDate = createdDate.toDateString() === now.toDateString()
      } else if (dateFilter === 'week') {
        matchesDate = diffDays <= 7
      } else if (dateFilter === 'month') {
        matchesDate = diffDays <= 30
      }
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending'
      case 'assigned': return 'status-assigned'
      case 'in_progress': return 'status-progress'
      case 'completed': return 'status-completed'
      case 'reviewed': return 'status-reviewed'
      default: return ''
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'รอการมอบหมาย'
      case 'assigned': return 'มอบหมายแล้ว'
      case 'in_progress': return 'กำลังดำเนินการ'
      case 'completed': return 'เสร็จสิ้นรอประเมิน'
      case 'reviewed': return 'ประเมินแล้ว/ปิดงาน'
      default: return status
    }
  }

  // If user is loaded and not authorized, show unauthorized card
  if (currentUser && !isAuthorized) {
    return (
      <div className="memberDashboardContainer">
        <div className="glowOrb glowOrb1"></div>
        <div className="glowOrb glowOrb2"></div>
        <div className="glowOrb glowOrb3"></div>
        <div className="dashboardWrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%' }}>
          <div className="cwFormCard card" style={{ textAlign: 'center', maxWidth: '500px', width: '90%', padding: '3rem 2rem', background: 'rgba(255, 255, 255, 0.95)' }}>
            <AlertCircle size={64} style={{ color: '#dc2626', margin: '0 auto 1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              ระบบมอบหมายและติดตามงานช่างฯ สงวนสิทธิ์การใช้งานเฉพาะกลุ่มงานดิจิทัลทางการแพทย์ งานช่างบำรุงรักษา และผู้บริหารเท่านั้น
            </p>
            <Link href="/member" className="backLink" style={{ margin: '0 auto', display: 'inline-flex' }}>
              <ArrowLeft size={16} />
              <span>กลับหน้าหลักสมาชิก</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="memberDashboardContainer">
      {/* Background Glowing Orbs */}
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="glowOrb glowOrb3"></div>

      <div className="dashboardWrapper">
        <Link href="/member" className="backLink">
          <ArrowLeft size={16} />
          <span>กลับหน้าหลักสมาชิก</span>
        </Link>

        <div className="workContainer" style={{ paddingTop: '0px' }}>
      {/* Page Header */}
      <div className="workHeader">
        <div className="workHeader__info">
          <h1>ระบบส่งมอบและติดตามความคืบหน้างานช่างฯ</h1>
          <p>ส่งแบบฟอร์มคำขอ มอบหมายให้เจ้าหน้าที่ และติดตามขั้นตอนการทำงาน</p>
        </div>
        {canCreate && activeTab === 'dashboard' && (
          <button 
            className="btn btn-primary workHeader__create-btn"
            onClick={() => { setActiveTab('create'); setError(''); setSuccess('') }}
          >
            <Plus size={20} />
            <span>สร้างคำขอใหม่</span>
          </button>
        )}
        {activeTab === 'create' && (
          <button 
            className="btn btn-outline workHeader__create-btn"
            onClick={() => { setActiveTab('dashboard'); setError(''); setSuccess('') }}
          >
            <ArrowLeft size={18} />
            <span>กลับรายการงาน</span>
          </button>
        )}
      </div>

      {error && <div className="workAlert alert-danger"><AlertCircle size={20} /> {error}</div>}
      {success && <div className="workAlert alert-success"><CheckCircle size={20} /> {success}</div>}

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="workDashboard">
          {/* Glassmorphism Stats grid */}
          <div className="workStats">
            <div className="workStatCard">
              <div className="workStatCard__icon bg-gray-500"><Clock size={20} /></div>
              <div className="workStatCard__data">
                <h3>{counts.pending} งาน</h3>
                <p>รอการมอบหมาย</p>
              </div>
            </div>
            <div className="workStatCard">
              <div className="workStatCard__icon bg-blue-500"><ClipboardList size={20} /></div>
              <div className="workStatCard__data">
                <h3>{counts.assigned} งาน</h3>
                <p>มอบหมายงานแล้ว</p>
              </div>
            </div>
            <div className="workStatCard">
              <div className="workStatCard__icon bg-orange-500"><RefreshCw size={20} /></div>
              <div className="workStatCard__data">
                <h3>{counts.in_progress} งาน</h3>
                <p>กำลังดำเนินการ</p>
              </div>
            </div>
            <div className="workStatCard">
              <div className="workStatCard__icon bg-emerald-500"><FileCheck size={20} /></div>
              <div className="workStatCard__data">
                <h3>{counts.completed} งาน</h3>
                <p>เสร็จสิ้นรอประเมิน</p>
              </div>
            </div>
            <div className="workStatCard">
              <div className="workStatCard__icon bg-teal-500"><CheckCircle size={20} /></div>
              <div className="workStatCard__data">
                <h3>{counts.reviewed} งาน</h3>
                <p>ปิดงานสมบูรณ์</p>
              </div>
            </div>
          </div>

          {/* Filters card */}
          <div className="workFilters card">
            <div className="workFilters__search">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="ค้นหาตามเลขที่คำขอ, หัวข้อ หรือผู้สร้าง..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="workFilters__selects">
              <div className="filter-group">
                <label>สถานะ</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="pending">รอการมอบหมาย</option>
                  <option value="assigned">มอบหมายแล้ว</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="completed">เสร็จสิ้นรอประเมิน</option>
                  <option value="reviewed">ประเมินแล้ว/ปิดงาน</option>
                </select>
              </div>
              <div className="filter-group">
                <label>ช่วงเวลา</label>
                <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="today">วันนี้</option>
                  <option value="week">สัปดาห์นี้</option>
                  <option value="month">เดือนนี้</option>
                </select>
              </div>
            </div>
          </div>

          {/* Work List table/cards */}
          <div className="workList card">
            <div className="workList__header">
              <h2>รายการงานและสถานะความคืบหน้า</h2>
              <button className="btn btn-outline btn-sm" onClick={fetchWorkRequests} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                <span>รีเฟรชข้อมูล</span>
              </button>
            </div>

            {filteredRequests.length > 0 ? (
              <div className="workTable-wrapper">
                <table className="workTable">
                  <thead>
                    <tr>
                      <th style={{ width: '140px' }}>เลขที่คำขอ</th>
                      <th>หัวข้องาน</th>
                      <th style={{ width: '160px' }}>ผู้ส่งคำขอ</th>
                      <th style={{ width: '160px' }}>ผู้รับผิดชอบ</th>
                      <th style={{ width: '130px' }}>สถานะ</th>
                      <th style={{ width: '100px' }} className="align-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(req => {
                      const primaryAssignee = req.assignees.find(a => a.role === 'primary')
                      return (
                        <tr key={req.id}>
                          <td className="font-semibold text-primary" style={{ whiteSpace: 'nowrap' }}>
                            <span title={req.request_no}>#{req.request_no.split('-').pop()}</span>
                          </td>
                          <td>
                            <span className="workTable__title-text">{req.title}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div className="user-info-cell">
                              <span className="username">{req.creator_name || '—'}</span>
                              <span className="dept">{req.creator_dept || ''}</span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {primaryAssignee ? (
                              <div className="user-info-cell">
                                <span className="username">{primaryAssignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span className={`status-badge ${getStatusBadgeClass(req.status)}`}>
                              {getStatusLabel(req.status)}
                            </span>
                          </td>
                          <td className="align-center" style={{ whiteSpace: 'nowrap' }}>
                            <Link href={`/member/approvals?workId=${req.id}`} className="btn-table-action">
                              <span>จัดการ</span>
                              <ArrowRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="workEmpty">
                <BarChart2 size={48} className="text-muted" />
                <h3>ไม่พบรายการมอบหมายงาน</h3>
                <p>กรุณาปรับปรุงตัวเลือกตัวกรอง หรือสร้างคำขอขึ้นใหม่หากยังไม่มีรายงาน</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE FORM */}
      {activeTab === 'create' && canCreate && (
        <form onSubmit={handleSubmit} className="workCreateForm cwFormCard card">
          <div className="form-section-title cwFormTitle">
            <FileText size={18} />
            <span>ข้อมูลการมอบหมายงานช่างฯ</span>
          </div>

          <div className="cwFormGroup">
            <label htmlFor="workTitle" className="cwFormLabel required-label">หัวข้องานหรือชื่อรายงาน</label>
            <input 
              id="workTitle"
              type="text" 
              className="cwFormInput"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="เช่น ขอพัฒนาแบบฟอร์มตรวจสอบจำนวนผู้ป่วยนอกในระบบคลังข้อมูล หรือ ขอซ่อมเครื่องคอมพิวเตอร์แผนกอุบัติเหตุ"
              required
              disabled={loading}
            />
          </div>

          <div className="cwFormGroup">
            <label htmlFor="workDesc" className="cwFormLabel required-label">รายละเอียดของงาน / ความต้องการเพิ่มเติม</label>
            <textarea 
              id="workDesc"
              className="cwFormInput cwFormTextarea text-area"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="อธิบายข้อมูลเงื่อนไขในการดึงข้อมูล คลังข้อมูลที่ต้องการ รายชื่อฟิลด์ ข้อจำกัดทางเทคนิค หรือปัญหาที่พบอย่างละเอียด..."
              required
              rows={6}
              disabled={loading}
            />
          </div>

          <div className="cwFormGroup">
            <label className="cwFormLabel">ไฟล์แนบประกอบความต้องการ (รูปภาพสูงสุด 20 รูป, PDF สูงสุด 10 ไฟล์)</label>
            <div 
              className="upload-dropzone" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="text-primary" />
              <p className="font-semibold">กดที่นี่เพื่อคลิกเลือกไฟล์เพื่อแนบประกอบ</p>
              <span className="text-muted text-xs">รองรับไฟล์ภาพ JPEG, PNG, GIF, WebP และไฟล์เอกสาร PDF เท่านั้น</span>
              <input 
                type="file" 
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </div>

            {attachments.length > 0 && (
              <div className="attachments-list">
                {attachments.map(att => (
                  <div key={att.path} className="attachment-item">
                    <span className="attachment-name">
                      {att.type === 'pdf' ? '📄' : '🖼️'} {att.name}
                    </span>
                    <button 
                      type="button" 
                      className="attachment-remove-btn"
                      onClick={() => handleRemoveAttachment(att.path)}
                      disabled={loading}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={() => setActiveTab('dashboard')}
              disabled={loading}
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'กำลังบันทึกข้อมูล...' : 'ส่งคำขอรับมอบหมายงาน'}
            </button>
          </div>
        </form>
      )}
        </div>
      </div>
    </div>
  )
}
