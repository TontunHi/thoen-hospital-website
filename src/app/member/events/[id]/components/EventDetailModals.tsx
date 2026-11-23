'use client'

import React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

export interface EventDetailModalsProps {
  event: any
  canManage: boolean
  qrDataUrl: string
  formatThaiDateTime: (dateString: string) => string
  actionLoading: boolean
  // Modal 3: Delete Attendance
  deletingAttendance: any | null
  setDeletingAttendance: React.Dispatch<React.SetStateAction<any | null>>
  handleConfirmDelete: () => void
  // Modal 4: Edit Event
  isEditEventModalOpen: boolean
  setIsEditEventModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  editEventError: string | null
  editTitle: string
  setEditTitle: React.Dispatch<React.SetStateAction<string>>
  editDescription: string
  setEditDescription: React.Dispatch<React.SetStateAction<string>>
  editLocation: string
  setEditLocation: React.Dispatch<React.SetStateAction<string>>
  editFiscalYear: string
  setEditFiscalYear: React.Dispatch<React.SetStateAction<string>>
  editStatus: string
  setEditStatus: React.Dispatch<React.SetStateAction<string>>
  editStartDate: string
  setEditStartDate: React.Dispatch<React.SetStateAction<string>>
  editEndDate: string
  setEditEndDate: React.Dispatch<React.SetStateAction<string>>
  editHasCustomCheckin: boolean
  setEditHasCustomCheckin: React.Dispatch<React.SetStateAction<boolean>>
  editCheckinOpen: string
  setEditCheckinOpen: React.Dispatch<React.SetStateAction<string>>
  editCheckinClose: string
  setEditCheckinClose: React.Dispatch<React.SetStateAction<string>>
  editEventLoading: boolean
  handleSaveEventSubmit: (e: React.FormEvent) => void
  // Modal 5: Add Attachment
  isAddAttachModalOpen: boolean
  setIsAddAttachModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  attachError: string | null
  attachType: 'IMAGE' | 'DOCUMENT' | 'NOTE'
  setAttachType: React.Dispatch<React.SetStateAction<'IMAGE' | 'DOCUMENT' | 'NOTE'>>
  attachTitle: string
  setAttachTitle: React.Dispatch<React.SetStateAction<string>>
  attachFiles: File[]
  setAttachFiles: React.Dispatch<React.SetStateAction<File[]>>
  attachTextContent: string
  setAttachTextContent: React.Dispatch<React.SetStateAction<string>>
  attachLoading: boolean
  handleSaveAttachmentSubmit: (e: React.FormEvent) => void
  // Modal 6: Lightbox
  lightboxUrl: { url: string; title: string } | null
  setLightboxUrl: React.Dispatch<React.SetStateAction<{ url: string; title: string } | null>>
}

