'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import './page.css'

export default function CreateNewsPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setImage(data.url)
      } else {
        setError(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ')
      }
    } catch {
      setError('ไม่สามารถอัปโหลดไฟล์ได้')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, content, image, isPublished }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/admin/news')
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
      <h1>➕ เพิ่มข่าวใหม่</h1>

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
              placeholder="กรอกหัวข้อข่าว"
              required
            />
          </div>

          <div className="formGroup">
            <label htmlFor="excerpt">บทคัดย่อ *</label>
            <textarea
              id="excerpt"
              className="formTextarea"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="กรอกบทคัดย่อข่าว (แสดงในหน้ารายการข่าว)"
              required
              style={{ minHeight: '100px' }}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="content">เนื้อหา *</label>
            <textarea
              id="content"
              className="formTextarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="กรอกเนื้อหาข่าวฉบับเต็ม"
              required
            />
          </div>

          <div className="formGroup">
            <label htmlFor="image">รูปภาพประกอบ</label>
            <input
              id="image"
              type="file"
              className="formInput"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageUpload}
            />
            {uploading && (
              <div className="uploadProgress">กำลังอัปโหลด...</div>
            )}
            {image && (
              <div className="imagePreview">
                <img src={image} alt="Preview" />
              </div>
            )}
          </div>

          <div className="formGroup">
            <div className="checkboxGroup">
              <input
                id="isPublished"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <label htmlFor="isPublished" style={{ margin: 0 }}>
                เผยแพร่ทันที
              </label>
            </div>
          </div>

          <div className="formActions">
            <button
              type="submit"
              className="submitButton"
              disabled={loading || uploading}
            >
              {loading ? 'กำลังบันทึก...' : '💾 บันทึกข่าว'}
            </button>
            <Link href="/admin/news" className="cancelButton">
              ยกเลิก
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
