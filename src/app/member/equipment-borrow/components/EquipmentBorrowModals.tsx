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
  LoanableAssetRecord,
  MaterialFormState,
} from './equipmentBorrowTypes'
import { EquipmentImageUploadField } from './EquipmentImageUploadField'
import { EquipmentItemThumbnail } from './EquipmentItemThumbnail'

export interface EquipmentBorrowModalsProps {
  currentUser: CurrentUser
  loading: boolean
  isUploadingImage: boolean
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
  pendingMaterialImageFile: File | null
  setPendingMaterialImageFile: React.Dispatch<React.SetStateAction<File | null>>
  handleSaveMaterial: (e: React.FormEvent) => void
  // Asset Image Modal
  assetImageModalData: LoanableAssetRecord | null
  setAssetImageModalData: React.Dispatch<React.SetStateAction<LoanableAssetRecord | null>>
  assetImageDraftUrl: string | null
  setAssetImageDraftUrl: React.Dispatch<React.SetStateAction<string | null>>
  pendingAssetImageFile: File | null
  setPendingAssetImageFile: React.Dispatch<React.SetStateAction<File | null>>
  handleSaveAssetImage: (e: React.FormEvent) => void
  // View Detail Modal
  viewDetailModalData: BorrowRequestRecord | null
  setViewDetailModalData: React.Dispatch<React.SetStateAction<BorrowRequestRecord | null>>
  openReturnInspectionModal: (request: BorrowRequestRecord) => void
}

