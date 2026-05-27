'use client'

import { useState, useEffect } from 'react'
import './page.css'

interface Banner {
  id: number
  title: string
  subtitle: string | null
  imageUrl: string
  linkUrl: string | null
  isActive: boolean
}

export default function AdminBannerPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form states
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isEditing, setIsEditing] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchBanners()
  }, [])

  const fetchBanners = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/banner')
      const data = await res.json()
      if (res.ok) {
        setBanners(data.banners || [])
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
      subtitle,
      imageUrl,
      linkUrl,
      isActive,
    }

    try {
      const url = isEditing ? `/api/banner/${isEditing}` : '/api/banner'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(isEditing ? 'แก้ไขแบนเนอร์สำเร็จ' : 'เพิ่มแบนเนอร์สำเร็จ')
        resetForm()
        fetchBanners()
      } else {
        setError(data.error || 'บันทึกข้อมูลล้มเหลว')
      }
    } catch {
      setError('ไม่สามารถบันทึกข้อมูลได้')
    }
  }

  const handleEdit = (banner: Banner) => {
    setIsEditing(banner.id)
    setTitle(banner.title)
    setSubtitle(banner.subtitle || '')
    setImageUrl(banner.imageUrl)
    setLinkUrl(banner.linkUrl || '')
    setIsActive(banner.isActive)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('คุณแน่ใจว่าต้องการลบแบนเนอร์นี้ใช่หรือไม่?')) return

    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/banner/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('ลบแบนเนอร์สำเร็จ')
        fetchBanners()
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
    setSubtitle('')
    setImageUrl('')
    setLinkUrl('')
    setIsActive(true)
  }

  return (
    <div className="adminBannerPage">
      <h1>🎏 จัดการแบนเนอร์</h1>
      <p>เพิ่ม แก้ไข หรือลบแบนเนอร์ประชาสัมพันธ์ต่างๆ ของโรงพยาบาล</p>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="bannerGrid">
        {/* Form Section */}
        <div className="formSection card">
          <h2>{isEditing ? '📝 แก้ไขแบนเนอร์' : '➕ เพิ่มแบนเนอร์ใหม่'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="formGroup">
              <label htmlFor="title">หัวข้อแบนเนอร์ (Title) *</label>
              <input
                id="title"
                type="text"
                className="formInput"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="กรอกหัวข้อแบนเนอร์"
                required
              />
            </div>

            <div className="formGroup">
              <label htmlFor="subtitle">คำโปรยหรือคำอธิบายรอง (Subtitle)</label>
              <input
                id="subtitle"
                type="text"
                className="formInput"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="กรอกรายละเอียดรอง"
              />
            </div>

            <div className="formGroup">
              <label>รูปภาพแบนเนอร์ *</label>
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

            <div className="formGroup">
              <label htmlFor="linkUrl">ลิงก์ปลายทางเมื่อคลิก (Link URL)</label>
              <input
                id="linkUrl"
                type="text"
                className="formInput"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="เช่น /news หรือลิงก์ภายนอก"
              />
            </div>

            <div className="formGroup checkboxGroup">
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                เปิดใช้งานแบนเนอร์นี้
              </label>
            </div>

            <div className="formActions">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {isEditing ? 'อัปเดตแบนเนอร์' : 'เพิ่มแบนเนอร์'}
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
          <h2>📋 รายการแบนเนอร์ทั้งหมด</h2>
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : banners.length > 0 ? (
            <div className="bannersList">
              {banners.map((banner) => (
                <div key={banner.id} className="bannerItem">
                  <div className="bannerItemImage">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={banner.imageUrl} alt={banner.title} />
                  </div>
                  <div className="bannerItemInfo">
                    <h3>
                      {banner.title}{' '}
                      {!banner.isActive && <span className="inactiveBadge">ปิดการใช้งาน</span>}
                    </h3>
                    {banner.subtitle && <p className="bannerSub">{banner.subtitle}</p>}
                    {banner.linkUrl && <p className="bannerLink">ลิงก์: {banner.linkUrl}</p>}
                    <div className="bannerActions">
                      <button onClick={() => handleEdit(banner)} className="btn btn-sm btn-edit">
                        แก้ไข
                      </button>
                      <button onClick={() => handleDelete(banner.id)} className="btn btn-sm btn-delete">
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="noData">ยังไม่มีข้อมูลแบนเนอร์</p>
          )}
        </div>
      </div>
    </div>
  )
}