export function EventDetailModals({
  event,
  canManage,
  qrDataUrl,
  formatThaiDateTime,
  actionLoading,
  deletingAttendance,
  setDeletingAttendance,
  handleConfirmDelete,
  isEditEventModalOpen,
  setIsEditEventModalOpen,
  editEventError,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  editLocation,
  setEditLocation,
  editFiscalYear,
  setEditFiscalYear,
  editStatus,
  setEditStatus,
  editStartDate,
  setEditStartDate,
  editEndDate,
  setEditEndDate,
  editHasCustomCheckin,
  setEditHasCustomCheckin,
  editCheckinOpen,
  setEditCheckinOpen,
  editCheckinClose,
  setEditCheckinClose,
  editEventLoading,
  handleSaveEventSubmit,
  isAddAttachModalOpen,
  setIsAddAttachModalOpen,
  attachError,
  attachType,
  setAttachType,
  attachTitle,
  setAttachTitle,
  attachFiles,
  setAttachFiles,
  attachTextContent,
  setAttachTextContent,
  attachLoading,
  handleSaveAttachmentSubmit,
  lightboxUrl,
  setLightboxUrl,
}: EventDetailModalsProps) {
  return (
    <>
      {deletingAttendance && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard" style={{ maxWidth: 440 }}>
            <div className="attendeeModalHeader" style={{ borderBottomColor: '#fecaca', background: '#fef2f2' }}>
              <h3 style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                <span>ยืนยันการลบรายชื่อ</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletingAttendance(null)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="attendeeModalBody">
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                คุณต้องการลบรายชื่อ <strong>{deletingAttendance.member?.name}</strong> ออกจากการเข้าร่วมกิจกรรมนี้ใช่หรือไม่?
              </p>
              <div style={{ padding: '0.65rem 0.85rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                ⚠️ คะแนนสะสม ({deletingAttendance.pointsAwarded} คะแนน) จะถูกนำออกจากคะแนนรวมของบุคลากรท่านนี้ทันที
              </div>
            </div>

            <div className="attendeeModalFooter">
              <button
                type="button"
                onClick={() => setDeletingAttendance(null)}
                disabled={actionLoading}
                className="modalBtnCancel"
              >
                <X size={15} />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="modalBtnDanger"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="modalBtnSpinner" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>ยืนยันลบรายชื่อ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditEventModalOpen && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard" style={{ maxWidth: 640 }}>
            <div className="attendeeModalHeader">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pencil size={18} color="#059669" />
                <span>แก้ไขรายละเอียดกิจกรรม</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditEventModalOpen(false)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEventSubmit}>
              <div className="attendeeModalBody" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {editEventError && (
                  <div style={{ padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.825rem' }}>
                    {editEventError}
                  </div>
                )}

                <div>
                  <label className="formLabel">
                    ชื่อกิจกรรม <span className="formRequired">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="formInput"
                  />
                </div>

                <div>
                  <label className="formLabel">คำอธิบาย/วัตถุประสงค์กิจกรรม</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="formInput"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="formLabel">สถานที่จัดงาน</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="formInput"
                    />
                  </div>
                  <div>
                    <label className="formLabel">ปีงบประมาณ พ.ศ.</label>
                    <input
                      type="text"
                      value={editFiscalYear}
                      onChange={(e) => setEditFiscalYear(e.target.value)}
                      className="formInput"
                    />
                  </div>
                </div>

                <div>
                  <label className="formLabel">สถานะกิจกรรม</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="formInput"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="UPCOMING">เร็วๆ นี้ (UPCOMING)</option>
                    <option value="ONGOING">กำลังจัดงาน (ONGOING)</option>
                    <option value="COMPLETED">สิ้นสุดแล้ว (COMPLETED)</option>
                    <option value="CANCELLED">ยกเลิกกิจกรรม (CANCELLED)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="formLabel">
                      วันและเวลาเริ่มกิจกรรม <span className="formRequired">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="formInput"
                    />
                  </div>
                  <div>
                    <label className="formLabel">
                      วันและเวลาสิ้นสุดกิจกรรม <span className="formRequired">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="formInput"
                    />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={editHasCustomCheckin}
                      onChange={(e) => setEditHasCustomCheckin(e.target.checked)}
                      style={{ width: '1rem', height: '1rem', accentColor: '#059669', cursor: 'pointer' }}
                    />
                    <span>กำหนดช่วงเวลาเปิด-ปิดสแกน QR Code เช็คอินแยกต่างหาก</span>
                  </label>

                  {editHasCustomCheckin && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div>
                        <label className="formLabel" style={{ color: '#92400e', fontSize: '0.8rem' }}>
                          เวลาเปิดรับสแกนเช็คอิน
                        </label>
                        <input
                          type="datetime-local"
                          value={editCheckinOpen}
                          onChange={(e) => setEditCheckinOpen(e.target.value)}
                          className="formInput"
                        />
                      </div>
                      <div>
                        <label className="formLabel" style={{ color: '#92400e', fontSize: '0.8rem' }}>
                          เวลาปิดรับสแกนเช็คอิน
                        </label>
                        <input
                          type="datetime-local"
                          value={editCheckinClose}
                          onChange={(e) => setEditCheckinClose(e.target.value)}
                          className="formInput"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="attendeeModalFooter">
                <button
                  type="button"
                  onClick={() => setIsEditEventModalOpen(false)}
                  disabled={editEventLoading}
                  className="modalBtnCancel"
                >
                  <X size={15} />
                  <span>ยกเลิก</span>
                </button>
                <button
                  type="submit"
                  disabled={editEventLoading}
                  className="modalBtnSubmit"
                >
                  {editEventLoading ? (
                    <>
                      <Loader2 size={16} className="modalBtnSpinner" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>บันทึกการแก้ไขกิจกรรม</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="printStandee">
        <div className="printStandeeBorder">
          <h1 className="printHospitalName">โรงพยาบาลเถิน</h1>
          <div className="printDivider" />

          <h2 className="printEventTitle">{event.title}</h2>

          <div className="printEventMeta">
            <p><strong>วันและเวลา:</strong> {formatThaiDateTime(event.eventStartDate)}</p>
            {event.location && (
              <p><strong>สถานที่:</strong> {event.location}</p>
            )}
          </div>

          <div className="printQrContainer">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code สำหรับเช็คอิน"
                className="printQrImage"
              />
            )}
          </div>

          <div className="printInstructions">
            <p className="printInstructionTitle">
              สแกนเช็คอินเข้าร่วมกิจกรรม (ยืนยันตัวตนผ่านแอป ThaID)
            </p>
            <p className="printInstructionTimes">
              ช่วงเวลาเปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)} ถึง {formatThaiDateTime(event.checkinCloseTime)}
            </p>
            <p className="printInstructionNote">
              📱 ใช้กล้องมือถือทั่วไปหรือแอป LINE สแกนป้ายนี้ • ได้รับ 1 คะแนนสะสม
            </p>
          </div>
        </div>
      </div>

      {isAddAttachModalOpen && (
        <div className="attendeeModalOverlay">
          <div className="attendeeModalCard" style={{ maxWidth: 560 }}>
            <div className="attendeeModalHeader">
              <h3>{canManage ? 'แนบไฟล์ / เอกสาร / ข้อความประกอบกิจกรรม' : '📸 อัปโหลดภาพกิจกรรม'}</h3>
              <button
                type="button"
                onClick={() => setIsAddAttachModalOpen(false)}
                className="attendeeModalCloseBtn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAttachmentSubmit}>
              <div className="attendeeModalBody">
                {attachError && (
                  <div className="formErrorBanner">
                    <AlertTriangle size={16} />
                    <span>{attachError}</span>
                  </div>
                )}

                {!canManage ? (
                  <div style={{
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                    border: '1px solid #a7f3d0',
                    borderRadius: '0.65rem',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    fontSize: '0.825rem',
                    color: '#065f46',
                    lineHeight: 1.45,
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#d1fae5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <ImageIcon size={18} color="#059669" />
                    </div>
                    <div>
                      <strong>สมาชิกทุกคนสามารถร่วมแชร์ภาพบรรยากาศกิจกรรมได้</strong>
                      <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.15rem' }}>
                        สามารถเลือกภาพจากมือถือหรือคอมพิวเตอร์ได้หลายรูปพร้อมกัน (ไม่เกิน 10MB ต่อภาพ)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="formFieldLabel">เลือกประเภทสิ่งที่แนบ</label>
                    <div className="attachmentTypeGrid">
                      <button
                        type="button"
                        onClick={() => setAttachType('IMAGE')}
                        className={`attachmentTypeOption ${attachType === 'IMAGE' ? 'activeImage' : ''}`}
                      >
                        <ImageIcon size={20} />
                        <span>📸 ภาพกิจกรรม</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachType('DOCUMENT')}
                        className={`attachmentTypeOption ${attachType === 'DOCUMENT' ? 'activeDoc' : ''}`}
                      >
                        <FileText size={20} />
                        <span>📄 เอกสาร/PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachType('NOTE')}
                        className={`attachmentTypeOption ${attachType === 'NOTE' ? 'activeNote' : ''}`}
                      >
                        <MessageSquare size={20} />
                        <span>📝 ข้อความบันทึก</span>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="formFieldLabel">
                    {attachType === 'NOTE' ? 'หัวข้อบันทึก / ประกาศ *' : 'ชื่อหัวข้อ / คำอธิบาย (ระบุหรือไม่ก็ได้)'}
                  </label>
                  <input
                    type="text"
                    value={attachTitle}
                    onChange={(e) => setAttachTitle(e.target.value)}
                    placeholder={
                      attachType === 'NOTE'
                        ? 'เช่น สรุปผลการจัดงาน, ประกาศแจ้งผู้เข้าร่วม'
                        : 'เช่น ภาพบรรยากาศพิธีเปิด, กำหนดการงาน (เว้นว่างเพื่อใช้ชื่อไฟล์เดิม)'
                    }
                    className="modalInput"
                  />
                </div>

                {attachType !== 'NOTE' && (
                  <div>
                    <label className="formFieldLabel">
                      {attachType === 'IMAGE'
                        ? 'เลือกไฟล์รูปภาพ (เลือกได้หลายไฟล์พร้อมกัน - ไม่เกิน 10MB/รูป) *'
                        : 'เลือกไฟล์เอกสาร (PDF, Word, Excel - ไม่เกิน 25MB) *'}
                    </label>
                    <input
                      type="file"
                      multiple={attachType === 'IMAGE'}
                      accept={
                        attachType === 'IMAGE'
                          ? '.jpg,.jpeg,.png,.webp,.gif,.jfif,.avif,.svg,.heic,.heif,image/*'
                          : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf'
                      }
                      onChange={(e) => {
                        if (e.target.files) {
                          setAttachFiles(Array.from(e.target.files))
                        }
                      }}
                      className="modalInput"
                      style={{ padding: '0.55rem', cursor: 'pointer' }}
                    />
                    {attachFiles.length > 0 && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                        ✓ เลือกแล้ว {attachFiles.length} ไฟล์ ({attachFiles.map((f) => f.name).join(', ')})
                      </div>
                    )}
                  </div>
                )}

                {attachType === 'NOTE' && (
                  <div>
                    <label className="formFieldLabel">เนื้อหาข้อความ / มติ / รายละเอียดสรุป *</label>
                    <textarea
                      rows={5}
                      value={attachTextContent}
                      onChange={(e) => setAttachTextContent(e.target.value)}
                      placeholder="พิมพ์ข้อความสรุปผล ข้อสั่งการ หรือประกาศกิจกรรมที่นี่..."
                      className="modalTextarea"
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>

              <div className="attendeeModalFooter">
                <button
                  type="button"
                  disabled={attachLoading}
                  onClick={() => setIsAddAttachModalOpen(false)}
                  className="modalBtnCancel"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={attachLoading}
                  className="modalBtnSubmit"
                >
                  {attachLoading ? (
                    <>
                      <Loader2 size={14} className="modalBtnSpinner" />
                      <span>{attachType === 'IMAGE' ? 'กำลังอัปโหลดรูปภาพ...' : 'กำลังบันทึก...'}</span>
                    </>
                  ) : (
                    <span>{canManage ? 'บันทึกสิ่งที่แนบ' : 'อัปโหลดภาพกิจกรรม'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="lightboxOverlay" onClick={() => setLightboxUrl(null)}>
          <div className="lightboxContainer" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl.url} alt={lightboxUrl.title} className="lightboxImg" />
            <div
              style={{
                marginTop: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                color: '#fff',
                padding: '0 0.5rem',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{lightboxUrl.title}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={lightboxUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachmentActionBtn"
                  title="เปิดดูรูปภาพในแท็บใหม่"
                >
                  <ExternalLink size={14} />
                </a>
                <a
                  href={lightboxUrl.url}
                  download={lightboxUrl.title}
                  className="attachmentActionBtn"
                  title="ดาวน์โหลดรูปภาพ"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxUrl(null)}
                  className="attachmentActionBtn"
                  title="ปิด"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
