'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Upload, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Loader2, 
  ArrowLeft, 
  HelpCircle,
  Calendar,
  X
} from 'lucide-react'
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
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // -------------------------------------------------------------
  // System 1: Record Pay Period (datein)
  // -------------------------------------------------------------
  const [periodType, setPeriodType] = useState('1') // '1' = เงินเดือน, '2' = OT
  const [periodDate, setPeriodDate] = useState('')
  const [periodNote, setPeriodNote] = useState('')
  const [isSavingPeriod, setIsSavingPeriod] = useState(false)

  // -------------------------------------------------------------
  // System 2: Upload CSV File
  // -------------------------------------------------------------
  const [uploadType, setUploadType] = useState<'salary' | 'ot'>('salary')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // -------------------------------------------------------------
  // System 3: Edit Period Modal
  // -------------------------------------------------------------
  const [editingPeriod, setEditingPeriod] = useState<ImportPeriod | null>(null)
  const [editType, setEditType] = useState('1')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [isUpdatingPeriod, setIsUpdatingPeriod] = useState(false)

  // -------------------------------------------------------------
  // System 4: Delete Period Confirmation Modal
  // -------------------------------------------------------------
  const [deletingPeriod, setDeletingPeriod] = useState<ImportPeriod | null>(null)
  const [isDeletingPeriod, setIsDeletingPeriod] = useState(false)

  // -------------------------------------------------------------
  // System 5: Batch Delete Latest Data (หัวข้อที่ 4)
  // -------------------------------------------------------------
  const [batchDeleteType, setBatchDeleteType] = useState<'salary' | 'ot'>('salary')
  const [latestBatch, setLatestBatch] = useState<{ tableName: string; date: string; count: number } | null>(null)
  const [isLoadingBatch, setIsLoadingBatch] = useState(false)
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  useEffect(() => {
    fetchPeriods()
  }, [])

  useEffect(() => {
    fetchLatestBatch(batchDeleteType)
  }, [batchDeleteType])

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusMsg({ type, message })
    setTimeout(() => {
      setStatusMsg(null)
    }, type === 'error' ? 10000 : 7000)
  }

  const fetchLatestBatch = async (type: 'salary' | 'ot') => {
    try {
      setIsLoadingBatch(true)
      const res = await fetch(`/api/salary/batch-delete?type=${type}`)
      const data = await res.json()
      if (data.success) {
        setLatestBatch(data.latestBatch || null)
      } else {
        setLatestBatch(null)
      }
    } catch (err) {
      console.error(err)
      setLatestBatch(null)
    } finally {
      setIsLoadingBatch(false)
    }
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

  // --- 1. Handle Submit Period (บันทึกวัน) ---
  const handlePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodDate) {
      showStatus('error', 'กรุณาระบุวันที่จ่ายเงินในรอบ')
      return
    }

    try {
      setIsSavingPeriod(true)
      setStatusMsg(null)

      const res = await fetch('/api/salary/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: periodType,
          datein: periodDate,
          notesalary: periodNote.trim() || null,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', 'บันทึกงวดวันจ่ายเงินในปฏิทินสำเร็จ!')
        setPeriodDate('')
        setPeriodNote('')
        fetchPeriods()
      } else {
        showStatus('error', data.error || 'บันทึกงวดวันจ่ายเงินล้มเหลว')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsSavingPeriod(false)
    }
  }

  // --- 2. Handle Submit File (อัปโหลดไฟล์ .CSV) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      showStatus('error', 'กรุณาเลือกไฟล์ข้อมูล (.CSV) ก่อนการอัปโหลด')
      return
    }

    try {
      setIsUploadingFile(true)
      setStatusMsg(null)

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('type', uploadType)

      const res = await fetch('/api/salary/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', `อัปโหลดไฟล์ข้อมูลสำเร็จ! (${data.message})`)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        showStatus('error', data.error || 'นำเข้าข้อมูลจากไฟล์ล้มเหลว')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายเซิร์ฟเวอร์')
    } finally {
      setIsUploadingFile(false)
    }
  }

  // --- 3. Handle Edit Period ---
  const openEditModal = (period: ImportPeriod) => {
    setEditingPeriod(period)
    setEditType(period.type ? String(period.type) : '1')
    
    // Format date string to YYYY-MM-DD directly without timezone shift
    let dStr = ''
    if (period.datein) {
      if (period.datein.includes('T')) {
        dStr = period.datein.split('T')[0]
      } else if (/^\d{4}-\d{2}-\d{2}/.test(period.datein)) {
        dStr = period.datein.substring(0, 10)
      } else {
        dStr = period.datein
      }
    }
    setEditDate(dStr)
    setEditNote(period.notesalary || '')
  }

  const handleUpdatePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPeriod || !editDate) {
      showStatus('error', 'กรุณาระบุวันที่ให้ครบถ้วน')
      return
    }

    try {
      setIsUpdatingPeriod(true)
      const res = await fetch('/api/salary/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPeriod.id,
          type: editType,
          datein: editDate,
          notesalary: editNote.trim() || null,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', 'แก้ไขรอบการจ่ายเงินเรียบร้อยแล้ว')
        setEditingPeriod(null)
        fetchPeriods()
      } else {
        showStatus('error', data.error || 'แก้ไขรอบการจ่ายเงินล้มเหลว')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsUpdatingPeriod(false)
    }
  }

  // --- 4. Handle Delete Period ---
  const executeDeletePeriod = async () => {
    if (!deletingPeriod) return

    try {
      setIsDeletingPeriod(true)
      const res = await fetch(`/api/salary/periods?id=${deletingPeriod.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', 'ลบงวดวันจ่ายเงินออกจากปฏิทินเรียบร้อยแล้ว')
        setDeletingPeriod(null)
        fetchPeriods()
      } else {
        showStatus('error', data.error || 'ลบรอบการจ่ายเงินล้มเหลว')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsDeletingPeriod(false)
    }
  }

  // --- 5. Handle Batch Delete (ลบชุดข้อมูลล่าสุด) ---
  const executeBatchDelete = async () => {
    if (!latestBatch) return

    try {
      setIsDeletingBatch(true)
      const res = await fetch('/api/salary/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: batchDeleteType,
          confirmedDate: latestBatch.date,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', data.message || 'ลบชุดข้อมูลล่าสุดเรียบร้อยแล้ว')
        setShowBatchDeleteModal(false)
        fetchLatestBatch(batchDeleteType)
      } else {
        showStatus('error', data.error || 'ลบชุดข้อมูลล้มเหลว')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsDeletingBatch(false)
    }
  }

  const getThaiDateStr = (dateinStr: string) => {
    if (!dateinStr) return ''
    try {
      // Parse YYYY-MM-DD directly without UTC conversion
      const rawDate = dateinStr.includes('T') ? dateinStr.split('T')[0] : dateinStr
      const parts = rawDate.split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10) + 543
        const monthIndex = parseInt(parts[1], 10) - 1
        const day = parseInt(parts[2], 10)
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
        return `${day} ${months[monthIndex] || ''} ${year}`
      }
      return dateinStr
    } catch {
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
        {/* Card 1: Record Pay Period (ระบบบันทึกวัน) */}
        <div className="uploadCard">
          <h2>
            <Calendar size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px', color: '#0d9488' }} />
            1. บันทึกงวดวันจ่ายเงิน (ปฏิทิน)
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '-6px', marginBottom: '16px' }}>
            สำหรับบันทึกวันที่เงินโอนเข้าบัญชี เพื่อแสดงในปฏิทินหน้า /salary
          </p>
          <form onSubmit={handlePeriodSubmit}>
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
                    disabled={isSavingPeriod}
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
                    disabled={isSavingPeriod}
                  />
                  <span>ค่าเวรล่วงเวลา / อื่นๆ (OT)</span>
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
                disabled={isSavingPeriod}
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
                disabled={isSavingPeriod}
              />
            </div>

            <button
              type="submit"
              className="btn btnPrimary"
              disabled={isSavingPeriod}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {isSavingPeriod ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  กำลังบันทึกงวดวันที่...
                </>
              ) : (
                'บันทึกงวดวันจ่ายเงิน'
              )}
            </button>
          </form>
        </div>

        {/* Card 2: Upload CSV File (ระบบอัปโหลดไฟล์) */}
        <div className="uploadCard">
          <h2>
            <Upload size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px', color: '#0369a1' }} />
            2. อัปโหลดไฟล์ข้อมูลสลิป (.CSV)
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '-6px', marginBottom: '16px' }}>
            นำเข้าไฟล์ข้อมูลเงินเดือนหรือค่าตอบแทนลงระบบฐานข้อมูล
          </p>
          <form onSubmit={handleFileUpload}>
            <div className="formGroup">
              <label className="formLabel required">นำเข้าลงตารางข้อมูล</label>
              <div className="formRadioGroup">
                <label className="formRadioLabel">
                  <input
                    type="radio"
                    name="uploadType"
                    value="salary"
                    checked={uploadType === 'salary'}
                    onChange={() => setUploadType('salary')}
                    disabled={isUploadingFile}
                  />
                  <span>ข้อมูลเงินเดือน (ตาราง salary)</span>
                </label>
                <label className="formRadioLabel">
                  <input
                    type="radio"
                    name="uploadType"
                    value="ot"
                    checked={uploadType === 'ot'}
                    onChange={() => setUploadType('ot')}
                    disabled={isUploadingFile}
                  />
                  <span>ข้อมูลค่าเวร / OT (ตาราง ot)</span>
                </label>
              </div>
            </div>

            <div className="formGroup">
              <label className="formLabel required">เลือกไฟล์ข้อมูล (.CSV)</label>
              <div
                className="dropzone"
                onClick={() => !isUploadingFile && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (!isUploadingFile && (e.key === 'Enter' || e.key === ' ')) {
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
                  onChange={handleFileChange}
                  accept=".csv"
                  style={{ display: 'none' }}
                  disabled={isUploadingFile}
                />
              </div>

              {selectedFile && (
                <div className="fileSelectedArea">
                  <div className="fileInfo">
                    <FileText size={20} />
                    <div>
                      <div>{selectedFile.name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btnSecondary"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    disabled={isUploadingFile}
                  >
                    ลบไฟล์
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btnPrimary"
              disabled={isUploadingFile || !selectedFile}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {isUploadingFile ? (
                <>
                  <Loader2 size={16} className="spinning" />
                  กำลังประมวลผลและนำเข้าไฟล์...
                </>
              ) : (
                'ยืนยันนำเข้าข้อมูลจากไฟล์'
              )}
            </button>
          </form>
        </div>

        {/* Card 3: Period History Table (เต็มความกว้าง) */}
        <div className="uploadCard uploadSalaryFullWidth">
          <h2>3. ประวัติงวดนำเข้า 10 รายการล่าสุด</h2>
          <div className="periodTableContainer">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>กำลังดึงข้อมูล...</div>
            ) : periods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>ไม่มีข้อมูลประวัติงวดนำเข้า</div>
            ) : (
              <table className="periodTable">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>ประเภท</th>
                    <th style={{ width: '150px' }}>งวดวันที่</th>
                    <th>หมายเหตุ</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>จัดการ</th>
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
                      <td>
                        <div className="actionButtonGroup" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btnActionIcon btnActionEdit"
                            onClick={() => openEditModal(p)}
                            title="แก้ไขงวดวันที่"
                          >
                            <Edit3 size={14} />
                            <span>แก้ไข</span>
                          </button>
                          <button
                            type="button"
                            className="btnActionIcon btnActionDelete"
                            onClick={() => setDeletingPeriod(p)}
                            title="ลบงวดวันที่"
                          >
                            <Trash2 size={14} />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Card 4: Delete Batch Data (ระบบลบชุดข้อมูลเงินเดือน/OT) */}
        <div className="uploadCard uploadSalaryFullWidth batchDeleteCard">
          <h2>
            <Trash2 size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px', color: '#ef4444' }} />
            4. ลบชุดข้อมูลเงินเดือน / OT
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '-6px', marginBottom: '16px' }}>
            สำหรับลบชุดข้อมูลที่นำเข้าผิดพลาด โดยระบบจะอนุญาตให้ลบได้เฉพาะ <strong>1 ชุดข้อมูลล่าสุด</strong> ของตารางที่เลือกเท่านั้น
          </p>

          <div className="formGroup" style={{ maxWidth: '500px' }}>
            <label className="formLabel required">เลือกตารางข้อมูลที่ต้องการตรวจสอบและลบ</label>
            <div className="formRadioGroup">
              <label className="formRadioLabel">
                <input
                  type="radio"
                  name="batchDeleteType"
                  value="salary"
                  checked={batchDeleteType === 'salary'}
                  onChange={() => setBatchDeleteType('salary')}
                  disabled={isLoadingBatch || isDeletingBatch}
                />
                <span>ข้อมูลเงินเดือน (ตาราง salary)</span>
              </label>
              <label className="formRadioLabel">
                <input
                  type="radio"
                  name="batchDeleteType"
                  value="ot"
                  checked={batchDeleteType === 'ot'}
                  onChange={() => setBatchDeleteType('ot')}
                  disabled={isLoadingBatch || isDeletingBatch}
                />
                <span>ข้อมูลค่าเวร / OT (ตาราง ot)</span>
              </label>
            </div>
          </div>

          {isLoadingBatch ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={20} className="spinning" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              กำลังตรวจสอบชุดข้อมูลล่าสุดในตาราง...
            </div>
          ) : latestBatch ? (
            <div>
              <div className="batchInfoBox">
                <div className="batchInfoRow">
                  <span className="batchInfoLabel">ตารางข้อมูล:</span>
                  <span className="batchInfoValue">
                    <span className={`statusBadge ${batchDeleteType === 'salary' ? 'statusSalary' : 'statusOt'}`}>
                      {batchDeleteType === 'salary' ? 'ตาราง salary (เงินเดือน)' : 'ตาราง ot (ค่าเวร/OT)'}
                    </span>
                  </span>
                </div>
                <div className="batchInfoRow">
                  <span className="batchInfoLabel">ชุดข้อมูลงวดวันที่ล่าสุด (c1):</span>
                  <span className="batchInfoValue" style={{ color: '#0f766e', fontSize: '15px' }}>
                    {getThaiDateStr(latestBatch.date)} ({latestBatch.date})
                  </span>
                </div>
                <div className="batchInfoRow">
                  <span className="batchInfoLabel">จำนวนรายการทั้งหมดในชุดนี้:</span>
                  <span className="batchInfoValue" style={{ color: '#dc2626', fontSize: '15px' }}>
                    {latestBatch.count.toLocaleString()} รายการ
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  * ตรวจสอบความถูกต้องก่อนกดลบ การลบจะมีผลกับข้อมูลในตาราง {batchDeleteType} ทันที
                </p>
                <button
                  type="button"
                  className="btn btnDanger"
                  onClick={() => setShowBatchDeleteModal(true)}
                  disabled={isDeletingBatch}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={16} />
                  ลบชุดข้อมูลล่าสุดนี้ ({latestBatch.count.toLocaleString()} รายการ)
                </button>
              </div>
            </div>
          ) : (
            <div className="batchEmptyBox">
              ไม่พบชุดข้อมูลล่าสุดในตาราง {batchDeleteType === 'salary' ? 'salary (เงินเดือน)' : 'ot (ค่าเวร/OT)'} หรือไม่มีข้อมูลที่สามารถลบได้
            </div>
          )}
        </div>
      </div>

      {/* Edit Period Modal */}
      {editingPeriod && (
        <div 
          className="modalOverlay" 
          onClick={() => !isUpdatingPeriod && setEditingPeriod(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (!isUpdatingPeriod && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
              setEditingPeriod(null)
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
            <div className="modalHeader" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
              <Edit3 size={36} color="#ffffff" />
              <h3 id="modal-title">แก้ไขงวดวันจ่ายเงิน</h3>
            </div>
            <form onSubmit={handleUpdatePeriod} className="modalBody">
              <div className="formGroup">
                <label className="formLabel required">ประเภทงวดการเงิน</label>
                <div className="formRadioGroup">
                  <label className="formRadioLabel">
                    <input
                      type="radio"
                      name="editType"
                      value="1"
                      checked={editType === '1'}
                      onChange={(e) => setEditType(e.target.value)}
                      disabled={isUpdatingPeriod}
                    />
                    <span>เงินเดือน (Salary)</span>
                  </label>
                  <label className="formRadioLabel">
                    <input
                      type="radio"
                      name="editType"
                      value="2"
                      checked={editType === '2'}
                      onChange={(e) => setEditType(e.target.value)}
                      disabled={isUpdatingPeriod}
                    />
                    <span>ค่าเวรล่วงเวลา / อื่นๆ (OT)</span>
                  </label>
                </div>
              </div>

              <div className="formGroup">
                <label htmlFor="editDate" className="formLabel required">วันที่จ่ายเงินในรอบ (ตามปฏิทินบัญชี)</label>
                <input
                  id="editDate"
                  type="date"
                  className="formInput"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  disabled={isUpdatingPeriod}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="editNote" className="formLabel">หมายเหตุ / คำอธิบายงวดเงิน</label>
                <input
                  id="editNote"
                  type="text"
                  className="formInput"
                  value={editNote}
                  placeholder="เช่น เงินเดือนประจำเดือน มิถุนายน 2569"
                  onChange={(e) => setEditNote(e.target.value)}
                  disabled={isUpdatingPeriod}
                />
              </div>

              <div className="modalActions" style={{ marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btnSecondary" 
                  onClick={() => setEditingPeriod(null)}
                  disabled={isUpdatingPeriod}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="btn btnPrimary" 
                  disabled={isUpdatingPeriod}
                >
                  {isUpdatingPeriod ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Period Confirmation Modal */}
      {deletingPeriod && (
        <div 
          className="modalOverlay" 
          onClick={() => !isDeletingPeriod && setDeletingPeriod(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (!isDeletingPeriod && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
              setDeletingPeriod(null)
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
            <div className="modalHeader" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <AlertTriangle size={36} color="#ffffff" />
              <h3 id="modal-title">ยืนยันการลบงวดวันจ่ายเงิน</h3>
            </div>
            <div className="modalBody">
              <p style={{ fontSize: '14.5px', color: '#475569', marginBottom: '16px', textAlign: 'center' }}>
                คุณต้องการลบงวดวันจ่ายเงินนี้ออกจากปฏิทินหรือไม่?
              </p>
              
              <div className="confirmDetailList" style={{ marginBottom: '16px' }}>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">ประเภท:</span>
                  <span className="confirmDetailValue" style={{ color: deletingPeriod.type === '1' ? '#0369a1' : '#d97706' }}>
                    {deletingPeriod.type === '1' ? 'เงินเดือน (Salary)' : 'ค่าตอบแทน/เวรล่วงเวลา (OT)'}
                  </span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">งวดวันที่:</span>
                  <span className="confirmDetailValue">{getThaiDateStr(deletingPeriod.datein)}</span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">หมายเหตุ:</span>
                  <span className="confirmDetailValue">{deletingPeriod.notesalary || '—'}</span>
                </div>
              </div>

              <p style={{ fontSize: '12.5px', color: '#64748b', textAlign: 'center', marginBottom: '20px' }}>
                * การลบนี้จะลบเฉพาะรายการในปฏิทินหน้า /salary เท่านั้น ไม่กระทบกับข้อมูลไฟล์สลิปเงินเดือนที่เคยนำเข้า
              </p>

              <div className="modalActions">
                <button 
                  type="button" 
                  className="btn btnSecondary" 
                  onClick={() => setDeletingPeriod(null)}
                  disabled={isDeletingPeriod}
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  className="btn btnDanger" 
                  onClick={executeDeletePeriod}
                  disabled={isDeletingPeriod}
                >
                  {isDeletingPeriod ? 'กำลังลบ...' : 'ยืนยันลบงวดนี้'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && latestBatch && (
        <div 
          className="modalOverlay" 
          onClick={() => !isDeletingBatch && setShowBatchDeleteModal(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (!isDeletingBatch && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
              setShowBatchDeleteModal(false)
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
            <div className="modalHeader" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
              <AlertTriangle size={36} color="#ffffff" />
              <h3 id="modal-title">ยืนยันการลบชุดข้อมูลล่าสุด</h3>
            </div>
            <div className="modalBody">
              <p style={{ fontSize: '14.5px', color: '#475569', marginBottom: '16px', textAlign: 'center' }}>
                คุณแน่ใจหรือไม่ว่าต้องการลบชุดข้อมูลนี้ออกจากตาราง <strong>{batchDeleteType}</strong>?
              </p>
              
              <div className="confirmDetailList" style={{ marginBottom: '16px' }}>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">ประเภทตาราง:</span>
                  <span className="confirmDetailValue" style={{ color: batchDeleteType === 'salary' ? '#0369a1' : '#d97706' }}>
                    {batchDeleteType === 'salary' ? 'ข้อมูลเงินเดือน (salary)' : 'ข้อมูลค่าเวร / OT (ot)'}
                  </span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">ชุดงวดวันที่ (c1):</span>
                  <span className="confirmDetailValue">{getThaiDateStr(latestBatch.date)} ({latestBatch.date})</span>
                </div>
                <div className="confirmDetailItem">
                  <span className="confirmDetailLabel">จำนวนรายการที่จะถูกลบ:</span>
                  <span className="confirmDetailValue" style={{ color: '#dc2626' }}>{latestBatch.count.toLocaleString()} รายการ</span>
                </div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                <p style={{ fontSize: '12.5px', color: '#991b1b', margin: 0, textAlign: 'center', lineHeight: '1.5' }}>
                  ⚠️ <strong>คำเตือน:</strong> การลบข้อมูลนี้จะลบแถวข้อมูลทั้งหมดที่มีงวดวันที่ดังกล่าวออกจากระบบฐานข้อมูลทันที และไม่สามารถกู้คืนได้
                </p>
              </div>

              <div className="modalActions">
                <button 
                  type="button" 
                  className="btn btnSecondary" 
                  onClick={() => setShowBatchDeleteModal(false)}
                  disabled={isDeletingBatch}
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  className="btn btnDanger" 
                  onClick={executeBatchDelete}
                  disabled={isDeletingBatch}
                >
                  {isDeletingBatch ? (
                    <>
                      <Loader2 size={16} className="spinning" />
                      กำลังลบชุดข้อมูล...
                    </>
                  ) : (
                    `ยืนยันลบข้อมูล (${latestBatch.count.toLocaleString()} รายการ)`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

