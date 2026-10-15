'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Trash2,
  Upload,
  Check,
  AlertCircle,
  PenTool,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import './page.css'

export default function MemberSignatureClient() {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw')
  const [currentSignatureExists, setCurrentSignatureExists] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Signature Drawing States
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  // Signature Upload States
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch current signature status
  useEffect(() => {
    fetchSignatureStatus()
  }, [])

  const formatThaiDate = (dateString: string) => {
    try {
      const d = new Date(dateString)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      const day = d.getDate()
      const month = thaiMonths[d.getMonth()]
      const year = d.getFullYear() + 543
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      return `${day} ${month} ${year} เวลา ${time} น.`
    } catch {
      return dateString
    }
  }

  const fetchSignatureStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/signatures')
      const data = await res.json()
      if (data.success) {
        setCurrentSignatureExists(data.exists)
        if (data.exists && data.updatedAt) {
          setLastUpdated(formatThaiDate(data.updatedAt))
        }
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'ไม่สามารถตรวจสอบสถานะลายเซ็นปัจจุบันได้')
    } finally {
      setLoading(false)
    }
  }

  // Initialize Canvas for Drawing
  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2 // Higher resolution for crisp stroke
      canvas.height = 260 * 2
      canvas.style.width = '100%'
      canvas.style.height = '260px'

      const context = canvas.getContext('2d')
      if (context) {
        context.scale(2, 2)
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = '#0f172a'
        context.lineWidth = 3
        contextRef.current = context
      }
    }
  }, [activeTab])

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message })
    setTimeout(() => {
      setStatus(null)
    }, 5000)
  }

  // Drawing Functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!contextRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    let clientX: number
    let clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top

    contextRef.current.beginPath()
    contextRef.current.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return
    e.preventDefault()

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    let clientX: number
    let clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top

    contextRef.current.lineTo(x, y)
    contextRef.current.stroke()
  }

  const stopDrawing = () => {
    if (!contextRef.current) return
    contextRef.current.closePath()
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    if (!contextRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Handle Image Upload and Background Removal
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showStatus('error', 'กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imgUrl = event.target?.result as string
      processImageBackground(imgUrl)
    }
    reader.readAsDataURL(file)
  }

  const processImageBackground = (src: string) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data

      // Pixel background removal for white/light paper background
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        if (r > 215 && g > 215 && b > 215) {
          data[i + 3] = 0 // transparent
        }
      }

      ctx.putImageData(imgData, 0, 0)
      setProcessedImageSrc(canvas.toDataURL('image/png'))
    }
    img.src = src
  }

  const handleSaveSignature = async () => {
    let signatureDataUrl = ''

    if (activeTab === 'draw') {
      if (!canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      let hasContent = false
      if (ctx) {
        try {
          const buffer = new Uint32Array(
            ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
          )
          hasContent = buffer.some((color) => color !== 0)
        } catch {
          hasContent = false
        }
      }

      if (!hasContent) {
        showStatus('error', 'กรุณาวาดลายเซ็นของคุณก่อนกดบันทึก')
        return
      }

      signatureDataUrl = canvas.toDataURL('image/png')
    } else {
      if (!processedImageSrc) {
        showStatus('error', 'กรุณาอัปโหลดรูปภาพลายเซ็นของคุณก่อนกดบันทึก')
        return
      }
      signatureDataUrl = processedImageSrc
    }

    try {
      setSaving(true)
      const response = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: signatureDataUrl }),
      })

      const data = await response.json()
      if (data.success) {
        showStatus('success', 'บันทึกลายเซ็นดิจิทัลของคุณเรียบร้อยแล้ว')
        setCurrentSignatureExists(true)
        setLastUpdated(formatThaiDate(new Date().toISOString()))
        if (activeTab === 'draw') clearCanvas()
        else {
          setProcessedImageSrc(null)
        }
      } else {
        showStatus('error', data.error || 'เกิดข้อผิดพลาดในการบันทึกลายเซ็น')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="signatureContainer">
      <Link href="/member" className="signatureBackLink">
        <ArrowLeft size={16} />
        กลับหน้าข้อมูลสมาชิก
      </Link>

      <header className="signatureHeaderCard">
        <div className="signatureHospitalBadge">
          <ShieldCheck size={14} />
          <span>โรงพยาบาลเถิน จ.ลำปาง • ระบบลายเซ็นดิจิทัล</span>
        </div>
        <h1 className="signatureHeaderTitle">จัดการลายเซ็นดิจิทัลเจ้าหน้าที่ (Digital Signature)</h1>
        <p className="signatureHeaderDesc">
          ตั้งค่าลายเซ็นอิเล็กทรอนิกส์ประจำตัว เพื่อใช้สำหรับประทับตกลงนามเอกสารดิจิทัล ใบเบิกพัสดุ
          และระบบขอผลิตสื่อผ่านระบบเครือข่ายโรงพยาบาลเถินได้อย่างสะดวกรวดเร็ว
        </p>
      </header>

      {status && (
        <div
          role="alert"
          className={`statusMessage ${status.type === 'success' ? 'statusSuccess' : 'statusError'}`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 size={18} className="statusIcon" />
          ) : (
            <AlertCircle size={18} className="statusIcon" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      <div className="signatureGrid">
        {/* Left Column: Current Signature Card */}
        <section className="signatureCard" aria-labelledby="current-signature-heading">
          <div className="cardHeaderRow">
            <h2 id="current-signature-heading" className="cardTitle">
              <CheckCircle2 size={18} className="cardTitleIcon" />
              ลายเซ็นปัจจุบัน
            </h2>
            <span
              className={`statusChip ${currentSignatureExists ? 'statusChipActive' : 'statusChipEmpty'}`}
            >
              {currentSignatureExists ? 'ลงทะเบียนแล้ว' : 'ยังไม่มีข้อมูล'}
            </span>
          </div>

          <div className="currentSignatureWrapper transparentPattern">
            {loading ? (
              <Loader2 className="animate-spin text-emerald-700" size={28} />
            ) : currentSignatureExists ? (
              <img
                src={`/api/signatures/image?t=${Date.now()}`}
                alt="ลายเซ็นดิจิทัลที่ลงทะเบียนในระบบ"
                className="signatureImage"
              />
            ) : (
              <div className="noSignatureState">
                <PenTool size={36} className="noSignatureIcon" />
                <span className="noSignatureText">ยังไม่ได้ลงทะเบียนลายเซ็น</span>
                <span className="noSignatureSubtext">
                  วาดหรืออัปโหลดลายเซ็นทางฝั่งขวาเพื่อเริ่มใช้งาน
                </span>
              </div>
            )}
          </div>

          {currentSignatureExists && lastUpdated && (
            <div className="updatedMeta">
              <Clock size={13} />
              <span>อัปเดตล่าสุด: {lastUpdated}</span>
            </div>
          )}

          <div className="policyNotice">
            <div className="flex items-start gap-2">
              <Info size={15} className="text-emerald-800 shrink-0 mt-0.5" />
              <div>
                <strong>มาตรฐานความปลอดภัย PDPA:</strong> ลายเซ็นอิเล็กทรอนิกส์จะถูกจัดเก็บแบบเข้ารหัส
                และใช้รับรองเฉพาะการปฏิบัติงานของเจ้าหน้าที่ผู้เป็นเจ้าของบัญชีเท่านั้น
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Signature Studio Card */}
        <section className="signatureCard" aria-labelledby="studio-signature-heading">
          <div className="cardHeaderRow">
            <h2 id="studio-signature-heading" className="cardTitle">
              <PenTool size={18} className="cardTitleIcon" />
              ลงทะเบียน / เปลี่ยนแปลงลายเซ็น
            </h2>
          </div>

          <div className="tabButtons" role="tablist" aria-label="วิธีการนำเข้าลายเซ็น">
            <button
              role="tab"
              aria-selected={activeTab === 'draw'}
              onClick={() => setActiveTab('draw')}
              className={`tabButton ${activeTab === 'draw' ? 'tabButtonActive' : ''}`}
            >
              <PenTool size={16} />
              <span>วาดลายเซ็นดิจิทัล</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
              className={`tabButton ${activeTab === 'upload' ? 'tabButtonActive' : ''}`}
            >
              <Upload size={16} />
              <span>อัปโหลดไฟล์ภาพ</span>
            </button>
          </div>

          {activeTab === 'draw' ? (
            <div>
              <div className="canvasInstruction">
                <Info size={14} />
                <span>ใช้เมาส์ หรือปากกา/นิ้วสัมผัส วาดลายเซ็นลงในกรอบด้านล่าง</span>
              </div>

              <div className="canvasWrapper transparentPattern">
                <canvas
                  ref={canvasRef}
                  className="drawingCanvas"
                  aria-label="กระดานวาดลายเซ็น"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <div className="canvasToolbar">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="button buttonSecondary"
                >
                  <Trash2 size={16} />
                  <span>ล้างกระดาน</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={saving}
                  className="button buttonPrimary"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  <span>{saving ? 'กำลังบันทึก...' : 'บันทึกลายเซ็นนี้'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {processedImageSrc ? (
                <div>
                  <div className="canvasInstruction">
                    <CheckCircle2 size={14} className="text-emerald-700" />
                    <span>ตัวอย่างลายเซ็นที่ตัดพื้นหลังสีขาวออกแล้ว</span>
                  </div>

                  <div className="previewContainer transparentPattern">
                    <img
                      src={processedImageSrc}
                      alt="ลายเซ็นที่ลบพื้นหลังแล้ว"
                      className="previewImage"
                    />
                  </div>

                  <div className="canvasToolbar">
                    <button
                      type="button"
                      onClick={() => setProcessedImageSrc(null)}
                      className="button buttonSecondary"
                    >
                      <Trash2 size={16} />
                      <span>เลือกภาพใหม่</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSignature}
                      disabled={saving}
                      className="button buttonPrimary"
                    >
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                      <span>{saving ? 'กำลังบันทึก...' : 'บันทึกลายเซ็นนี้'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleImageUpload}
                    className="uploadInput"
                    id="member-signature-upload-input"
                  />
                  <label htmlFor="member-signature-upload-input" className="uploadLabel">
                    <Upload size={36} className="uploadIcon" />
                    <span className="uploadText">คลิกเพื่อเลือกไฟล์รูปภาพลายเซ็น</span>
                    <span className="uploadSubtext">รองรับรูปแบบ PNG, JPG หรือ JPEG</span>
                    <span className="uploadHint">
                      * ระบบจะทำการลบพื้นหลังกระดาษสีขาวให้อัตโนมัติ
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
