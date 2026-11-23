'use client'

import React from 'react'
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import type {
  BorrowRequestRecord,
  CurrentUser,
  MaterialFormState,
} from './equipmentBorrowTypes'

export interface EquipmentBorrowModalsProps {
  currentUser: CurrentUser
  loading: boolean
  renderStatusBadge: (status: string) => React.ReactNode
  renderItemStatusBadge: (itemStatus: string, requestStatus?: string) => React.ReactNode
  // Reject Modal
  rejectModalData: { id: number; requestNo: string } | null
  setRejectModalData: React.Dispatch<React.SetStateAction<{ id: number; requestNo: string } | null>>
  rejectReason: string
  setRejectReason: React.Dispatch<React.SetStateAction<string>>
  handleRejectRequest: () => void
  // Return Inspection Modal
  inspectModalData: BorrowRequestRecord | null
  setInspectModalData: React.Dispatch<React.SetStateAction<BorrowRequestRecord | null>>
  returnItemsInput: Record<number, { returnedQty: number; condition: 'NORMAL' | 'DAMAGED' | 'LOST'; notes: string }>
  setReturnItemsInput: React.Dispatch<
    React.SetStateAction<
      Record<number, { returnedQty: number; condition: 'NORMAL' | 'DAMAGED' | 'LOST'; notes: string }>
    >
  >
  handleConfirmReturn: () => void
  // Material Modal
  materialModalMode: 'create' | 'edit' | null
  setMaterialModalMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | null>>
  materialForm: MaterialFormState
  setMaterialForm: React.Dispatch<React.SetStateAction<MaterialFormState>>
  handleSaveMaterial: (e: React.FormEvent) => void
  // View Detail Modal
  viewDetailModalData: BorrowRequestRecord | null
  setViewDetailModalData: React.Dispatch<React.SetStateAction<BorrowRequestRecord | null>>
  openReturnInspectionModal: (request: BorrowRequestRecord) => void
}

