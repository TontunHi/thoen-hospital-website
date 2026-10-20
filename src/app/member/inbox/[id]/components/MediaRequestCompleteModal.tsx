'use client'

import React from 'react'
import { CheckCircle2, X, Clock, Palette, Send, AlertCircle } from 'lucide-react'

export interface MediaRequestCompleteModalProps {
  isOpen: boolean
  onClose: () => void
  taskNo: string
  taskTitle: string
  completeComment: string
  setCompleteComment: (c: string) => void
  actionLoading: boolean
  handleCompleteMediaRequest: () => void
}

export default function MediaRequestCompleteModal({
  isOpen,
  onClose,
  taskNo,
  taskTitle,
  completeComment,
  setCompleteComment,
  actionLoading,
  handleCompleteMediaRequest,
}: MediaRequestCompleteModalProps) {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-modal-title"
      className="modalOverlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        className="modalCard"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f0fdf4',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3
                id="complete-modal-title"
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: '#14532d',
                  margin: 0,
                }}
              >
                ยืนยันการดำเนินงานเสร็จสิ้น
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#166534' }}>
                รหัสคำขอ: <strong>{taskNo}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.35rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Target Task Info */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.65rem',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>
              หัวข้องานสื่อประชาสัมพันธ์
            </span>
            <strong style={{ color: '#0f172a' }}>{taskTitle}</strong>
          </div>

          {/* Notice Box */}
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '0.65rem',
              fontSize: '0.85rem',
              color: '#065f46',
              lineHeight: 1.5,
              display: 'flex',
              gap: '0.65rem',
            }}
          >
            <Palette size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>จบกระบวนการทันที:</strong> ระบบจะปรับสถานะคำขอเป็น <b>"อนุมัติเรียบร้อย"</b> โดยคงข้อมูลขั้นตอนในเอกสารไว้ตามเดิม (ไม่ประทับชื่อหรือลายเซ็นทับ เพื่อให้สามารถพิมพ์เอกสารนำไปลงนามภายนอกได้) พร้อมส่งแจ้งเตือนเข้ากลุ่ม Telegram ร้องขอสื่อและผู้ร้องขอ
            </div>
          </div>

          {/* Handover Comment Textarea */}
          <div>
            <label
              htmlFor="complete-comment-input"
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#334155',
                marginBottom: '0.35rem',
              }}
            >
              ข้อความส่งมอบงาน / หมายเหตุปิดงาน <span style={{ color: '#94a3b8', fontWeight: 400 }}>(ระบุหรือไม่ก็ได้)</span>
            </label>
            <textarea
              id="complete-comment-input"
              rows={3}
              placeholder="เช่น ผลิตสื่อและส่งมอบไฟล์งานเรียบร้อยแล้ว, ติดตั้งป้ายประชาสัมพันธ์เรียบร้อย..."
              value={completeComment}
              onChange={(e) => setCompleteComment(e.target.value)}
              disabled={actionLoading}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            disabled={actionLoading}
            onClick={onClose}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            disabled={actionLoading}
            onClick={handleCompleteMediaRequest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid #15803d',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading ? 0.75 : 1,
            }}
          >
            {actionLoading ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>ยืนยันเสร็จสิ้นงานทันที</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
