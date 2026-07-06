'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, CheckCircle, AlertTriangle, FileText, Loader2, ArrowLeft, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface ImportPeriod {
  id: number
  type: string
  datein: string
  notesalary: string | null
}

export default function UploadSalaryClient() {
  const [periods, setPeriods] = useState<ImportPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form States (Unified)
  const [periodType, setPeriodType] = useState('1') // '1' = เงินเดือน, '2' = OT
  const [periodDate, setPeriodDate] = useState('')
  const [periodNote, setPeriodNote] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  // Modal Confirmation State
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchPeriods()
  }, [])

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusMsg({ type, message })
    setTimeout(() => {
      setStatusMsg(null)
    }, type === 'error' ? 10000 : 7000)
  }

  const fetchPeriods = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/salary/periods')
      const data = await res.json()
      if (data.success) {
        setPeriods(data.periods || [])
      } else {
        showStatus('error', data.error || 'ดึงประวัติการนำเข้าไม่สำเร็จ')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'ไม่สามารถเชื่อมต่อระบบดึงข้อมูลรอบการเงินได้')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUnifiedSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const missing: string[] = []
    if (!selectedFile) missing.push('ยังไม่ได้เลือกไฟล์ข้อมูล (.CSV)')
    if (!periodDate) missing.push('ยังไม่ได้ระบุวันที่จ่ายเงิน')

    if (missing.length > 0) {
      showStatus('error', `กรุณากรอกข้อมูลให้ครบถ้วนก่อนการนำเข้า: ` + missing.join(', '))
      return
    }

    // Show beautiful confirmation modal
    setShowConfirmModal(true)
  }

  const executeUpload = async () => {
    setShowConfirmModal(false)
    try {
      setSubmitting(true)
      setStatusMsg(null)

      // 1. Save Period to datein
      const periodRes = await fetch('/api/salary/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: periodType,
          datein: periodDate,
          notesalary: periodNote.trim() || null,
        }),
      })

      const periodData = await periodRes.json()
      if (!periodRes.ok || !periodData.success) {
        showStatus('error', periodData.error || 'บันทึกงวดนำเข้าปฏิทิน (datein) ล้มเหลว')
        return
      }

      // 2. Upload CSV File (Type maps: '1' -> 'salary', '2' -> 'ot')
      const targetUploadType = periodType === '1' ? 'salary' : 'ot'
      const formData = new FormData()
      formData.append('file', selectedFile!)
      formData.append('type', targetUploadType)

      const uploadRes = await fetch('/api/salary/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadRes.json()
      if (uploadRes.ok && uploadData.success) {
        showStatus('success', `บันทึกงวดและอัปโหลดข้อมูลสำเร็จ! (${uploadData.message})`)
        
        // Clear all inputs
        setPeriodDate('')
        setPeriodNote('')
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        
        fetchPeriods()
      } else {
        showStatus('error', uploadData.error || 'นำเข้าข้อมูลจากไฟล์ล้มเหลว (แต่งวดปฏิทินถูกบันทึกแล้ว)')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายเซิร์ฟเวอร์')
    } finally {
      setSubmitting(false)
    }
  }

  const getThaiDateStr = (dateinStr: string) => {
    try {
      const d = new Date(dateinStr)
      if (isNaN(d.getTime())) return dateinStr
      const day = d.getDate()
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
      const month = months[d.getMonth()]
      const year = d.getFullYear() + 543
      return `${day} ${month} ${year}`
    } catch (e) {
      return dateinStr
    }
  }

  return (
    <div className="uploadSalaryContainer">
      <div className="uploadSalaryHeader">
        <div>
          <Link href="/member" className="btn btnSecondary" style={{ marginBottom: '12px' }}>
            <ArrowLeft size={16} /> ย้อนกลับไปหน้าจัดการ
          </Link>
          <h1>ระบบจัดการนำเข้าข้อมูลเงินเดือน / OT</h1>
        </div>
      </div>

      {statusMsg && (
        <div className={`alertBox ${statusMsg.type === 'success' ? 'alertSuccess' : 'alertError'}`}>
          {statusMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{statusMsg.message}</span>
        </div>
      )}

      <div className="uploadSalaryGrid">
        {/* Left Column: Combined Upload & Period Form */}
        <div className="uploadCard">
          <h2>กรอกรายละเอียดและแนบไฟล์นำเข้าข้อมูลการเงิน</h2>
          <form onSubmit={handleUnifiedSubmit}>
            <div className="formGroup">
              <label className="formLabel required">ประเภทงวดการเงิน</label>
              <div className="formRadioGroup">
                <label className="formRadioLabel">
                  <input
                    type="radio"
                    name="periodType"
                    value="1"
                    checked={periodType === '1'}
                    onChange={(e) => setPeriodType(e.target.value)}
                    disabled={submitting}
                  />
                  <span>เงินเดือน (Salary)</span>
                </label>
                <label className="formRadioLabel">
                  <input
                    type="radio"
                    name="periodType"
                    value="2"
                    checked={periodType === '2'}
                    onChange={(e) => setPeriodType(e.target.value)}
                    disabled={submitting}
                  />
                  <span>ค่าเวรล่วงเวลา / รายวัน / อื่นๆ (OT)</span>
                </label>
              </div>
            </div>

            <div className="formGroup">
              <label htmlFor="periodDate" className="formLabel required">วันที่จ่ายเงินในรอบ (ตามปฏิทินบัญชี)</label>
              <input
                id="periodDate"
                type="date"
                className="formInput"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="formGroup">
              <label htmlFor="periodNote" className="formLabel">หมายเหตุ / คำอธิบายงวดเงิน (ถ้ามี)</label>
              <input
                id="periodNote"
                type="text"
                className="formInput"
                value={periodNote}
                placeholder="เช่น เงินเดือนประจำเดือน มิถุนายน 2569"
                onChange={(e) => setPeriodNote(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="formGroup" style={{ marginTop: '24px' }}>
              <label className="formLabel required">ไฟล์ข้อมูลพนักงาน (.CSV)</label>
              <div
                className="dropzone"
                onClick={() => !submitting && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (!submitting && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
              >
                <Upload size={36} className="dropzoneIcon" />
                <p className="dropzoneText">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางตรงนี้</p>
                <span className="dropzoneSubtext">รองรับเฉพาะไฟล์ .CSV จากระบบการเงินเท่านั้น</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </div>

              {selectedFile && (
                <div className="fileSelectedArea">
                  <div className="fileInfo">
                    <FileText size={16} />
                    <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    className="btn btnSecondary"
                    style={{ padding: '6px' }}
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    disabled={submitting}
                  >
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btnPrimary"
              style={{ width: '100%', marginTop: '24px', padding: '12px', fontSize: '15px' }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>กำลังบันทึกงวดปฏิทินและนำเข้าไฟล์ข้อมูล...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>เริ่มอัปโหลดและนำเข้าข้อมูลระบบการเงิน</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Read-only History List */}
        <div className="uploadCard">
          <h2>ประวัติงวดนำเข้า 10 รายการล่าสุด</h2>
          <div className="periodTableContainer">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>กำลังดึงข้อมูล...</div>
            ) : periods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>ไม่มีข้อมูลประวัติงวดนำเข้า</div>
            ) : (
              <table className="periodTable">
                <thead>
                  <tr>
                    <th>ประเภท</th>
                    <th>งวดวันที่</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className={`statusBadge ${p.type === '1' ? 'statusSalary' : 'statusOt'}`}>
                          {p.type === '1' ? 'เงินเดือน' : 'ค่าเวร/OT'}
                        </span>
                      </td>
                      <td>{getThaiDateStr(p.datein)}</td>
                      <td>{p.notesalary || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div 
          className="modalOverlay" 
          onClick={() => setShowConfirmModal(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              setShowConfirmModal(false)
            }
          }}
        >
          <div 
            className="modalCard" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
          >
            <div className="modalHeader">
              <HelpCircle size={48} />
              <h3 id="modal-title">ยืนยันการนำเข้าข้อมูลการเงิน</h3>
            </div>
            <div className="modalBody">
              <p style={{ fontSize: '14.5px', color: '#475569', marginBottom: '18px', textAlign: 'center' }}>
                โปรดตรวจสอบความถูกต้องของข้อมูลก่อนเริ่มกระบวนการเขียนฐานข้อมูล
              </p>
              
              <div className="confirmDetailList">
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">ประเภทงวดการเงิน</span>
                  <span className="confirmDetailValue" style={{ color: periodType === '1' ? '#0369a1' : '#d97706' }}>
                    {periodType === '1' ? 'เงินเดือน (Salary)' : 'ค่าตอบแทน/เวรล่วงเวลา (OT)'}
                  </span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">วันที่จ่ายเงินในรอบ</span>
                  <span className="confirmDetailValue">{getThaiDateStr(periodDate)}</span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">หมายเหตุ / คำอธิบาย</span>
                  <span className="confirmDetailValue">{periodNote.trim() || '—'}</span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">ไฟล์เอกสารที่นำเข้า</span>
                  <span className="confirmDetailValue" style={{ color: '#0f766e' }}>
                    {selectedFile?.name} ({(selectedFile?.size || 0 / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>

              <div className="modalActions">
                <button 
                  type="button" 
                  className="btn btnSecondary" 
                  onClick={() => setShowConfirmModal(false)}
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  className="btn btnPrimary" 
                  onClick={executeUpload}
                >
                  ยืนยันนำเข้าข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
