'use client'

import React from 'react'
import {
  Image as ImageIcon,
  Maximize2,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { formatThaiBuddhistDateTime } from '@/lib/formatters'
import type {
  CategoryVisibility,
  OnlineMediaViewRecord,
  OnlineMediaViewerItem,
} from '@/lib/media/onlineMediaService'
import {
  formatBytes,
  type MediaFormState,
  type UploadTelemetryState,
} from './onlineMediaHelpers'

export interface OnlineMediaSupplementsSectionProps {
  thumbnailPreviewUrl: string | null
  setThumbnailPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>
  itemForm: MediaFormState
  setItemForm: React.Dispatch<React.SetStateAction<MediaFormState>>
  isUploadingThumb: boolean
  isUploadingAtt: boolean
  handleThumbnailUpload: (file: File) => void
  handleAttachmentFilesUpload: (files: FileList) => void
}

export function OnlineMediaSupplementsSection({
  thumbnailPreviewUrl,
  setThumbnailPreviewUrl,
  itemForm,
  setItemForm,
  isUploadingThumb,
  isUploadingAtt,
  handleThumbnailUpload,
  handleAttachmentFilesUpload,
}: OnlineMediaSupplementsSectionProps) {
  return (
    <>
      <div className="omSectionCard">
        <div className="omSectionTitle">
          <ImageIcon size={15} />
          <span>4. ภาพหน้าปกสื่อ (Thumbnail - ไม่บังคับ)</span>
        </div>

        <div className="omThumbPreviewBox">
          {thumbnailPreviewUrl ? (
            <img src={thumbnailPreviewUrl} alt="Thumbnail preview" className="omThumbPreviewImg" />
          ) : (
            <div
              className="omThumbPreviewImg"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
              }}
            >
              <ImageIcon size={20} />
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="omHint">
              {itemForm.thumbnailS3Key
                ? 'อัปโหลดภาพปกแล้ว'
                : 'รองรับ JPG, PNG, WebP ขนาดไม่เกิน 10MB'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="omBtn omBtnCompact" style={{ cursor: 'pointer' }}>
                {isUploadingThumb ? <RefreshCw size={14} /> : <Upload size={14} />}
                <span>{isUploadingThumb ? 'กำลังอัปโหลด...' : 'เลือกภาพปก'}</span>
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={isUploadingThumb}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleThumbnailUpload(f)
                    e.target.value = ''
                  }}
                />
              </label>
              {itemForm.thumbnailS3Key && (
                <button
                  type="button"
                  className="omBtn omBtnCompact"
                  onClick={() => {
                    setThumbnailPreviewUrl(null)
                    setItemForm((p) => ({ ...p, thumbnailS3Key: '' }))
                  }}
                >
                  ล้างภาพปก
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="omSectionCard">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div className="omSectionTitle">
            <Paperclip size={15} />
            <span>5. เอกสาร / ภาพประกอบเพิ่มเติม</span>
          </div>

          <label className="omBtn omBtnCompact" style={{ cursor: 'pointer' }}>
            {isUploadingAtt ? <RefreshCw size={14} /> : <Plus size={14} />}
            <span>{isUploadingAtt ? 'กำลังอัปโหลด...' : 'แนบไฟล์เสริม'}</span>
            <input
              type="file"
              hidden
              multiple
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
              disabled={isUploadingAtt}
              onChange={(e) => {
                if (e.target.files) handleAttachmentFilesUpload(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {itemForm.attachments.length === 0 ? (
          <div className="omHint">
            แนบไฟล์ PDF สไลด์บรรยายหรือใบงานประกอบเพื่อให้ดูควบคู่กับคลิปได้ (เลือกได้หลายไฟล์)
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {itemForm.attachments.map((att, idx) => (
              <div
                key={`${att.s3Key}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#ffffff',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              >
                <input
                  type="text"
                  className="omInput"
                  value={att.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value
                    const extMatch = (att.fileName || att.s3Key).match(/(\.[a-zA-Z0-9]{1,10})$/)
                    const ext = extMatch ? extMatch[1].toLowerCase() : ''
                    const nextFileName = nextTitle.trim()
                      ? `${nextTitle.trim().replace(/[\\/:*?"<>|\r\n\t]+/g, '_')}${ext}`
                      : att.fileName
                    setItemForm((p) => ({
                      ...p,
                      attachments: p.attachments.map((a, i) =>
                        i === idx ? { ...a, title: nextTitle, fileName: nextFileName } : a
                      ),
                    }))
                  }}
                  aria-label="ชื่อไฟล์แนบ"
                />
                <span
                  className="omHint"
                  style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatBytes(att.fileSize)}
                </span>
                <button
                  type="button"
                  className="omIconBtn omIconBtnDanger"
                  onClick={() =>
                    setItemForm((p) => ({
                      ...p,
                      attachments: p.attachments.filter((_, i) => i !== idx),
                    }))
                  }
                  aria-label="ลบไฟล์แนบ"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export interface OnlineMediaAuxModalsProps {
  isItemModalOpen: boolean
  isModalMinimized: boolean
  setIsModalMinimized: React.Dispatch<React.SetStateAction<boolean>>
  telemetry: UploadTelemetryState | null
  itemFormTitle: string
  // Category modal
  isCatModalOpen: boolean
  setIsCatModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSavingCat: boolean
  catForm: {
    id?: number
    name: string
    visibility: CategoryVisibility
    displayOrder: number
    isActive: boolean
  }
  setCatForm: React.Dispatch<
    React.SetStateAction<{
      id?: number
      name: string
      visibility: CategoryVisibility
      displayOrder: number
      isActive: boolean
    }>
  >
  handleSaveCategory: (e: React.FormEvent) => void
  // Viewer modal
  viewerModalItem: OnlineMediaViewerItem | null
  setViewerModalItem: React.Dispatch<React.SetStateAction<OnlineMediaViewerItem | null>>
  viewerSearch: string
  setViewerSearch: React.Dispatch<React.SetStateAction<string>>
  viewerList: OnlineMediaViewRecord[]
  filteredViewers: OnlineMediaViewRecord[]
  loadingViewers: boolean
  // Delete modal
  deleteTarget: { type: 'item' | 'category'; id: number; label: string } | null
  setDeleteTarget: React.Dispatch<
    React.SetStateAction<{ type: 'item' | 'category'; id: number; label: string } | null>
  >
  isDeleting: boolean
  handleConfirmDelete: () => void
}

export function OnlineMediaAuxModals({
  isItemModalOpen,
  isModalMinimized,
  setIsModalMinimized,
  telemetry,
  itemFormTitle,
  isCatModalOpen,
  setIsCatModalOpen,
  isSavingCat,
  catForm,
  setCatForm,
  handleSaveCategory,
  viewerModalItem,
  setViewerModalItem,
  viewerSearch,
  setViewerSearch,
  viewerList,
  filteredViewers,
  loadingViewers,
  deleteTarget,
  setDeleteTarget,
  isDeleting,
  handleConfirmDelete,
}: OnlineMediaAuxModalsProps) {
  return (
    <>
      {isItemModalOpen && isModalMinimized && (
        <div className="omFloatingMonitor" role="status" aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {telemetry ? telemetry.fileName : itemFormTitle || 'ร่างสื่อออนไลน์'}
            </div>
            <button
              type="button"
              className="omBtn omBtnCompact"
              onClick={() => setIsModalMinimized(false)}
            >
              <Maximize2 size={13} />
              <span>เปิดหน้าต่าง</span>
            </button>
          </div>

          {telemetry ? (
            <>
              <div className="omProgressBar">
                <div className="omProgressFill" style={{ width: `${telemetry.percent}%` }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  color: '#475569',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>
                  {telemetry.percent}% · {formatBytes(telemetry.uploadedBytes)} /{' '}
                  {formatBytes(telemetry.totalBytes)}
                </span>
                <span>
                  {telemetry.active && telemetry.speedBytesPerSec > 0
                    ? `${formatBytes(telemetry.speedBytesPerSec)}/s`
                    : telemetry.phase === 'completed'
                    ? 'พร้อมบันทึก'
                    : telemetry.message}
                </span>
              </div>
            </>
          ) : (
            <div className="omHint">ย่อหน้าต่างชั่วคราว คลิกเปิดหน้าต่างเพื่อกรอกข้อมูลต่อ</div>
          )}
        </div>
      )}

      {isCatModalOpen && (
        <div className="omModalOverlay" onClick={() => !isSavingCat && setIsCatModalOpen(false)}>
          <div className="omModalDialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <h2>{catForm.id ? 'แก้ไขหมวดหมู่สื่อ' : 'เพิ่มหมวดหมู่สื่อใหม่'}</h2>
              <button
                type="button"
                className="omIconBtn"
                onClick={() => !isSavingCat && setIsCatModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="omModalBody">
                <div className="omFieldGroup">
                  <label className="omLabel" htmlFor="cat-name">
                    ชื่อหมวดหมู่ *
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    className="omInput"
                    value={catForm.name}
                    onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="omFieldRow">
                  <div className="omFieldGroup">
                    <label className="omLabel" htmlFor="cat-vis">
                      ขอบเขตที่แสดง
                    </label>
                    <select
                      id="cat-vis"
                      className="omSelect"
                      value={catForm.visibility}
                      onChange={(e) =>
                        setCatForm((p) => ({ ...p, visibility: e.target.value as CategoryVisibility }))
                      }
                    >
                      <option value="ALL">ทั้งหมด (สาธารณะ + ภายใน)</option>
                      <option value="PUBLIC">เฉพาะสื่อสาธารณะ</option>
                      <option value="INTERNAL">เฉพาะสื่อภายในบุคลากร</option>
                    </select>
                  </div>
                  <div className="omFieldGroup">
                    <label className="omLabel" htmlFor="cat-order">
                      ลำดับการแสดงผล
                    </label>
                    <input
                      id="cat-order"
                      type="number"
                      className="omInput"
                      value={catForm.displayOrder}
                      onChange={(e) =>
                        setCatForm((p) => ({ ...p, displayOrder: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <label className="omCheckRow">
                  <input
                    type="checkbox"
                    checked={catForm.isActive}
                    onChange={(e) => setCatForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  <span>เปิดใช้งานหมวดหมู่นี้</span>
                </label>
              </div>
              <div className="omModalFooter">
                <div className="omModalFooterActions">
                  <button type="button" className="omBtn" onClick={() => setIsCatModalOpen(false)}>
                    ยกเลิก
                  </button>
                  <button type="submit" className="omBtn omBtnPrimary" disabled={isSavingCat}>
                    {isSavingCat ? 'กำลังบันทึก...' : 'บันทึกหมวดหมู่'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewerModalItem && (
        <div className="omModalOverlay" onClick={() => setViewerModalItem(null)}>
          <div className="omModalDialog" onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <div>
                <h2>ประวัติบุคลากรที่เข้าชมสื่อ</h2>
                <div className="omHint">{viewerModalItem.title}</div>
              </div>
              <button
                type="button"
                className="omIconBtn"
                onClick={() => setViewerModalItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={17} />
              </button>
            </div>
            <div className="omModalBody">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  ผู้เข้าชมที่มีบัญชีบุคลากร: {viewerList.length} คน (ยอดดูรวมทั้งหมด{' '}
                  {viewerModalItem.viewCount.toLocaleString()} ครั้ง)
                </span>
                <input
                  type="text"
                  className="omInput"
                  style={{ maxWidth: 250 }}
                  placeholder="ค้นหาชื่อ หรือกลุ่มงาน..."
                  value={viewerSearch}
                  onChange={(e) => setViewerSearch(e.target.value)}
                />
              </div>

              {loadingViewers ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  กำลังโหลดประวัติการเข้าชม...
                </div>
              ) : filteredViewers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  ยังไม่มีประวัติบุคลากรที่เข้าชมสื่อรายการนี้
                </div>
              ) : (
                <div className="omTableCard">
                  <table className="omTable" style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th>ชื่อ-สกุลบุคลากร</th>
                        <th>กลุ่มงาน / หน่วยงาน</th>
                        <th className="omNumCol">จำนวนครั้ง</th>
                        <th>เข้าชมครั้งแรก</th>
                        <th>เข้าชมล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredViewers.map((v) => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 600 }}>{v.memberName}</td>
                          <td>{v.memberDepartment || '-'}</td>
                          <td className="omNumCol">{v.viewCount} ครั้ง</td>
                          <td className="omDateCol">{formatThaiBuddhistDateTime(v.firstViewedAt)}</td>
                          <td className="omDateCol">{formatThaiBuddhistDateTime(v.lastViewedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="omModalOverlay" onClick={() => !isDeleting && setDeleteTarget(null)}>
          <div className="omModalDialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="omModalHeader">
              <h2>ยืนยันการลบข้อมูล</h2>
              <button
                type="button"
                className="omIconBtn"
                onClick={() => !isDeleting && setDeleteTarget(null)}
                aria-label="ปิด"
              >
                <X size={17} />
              </button>
            </div>
            <div className="omModalBody">
              <p style={{ margin: 0 }}>
                คุณต้องการลบ <strong>{deleteTarget.label}</strong> ใช่หรือไม่
                {deleteTarget.type === 'item'
                  ? ' ไฟล์สื่อและเอกสารแนบที่เก็บบน MinIO จะถูกลบออกอย่างถาวร'
                  : ''}
              </p>
            </div>
            <div className="omModalFooter">
              <div className="omModalFooterActions">
                <button
                  type="button"
                  className="omBtn"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="omBtn omBtnDanger"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