export function EquipmentBorrowModals({
  currentUser,
  loading,
  renderStatusBadge,
  renderItemStatusBadge,
  rejectModalData,
  setRejectModalData,
  rejectReason,
  setRejectReason,
  handleRejectRequest,
  inspectModalData,
  setInspectModalData,
  returnItemsInput,
  setReturnItemsInput,
  handleConfirmReturn,
  materialModalMode,
  setMaterialModalMode,
  materialForm,
  setMaterialForm,
  handleSaveMaterial,
  viewDetailModalData,
  setViewDetailModalData,
  openReturnInspectionModal,
}: EquipmentBorrowModalsProps) {
  return (
    <>
      {rejectModalData && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '450px' }}>
            <div className="modalHeader">
              <h2>ระบุเหตุผลการไม่อนุมัติ ({rejectModalData.requestNo})</h2>
              <button onClick={() => setRejectModalData(null)} className="modalCloseBtn">
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div className="formGroup">
                <label>เหตุผลที่ไม่อนุมัติคำขอ</label>
                <textarea
                  rows={3}
                  className="formControl"
                  required
                  placeholder="เช่น อุปกรณ์ติดคิวใช้งานราชการอื่น, อุปกรณ์อยู่ระหว่างส่งซ่อมบำรุง..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modalFooter">
              <button onClick={() => setRejectModalData(null)} className="secondaryButton">
                ยกเลิก
              </button>
              <button onClick={handleRejectRequest} className="actionBtn actionBtnReject" style={{ padding: '0.65rem 1.25rem' }}>
                ยืนยันไม่อนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectModalData && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '750px' }}>
            <div className="modalHeader">
              <h2>ตรวจรับคืนอุปกรณ์ ({inspectModalData.requestNo})</h2>
              <button onClick={() => setInspectModalData(null)} className="modalCloseBtn" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.75rem', fontSize: '0.9rem' }}>
                <div><strong>ผู้ยืม:</strong> {inspectModalData.requesterName} ({inspectModalData.requesterDept || '-'})</div>
                <div><strong>วัตถุประสงค์:</strong> {inspectModalData.purpose}</div>
              </div>

              {inspectModalData.items.every((it) => it.returnedQty >= it.quantity || it.status === 'CONSUMED') && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} />
                  <span>รายการอุปกรณ์ทั้งหมดในคำขอนี้ได้รับการตรวจรับคืนครบแล้ว ท่านสามารถกดยืนยันเพื่อปิดคำขอและปรับสถานะเป็น &quot;ส่งคืนครบแล้ว&quot; ได้ทันที</span>
                </div>
              )}

              <div className="formGroup">
                <label>บันทึกสภาพและการรับคืนทีละรายการ</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {inspectModalData.items.map((item) => {
                    const inputState = returnItemsInput[item.id] || { returnedQty: 0, condition: 'NORMAL', notes: '' }
                    const remaining = item.quantity - item.returnedQty

                    return (
                      <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', background: remaining <= 0 ? '#f8fafc' : 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600 }}>{item.itemName}</span>
                          <span style={{ fontSize: '0.85rem', color: remaining <= 0 ? '#16a34a' : '#64748b', fontWeight: remaining <= 0 ? 600 : 'normal' }}>
                            {remaining <= 0 ? 'คืนครบแล้ว' : `ยืมไป: ${item.quantity} | คืนแล้ว: ${item.returnedQty} | ค้างคืน: ${remaining}`}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 2fr', gap: '0.75rem', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'block' }}>จำนวนที่ส่งคืนครั้งนี้</span>
                            <input
                              type="number"
                              min={0}
                              max={Math.max(0, remaining)}
                              disabled={remaining <= 0}
                              className="formControl"
                              value={inputState.returnedQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, returnedQty: val },
                                })
                              }}
                            />
                          </div>

                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'block' }}>สภาพอุปกรณ์ตอนคืน</span>
                            <select
                              className="formControl"
                              value={inputState.condition}
                              disabled={remaining <= 0}
                              onChange={(e) => {
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, condition: e.target.value as any },
                                })
                              }}
                            >
                              <option value="NORMAL">ปกติ (คืนสต็อกคลัง)</option>
                              <option value="DAMAGED">ชำรุด (ไม่คืนสต็อก)</option>
                              <option value="LOST">สูญหาย (ไม่คืนสต็อก)</option>
                            </select>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'block' }}>หมายเหตุการตรวจรับ</span>
                            <input
                              type="text"
                              className="formControl"
                              placeholder="เช่น สายมีรอยถลอก, สภาพสมบูรณ์..."
                              value={inputState.notes}
                              disabled={remaining <= 0}
                              onChange={(e) => {
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, notes: e.target.value },
                                })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button onClick={() => setInspectModalData(null)} className="secondaryButton">
                ยกเลิก
              </button>
              <button onClick={handleConfirmReturn} className="primaryButton">
                {inspectModalData.items.every((it) => it.returnedQty >= it.quantity || it.status === 'CONSUMED')
                  ? 'ยืนยันปิดคำขอ (คืนครบแล้ว)'
                  : 'บันทึกการตรวจรับคืน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {materialModalMode && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '550px' }}>
            <div className="modalHeader">
              <h2>{materialModalMode === 'create' ? 'เพิ่มรายการวัสดุใหม่' : 'แก้ไขข้อมูลวัสดุ'}</h2>
              <button onClick={() => setMaterialModalMode(null)} className="modalCloseBtn" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>ชื่อวัสดุ <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="formControl"
                    placeholder="เช่น ปลั๊กพ่วง 5 เมตร 4 ช่อง, สายแปลง HDMI to Type-C..."
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="formGroup">
                    <label>ประเภทวัสดุ</label>
                    <select
                      className="formControl"
                      value={materialForm.materialType}
                      onChange={(e) => setMaterialForm({ ...materialForm, materialType: e.target.value as any })}
                    >
                      <option value="REUSABLE">ยืม-คืน (ใช้งานหมุนเวียน)</option>
                      <option value="CONSUMABLE">สิ้นเปลือง (เบิกใช้หมดไป)</option>
                    </select>
                  </div>

                  <div className="formGroup">
                    <label>หมวดหมู่วัสดุ</label>
                    <select
                      className="formControl"
                      value={materialForm.category}
                      onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                    >
                      <option value="GENERAL">ทั่วไป / สำนักงาน</option>
                      <option value="ELECTRICAL">ไฟฟ้า / โสตทัศนูปกรณ์</option>
                      <option value="IT">คอมพิวเตอร์ / ไอที</option>
                      <option value="MEDICAL">เครื่องมือแพทย์</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="formGroup">
                    <label>จำนวนรวมทั้งหมด</label>
                    <input
                      type="number"
                      min={0}
                      required
                      className="formControl"
                      value={materialForm.totalQty}
                      onChange={(e) => setMaterialForm({ ...materialForm, totalQty: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>

                  <div className="formGroup">
                    <label>หน่วยนับ</label>
                    <input
                      type="text"
                      required
                      className="formControl"
                      placeholder="เช่น ชิ้น, อัน, เส้น, กล่อง..."
                      value={materialForm.unit}
                      onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>สถานที่จัดเก็บ / คลัง</label>
                  <input
                    type="text"
                    className="formControl"
                    placeholder="เช่น ตู้เก็บของ IT, คลังพัสดุกลาง, ห้องศูนย์คอมฯ..."
                    value={materialForm.location}
                    onChange={(e) => setMaterialForm({ ...materialForm, location: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>หมายเหตุ</label>
                  <textarea
                    rows={2}
                    className="formControl"
                    placeholder="รายละเอียดเพิ่มเติมหรือข้อควรระวัง..."
                    value={materialForm.notes}
                    onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  />
                </div>

                {materialModalMode === 'edit' && (
                  <div className="formGroup">
                    <label>สถานะการใช้งาน</label>
                    <select
                      className="formControl"
                      value={materialForm.isActive ? 'ACTIVE' : 'INACTIVE'}
                      onChange={(e) => setMaterialForm({ ...materialForm, isActive: e.target.value === 'ACTIVE' })}
                    >
                      <option value="ACTIVE">เปิดใช้งาน (พร้อมให้ยืม/เบิก)</option>
                      <option value="INACTIVE">ปิดใช้งาน (ระงับการยืม/เบิกชั่วคราว)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modalFooter">
                <button type="button" onClick={() => setMaterialModalMode(null)} className="secondaryButton">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="primaryButton">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลวัสดุ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDetailModalData && (
        <div className="modalBackdrop" onClick={() => setViewDetailModalData(null)}>
          <div
            className="modalContent"
            style={{ maxWidth: '780px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
          >
            <div className="modalHeader">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '0.625rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15856a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <h3 id="detail-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    รายละเอียดคำขอยืม: <span style={{ color: '#15856a' }}>{viewDetailModalData.requestNo}</span>
                  </h3>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    ยื่นคำขอเมื่อ {new Date(viewDetailModalData.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา {new Date(viewDetailModalData.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailModalData(null)}
                className="modalCloseBtn"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modalBody">
              <div className="detailRequesterBanner">
                <div className="detailRequesterInfo">
                  <div className="detailRequesterAvatar">
                    {getInitials(viewDetailModalData.requesterName)}
                  </div>
                  <div>
                    <div className="detailRequesterName">{viewDetailModalData.requesterName}</div>
                    <div className="detailRequesterMeta">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Building2 size={13} />
                        {viewDetailModalData.requesterDept || 'ไม่ระบุแผนก'}
                      </span>
                      {viewDetailModalData.phone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Phone size={13} />
                          <a href={`tel:${viewDetailModalData.phone}`} style={{ color: '#15856a', textDecoration: 'none' }}>
                            {viewDetailModalData.phone}
                          </a>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div>{renderStatusBadge(viewDetailModalData.status)}</div>
              </div>

              <div className="detailMetaGrid">
                <div className="detailMetaItem" style={{ gridColumn: '1 / -1' }}>
                  <span className="detailMetaLabel"><FileText size={14} /> วัตถุประสงค์การยืม</span>
                  <div className="detailMetaValue">{viewDetailModalData.purpose}</div>
                </div>

                {viewDetailModalData.location && (
                  <div className="detailMetaItem">
                    <span className="detailMetaLabel"><MapPin size={14} /> สถานที่ใช้งาน</span>
                    <div className="detailMetaValue">{viewDetailModalData.location}</div>
                  </div>
                )}

                <div className="detailMetaItem">
                  <span className="detailMetaLabel"><Calendar size={14} /> วันที่เริ่มยืม</span>
                  <div className="detailMetaValue">
                    {new Date(viewDetailModalData.borrowDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div className="detailMetaItem">
                  <span className="detailMetaLabel"><Clock size={14} /> กำหนดส่งคืน</span>
                  <div
                    className={`detailMetaValue ${
                      viewDetailModalData.expectedReturnDate &&
                      new Date(viewDetailModalData.expectedReturnDate) < new Date() &&
                      viewDetailModalData.status !== 'RETURNED'
                        ? 'detailMetaValueDanger'
                        : ''
                    }`}
                  >
                    {viewDetailModalData.expectedReturnDate
                      ? new Date(viewDetailModalData.expectedReturnDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-'}
                  </div>
                </div>

                {viewDetailModalData.actualReturnDate && (
                  <div className="detailMetaItem">
                    <span className="detailMetaLabel"><CheckCircle2 size={14} color="#16a34a" /> วันที่ส่งคืนจริง</span>
                    <div className="detailMetaValue detailMetaValueSuccess">
                      {new Date(viewDetailModalData.actualReturnDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                )}

                {viewDetailModalData.approvedByName && (
                  <div className="detailMetaItem">
                    <span className="detailMetaLabel"><ShieldCheck size={14} color="#15856a" /> ผู้อนุมัติคำขอ</span>
                    <div className="detailMetaValue">{viewDetailModalData.approvedByName}</div>
                  </div>
                )}
              </div>

              {viewDetailModalData.rejectReason && (
                <div className="detailAlertBox detailAlertBoxReject">
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>เหตุผลที่ไม่อนุมัติ:</strong>
                    <span>{viewDetailModalData.rejectReason}</span>
                  </div>
                </div>
              )}

              <div>
                <div className="detailItemsHeading">
                  <span>รายการอุปกรณ์และพัสดุที่ยืม</span>
                  <span className="detailItemBadgeCount">{viewDetailModalData.items.length} รายการ</span>
                </div>

                <div className="tableContainer" style={{ marginTop: '0.75rem' }}>
                  <table className="styledTable" style={{ fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th>รายการ</th>
                        <th style={{ textAlign: 'center', width: '80px' }}>ขอยืม</th>
                        <th style={{ textAlign: 'center', width: '80px' }}>คืนแล้ว</th>
                        <th style={{ width: '130px' }}>สถานะของ</th>
                        <th>สภาพตอนส่งคืน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetailModalData.items.map((it) => (
                        <tr key={it.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.itemName}</div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', alignItems: 'center' }}>
                              {it.itemCode && (
                                <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                                  รหัส: {it.itemCode}
                                </span>
                              )}
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                ({it.itemType === 'ASSET' ? 'ครุภัณฑ์' : 'วัสดุ'})
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9375rem' }}>
                            {it.quantity}
                          </td>
                          <td
                            style={{
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '0.9375rem',
                              color: it.returnedQty >= it.quantity ? '#16a34a' : it.returnedQty > 0 ? '#d97706' : '#64748b',
                            }}
                          >
                            {it.returnedQty}
                          </td>
                          <td>{renderItemStatusBadge(it.status, viewDetailModalData.status)}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {it.returnCondition === 'NORMAL'
                                ? 'สภาพปกติ'
                                : it.returnCondition === 'DAMAGED'
                                ? 'ชำรุดเสียหาย'
                                : it.returnCondition === 'LOST'
                                ? 'สูญหาย'
                                : '-'}
                            </div>
                            {it.returnNotes && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                                หมายเหตุ: {it.returnNotes}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modalFooter">
              {currentUser.canManageBorrow &&
                (viewDetailModalData.status === 'APPROVED' || viewDetailModalData.status === 'PARTIAL_RETURNED') && (
                  <button
                    type="button"
                    onClick={() => {
                      const req = viewDetailModalData
                      setViewDetailModalData(null)
                      openReturnInspectionModal(req)
                    }}
                    className="primaryButton"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    <RotateCcw size={16} /> ดำเนินการตรวจรับคืนของ
                  </button>
                )}
              <button
                type="button"
                onClick={() => setViewDetailModalData(null)}
                className="secondaryButton"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
