'use client'

import React, { useState, useMemo } from 'react'
import {
  FileSpreadsheet,
  Search,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
  CalendarCheck2,
} from 'lucide-react'
import type { SeamlessImportedFileDetail } from '@/lib/clinical/rcmSeamlessImportService'
import { formatThaiDate } from '@/lib/formatters'

interface ImportedFilesModalProps {
  isOpen: boolean
  files: SeamlessImportedFileDetail[]
  isLoading: boolean
  isDeleting: boolean
  canImport: boolean
  onClose: () => void
  onFilterByFile: (fileName: string) => void
  onDeleteSingleFile: (fileName: string) => Promise<void>
  onDeleteMultipleFiles: (fileNames: string[]) => Promise<void>
}

export function ImportedFilesModal({
  isOpen,
  files,
  isLoading,
  isDeleting,
  canImport,
  onClose,
  onFilterByFile,
  onDeleteSingleFile,
  onDeleteMultipleFiles,
}: ImportedFilesModalProps) {
  const [search, setSearch] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => f.fileName.toLowerCase().includes(q))
  }, [files, search])

  if (!isOpen) return null

  const toggleSelect = (fileName: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileName)) next.delete(fileName)
      else next.add(fileName)
      return next
    })
  }

  const allVisibleSelected =
    filteredFiles.length > 0 && filteredFiles.every((f) => selectedFiles.has(f.fileName))

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedFiles((prev) => {
        const next = new Set(prev)
        filteredFiles.forEach((f) => next.delete(f.fileName))
        return next
      })
    } else {
      setSelectedFiles((prev) => {
        const next = new Set(prev)
        filteredFiles.forEach((f) => next.add(f.fileName))
        return next
      })
    }
  }

  const handleBulkDelete = async () => {
    const list = Array.from(selectedFiles)
    if (list.length === 0) return
    await onDeleteMultipleFiles(list)
    setSelectedFiles(new Set())
  }

  return (
    <div
      className="seamless-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seamless-files-modal-title"
    >
      <div className="seamless-detail-modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
        <div className="seamless-detail-modal-head">
          <div>
            <h3 id="seamless-files-modal-title" style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
              จัดการไฟล์ Seamless ที่นำเข้าแล้ว ({files.length.toLocaleString('th-TH')} ไฟล์)
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
              เทียบเท่า FoxPro cmdDel / cmdTable.RightClick — คลิกชื่อไฟล์เพื่อกรองตาราง หรือเลือกหลายไฟล์เพื่อลบ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="seamless-modal-close-btn"
            aria-label="ปิดหน้าต่างจัดการไฟล์"
          >
            <X size={18} />
          </button>
        </div>

        <div className="seamless-detail-modal-body" style={{ gap: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="seamless-search-wrap" style={{ flex: '1 1 260px' }}>
              <Search size={15} className="seamless-search-icon" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อไฟล์..."
                className="seamless-search-input"
              />
            </div>

            {canImport && selectedFiles.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="seamless-btn danger"
              >
                <Trash2 size={14} />
                <span>
                  {isDeleting
                    ? 'กำลังลบ...'
                    : `ลบที่เลือก (${selectedFiles.size} ไฟล์)`}
                </span>
              </button>
            )}
          </div>

          <div className="seamless-table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="seamless-table">
              <thead>
                <tr>
                  {canImport && (
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={toggleSelectAllVisible}
                        className="seamless-icon-action-btn"
                        aria-label="เลือกทั้งหมด"
                      >
                        {allVisibleSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    </th>
                  )}
                  <th>ชื่อไฟล์ (FileName)</th>
                  <th style={{ textAlign: 'right' }}>จำนวนแถว</th>
                  <th>ช่วงวันที่รับบริการ</th>
                  <th style={{ textAlign: 'right' }}>ยอดชดเชยรวม</th>
                  <th style={{ textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && files.length === 0 ? (
                  <tr>
                    <td colSpan={canImport ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      กำลังโหลดรายการไฟล์...
                    </td>
                  </tr>
                ) : filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={canImport ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      ไม่พบไฟล์ที่นำเข้าแล้ว
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((f) => {
                    const checked = selectedFiles.has(f.fileName)
                    return (
                      <tr key={f.fileName}>
                        {canImport && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => toggleSelect(f.fileName)}
                              className="seamless-icon-action-btn"
                              aria-label={`เลือกไฟล์ ${f.fileName}`}
                            >
                              {checked ? <CheckSquare size={15} style={{ color: '#059669' }} /> : <Square size={15} />}
                            </button>
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                            <FileSpreadsheet size={14} style={{ color: '#059669', flexShrink: 0 }} />
                            <span>{f.fileName}</span>
                          </div>
                          {(f.otherHospCount > 0 || f.missingPayDateCount > 0) && (
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                              {f.otherHospCount > 0 && (
                                <span className="seamless-mini-badge amber">
                                  ต่าง รพ. {f.otherHospCount}
                                </span>
                              )}
                              {f.missingPayDateCount > 0 && (
                                <span className="seamless-mini-badge rose">
                                  รอวันโอน {f.missingPayDateCount}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>
                          {f.rowCount.toLocaleString('th-TH')}
                        </td>
                        <td className="tabular-nums" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {f.minDate ? `${formatThaiDate(f.minDate)} – ${formatThaiDate(f.maxDate)}` : '-'}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                          ฿{f.totalCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                onFilterByFile(f.fileName)
                                onClose()
                              }}
                              className="seamless-btn secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              title="ดูรายการของไฟล์นี้ในตาราง Live DB"
                            >
                              <Filter size={12} />
                              <span>กรอง</span>
                            </button>
                            {canImport && (
                              <button
                                type="button"
                                onClick={() => onDeleteSingleFile(f.fileName)}
                                disabled={isDeleting}
                                className="seamless-chip-danger-btn"
                                title={`ลบข้อมูลทั้งหมดของไฟล์ ${f.fileName}`}
                              >
                                <Trash2 size={12} />
                                <span>ลบ</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  mode: 'other_hospitals' | 'all' | null
  otherHospCount: number
  totalRows: number
  myHospCode: string
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({
  mode,
  otherHospCount,
  totalRows,
  myHospCode,
  isSubmitting,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('')

  if (!mode) return null

  const isDeleteAll = mode === 'all'
  const canConfirm = !isDeleteAll || confirmText.trim().toUpperCase() === 'DELETE ALL'

  return (
    <div
      className="seamless-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seamless-delete-confirm-title"
    >
      <div className="seamless-error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="seamless-modal-head">
          <div className="seamless-modal-head-left">
            <div className="seamless-modal-icon-badge">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="seamless-delete-confirm-title" className="seamless-modal-title">
                {isDeleteAll
                  ? 'ยืนยันการล้างข้อมูล Seamless ทั้งหมด (CalDelete)'
                  : `ยืนยันลบข้อมูลหน่วยบริการอื่น (HCode ≠ ${myHospCode})`}
              </h3>
              <p className="seamless-modal-subtitle">
                การลบข้อมูลจาก rcmdb.seamless ไม่สามารถย้อนกลับได้
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="seamless-modal-close-btn" aria-label="ปิดหน้าต่าง">
            <X size={18} />
          </button>
        </div>

        <div className="seamless-modal-body">
          {isDeleteAll ? (
            <>
              <p className="seamless-modal-error-text">
                คำสั่งนี้จะลบข้อมูลทั้งหมดในตาราง <code>rcmdb.seamless</code> จำนวนประมาณ{' '}
                <strong>{totalRows.toLocaleString('th-TH')}</strong> แถว (สำหรับผู้ดูแลระบบ / manage_rcm_import เท่านั้น)
              </p>
              <div>
                <label
                  htmlFor="seamless-delete-all-input"
                  style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem', color: '#334155' }}
                >
                  พิมพ์ <code>DELETE ALL</code> เพื่อยืนยันการล้างข้อมูลทั้งหมด
                </label>
                <input
                  id="seamless-delete-all-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE ALL"
                  className="seamless-search-input"
                  style={{ paddingLeft: '0.75rem' }}
                />
              </div>
            </>
          ) : (
            <p className="seamless-modal-error-text">
              ตรวจพบรายการที่รหัสหน่วยบริการ (HCode) ไม่ใช่ของ รพ.เถิน ({myHospCode}) จำนวน{' '}
              <strong>{otherHospCount.toLocaleString('th-TH')}</strong> แถว — ต้องการลบแถวเหล่านี้ออกจากฐานข้อมูลใช่หรือไม่?
              (เทียบเท่าคำสั่ง FoxPro: <code>delete from seamless where hcode&lt;&gt;myhospcode</code>)
            </p>
          )}
        </div>

        <div className="seamless-modal-foot">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="seamless-btn secondary">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isSubmitting}
            className="seamless-btn danger"
          >
            <Trash2 size={14} />
            <span>{isSubmitting ? 'กำลังลบ...' : 'ยืนยันการลบข้อมูล'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

interface SyncPaymentModalProps {
  isOpen: boolean
  missingPayDateCount: number
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (force: boolean) => Promise<void>
}

export function SyncPaymentModal({
  isOpen,
  missingPayDateCount,
  isSubmitting,
  onClose,
  onConfirm,
}: SyncPaymentModalProps) {
  const [forceOverwrite, setForceOverwrite] = useState(false)

  if (!isOpen) return null

  return (
    <div
      className="seamless-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seamless-sync-pay-title"
    >
      <div className="seamless-error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="seamless-modal-head" style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
          <div className="seamless-modal-head-left">
            <div
              className="seamless-modal-icon-badge"
              style={{ backgroundColor: '#d1fae5', color: '#047857' }}
            >
              <CalendarCheck2 size={20} />
            </div>
            <div>
              <h3 id="seamless-sync-pay-title" className="seamless-modal-title" style={{ color: '#065f46' }}>
                ซิงค์วันที่โอนเงิน & ปีงบประมาณ (FoxPro AddPay)
              </h3>
              <p className="seamless-modal-subtitle" style={{ color: '#047857' }}>
                เชื่อมโยง PayNo กับตาราง nhso_budget และคำนวณ YYMM / YearBudget ให้ครบทุกแถว
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="seamless-modal-close-btn" aria-label="ปิดหน้าต่าง">
            <X size={18} />
          </button>
        </div>

        <div className="seamless-modal-body">
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e293b', lineHeight: 1.55 }}>
            ระบบจะค้นหาวันที่โอน (<code>PayDate</code>) และรหัสผังบัญชี (<code>CodeAccount</code>) จากตาราง{' '}
            <code>rcmdb.nhso_budget</code> โดยจับคู่จาก <code>PayNo</code> พร้อมเติมค่า{' '}
            <code>YYMM</code>, <code>YearBudget</code>, <code>YYMM_Pay</code> และ <code>YearBudget_Pay</code>{' '}
            (ปัจจุบันมีรายการที่ยังไม่มีวันโอน <strong>{missingPayDateCount.toLocaleString('th-TH')}</strong> แถว)
          </p>

          <label className="seamless-checkbox-label">
            <input
              type="checkbox"
              checked={forceOverwrite}
              onChange={(e) => setForceOverwrite(e.target.checked)}
              disabled={isSubmitting}
            />
            <div>
              <span className="seamless-checkbox-title">เขียนทับวันที่โอนที่มีอยู่แล้ว (Force Sync)</span>
              <span className="seamless-checkbox-desc">
                ค่าเริ่มต้นจะอัปเดตเฉพาะแถวที่ PayDate ยังว่าง หากติ๊กเลือกจะอัปเดตใหม่ทั้งหมดที่จับคู่ nhso_budget ได้
              </span>
            </div>
          </label>
        </div>

        <div className="seamless-modal-foot">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="seamless-btn secondary">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(forceOverwrite)}
            disabled={isSubmitting}
            className="seamless-btn primary"
          >
            <RefreshCw size={14} className={isSubmitting ? 'seamless-spin' : ''} />
            <span>{isSubmitting ? 'กำลังซิงค์ข้อมูล...' : 'เริ่มซิงค์วันที่โอนเงิน'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
