'use client'

import { useState, useEffect } from 'react'
import './page.css'

interface Slideshow {
  id: number
  title: string
  description: string | null
  imageUrl: string
  order: number
  isActive: boolean
}

export default function AdminSlideshowPage() {
  const [slides, setSlides] = useState<Slideshow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [order, setOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [isEditing, setIsEditing] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchSlides()
  }, [])

  const fetchSlides = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/slideshow')
      const data = await res.json()
      if (res.ok) {
        setSlides(data.slideshows || [])
      } else {
        setError(data.error || 'โหลดข้อมูลล้มเหลว')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setImageUrl(data.url)
      } else {
        setError(data.error || 'อัปโหลดรูปภาพล้มเหลว')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      title,
      description,
      imageUrl,
      order: parseInt(order),
      isActive,
    }

    try {
      const url = isEditing ? `/api/slideshow/${isEditing}` : '/api/slideshow'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(isEditing ? 'แก้ไขสไลด์โชว์สำเร็จ' : 'เพิ่มสไลด์โชว์สำเร็จ')
        resetForm()
        fetchSlides()
      } else {
        setError(data.error || 'บันทึกข้อมูลล้มเหลว')
      }
    } catch {
      setError('ไม่สามารถบันทึกข้อมูลได้')
    }
  }

  const handleEdit = (slide: Slideshow) => {
    setIsEditing(slide.id)
    setTitle(slide.title)
    setDescription(slide.description || '')
    setImageUrl(slide.imageUrl)
    setOrder(slide.order.toString())
    setIsActive(slide.isActive)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('คุณแน่ใจว่าต้องการลบสไลด์โชว์นี้ใช่หรือไม่?')) return

    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/slideshow/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('ลบสไลด์โชว์สำเร็จ')
        fetchSlides()
      } else {
        const data = await res.json()
        setError(data.error || 'ลบข้อมูลล้มเหลว')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
  }

  const resetForm = () => {
    setIsEditing(null)
    setTitle('')
    setDescription('')
    setImageUrl('')
    setOrder('0')
    setIsActive(true)
  }

  return (
    <div className="adminSlideshowPage">
      <h1>🖼️ จัดการสไลด์โชว์</h1>
      <p>เพิ่ม แก้ไข หรือลบรูปภาพสไลด์โชว์ที่จะแสดงด้านบนของหน้าแรก</p>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="slideshowGrid">
        {/* Form Section */}
        <div className="formSection card">
          <h2>{isEditing ? '📝 แก้ไขสไลด์' : '➕ เพิ่มสไลด์ใหม่'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="formGroup">
              <label htmlFor="title">หัวข้อสไลด์ (Title) *</label>
              <input
                id="title"
                type="text"
                className="formInput"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="กรอกหัวข้อสไลด์"
                required
              />
            </div>

            <div className="formGroup">
              <label htmlFor="description">รายละเอียดเพิ่มเติม (Description)</label>
              <textarea
                id="description"
                className="formInput"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="กรอกรายละเอียดสั้นๆ"
                rows={3}
              />
            </div>

            <div className="formGroup">
              <label>รูปภาพสไลด์ *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
              />
              {uploading && <p className="uploadStatus">กำลังอัปโหลดรูปภาพ...</p>}
              
              <div className="imageInputGroup">
                <input
                  type="text"
                  className="formInput"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="หรือระบุ URL รูปภาพ"
                  required
                />
              </div>

              {imageUrl && (
                <div className="imagePreview">
                  <p>ตัวอย่างรูปภาพ:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview" />
                </div>
              )}
            </div>

            <div className="formRow">
              <div className="formGroup">
                <label htmlFor="order">ลำดับการแสดงผล (Order)</label>
                <input
                  id="order"
                  type="number"
                  className="formInput"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  min="0"
                />
              </div>

              <div className="formGroup checkboxGroup">
                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  เปิดใช้งานสไลด์นี้
                </label>
              </div>
            </div>

            <div className="formActions">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {isEditing ? 'อัปเดตสไลด์' : 'เพิ่มสไลด์'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  ยกเลิก
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Section */}
        <div className="listSection card">
          <h2>📋 รายการสไลด์ทั้งหมด</h2>
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : slides.length > 0 ? (
            <div className="slidesList">
              {slides.map((slide) => (
                <div key={slide.id} className="slideItem">
                  <div className="slideItemImage">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slide.imageUrl} alt={slide.title} />
                  </div>
                  <div className="slideItemInfo">
                    <h3>
                      {slide.title}{' '}
                      {!slide.isActive && <span className="inactiveBadge">ปิดการใช้งาน</span>}
                    </h3>
                    <p className="slideDesc">{slide.description || '-'}</p>
                    <p className="slideOrder">ลำดับ: {slide.order}</p>
                    <div className="slideActions">
                      <button onClick={() => handleEdit(slide)} className="btn btn-sm btn-edit">
                        แก้ไข
                      </button>
                      <button onClick={() => handleDelete(slide.id)} className="btn btn-sm btn-delete">
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="noData">ยังไม่มีข้อมูลสไลด์โชว์</p>
          )}
        </div>
      </div>
    </div>
  )
}
