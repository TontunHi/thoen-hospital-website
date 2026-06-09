'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Plus, Trash2, Calendar, Link as LinkIcon, Image as ImageIcon, Eye, Clock, Edit2, ArrowUpDown } from 'lucide-react'
import './page.css'

interface SlideItem {
  id: number
  imagePath: string
  title: string | null
  linkUrl: string | null
  startDate: string
  endDate: string
  displayOrder: number
}

export default function AdminSlidesPage() {
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form State
  const [imagePath, setImagePath] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [displayOrder, setDisplayOrder] = useState<number>(0)
  
  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null)

  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSlides = async () => {
    try {
      const res = await fetch('/api/hero-slides?all=true')
      const data = await res.json()
      if (res.ok) {
        setSlides(data.slides || [])
      }
    } catch (err) {
      console.error('Failed to fetch slides:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlides()
  }, [])

  const formatToDatetimeLocal = (isoString: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const tzoffset = d.getTimezoneOffset() * 60000 // offset in milliseconds
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16)
    return localISOTime
  }

  const handleEdit = (slide: SlideItem) => {
    setEditingId(slide.id)
    setImagePath(slide.imagePath)
    setLocalPreviewUrl(slide.imagePath)
    setTitle(slide.title || '')
    setLinkUrl(slide.linkUrl || '')
    setStartDate(formatToDatetimeLocal(slide.startDate))
    setEndDate(formatToDatetimeLocal(slide.endDate))
    setDisplayOrder(slide.displayOrder || 0)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setImagePath('')
    setLocalPreviewUrl('')
    setTitle('')
    setLinkUrl('')
    setStartDate('')
    setEndDate('')
    setDisplayOrder(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setError('')
    setSuccess('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // If there is an existing uploaded temp image (and we aren't in editing mode representing database record), delete it first
    if (imagePath && !editingId) {
      try {
        await fetch(`/api/upload?path=${encodeURIComponent(imagePath)}`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.error('Failed to clean up previous temp image:', err)
      }
    }

    // Show local preview instantly
    const localUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(localUrl)

    setUploading(true)
    setError('')
    setSuccess('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title || 'slide')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setImagePath(data.url)
        setSuccess('อัปโหลดไฟล์ภาพสำเร็จ')
      } else {
        setError(data.error || 'อัปโหลดภาพไม่สำเร็จ')
        setLocalPreviewUrl('')
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการอัปโหลด')
      setLocalPreviewUrl('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveSelectedImage = async () => {
    const pathToClean = imagePath
    setImagePath('')
    setLocalPreviewUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Only delete from disk if we aren't editing an existing slide (where it's already a saved slide path)
    if (pathToClean && !editingId) {
      try {
        await fetch(`/api/upload?path=${encodeURIComponent(pathToClean)}`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.error('Failed to delete temporary uploaded file:', err)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!imagePath) {
      setError('กรุณาอัปโหลดรูปภาพก่อน')
      setSubmitting(false)
      return
    }

    try {
      const url = editingId ? `/api/hero-slides/${editingId}` : '/api/hero-slides'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath,
          title: title || null,
          linkUrl: linkUrl || null,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          displayOrder: Number(displayOrder) || 0,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(editingId ? 'แก้ไขข้อมูลสไลด์ภาพเรียบร้อยแล้ว' : 'บันทึกสไลด์โชว์เรียบร้อยแล้ว')
        // Reset form
        setEditingId(null)
        setImagePath('')
        setLocalPreviewUrl('')
        setTitle('')
        setLinkUrl('')
        setStartDate('')
        setEndDate('')
        setDisplayOrder(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        fetchSlides()
      } else {
        setError(data.error || 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันที่จะลบสไลด์ภาพนี้ใช่หรือไม่? การลบจะทำให้ภาพหายไปจากหน้าแรกทันที')) return

    try {
      const res = await fetch(`/api/hero-slides/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSlides(slides.filter((slide) => slide.id !== id))
        setSuccess('ลบสไลด์ภาพเรียบร้อยแล้ว')
        if (editingId === id) {
          handleCancelEdit()
        }
      } else {
        const data = await res.json()
        setError(data.error || 'ลบไม่สำเร็จ')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการติดต่อระบบ')
    }
  }

  const [draggedItem, setDraggedItem] = useState<SlideItem | null>(null)

  const getSlideStatus = (startStr: string, endStr: string) => {
    const now = new Date()
    const start = new Date(startStr)
    const end = new Date(endStr)

    if (now < start) {
      return { label: 'กำลังมาถึง (Upcoming)', className: 'status-upcoming' }
    } else if (now > end) {
      return { label: 'หมดอายุ (Expired)', className: 'status-expired' }
    } else {
      return { label: 'กำลังแสดงผล (Active)', className: 'status-active' }
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, slide: SlideItem) => {
    setDraggedItem(slide)
    e.dataTransfer.effectAllowed = 'move'
    // For Firefox compatibility
    e.dataTransfer.setData('text/plain', slide.id.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
    if (!draggedItem) return
    const draggedIndex = slides.findIndex((item) => item.id === draggedItem.id)
    if (draggedIndex === targetIndex) return

    const newSlides = [...slides]
    // Reorder array locally
    newSlides.splice(draggedIndex, 1)
    newSlides.splice(targetIndex, 0, draggedItem)

    // Reactively update temporary order for preview
    const reorderedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      displayOrder: idx
    }))

    setSlides(reorderedSlides)
  }

  const handleDragEnd = async () => {
    setDraggedItem(null)
    
    // Save new orders to Database
    try {
      setError('')
      const updates = slides.map((slide, idx) => ({
        id: slide.id,
        displayOrder: idx
      }))

      // Send new ordering to a batch API or update them individually
      // In our Next.js backend, let's update them via loop or add a batch endpoint.
      // Since we want to be safe, we can trigger PUT calls to update displayOrder, or we can send to a single endpoint.
      // Let's call PUT for each changed slide to prevent adding new routes.
      const savePromises = updates.map(update => 
        fetch(`/api/hero-slides/${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Get original slide values to pass Zod schema verification
            ...slides.find(s => s.id === update.id),
            displayOrder: update.displayOrder
          })
        })
      )

      await Promise.all(savePromises)
      setSuccess('จัดเรียงลำดับสไลด์ใหม่เรียบร้อยแล้ว')
      fetchSlides()
    } catch (err) {
      console.error('Failed to save slide order:', err)
      setError('เกิดข้อผิดพลาดในการจัดเก็บลำดับสไลด์ใหม่')
    }
  }

  if (loading) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>กำลังโหลดรายการสไลด์ภาพ...</p>
      </div>
    )
  }

  return (
    <div className="slidesAdminPage">
      <div className="pageHeader">
        <div>
          <h1>จัดการสไลด์โชว์</h1>
          <p className="subtext">อัปโหลด ตั้งเวลาเริ่มแสดงและหมดอายุของสไลด์โชว์รูปภาพในหน้าแรกของเว็บไซต์</p>
        </div>
      </div>

      {error && <div className="slidesAlert alert-danger">{error}</div>}
      {success && <div className="slidesAlert alert-success">{success}</div>}

      <div className="slidesGrid">
        {/* Creation / Edit Form */}
        <div className="formSection card">
          <h2>{editingId ? 'แก้ไขข้อมูลสไลด์' : 'เพิ่มสไลด์ใหม่'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="formGroup">
              <label>อัปโหลดรูปภาพสไลด์ * (แนะนำขนาด 1920x800px)</label>
              <input
                ref={fileInputRef}
                type="file"
                className="formInput"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageUpload}
                required={!localPreviewUrl && !imagePath}
              />
              {uploading && <div className="uploadProgress">กำลังอัปโหลดรูปภาพ...</div>}
              {(localPreviewUrl || imagePath) && (
                <div className="previewUploadedSlide">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={localPreviewUrl || imagePath} alt="Uploaded preview" />
                  <button type="button" className="removeImgBtn" onClick={handleRemoveSelectedImage}>✕ เปลี่ยนรูป</button>
                </div>
              )}
            </div>

            <div className="formGroup">
              <label htmlFor="slideTitle">หัวข้อภาพ / คำโปรย (ถ้ามี)</label>
              <input
                id="slideTitle"
                type="text"
                className="formInput"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="คำอธิบายสั้นๆ แสดงบนภาพ"
              />
            </div>

            <div className="formGroup">
              <label htmlFor="slideLink">ลิงก์ภายนอกปลายทางเมื่อคลิก (ถ้ามี)</label>
              <input
                id="slideLink"
                type="url"
                className="formInput"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="เช่น https://..."
              />
            </div>

            <div className="formRow">
              <div className="formGroup col-6">
                <label htmlFor="startDate">วันที่เริ่มให้แสดงบนเว็บ *</label>
                <input
                  id="startDate"
                  type="datetime-local"
                  className="formInput"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="formGroup col-6">
                <label htmlFor="endDate">วันและเวลาที่สิ้นสุดการแสดงผล *</label>
                <input
                  id="endDate"
                  type="datetime-local"
                  className="formInput"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="formGroup">
              <label htmlFor="displayOrder">ลำดับการแสดงผล (แนะให้ใช้การลากวางที่แถบด้านขวา)</label>
              <input
                id="displayOrder"
                type="number"
                min="0"
                className="formInput"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                placeholder="ระบุตัวเลข เช่น 0, 1, 2"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {editingId && (
                <button type="button" className="submitBtn" style={{ backgroundColor: '#64748b' }} onClick={handleCancelEdit}>
                  ยกเลิก
                </button>
              )}
              <button type="submit" className="submitBtn" style={{ flex: 1 }} disabled={submitting || uploading}>
                {submitting ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'บันทึกและเปิดใช้งานตั้งเวลา')}
              </button>
            </div>
          </form>
        </div>

        {/* Existing List */}
        <div className="listSection card">
          <h2>รายการสไลด์ทั้งหมด ({slides.length})</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpDown size={14} /> สามารถคลิกค้างแล้วลากวางเพื่อสลับลำดับการแสดงผลได้ทันที (บนสุดแสดงเป็นอันดับแรก)
          </p>
          {slides.length > 0 ? (
            <div className="slidesList">
              {slides.map((slide, index) => {
                const status = getSlideStatus(slide.startDate, slide.endDate)
                const isDraggingThis = draggedItem?.id === slide.id
                return (
                  <div 
                    key={slide.id} 
                    className={`slideItemCard ${isDraggingThis ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, slide)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="slideImgWrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slide.imagePath} alt={slide.title || 'Slide Image'} draggable={false} />
                    </div>
                    <div className="slideItemDetails">
                      <div className="slideItemTitle">
                        <div>
                          {slide.title ? <h3>{slide.title}</h3> : <p className="noTitle">ไม่มีหัวข้อคำอธิบาย</p>}
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#0d9488', fontWeight: 'bold', marginTop: '4px' }}>
                            <ArrowUpDown size={12} />
                            <span>ลำดับที่: {slide.displayOrder}</span>
                          </div>
                        </div>
                        <span className={`statusPill ${status.className}`}>{status.label}</span>
                      </div>
                      
                      <div className="slideItemMeta">
                        <div className="metaRow">
                          <Calendar size={14} />
                          <span>
                            เริ่ม: {new Date(slide.startDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                          </span>
                        </div>
                        <div className="metaRow">
                          <Clock size={14} />
                          <span>
                            สิ้นสุด: {new Date(slide.endDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                          </span>
                        </div>
                        {slide.linkUrl && (
                          <div className="metaRow urlRow">
                            <LinkIcon size={14} />
                            <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" draggable={false}>ลิงก์: {slide.linkUrl}</a>
                          </div>
                        )}
                      </div>

                      <div className="slideItemActions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => handleEdit(slide)} className="deleteSlideBtn" style={{ color: '#0f766e', borderColor: '#ccfbf1' }} draggable={false}>
                          <Edit2 size={14} /> แก้ไขข้อมูล
                        </button>
                        <button type="button" onClick={() => handleDelete(slide.id)} className="deleteSlideBtn" draggable={false}>
                          <Trash2 size={14} /> ลบสไลด์
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="emptySlides">
              <ImageIcon size={48} />
              <p>ยังไม่มีการอัปโหลดสไลด์ภาพหัวแบนเนอร์</p>
              <span className="sub">ระบบจะแสดงผลรูปภาพแบนเนอร์เริ่มต้นของทางโรงพยาบาล</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
