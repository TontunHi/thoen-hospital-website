'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Trash2, Upload, Check, AlertCircle, PenTool, Loader2, ArrowLeft } from 'lucide-react'
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
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null)
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch current signature status
  useEffect(() => {
    fetchSignatureStatus()
  }, [])

  const fetchSignatureStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/signatures')
      const data = await res.json()
      if (data.success) {
        setCurrentSignatureExists(data.exists)
        if (data.exists && data.updatedAt) {
          setLastUpdated(new Date(data.updatedAt).toLocaleString('th-TH'))
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
      canvas.width = rect.width * 2 // Higher resolution
      canvas.height = 250 * 2
      canvas.style.width = '100%'
      canvas.style.height = '250px'

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
    let clientX, clientY

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
    let clientX, clientY

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
      setUploadedImageSrc(imgUrl)
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

      // Pixel background removal
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
      const buffer = new Uint32Array(
        canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.buffer
      )
      const hasContent = buffer.some(color => color !== 0)
      
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
        setLastUpdated(new Date().toLocaleString('th-TH'))
        if (activeTab === 'draw') clearCanvas()
        else {
          setUploadedImageSrc(null)
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
      <Link href="/member" className="backButton">
        <ArrowLeft size={16} />
        กลับหน้าข้อมูลสมาชิก
      </Link>

      <div className="signatureHeader">
        <h1>จัดการลายเซ็นดิจิทัลของคุณ (Member Signature)</h1>
        <p>ตั้งค่าลายเซ็นของคุณ เพื่อใช้สำหรับประทับตกลงนามเอกสารและระบบขอผลิตสื่อผ่านหน้าเว็บได้อย่างสะดวกรวดเร็ว</p>
      </div>

      {status && (
        <div className={`statusMessage ${status.type === 'success' ? 'statusSuccess' : 'statusError'}`}>
          {status.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="signatureGrid">
        {/* Left Card */}
        <div className="signatureCard">
          <h2 className="cardTitle">
            <Check size={18} style={{ color: '#0284c7' }} />
            ลายเซ็นปัจจุบันของคุณ
          </h2>
          
          <div className="currentSignatureWrapper transparentPattern">
            {loading ? (
              <Loader2 className="animate-spin" size={24} style={{ color: '#0284c7' }} />
            ) : currentSignatureExists ? (
              <img 
                src={`/api/signatures/image?t=${Date.now()}`} 
                alt="ลายเซ็นดิจิทัล" 
                className="signatureImage"
              />
            ) : (
              <div className="noSignatureText">คุณยังไม่ได้ลงทะเบียนลายเซ็นในระบบ</div>
            )}
          </div>

          {currentSignatureExists && lastUpdated && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
              อัปเดตล่าสุด: {lastUpdated}
            </div>
          )}
        </div>

        {/* Right Card */}
        <div className="signatureCard">
          <h2 className="cardTitle">
            <PenTool size={18} style={{ color: '#0284c7' }} />
            ลงทะเบียน / เปลี่ยนแปลงลายเซ็น
          </h2>

          <div className="tabButtons">
            <button
              onClick={() => setActiveTab('draw')}
              className={`tabButton ${activeTab === 'draw' ? 'tabButtonActive' : ''}`}
            >
              วาดลายเซ็นดิจิทัล
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`tabButton ${activeTab === 'upload' ? 'tabButtonActive' : ''}`}
            >
              อัปโหลดไฟล์ภาพ
            </button>
          </div>

          {activeTab === 'draw' ? (
            <div>
              <div className="canvasWrapper transparentPattern">
                <canvas
                  ref={canvasRef}
                  className="drawingCanvas"
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
                <button onClick={clearCanvas} className="button buttonSecondary">
                  <Trash2 size={16} />
                  ล้างหน้าจอ
                </button>
                <button
                  onClick={handleSaveSignature}
                  disabled={saving}
                  className="button buttonPrimary"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  บันทึกลายเซ็นนี้
                </button>
              </div>
            </div>
          ) : (
            <div>
              {processedImageSrc ? (
                <div>
                  <div className="previewContainer transparentPattern">
                    <img
                      src={processedImageSrc}
                      alt="ลายเซ็นที่ลบพื้นหลังแล้ว"
                      className="previewImage"
                    />
                  </div>
                  <div className="canvasToolbar">
                    <button
                      onClick={() => {
                        setUploadedImageSrc(null)
                        setProcessedImageSrc(null)
                      }}
                      className="button buttonSecondary"
                    >
                      <Trash2 size={16} />
                      เลือกภาพใหม่
                    </button>
                    <button
                      onClick={handleSaveSignature}
                      disabled={saving}
                      className="button buttonPrimary"
                    >
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                      บันทึกลายเซ็นนี้
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="uploadInput"
                    id="member-signature-upload-input"
                  />
                  <label htmlFor="member-signature-upload-input" className="uploadLabel">
                    <Upload size={32} className="uploadIcon" />
                    <span className="uploadText">เลือกรูปภาพลายเซ็น</span>
                    <span className="uploadSubtext">รองรับไฟล์ PNG, JPG หรือ JPEG</span>
                    <span className="uploadSubtext" style={{ fontSize: '11px', marginTop: '6px', color: '#0284c7' }}>
                      *ระบบจะลบพื้นหลังสีขาวออกให้เป็นภาพโปร่งใสโดยอัตโนมัติ
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
