'use client'

import React from 'react'
import { AlertCircle, UserX, X } from 'lucide-react'

interface RegistrationRejectModalProps {
  isOpen: boolean
  requestId: number | null
  rejectReason: string
  setRejectReason: (reason: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function RegistrationRejectModal({
  isOpen,
  requestId,
  rejectReason,
  setRejectReason,
  onClose,
  onConfirm,
}: RegistrationRejectModalProps) {
  if (!isOpen || requestId === null) return null

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modalCard max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalHeaderLeft">
            <div className="modalHeaderIconReject">
              <AlertCircle size={20} className="text-rose-600" />
            </div>
            <div className="modalHeaderTitleBox">
              <h3 className="modalTitle">ปฏิเสธคำขอลงทะเบียน</h3>
              <p className="modalSubtitle">คำขอ #{requestId}</p>
            </div>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modalBody">
          <p className="text-sm text-slate-600 mb-3">
            กรุณาระบุเหตุผลในการปฏิเสธคำขอนี้ เพื่อบันทึกเป็นประวัติในระบบ
          </p>
          <textarea
            className="textInput h-24 py-2"
            placeholder="ระบุเหตุผล เช่น ข้อมูลไม่ถูกต้อง, ไม่พบบันทึกการจ้างงาน"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
        <div className="modalFooter">
          <div className="modalFooterActions">
            <button
              type="button"
              className="btnModalCancel"
              onClick={onClose}
            >
              <X size={16} />
              <span>ยกเลิก</span>
            </button>
            <button
              type="button"
              className="btnModalReject"
              onClick={onConfirm}
            >
              <UserX size={16} />
              <span>ยืนยันการปฏิเสธ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
