'use client'

import React from 'react'
import { AlertCircle, CheckCircle2, RefreshCw, Search, X } from 'lucide-react'
import {
  PalliativeRegistryItem,
  PalliativeSyncSummary,
  VisitRepItem,
} from '@/lib/clinical/palliativeRegistryService'
import { formatThaiDate, formatThaiBuddhistDateTime } from '@/lib/formatters'
import { RepAmountBadge } from './PalliativeRegistryCells'

export interface PalliativeAddFormState {
  hn: string
  patientName: string
  address: string
  phone: string
  icd10Principal: string
  icd10Palliative: string
  projectCode: string
  registrationStatus: string
  deathDate: string
}

export interface PalliativeEditVisitRow {
  visitNo: number
  visitDate: string
  rep?: string | null
  compensated?: number
  reason?: string | null
  repItems?: VisitRepItem[]
}

export interface PalliativeRegistryModalsProps {
  items: PalliativeRegistryItem[]
  // Modal 1: Add
  isAddModalOpen: boolean
  setIsAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  addForm: PalliativeAddFormState
  setAddForm: React.Dispatch<React.SetStateAction<PalliativeAddFormState>>
  addError: string | null
  isDuplicate: boolean
  setIsDuplicate: React.Dispatch<React.SetStateAction<boolean>>
  lookupFeedback: { type: 'success' | 'warning' | 'error'; message: string } | null
  setLookupFeedback: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'warning' | 'error'; message: string } | null>
  >
  isLookingUpHn: boolean
  isSubmittingAdd: boolean
  handleLookupHn: (hnToSearch?: string) => void
  handleAddSubmit: (e: React.FormEvent) => void
  // Modal 2: Edit
  editingItem: PalliativeRegistryItem | null
  setEditingItem: React.Dispatch<React.SetStateAction<PalliativeRegistryItem | null>>
  editForm: Partial<PalliativeRegistryItem>
  setEditForm: React.Dispatch<React.SetStateAction<Partial<PalliativeRegistryItem>>>
  editVisits: PalliativeEditVisitRow[]
  editError: string | null
  isSubmittingEdit: boolean
  handleEditSubmit: (e: React.FormEvent) => void
  handleVisitDateChange: (visitNo: number, value: string) => void
  handleAddVisit: () => void
  handleRemoveVisit: (visitNo: number) => void
  // Modal 3: Delete
  deletingItem: PalliativeRegistryItem | null
  setDeletingItem: React.Dispatch<React.SetStateAction<PalliativeRegistryItem | null>>
  isDeleting: boolean
  handleDeleteConfirm: () => void
  // Modal 4: Sync Result
  isSyncModalOpen: boolean
  setIsSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  syncModalError: string | null
  syncModalResult: PalliativeSyncSummary | null
}

