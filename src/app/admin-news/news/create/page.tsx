'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import './page.css'

export default function CreateNewsPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [status, setStatus] = useState('PUBLISHED') 
  const [category, setCategory] = useState('PR') // PR, TRAINING, JOBS, KNOWLEDGE
  const [publishedAt, setPublishedAt] = useState('') // datetime-local string
  const [expiredAt, setExpiredAt] = useState('') // datetime-local string
  const [images, setImages] = useState<string[]>([]) // multiple images array
  
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle uploading multiple images one by one or in batches
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)
    setError('')

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('publishedAt', publishedAt)

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (res.ok) {
          setImages((prev) => [...prev, data.url])
        } else {
          setError(data.error || 'อัปโหลดไฟล์ภาพไม่สำเร็จ')
          break
        }
      } catch {
        setError('ไม่สามารถอัปโหลดไฟล์ภาพได้')
        break
      }
    }
    setUploadingImage(false)
    e.target.value = '' // Clear input
  }

  // Handle PDF upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPdf(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    formData.append('publishedAt', publishedAt)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setPdfUrl(data.url)
      } else {
        setError(data.error || 'อัปโหลดเอกสาร PDF ไม่สำเร็จ')
      }
    } catch {
      setError('ไม่สามารถอัปโหลดเอกสาร PDF ได้')
    } finally {
      setUploadingPdf(false)
      e.target.value = '' // Clear input
    }
  }

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        title,
        youtubeUrl: youtubeUrl || null,
        pdfUrl: pdfUrl || null,
        status,
        category,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        expiredAt: expiredAt ? new Date(expiredAt).toISOString() : null,
        images,
      }

      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/admin-news/news')
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="newsFormPage">
      <h1>เพิ่มข่าวใหม่</h1>

      {error && <div className="errorMessage">{error}</div>}

      <div className="formCard">
        <form onSubmit={handleSubmit}>
          <div className="formGroup">
            <label htmlFor="title">หัวข้อข่าว *</label>
            <input
              id="title"
              type="text"
              className="formInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="กรอกหัวข้อข่าวประชาสัมพันธ์"
              required
            />
          </div>

          {/* Excerpt and Content inputs removed */}

          <div className="formRow">
            <div className="formGroup col-6">
              <label htmlFor="youtubeUrl">ลิงก์วิดีโอ YouTube (ถ้ามี)</label>
              <input
                id="youtubeUrl"
                type="url"
                className="formInput"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="เช่น https://www.youtube.com/watch?v=..."
              />
            </div>

            <div className="formGroup col-6">
              <label htmlFor="pdfFile">แนบเอกสาร PDF (ถ้ามี)</label>
              <input
                id="pdfFile"
                type="file"
                className="formInput"
                accept="application/pdf"
                onChange={handlePdfUpload}
              />
              {uploadingPdf && <div className="uploadProgress">กำลังอัปโหลด PDF...</div>}
              {pdfUrl && (
                <div className="pdfUploadedInfo">
                  <span>อัปโหลดสำเร็จ: </span>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">ดูเอกสารที่แนบ</a>
                  <button type="button" className="removeFileBtn" onClick={() => setPdfUrl('')}>ลบ</button>
                </div>
              )}
            </div>
          </div>

          <div className="formGroup">
            <label>รูปภาพประกอบข่าว (อัปโหลดได้หลายรูปภาพ)</label>
            <input
              type="file"
              className="formInput"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleImageUpload}
            />
            {uploadingImage && <div className="uploadProgress">กำลังอัปโหลดรูปภาพ...</div>}
            
            {images.length > 0 && (
              <div className="imagesPreviewGrid">
                {images.map((url, idx) => (
                  <div key={idx} className="imagePreviewCard">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Preview ${idx + 1}`} />
                    <button
                      type="button"
                      className="imageDeleteBtn"
                      onClick={() => removeImage(idx)}
                      title="ลบรูปภาพนี้"
                    >
                      ✕
                    </button>
                    <span className="imageOrderBadge">รูปที่ {idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="formRow">
            <div className="formGroup col-6">
              <label htmlFor="publishedAt">เวลาเริ่มเผยแพร่ข่าวสาร (เริ่มแสดงผล)</label>
              <input
                id="publishedAt"
                type="datetime-local"
                className="formInput"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
              <span className="fieldTip">เว้นว่างไว้หากต้องการเผยแพร่ทันที (ตามเวลาปัจจุบัน)</span>
            </div>

            <div className="formGroup col-6">
              <label htmlFor="expiredAt">เวลาสิ้นสุดการเผยแพร่ (วันหมดอายุข่าว) *</label>
              <input
                id="expiredAt"
                type="datetime-local"
                className="formInput"
                value={expiredAt}
                onChange={(e) => setExpiredAt(e.target.value)}
                required
              />
              <span className="fieldTip">ข่าวจะหยุดแสดงผลหลังจากถึงช่วงเวลาที่ระบุนี้</span>
            </div>
          </div>

          <div className="formRow">
            <div className="formGroup col-6">
              <label htmlFor="category">ประเภทข่าวสาร *</label>
              <select
                id="category"
                className="formInput"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="PR">ข่าวสารประชาสัมพันธ์</option>
                <option value="TRAINING">ประชุมอบรม / สัมมนา</option>
                <option value="JOBS">ประกาศรับสมัครงาน</option>
                <option value="KNOWLEDGE">ข่าวสารความรู้</option>
              </select>
            </div>

            <div className="formGroup col-6">
              <label htmlFor="status">สถานะข่าวประชาสัมพันธ์</label>
              <select
                id="status"
                className="formInput"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="PUBLISHED">ลงข่าว (เผยแพร่ต่อสาธารณะ)</option>
                <option value="DRAFT">ดราฟ (บันทึกร่างไว้แก้ไขต่อ)</option>
                <option value="ARCHIVED">เก็บเข้าคลัง (ไม่แสดงบนหน้าเว็บหลัก)</option>
              </select>
            </div>
          </div>

          <div className="formActions">
            <button
              type="submit"
              className="submitButton"
              disabled={loading || uploadingImage || uploadingPdf}
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกข่าว'}
            </button>
            <Link href="/admin-news/news" className="cancelButton">
              ยกเลิก
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
