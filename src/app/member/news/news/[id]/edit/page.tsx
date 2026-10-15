'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Video, 
  Sparkles, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Layers,
  Calendar
} from 'lucide-react'
import './page.css'

interface ImageItem {
  id: number
  imageUrl: string
  order: number
}

export default function EditNewsPage(props: any) {
  const router = useRouter()
  // Unwrap parameters using React.use() for Next.js 16+
  const resolvedParams = use(props.params) as { id: string }
  const id = resolvedParams.id

  const [title, setTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [status, setStatus] = useState('PUBLISHED') 
  const [category, setCategory] = useState('PR') // PR, TRAINING, JOBS, ANNOUNCEMENT
  const [publishedAt, setPublishedAt] = useState('') // datetime-local string
  const [expiredAt, setExpiredAt] = useState('') // datetime-local string
  const [images, setImages] = useState<string[]>([]) // multiple images array
  
  const [fetching, setFetching] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch(`/api/news/${id}`)
        const data = await res.json()

        if (res.ok && data.news) {
          setTitle(data.news.title)
          setYoutubeUrl(data.news.youtubeUrl || '')
          setPdfUrl(data.news.pdfUrl || '')
          setStatus(data.news.status || 'PUBLISHED')
          setCategory(data.news.category || 'PR')
          
          if (data.news.publishedAt) {
            // Format to YYYY-MM-DDTHH:MM for datetime-local input
            const d = new Date(data.news.publishedAt)
            const fiveYears = new Date()
            fiveYears.setFullYear(fiveYears.getFullYear() + 5)
            
            const targetDate = d > fiveYears ? new Date() : d
            const year = targetDate.getFullYear()
            const month = String(targetDate.getMonth() + 1).padStart(2, '0')
            const day = String(targetDate.getDate()).padStart(2, '0')
            const hours = String(targetDate.getHours()).padStart(2, '0')
            const minutes = String(targetDate.getMinutes()).padStart(2, '0')
            setPublishedAt(`${year}-${month}-${day}T${hours}:${minutes}`)
          }

          if (data.news.expiredAt) {
            const d = new Date(data.news.expiredAt)
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            const hours = String(d.getHours()).padStart(2, '0')
            const minutes = String(d.getMinutes()).padStart(2, '0')
            setExpiredAt(`${year}-${month}-${day}T${hours}:${minutes}`)
          }
          
          if (Array.isArray(data.news.images)) {
            setImages(data.news.images.map((img: ImageItem) => img.imageUrl))
          }
        } else {
          setError('ไม่พบข้อมูลข่าวสารที่ต้องการแก้ไข')
        }
      } catch {
        setError('ไม่สามารถโหลดข้อมูลข่าวจากระบบได้')
      } finally {
        setFetching(false)
      }
    }

    fetchNews()
  }, [id])

  // Handle uploading multiple images
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)
    setError('')

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title || 'news-image')
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
    formData.append('title', title || 'news-document')
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
    setSuccess('')
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

      const res = await fetch(`/api/news/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess('บันทึกการแก้ไขข้อมูลข่าวเรียบร้อยแล้ว กำลังนำท่านกลับสู่หน้ารายการ...')
        setTimeout(() => router.push('/member/news/news'), 1200)
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึกข่าว')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="workbenchLoadingState">
        <span className="uploadSpinner" />
        <p>กำลังโหลดข้อมูลข่าวสาร #{id}...</p>
      </div>
    )
  }

  return (
    <div className="newsFormWorkbench">
      {/* ── Top Navigation & Title Bar ── */}
      <div className="workbenchHeader">
        <Link href="/member/news/news" className="backToNewsLink">
          <ArrowLeft size={16} />
          <span>ย้อนกลับไปรายการข่าว</span>
        </Link>
        <div className="workbenchTitleRow">
          <div>
            <div className="titleWithIdBadge">
              <h1 className="workbenchTitle">แก้ไขข้อมูลข่าวสาร</h1>
              <span className="newsIdBadge">รหัส #{id}</span>
            </div>
            <p className="workbenchSubtitle">
              ปรับปรุงรายละเอียด รูปภาพประกอบ หรือตั้งเวลาแสดงผลของข่าวนี้ใหม่
            </p>
          </div>
          <div className="statusPreviewBadge">
            <span className="dot" />
            <span>สถานะ: {status === 'PUBLISHED' ? 'เผยแพร่อยู่' : status === 'DRAFT' ? 'ฉบับร่าง' : 'จัดเก็บ'}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="workbenchAlert alertDanger">
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="workbenchAlert alertSuccess">
          <CheckCircle2 size={18} />
          <div>{success}</div>
        </div>
      )}

      {/* ── Main Form ── */}
      <form onSubmit={handleSubmit} className="formWorkbenchLayout">
        <div className="formMainColumn">
          {/* Card 1: Main Info */}
          <div className="formSectionCard">
            <div className="sectionCardHeader">
              <div className="sectionCardIcon">
                <Layers size={18} />
              </div>
              <div>
                <h2 className="sectionCardTitle">ข้อมูลข่าวสาร</h2>
                <p className="sectionCardDesc">ระบุหัวข้อ ประเภท และสถานะการเผยแพร่</p>
              </div>
            </div>

            <div className="cardBody">
              <div className="formFieldGroup">
                <label htmlFor="title" className="fieldLabel">
                  หัวข้อข่าวสาร <span className="requiredAsterisk">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  className="fieldInput"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="กรอกหัวข้อข่าวประชาสัมพันธ์"
                  required
                />
              </div>

              <div className="formFieldRow">
                <div className="formFieldCol">
                  <label htmlFor="category" className="fieldLabel">
                    ประเภทข่าวสาร <span className="requiredAsterisk">*</span>
                  </label>
                  <select
                    id="category"
                    className="fieldSelect"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="PR">📢 ข่าวสารประชาสัมพันธ์</option>
                    <option value="TRAINING">🎓 ประชุมอบรม / สัมมนา</option>
                    <option value="JOBS">💼 ประกาศรับสมัครงาน</option>
                    <option value="ANNOUNCEMENT">📑 ประกาศทั่วไป / จัดซื้อจัดจ้าง</option>
                  </select>
                </div>

                <div className="formFieldCol">
                  <label htmlFor="status" className="fieldLabel">
                    สถานะการเผยแพร่
                  </label>
                  <select
                    id="status"
                    className="fieldSelect"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="PUBLISHED">🟢 ลงข่าว (เผยแพร่ตามเวลาเริ่ม-หมดอายุ)</option>
                    <option value="DRAFT">🟡 ดราฟ (บันทึกร่างไว้แก้ไขต่อ)</option>
                    <option value="ARCHIVED">⚪ เก็บเข้าคลัง (ไม่แสดงบนหน้าเว็บหลัก)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Media & Attachments */}
          <div className="formSectionCard">
            <div className="sectionCardHeader">
              <div className="sectionCardIcon">
                <ImageIcon size={18} />
              </div>
              <div>
                <h2 className="sectionCardTitle">รูปภาพและสื่อประกอบข่าวสาร</h2>
                <p className="sectionCardDesc">อัปโหลดภาพประกอบ วิดีโอ YouTube หรือเอกสาร PDF</p>
              </div>
            </div>

            <div className="cardBody">
              {/* Multiple Images Upload */}
              <div className="formFieldGroup">
                <label className="fieldLabel">
                  รูปภาพประกอบข่าว (อัปโหลดเพิ่มได้หลายรูป)
                </label>
                
                <div className="uploadDropzone">
                  <input
                    id="imageUploadInput"
                    type="file"
                    className="hiddenFileInput"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="imageUploadInput" className="uploadDropzoneContent">
                    <div className="uploadDropzoneIcon">
                      <Upload size={24} />
                    </div>
                    <div className="uploadDropzoneText">
                      <strong>คลิกเพื่ออัปโหลดรูปภาพเพิ่มเติม</strong>
                      <span>รองรับ JPEG, PNG, WebP (เลือกหลายรูปพร้อมกันได้)</span>
                    </div>
                  </label>
                </div>

                {uploadingImage && (
                  <div className="uploadingStatus">
                    <span className="uploadSpinner" />
                    <span>กำลังอัปโหลดรูปภาพเข้าสู่ระบบคลังไฟล์...</span>
                  </div>
                )}

                {images.length > 0 && (
                  <div className="imagesPreviewContainer">
                    <div className="imagesHeader">
                      <span className="imagesCountText">รูปภาพทั้งหมด ({images.length} รูป)</span>
                      <span className="coverHintText">* รูปแรกจะใช้เป็นภาพหน้าปกข่าว</span>
                    </div>
                    <div className="imagesPreviewGrid">
                      {images.map((url, idx) => (
                        <div key={idx} className="imageCard">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`รูปข่าวที่ ${idx + 1}`} />
                          <button
                            type="button"
                            className="deleteImageBtn"
                            onClick={() => removeImage(idx)}
                            title="ลบรูปภาพนี้"
                          >
                            <Trash2 size={13} />
                          </button>
                          <span className={`orderBadge ${idx === 0 ? 'isCover' : ''}`}>
                            {idx === 0 ? '★ หน้าปก' : `รูปที่ ${idx + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* YouTube & PDF Row */}
              <div className="formFieldRow">
                <div className="formFieldCol">
                  <label htmlFor="youtubeUrl" className="fieldLabel">
                    <Video size={14} className="inlineIcon" />
                    <span>ลิงก์วิดีโอ YouTube (ถ้ามี)</span>
                  </label>
                  <input
                    id="youtubeUrl"
                    type="url"
                    className="fieldInput"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <span className="fieldHelpText">ระบบจะสร้างเครื่องเล่นวิดีโอ YouTube ฝังลงในเนื้อหาข่าวโดยอัตโนมัติ</span>
                </div>

                <div className="formFieldCol">
                  <label htmlFor="pdfFile" className="fieldLabel">
                    <FileText size={14} className="inlineIcon" />
                    <span>แนบเอกสาร PDF (ถ้ามี)</span>
                  </label>
                  <input
                    id="pdfFile"
                    type="file"
                    className="fieldInput filePickerInput"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                  />
                  {uploadingPdf && (
                    <div className="uploadingStatus">
                      <span className="uploadSpinner" />
                      <span>กำลังอัปโหลดเอกสาร PDF...</span>
                    </div>
                  )}
                  {pdfUrl && (
                    <div className="attachedFileInfoCard">
                      <div className="attachedFileLeft">
                        <FileText size={18} className="pdfFileIcon" />
                        <div>
                          <span className="attachedFileName">เอกสารที่แนบไว้</span>
                          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="previewPdfLink">
                            คลิกเพื่อดูเอกสาร <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="removeAttachedBtn" 
                        onClick={() => setPdfUrl('')}
                        title="ลบเอกสารแนบ"
                      >
                        ลบออก
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar Column: Schedule & Publishing ── */}
        <div className="formSidebarColumn">
          {/* Schedule Card */}
          <div className="formSectionCard">
            <div className="sectionCardHeader">
              <div className="sectionCardIcon">
                <Clock size={18} />
              </div>
              <div>
                <h2 className="sectionCardTitle">กำหนดการแสดงผล</h2>
                <p className="sectionCardDesc">ตั้งเวลาเริ่มและสิ้นสุดการเผยแพร่</p>
              </div>
            </div>

            <div className="cardBody">
              <div className="formFieldGroup">
                <label htmlFor="publishedAt" className="fieldLabel">
                  เวลาเริ่มเผยแพร่ข่าวสาร
                </label>
                <input
                  id="publishedAt"
                  type="datetime-local"
                  className="fieldInput"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
                <span className="fieldHelpText">เวลาที่ข่าวประชาสัมพันธ์จะปรากฏบนเว็บไซต์</span>
              </div>

              <div className="formFieldGroup">
                <label htmlFor="expiredAt" className="fieldLabel">
                  เวลาสิ้นสุดการเผยแพร่ <span className="requiredAsterisk">*</span>
                </label>
                <input
                  id="expiredAt"
                  type="datetime-local"
                  className="fieldInput"
                  value={expiredAt}
                  onChange={(e) => setExpiredAt(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  required
                />
                <span className="fieldHelpText">ข่าวจะถูกปลดจากการแสดงผลบนหน้าแรกอัตโนมัติเมื่อครบกำหนด</span>
              </div>

              {/* Info Guide */}
              <div className="publishingNoticeBox">
                <CheckCircle2 size={16} className="noticeIcon" />
                <p>
                  การแก้ไขจะมีผลต่อหน้าเว็บไซต์โรงพยาบาลเถินทันทีหลังจากกดบันทึก
                </p>
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div className="formSectionCard actionStickyCard">
            <div className="cardBody">
              <button
                type="submit"
                className="submitWorkbenchBtn"
                disabled={loading || uploadingImage || uploadingPdf}
              >
                {loading ? (
                  <>
                    <span className="uploadSpinner" />
                    <span>กำลังบันทึกการแก้ไข...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>บันทึกการแก้ไขข่าว</span>
                  </>
                )}
              </button>

              <Link href="/member/news/news" className="cancelWorkbenchBtn">
                ยกเลิก
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