export function PalliativeRegistryModals({
  items,
  isAddModalOpen,
  setIsAddModalOpen,
  addForm,
  setAddForm,
  addError,
  isDuplicate,
  setIsDuplicate,
  lookupFeedback,
  setLookupFeedback,
  isLookingUpHn,
  isSubmittingAdd,
  handleLookupHn,
  handleAddSubmit,
  editingItem,
  setEditingItem,
  editForm,
  setEditForm,
  editVisits,
  editError,
  isSubmittingEdit,
  handleEditSubmit,
  handleVisitDateChange,
  handleAddVisit,
  handleRemoveVisit,
  deletingItem,
  setDeletingItem,
  isDeleting,
  handleDeleteConfirm,
  isSyncModalOpen,
  setIsSyncModalOpen,
  syncModalError,
  syncModalResult,
}: PalliativeRegistryModalsProps) {
  return (
    <>
      {/* Modal 1: เพิ่มทะเบียนผู้ป่วย (Initial Intake Fields) */}
      {isAddModalOpen && (
        <div className="pcr-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="pcr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pcr-modal-header">
              <h2 className="pcr-modal-title">+ เพิ่มทะเบียนผู้ป่วย Palliative Care</h2>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="pcr-modal-form">
              <div className="pcr-modal-body">
                {addError && (
                  <div
                    style={{
                      background: 'var(--pc-rose-bg)',
                      border: '1px solid var(--pc-rose-border)',
                      color: 'var(--pc-rose-text)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    {addError}
                  </div>
                )}

                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">ข้อมูลแรกรับผู้ป่วย (ดึงข้อมูลอัตโนมัติจาก HOSxP)</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label pcr-form-label-required">HN หรือ AN (หมายเลขผู้ป่วย / เลข admit)</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="pcr-input"
                          placeholder="เช่น 000206"
                          required
                          value={addForm.hn}
                          onChange={(e) => {
                            const val = e.target.value
                            const norm = (h: string) => (/^\d+$/.test(h.trim()) ? h.trim().replace(/^0+/, '') : h.trim())
                            const valNorm = norm(val)
                            const alreadyInTable = Boolean(
                              valNorm &&
                                items.some(
                                  (it) => norm(it.hn) === valNorm || (it.an && norm(it.an) === valNorm)
                                )
                            )
                            if (alreadyInTable) {
                              setIsDuplicate(true)
                              setLookupFeedback({
                                type: 'error',
                                message: `⚠️ หมายเลขนี้มีอยู่ในทะเบียนแล้ว ห้ามลงข้อมูลซ้ำ`,
                              })
                            } else if (isDuplicate) {
                              setIsDuplicate(false)
                              setLookupFeedback(null)
                            }
                            setAddForm({ ...addForm, hn: val })
                          }}
                          onBlur={() => {
                            if (addForm.hn.trim() && !addForm.patientName.trim()) {
                              handleLookupHn(addForm.hn)
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="pcr-btn pcr-btn-secondary"
                          style={{ minHeight: 40, whiteSpace: 'nowrap', padding: '0 12px' }}
                          onClick={() => handleLookupHn(addForm.hn)}
                          disabled={isLookingUpHn || !addForm.hn.trim()}
                          title="ดึงชื่อ ที่อยู่ เบอร์โทร และสถานะคลินิก Palliative Care จาก HOSxP"
                        >
                          {isLookingUpHn ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Search size={14} />
                              ดึงข้อมูล
                            </>
                          )}
                        </button>
                      </div>

                      {lookupFeedback && (
                        <div
                          className={
                            lookupFeedback.type === 'success'
                              ? 'pcr-tag pcr-tag-teal'
                              : lookupFeedback.type === 'warning'
                              ? 'pcr-tag pcr-tag-amber'
                              : 'pcr-tag pcr-tag-rose'
                          }
                          style={{ marginTop: 4, padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4 }}
                        >
                          {lookupFeedback.message}
                        </div>
                      )}
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label pcr-form-label-required">ชื่อ-สกุลผู้ป่วย</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก HOSxP หรือกรอกเอง"
                        required
                        value={addForm.patientName}
                        onChange={(e) => setAddForm({ ...addForm, patientName: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ที่อยู่</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก HOSxP หรือกรอกเอง เช่น 205/1 ม.4 ต.เถินบุรี อ.เถิน"
                        value={addForm.address}
                        onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">เบอร์โทรผู้ป่วย / ญาติ</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก HOSxP หรือกรอกเอง เช่น 065-2488015"
                        value={addForm.phone}
                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      />
                    </div>

                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ICD10 รหัสโรคหลัก (ดึงอัตโนมัติจาก AN ในคลินิก Palliative Care)</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="ดึงจาก AN ใน HOSxP อัตโนมัติ เช่น C541"
                        value={addForm.icd10Principal}
                        onChange={(e) => setAddForm({ ...addForm, icd10Principal: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--pc-teal-bg)',
                    border: '1px solid var(--pc-teal-border)',
                    color: 'var(--pc-teal-text)',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    fontSize: '0.8125rem',
                  }}
                >
                  หมายเหตุ: สถานะขึ้นทะเบียนจะถูกตรวจสอบกับ <strong>คลินิก Palliative Care</strong> ใน HOSxP อัตโนมัติ และข้อมูลการเยี่ยมบ้านครั้งที่ 1-6 พร้อมผลชดเชย Rep จะแสดงในตารางเมื่อบันทึกวันเยี่ยม
                </div>
              </div>

              <div className="pcr-modal-footer">
                <button
                  type="button"
                  className="pcr-btn pcr-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="pcr-btn pcr-btn-primary"
                  disabled={isSubmittingAdd || isDuplicate || !addForm.hn.trim()}
                >
                  {isSubmittingAdd
                    ? 'กำลังบันทึก...'
                    : isDuplicate
                    ? 'มีข้อมูลในทะเบียนแล้ว (ห้ามลงซ้ำ)'
                    : 'บันทึกขึ้นทะเบียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: แก้ไข / บันทึกการเยี่ยมบ้านและหมายเหตุ (Full Edit) */}
      {editingItem && (
        <div className="pcr-modal-backdrop" onClick={() => setEditingItem(null)}>
          <div
            className="pcr-modal-card"
            style={{ maxWidth: 960 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pcr-modal-header">
              <div>
                <h2 className="pcr-modal-title">
                  บันทึกข้อมูลและประวัติการเยี่ยม: {editingItem.patientName}
                </h2>
                <div className="pcr-modal-patient-subtitle">
                  <span className="pcr-modal-patient-pill">HN: {editingItem.hn}</span>
                  {editingItem.registeredDate ? (
                    <span className="pcr-modal-patient-pill" style={{ color: 'var(--pc-teal-text)' }}>
                      ขึ้นทะเบียน Palliative Care เมื่อ {formatThaiDate(editingItem.registeredDate)}
                    </span>
                  ) : (
                    <span className="pcr-modal-patient-pill" style={{ color: 'var(--pc-amber-text)' }}>
                      ยังไม่ขึ้นทะเบียน Palliative Care
                    </span>
                  )}
                  {editingItem.deathDate && (
                    <span className="pcr-modal-patient-pill" style={{ color: 'var(--pc-rose-text)', borderColor: 'var(--pc-rose-border)' }}>
                      เสียชีวิตเมื่อ {formatThaiDate(editingItem.deathDate)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setEditingItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="pcr-modal-form">
              <div className="pcr-modal-body">
                {editError && (
                  <div
                    style={{
                      background: 'var(--pc-rose-bg)',
                      border: '1px solid var(--pc-rose-border)',
                      color: 'var(--pc-rose-text)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    {editError}
                  </div>
                )}

                {/* Section A: Basic info */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">1. ข้อมูลผู้ป่วยและการขึ้นทะเบียนคลินิก Palliative Care</div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">HN (ข้อมูลคงที่)</label>
                      <input
                        type="text"
                        className="pcr-input pcr-input-readonly"
                        value={editForm.hn || ''}
                        readOnly
                        disabled
                        title="HN เป็นข้อมูลคงที่ ไม่สามารถแก้ไขได้"
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ชื่อ-สกุลผู้ป่วย (ข้อมูลคงที่)</label>
                      <input
                        type="text"
                        className="pcr-input pcr-input-readonly"
                        value={editForm.patientName || ''}
                        readOnly
                        disabled
                        title="ชื่อ-สกุลผู้ป่วย เป็นข้อมูลคงที่ ไม่สามารถแก้ไขได้"
                      />
                    </div>
                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ที่อยู่</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">เบอร์โทรผู้ป่วย/ญาติ</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น 0812345678"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">ICD-10 รหัสโรคหลัก</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.icd10Principal || ''}
                        onChange={(e) => setEditForm({ ...editForm, icd10Principal: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">สถานะคลินิก Palliative Care ใน HOSxP</label>
                      <div style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
                        {editingItem.registeredDate ? (
                          <span className="pcr-tag pcr-tag-teal">
                            ขึ้นทะเบียนแล้ว (วันที่: {formatThaiDate(editingItem.registeredDate)})
                          </span>
                        ) : (
                          <span className="pcr-tag pcr-tag-amber">
                            ยังไม่ได้ดำเนินการ / รอ
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">Project code Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.projectCode || ''}
                        onChange={(e) => setEditForm({ ...editForm, projectCode: e.target.value })}
                      />
                    </div>
                    <div className="pcr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="pcr-form-label">ICD-10 รหัส Palliative</label>
                      <input
                        type="text"
                        className="pcr-input"
                        value={editForm.icd10Palliative || ''}
                        onChange={(e) => setEditForm({ ...editForm, icd10Palliative: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Visits */}
                <div className="pcr-form-section">
                  <div className="pcr-form-section-title">2. บันทึกวันเยี่ยมบ้านและข้อมูลการชดเชย Rep (ขั้นต่ำ 6 ครั้ง)</div>
                  <div className="pcr-form-grid">
                    {editVisits.map((v) => {
                      const latestRep = v.repItems && v.repItems.length > 0 ? v.repItems[0] : null
                      const displayRep = latestRep?.rep || v.rep || ''
                      const displayComp = latestRep !== null ? latestRep.compensated : v.compensated
                      const displayReason = latestRep?.reason || v.reason || ''
                      const displaySource = latestRep?.source

                      return (
                        <div key={v.visitNo} className="pcr-visit-edit-card">
                          <div className="pcr-visit-edit-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="pcr-visit-edit-title">
                                การเยี่ยมครั้งที่ {v.visitNo}
                              </span>
                              {v.visitNo > 6 && (
                                <button
                                  type="button"
                                  className="pcr-btn-delete-visit"
                                  onClick={() => handleRemoveVisit(v.visitNo)}
                                  title={`ลบการเยี่ยมครั้งที่ ${v.visitNo}`}
                                >
                                  ✕ ลบครั้งนี้
                                </button>
                              )}
                            </div>
                            {displayRep || (displayComp !== undefined && displayComp !== null && Number(displayComp) > 0) ? (
                              <RepAmountBadge
                                rep={displayRep}
                                compensated={displayComp}
                                reason={displayReason}
                                source={displaySource}
                              />
                            ) : v.visitDate ? (
                              <span className="pcr-rep-badge pcr-rep-pending">รอผลชดเชย</span>
                            ) : null}
                          </div>

                          <div>
                            <label className="pcr-form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                              วันเยี่ยม (วว/ดด/ปปปป พ.ศ.)
                            </label>
                            <input
                              type="text"
                              className="pcr-input"
                              placeholder="เช่น 02/11/2569"
                              value={v.visitDate || ''}
                              onChange={(e) => handleVisitDateChange(v.visitNo, e.target.value)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="pcr-btn pcr-btn-secondary"
                      onClick={handleAddVisit}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    >
                      <span className="pcr-symbol" aria-hidden="true">+</span>
                      เพิ่มการเยี่ยม (ครั้งที่ {editVisits.length + 1})
                    </button>
                  </div>
                </div>

                {/* Section C: Death Information */}
                <div className={`pcr-form-section ${editForm.deathDate ? 'pcr-form-section-death' : ''}`}>
                  <div className="pcr-form-section-title" style={{ color: editForm.deathDate ? 'var(--pc-rose-text)' : undefined }}>
                    3. ข้อมูลการเสียชีวิต
                  </div>
                  <div className="pcr-form-grid">
                    <div className="pcr-form-group">
                      <label className="pcr-form-label">วันที่เสียชีวิต (วว/ดด/ปปปป พ.ศ.)</label>
                      <input
                        type="text"
                        className="pcr-input"
                        placeholder="เช่น 02/11/2569 (เว้นว่างหากยังมีชีวิต)"
                        value={editForm.deathDate || ''}
                        onChange={(e) => setEditForm({ ...editForm, deathDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pcr-modal-footer">
                <button
                  type="button"
                  className="pcr-btn pcr-btn-secondary"
                  onClick={() => setEditingItem(null)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="pcr-btn pcr-btn-primary"
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="pcr-modal-backdrop" onClick={() => setDeletingItem(null)}>
          <div className="pcr-modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="pcr-modal-header">
              <h2 className="pcr-modal-title" style={{ color: 'var(--pc-rose-text)' }}>
                ยืนยันการลบเคสผู้ป่วย
              </h2>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setDeletingItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pcr-modal-body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--pc-ink)' }}>
                คุณต้องการลบข้อมูลทะเบียนผู้ป่วย <strong>{deletingItem.patientName}</strong> (HN: {deletingItem.hn}) ออกจากระบบใช่หรือไม่?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--pc-rose-text)' }}>
                * การกระทำนี้ไม่สามารถย้อนกลับได้ และจะถูกบันทึกในระบบ Audit Log
              </p>
            </div>
            <div className="pcr-modal-footer">
              <button
                type="button"
                className="pcr-btn pcr-btn-secondary"
                onClick={() => setDeletingItem(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="pcr-btn pcr-btn-danger"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                <span className="pcr-symbol" aria-hidden="true">✕</span>
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: สรุปผลการซิงค์ข้อมูลจาก HOSxP */}
      {isSyncModalOpen && (
        <div
          className="pcr-modal-backdrop"
          onClick={() => setIsSyncModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pcr-sync-modal-title"
        >
          <div
            className="pcr-modal-card"
            style={{ maxWidth: 780 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pcr-modal-header">
              <div>
                <h2
                  id="pcr-sync-modal-title"
                  className="pcr-modal-title"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {syncModalError || !syncModalResult ? (
                    <AlertCircle size={20} style={{ color: 'var(--pc-amber-text)' }} />
                  ) : (
                    <CheckCircle2 size={20} style={{ color: 'var(--pc-teal-text)' }} />
                  )}
                  ผลการซิงค์ข้อมูลจาก HOSxP (คลินิก 2423)
                </h2>
                {syncModalResult?.syncedAt && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--pc-muted)', marginTop: '0.2rem' }}>
                    เวลาที่ซิงค์: {formatThaiBuddhistDateTime(syncModalResult.syncedAt)}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="pcr-modal-close-btn"
                onClick={() => setIsSyncModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
            </div>

            <div className="pcr-modal-body">
              {syncModalError || !syncModalResult ? (
                <div
                  style={{
                    background: 'var(--pc-amber-bg)',
                    border: '1px solid var(--pc-amber-border)',
                    color: 'var(--pc-amber-text)',
                    padding: '0.85rem 1rem',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>
                    {syncModalError ||
                      'ไม่สามารถซิงค์ข้อมูลจาก HOSxP ได้ในขณะนี้ ระบบแสดงข้อมูลล่าสุดที่มีอยู่ในทะเบียน'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="pcr-sync-kpi-grid">
                    <div className="pcr-sync-kpi-card">
                      <span className="pcr-sync-kpi-label">คลินิก 2423 ใน HOSxP</span>
                      <span className="pcr-sync-kpi-val">
                        {(syncModalResult.totalClinicMembers ?? 0).toLocaleString()} ราย
                      </span>
                    </div>
                    <div
                      className={`pcr-sync-kpi-card ${syncModalResult.insertedCount > 0 ? 'is-highlight-teal' : ''}`}
                    >
                      <span className="pcr-sync-kpi-label">เพิ่มผู้ป่วยใหม่</span>
                      <span className="pcr-sync-kpi-val">
                        {(syncModalResult.insertedCount ?? 0).toLocaleString()} ราย
                      </span>
                    </div>
                    <div
                      className={`pcr-sync-kpi-card ${syncModalResult.updatedCount > 0 ? 'is-highlight-blue' : ''}`}
                    >
                      <span className="pcr-sync-kpi-label">อัปเดตข้อมูลผู้ป่วย</span>
                      <span className="pcr-sync-kpi-val">
                        {(syncModalResult.updatedCount ?? 0).toLocaleString()} ราย
                      </span>
                    </div>
                    <div
                      className={`pcr-sync-kpi-card ${syncModalResult.visitsAddedCount > 0 ? 'is-highlight-teal' : ''}`}
                    >
                      <span className="pcr-sync-kpi-label">เพิ่มวันเยี่ยมบ้าน</span>
                      <span className="pcr-sync-kpi-val">
                        {(syncModalResult.visitsAddedCount ?? 0).toLocaleString()} ครั้ง
                      </span>
                    </div>
                  </div>

                  {syncModalResult.skippedLtcCount > 0 && (
                    <div
                      style={{
                        background: 'var(--pc-surface-alt)',
                        border: '1px solid var(--pc-border)',
                        color: 'var(--pc-ink-2)',
                        padding: '0.55rem 0.85rem',
                        borderRadius: 8,
                        fontSize: '0.8125rem',
                      }}
                    >
                      ข้ามผู้ป่วยที่อยู่ในทะเบียน Long Term Care (LTC):{' '}
                      <strong>{syncModalResult.skippedLtcCount.toLocaleString()} ราย</strong>
                    </div>
                  )}

                  {syncModalResult.insertedCount === 0 &&
                    syncModalResult.updatedCount === 0 &&
                    syncModalResult.visitsAddedCount === 0 && (
                      <div
                        style={{
                          background: 'var(--pc-teal-bg)',
                          border: '1px solid var(--pc-teal-border)',
                          color: 'var(--pc-teal-text)',
                          padding: '0.9rem 1rem',
                          borderRadius: 8,
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                        }}
                      >
                        <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                        <span>
                          ข้อมูลในทะเบียนเป็นปัจจุบันแล้ว ไม่พบรายชื่อใหม่ ข้อมูลที่ต้องอัปเดต
                          หรือวันเยี่ยมบ้านเพิ่มเติมจาก HOSxP
                        </span>
                      </div>
                    )}

                  {((syncModalResult.insertedItems?.length ?? 0) > 0 ||
                    syncModalResult.insertedCount > 0) && (
                    <div className="pcr-sync-section">
                      <div className="pcr-sync-section-header">
                        <span>เพิ่มผู้ป่วยใหม่เข้าทะเบียน</span>
                        <span className="pcr-tag pcr-tag-teal">
                          {syncModalResult.insertedCount.toLocaleString()} ราย
                        </span>
                      </div>
                      {syncModalResult.insertedItems && syncModalResult.insertedItems.length > 0 ? (
                        <div className="pcr-sync-list-wrap">
                          <table className="pcr-sync-table">
                            <thead>
                              <tr>
                                <th style={{ width: 95 }}>HN</th>
                                <th>ชื่อ-สกุลผู้ป่วย</th>
                                <th style={{ width: 120 }}>ICD-10 หลัก</th>
                                <th style={{ width: 130 }}>วันที่ขึ้นทะเบียน</th>
                              </tr>
                            </thead>
                            <tbody>
                              {syncModalResult.insertedItems.map((it) => (
                                <tr key={`ins-${it.hn}`}>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{it.hn}</td>
                                  <td>{it.patientName}</td>
                                  <td>{it.icd10Principal || '—'}</td>
                                  <td>
                                    {it.registeredDate ? formatThaiDate(it.registeredDate) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--pc-muted)' }}>
                          เพิ่มผู้ป่วยใหม่เข้าทะเบียนจำนวน {syncModalResult.insertedCount.toLocaleString()} ราย
                        </div>
                      )}
                    </div>
                  )}

                  {((syncModalResult.updatedItems?.length ?? 0) > 0 ||
                    syncModalResult.updatedCount > 0) && (
                    <div className="pcr-sync-section">
                      <div className="pcr-sync-section-header">
                        <span>อัปเดตข้อมูลผู้ป่วยเดิม</span>
                        <span className="pcr-tag pcr-tag-blue">
                          {syncModalResult.updatedCount.toLocaleString()} ราย
                        </span>
                      </div>
                      {syncModalResult.updatedItems && syncModalResult.updatedItems.length > 0 ? (
                        <div className="pcr-sync-list-wrap">
                          <table className="pcr-sync-table">
                            <thead>
                              <tr>
                                <th style={{ width: 95 }}>HN</th>
                                <th>ชื่อ-สกุลผู้ป่วย</th>
                                <th>รายการที่อัปเดต</th>
                              </tr>
                            </thead>
                            <tbody>
                              {syncModalResult.updatedItems.map((it) => (
                                <tr key={`upd-${it.hn}`}>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{it.hn}</td>
                                  <td>{it.patientName}</td>
                                  <td>
                                    <div className="pcr-sync-chips-wrap">
                                      {it.updatedFields.includes('status') && (
                                        <span className="pcr-tag pcr-tag-teal">
                                          สถานะ: ดำเนินการเรียบร้อย
                                        </span>
                                      )}
                                      {it.updatedFields.includes('registeredDate') && (
                                        <span className="pcr-tag pcr-tag-blue">
                                          วันขึ้นทะเบียน:{' '}
                                          {it.registeredDate
                                            ? formatThaiDate(it.registeredDate)
                                            : '—'}
                                        </span>
                                      )}
                                      {it.updatedFields.includes('deathDate') && (
                                        <span className="pcr-tag pcr-tag-rose">
                                          วันเสียชีวิต:{' '}
                                          {it.deathDate ? formatThaiDate(it.deathDate) : '—'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--pc-muted)' }}>
                          อัปเดตข้อมูลผู้ป่วยเดิมจำนวน {syncModalResult.updatedCount.toLocaleString()} ราย
                        </div>
                      )}
                    </div>
                  )}

                  {((syncModalResult.visitsAddedItems?.length ?? 0) > 0 ||
                    syncModalResult.visitsAddedCount > 0) && (
                    <div className="pcr-sync-section">
                      <div className="pcr-sync-section-header">
                        <span>เพิ่มวันเยี่ยมบ้านจาก HOSxP (ADP 30001)</span>
                        <span className="pcr-tag pcr-tag-teal">
                          {syncModalResult.visitsAddedCount.toLocaleString()} ครั้ง
                        </span>
                      </div>
                      {syncModalResult.visitsAddedItems &&
                      syncModalResult.visitsAddedItems.length > 0 ? (
                        <div className="pcr-sync-list-wrap">
                          <table className="pcr-sync-table">
                            <thead>
                              <tr>
                                <th style={{ width: 95 }}>HN</th>
                                <th style={{ width: 190 }}>ชื่อ-สกุลผู้ป่วย</th>
                                <th>วันเยี่ยมบ้านที่เพิ่ม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {syncModalResult.visitsAddedItems.map((it) => (
                                <tr key={`vis-${it.hn}`}>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{it.hn}</td>
                                  <td>{it.patientName}</td>
                                  <td>
                                    <div className="pcr-sync-chips-wrap">
                                      {it.addedVisits.map((v) => (
                                        <span
                                          key={`v-${it.hn}-${v.visitNo}`}
                                          className="pcr-tag pcr-tag-teal"
                                        >
                                          ครั้งที่ {v.visitNo}: {formatThaiDate(v.visitDate)}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--pc-muted)' }}>
                          เพิ่มวันเยี่ยมบ้านจำนวน {syncModalResult.visitsAddedCount.toLocaleString()} ครั้ง
                        </div>
                      )}
                    </div>
                  )}

                  {syncModalResult.skippedLtcItems &&
                    syncModalResult.skippedLtcItems.length > 0 && (
                      <details className="pcr-sync-details">
                        <summary>
                          รายชื่อที่ข้ามเนื่องจากอยู่ในทะเบียน LTC (
                          {syncModalResult.skippedLtcItems.length} ราย)
                        </summary>
                        <div
                          style={{
                            marginTop: '0.5rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.4rem',
                          }}
                        >
                          {syncModalResult.skippedLtcItems.map((it) => (
                            <span key={`ltc-${it.hn}`} className="pcr-tag pcr-tag-neutral">
                              {it.hn} · {it.patientName}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                </>
              )}
            </div>

            <div className="pcr-modal-footer">
              <button
                type="button"
                className="pcr-btn pcr-btn-primary"
                onClick={() => setIsSyncModalOpen(false)}
              >
                รับทราบ / ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