export function EquipmentBorrowModals({
  currentUser,
  loading,
  isUploadingImage,
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
  pendingMaterialImageFile,
  setPendingMaterialImageFile,
  handleSaveMaterial,
  assetImageModalData,
  setAssetImageModalData,
  assetImageDraftUrl,
  setAssetImageDraftUrl,
  pendingAssetImageFile,
  setPendingAssetImageFile,
  handleSaveAssetImage,
  viewDetailModalData,
  setViewDetailModalData,
  openReturnInspectionModal,
}: EquipmentBorrowModalsProps) {
  return (
    <>
      {rejectModalData && (
        <div className="modalBackdrop">
          <div className="modalContent modalSm">
            <div className="modalHeader">
              <h2>ระบุเหตุผลการไม่อนุมัติ ({rejectModalData.requestNo})</h2>
              <button
                type="button"
                onClick={() => setRejectModalData(null)}
                className="modalCloseBtn"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="modalBody">
              <div className="formGroup">
                <label>เหตุผลที่ไม่อนุมัติคำขอ</label>
                <textarea
                  rows={3}
                  className="formControl"
                  required
                  placeholder="เช่น อุปกรณ์ติดคิวใช้งานราชการอื่น, อุปกรณ์อยู่ระหว่างส่งซ่อมบำรุง…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modalFooter">
              <button type="button" onClick={() => setRejectModalData(null)} className="secondaryButton">
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleRejectRequest}
                className="actionBtn actionBtnReject actionBtnLg"
              >
                ยืนยันไม่อนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectModalData && (
        <div className="modalBackdrop">
          <div className="modalContent modalLg">
            <div className="modalHeader">
              <h2>ตรวจรับคืนอุปกรณ์ ({inspectModalData.requestNo})</h2>
              <button
                type="button"
                onClick={() => setInspectModalData(null)}
                className="modalCloseBtn"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="modalBody">
              <div className="inspectSummaryCard">
                <div><strong>ผู้ยืม:</strong> {inspectModalData.requesterName} ({inspectModalData.requesterDept || '-'})</div>
                <div><strong>วัตถุประสงค์:</strong> {inspectModalData.purpose}</div>
              </div>

              {inspectModalData.items.every((it) => it.returnedQty >= it.quantity || it.status === 'CONSUMED') && (
                <div className="detailAlertBox detailAlertBoxReturnDone">
                  <CheckCircle2 size={16} strokeWidth={1.5} />
                  <span>รายการอุปกรณ์ทั้งหมดในคำขอนี้ได้รับการตรวจรับคืนครบแล้ว ท่านสามารถกดยืนยันเพื่อปิดคำขอและปรับสถานะเป็น &quot;ส่งคืนครบแล้ว&quot; ได้ทันที</span>
                </div>
              )}

              <div className="formGroup">
                <label>บันทึกสภาพและการรับคืนทีละรายการ</label>
                <div className="inspectItemList">
                  {inspectModalData.items.map((item) => {
                    const inputState = returnItemsInput[item.id] || { returnedQty: 0, condition: 'NORMAL', notes: '' }
                    const remaining = item.quantity - item.returnedQty

                    return (
                      <div key={item.id} className={`inspectItemCard ${remaining <= 0 ? 'inspectItemCardDone' : ''}`}>
                        <div className="inspectItemHeader">
                          <span className="fontSemibold">{item.itemName}</span>
                          <span className={remaining <= 0 ? 'inspectItemDoneText' : 'inspectItemRemainText'}>
                            {remaining <= 0 ? 'คืนครบแล้ว' : `ยืมไป: ${item.quantity} | คืนแล้ว: ${item.returnedQty} | ค้างคืน: ${remaining}`}
                          </span>
                        </div>

                        <div className="inspectItemGrid">
                          <div>
                            <span className="inspectFieldLabel">จำนวนที่ส่งคืนครั้งนี้</span>
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
                            <span className="inspectFieldLabel">สภาพอุปกรณ์ตอนคืน</span>
                            <select
                              className="formControl"
                              value={inputState.condition}
                              disabled={remaining <= 0}
                              onChange={(e) => {
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, condition: e.target.value as 'NORMAL' | 'DAMAGED' | 'LOST' },
                                })
                              }}
                            >
                              <option value="NORMAL">ปกติ (คืนสต็อกคลัง)</option>
                              <option value="DAMAGED">ชำรุด (ไม่คืนสต็อก)</option>
                              <option value="LOST">สูญหาย (ไม่คืนสต็อก)</option>
                            </select>
                          </div>

                          <div>
                            <span className="inspectFieldLabel">หมายเหตุการตรวจรับ</span>
                            <input
                              type="text"
                              className="formControl"
                              placeholder="เช่น สายมีรอยถลอก, สภาพสมบูรณ์…"
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
              <button type="button" onClick={() => setInspectModalData(null)} className="secondaryButton">
                ยกเลิก
              </button>
              <button type="button" onClick={handleConfirmReturn} className="primaryButton">
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
          <div className="modalContent modalMd">
            <div className="modalHeader">
              <h2>{materialModalMode === 'create' ? 'เพิ่มรายการวัสดุใหม่' : 'แก้ไขข้อมูลวัสดุ'}</h2>
              <button
                type="button"
                onClick={() => {
                  setPendingMaterialImageFile(null)
                  setMaterialModalMode(null)
                }}
                className="modalCloseBtn"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>ชื่อวัสดุ <span className="requiredMark">*</span></label>
                  <input
                    type="text"
                    required
                    className="formControl"
                    placeholder="เช่น ปลั๊กพ่วง 5 เมตร 4 ช่อง, สายแปลง HDMI to Type-C…"
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  />
                </div>

                <EquipmentImageUploadField
                  currentImageUrl={materialForm.imageUrl}
                  pendingFile={pendingMaterialImageFile}
                  onFileSelect={(file) => setPendingMaterialImageFile(file)}
                  onClearImage={() => setMaterialForm({ ...materialForm, imageUrl: null })}
                  disabled={loading || isUploadingImage}
                  label="รูปภาพตัวอย่างวัสดุ (ช่วยให้ผู้ขอยืมเข้าใจหน้าตาอุปกรณ์)"
                />

                <div className="gridTwoCol">
                  <div className="formGroup">
                    <label>ประเภทวัสดุ</label>
                    <select
                      className="formControl"
                      value={materialForm.materialType}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          materialType: e.target.value as 'REUSABLE' | 'CONSUMABLE',
                        })
                      }
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

                <div className="gridTwoCol">
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
                      placeholder="เช่น ชิ้น, อัน, เส้น, กล่อง…"
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
                    placeholder="เช่น ตู้เก็บของ IT, คลังพัสดุกลาง, ห้องศูนย์คอมฯ…"
                    value={materialForm.location}
                    onChange={(e) => setMaterialForm({ ...materialForm, location: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>หมายเหตุ</label>
                  <textarea
                    rows={2}
                    className="formControl"
                    placeholder="รายละเอียดเพิ่มเติมหรือข้อควรระวัง…"
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
                <button
                  type="button"
                  onClick={() => {
                    setPendingMaterialImageFile(null)
                    setMaterialModalMode(null)
                  }}
                  className="secondaryButton"
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading || isUploadingImage} className="primaryButton">
                  {isUploadingImage ? 'กำลังอัปโหลดรูปภาพ…' : loading ? 'กำลังบันทึก…' : 'บันทึกข้อมูลวัสดุ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assetImageModalData && (
        <div className="modalBackdrop" onClick={() => setAssetImageModalData(null)}>
          <div
            className="modalContent modalMd"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-image-modal-title"
          >
            <div className="modalHeader">
              <div>
                <h2 id="asset-image-modal-title">แนบรูปภาพครุภัณฑ์</h2>
                <div className="lightboxSubCode">
                  {assetImageModalData.name} ({assetImageModalData.articleNum})
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingAssetImageFile(null)
                  setAssetImageModalData(null)
                }}
                className="modalCloseBtn"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSaveAssetImage}>
              <div className="modalBody">
                <EquipmentImageUploadField
                  currentImageUrl={assetImageDraftUrl}
                  pendingFile={pendingAssetImageFile}
                  onFileSelect={(file) => setPendingAssetImageFile(file)}
                  onClearImage={() => setAssetImageDraftUrl(null)}
                  disabled={loading || isUploadingImage}
                  label="รูปภาพตัวอย่างครุภัณฑ์"
                />
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  onClick={() => {
                    setPendingAssetImageFile(null)
                    setAssetImageModalData(null)
                  }}
                  className="secondaryButton"
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading || isUploadingImage} className="primaryButton">
                  {isUploadingImage ? 'กำลังอัปโหลดรูปภาพ…' : loading ? 'กำลังบันทึก…' : 'บันทึกรูปภาพครุภัณฑ์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDetailModalData && (
        <div className="modalBackdrop" onClick={() => setViewDetailModalData(null)}>
          <div
            className="modalContent modalLg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
          >
            <div className="modalHeader">
              <div className="detailModalHeaderLeft">
                <div className="detailModalIconBox">
                  <FileText size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 id="detail-modal-title" className="detailModalTitle">
                    รายละเอียดคำขอยืม: <span className="detailMetaValueHighlight">{viewDetailModalData.requestNo}</span>
                  </h3>
                  <span className="detailModalDate">
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
                <X size={20} strokeWidth={1.5} />
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
                      <span className="inlineIconRow">
                        <Building2 size={14} strokeWidth={1.5} />
                        {viewDetailModalData.requesterDept || 'ไม่ระบุแผนก'}
                      </span>
                      {viewDetailModalData.phone && (
                        <span className="inlineIconRow">
                          <Phone size={14} strokeWidth={1.5} />
                          <a href={`tel:${viewDetailModalData.phone}`} className="detailPhoneLink">
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
                <div className="detailMetaItem detailMetaItemFull">
                  <span className="detailMetaLabel"><FileText size={14} strokeWidth={1.5} /> วัตถุประสงค์การยืม</span>
                  <div className="detailMetaValue">{viewDetailModalData.purpose}</div>
                </div>

                {viewDetailModalData.location && (
                  <div className="detailMetaItem">
                    <span className="detailMetaLabel"><MapPin size={14} strokeWidth={1.5} /> สถานที่ใช้งาน</span>
                    <div className="detailMetaValue">{viewDetailModalData.location}</div>
                  </div>
                )}

                <div className="detailMetaItem">
                  <span className="detailMetaLabel"><Calendar size={14} strokeWidth={1.5} /> วันที่เริ่มยืม</span>
                  <div className="detailMetaValue">
                    {new Date(viewDetailModalData.borrowDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div className="detailMetaItem">
                  <span className="detailMetaLabel"><Clock size={14} strokeWidth={1.5} /> กำหนดส่งคืน</span>
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
                    <span className="detailMetaLabel"><CheckCircle2 size={14} strokeWidth={1.5} /> วันที่ส่งคืนจริง</span>
                    <div className="detailMetaValue detailMetaValueSuccess">
                      {new Date(viewDetailModalData.actualReturnDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                )}

                {viewDetailModalData.approvedByName && (
                  <div className="detailMetaItem">
                    <span className="detailMetaLabel"><ShieldCheck size={14} strokeWidth={1.5} /> ผู้อนุมัติคำขอ</span>
                    <div className="detailMetaValue">{viewDetailModalData.approvedByName}</div>
                  </div>
                )}
              </div>

              {viewDetailModalData.rejectReason && (
                <div className="detailAlertBox detailAlertBoxReject">
                  <AlertTriangle size={18} strokeWidth={1.5} className="alertIconTop" />
                  <div>
                    <strong className="blockHeadingSm">เหตุผลที่ไม่อนุมัติ:</strong>
                    <span>{viewDetailModalData.rejectReason}</span>
                  </div>
                </div>
              )}

              <div>
                <div className="detailItemsHeading">
                  <span>รายการอุปกรณ์และพัสดุที่ยืม</span>
                  <span className="detailItemBadgeCount">{viewDetailModalData.items.length} รายการ</span>
                </div>

                <div className="tableContainer tableContainerNested">
                  <table className="styledTable styledTableCompact">
                    <thead>
                      <tr>
                        <th>รายการ</th>
                        <th className="textCenter colQty">ขอยืม</th>
                        <th className="textCenter colQty">คืนแล้ว</th>
                        <th className="colStatus">สถานะของ</th>
                        <th>สภาพตอนส่งคืน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetailModalData.items.map((it) => (
                        <tr key={it.id}>
                          <td>
                            <div className="detailItemNameCell">
                              <EquipmentItemThumbnail
                                imageUrl={it.imageUrl}
                                name={it.itemName}
                                variant="thumb-sm"
                              />
                              <div>
                                <div className="fontSemibold textPrimary">{it.itemName}</div>
                                <div className="detailItemCodeRow">
                                  {it.itemCode && (
                                    <span className="codeTag">รหัส: {it.itemCode}</span>
                                  )}
                                  <span className="detailItemTypeTag">
                                    ({it.itemType === 'ASSET' ? 'ครุภัณฑ์' : 'วัสดุ'})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="textCenter fontSemibold tabularNums">{it.quantity}</td>
                          <td
                            className={`textCenter fontSemibold tabularNums ${
                              it.returnedQty >= it.quantity
                                ? 'textSuccess'
                                : it.returnedQty > 0
                                ? 'textWarning'
                                : 'textMuted'
                            }`}
                          >
                            {it.returnedQty}
                          </td>
                          <td>{renderItemStatusBadge(it.status, viewDetailModalData.status)}</td>
                          <td>
                            <div className="fontMedium">
                              {it.returnCondition === 'NORMAL'
                                ? 'สภาพปกติ'
                                : it.returnCondition === 'DAMAGED'
                                ? 'ชำรุดเสียหาย'
                                : it.returnCondition === 'LOST'
                                ? 'สูญหาย'
                                : '-'}
                            </div>
                            {it.returnNotes && (
                              <div className="returnNoteSubtext">
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
                    className="primaryButton compactBtn"
                  >
                    <RotateCcw size={16} strokeWidth={1.5} /> ดำเนินการตรวจรับคืนของ
                  </button>
                )}
              <button
                type="button"
                onClick={() => setViewDetailModalData(null)}
                className="secondaryButton compactBtn"
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
