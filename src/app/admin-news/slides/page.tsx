'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Plus, Trash2, Calendar, Link as LinkIcon, Image as ImageIcon, Eye, Clock } from 'lucide-react'
import './page.css'

interface SlideItem {
  id: number
  imagePath: string
  title: string | null
  linkUrl: string | null
  startDate: string
  endDate: string
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // If there is an existing uploaded temp image, delete it first
    if (imagePath) {
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

    if (pathToClean) {
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
      const res = await fetch('/api/hero-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePath,
          title: title || null,
          linkUrl: linkUrl || null,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess('บันทึกสไลด์โชว์เรียบร้อยแล้ว')
        // Reset form
        setImagePath('')
        setLocalPreviewUrl('')
        setTitle('')
        setLinkUrl('')
        setStartDate('')
        setEndDate('')
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
      } else {
        const data = await res.json()
        setError(data.error || 'ลบไม่สำเร็จ')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการติดต่อระบบ')
    }
  }

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
        {/* Creation Form */}
        <div className="formSection card">
          <h2>เพิ่มสไลด์ใหม่</h2>
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

            <button type="submit" className="submitBtn" disabled={submitting || uploading}>
              {submitting ? 'กำลังบันทึก...' : 'บันทึกและเปิดใช้งานตั้งเวลา'}
            </button>
          </form>
        </div>

        {/* Existing List */}
        <div className="listSection card">
          <h2>รายการสไลด์ทั้งหมด ({slides.length})</h2>
          {slides.length > 0 ? (
            <div className="slidesList">
              {slides.map((slide) => {
                const status = getSlideStatus(slide.startDate, slide.endDate)
                return (
                  <div key={slide.id} className="slideItemCard">
                    <div className="slideImgWrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slide.imagePath} alt={slide.title || 'Slide Image'} />
                    </div>
                    <div className="slideItemDetails">
                      <div className="slideItemTitle">
                        {slide.title ? <h3>{slide.title}</h3> : <p className="noTitle">ไม่มีหัวข้อคำอธิบาย</p>}
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
                            <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer">ลิงก์: {slide.linkUrl}</a>
                          </div>
                        )}
                      </div>

                      <div className="slideItemActions">
                        <button type="button" onClick={() => handleDelete(slide.id)} className="deleteSlideBtn">
                          <Trash2 size={16} /> ลบสไลด์
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
