'use client'

import React from 'react'
import { PauseCircle, X, Clock } from 'lucide-react'

export interface TaskHoldModalProps {
  isOpen: boolean
  onClose: () => void
  holdReason: string
  setHoldReason: (reason: string) => void
  holdCustomReason: string
  setHoldCustomReason: (reason: string) => void
  holdDetails: string
  setHoldDetails: (details: string) => void
  actionLoading: boolean
  handleHoldTask: () => void
}

export default function TaskHoldModal({
  isOpen,
  onClose,
  holdReason,
  setHoldReason,
  holdCustomReason,
  setHoldCustomReason,
  holdDetails,
  setHoldDetails,
  actionLoading,
  handleHoldTask,
}: TaskHoldModalProps) {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-modal-title"
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
          maxWidth: '480px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PauseCircle className="text-amber-600 w-5 h-5" />
            <h3 id="hold-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#92400e' }}>
              พักการดำเนินงานชั่วคราว (Hold Task)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
              เลือกเหตุผลในการพักงาน <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                'รอการจัดสรรงบ',
                'ต้องการหารือรายละเอียดเพิ่มเติม',
                'อื่นๆ',
              ].map((r) => (
                <label
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: holdReason === r ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                    backgroundColor: holdReason === r ? '#fffbeb' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: holdReason === r ? 600 : 400,
                    color: holdReason === r ? '#92400e' : '#334155',
                  }}
                >
                  <input
                    type="radio"
                    name="holdReasonRadio"
                    value={r}
                    checked={holdReason === r}
                    onChange={() => setHoldReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {holdReason === 'อื่นๆ' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                ระบุเหตุผลอื่นๆ <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น รอประสานงานร้านป้ายภายนอก, รอยืนยันไฟล์ต้นฉบับ..."
                value={holdCustomReason}
                onChange={(e) => setHoldCustomReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
              รายละเอียด / หมายเหตุเพิ่มเติม (ระบุหรือไม่ก็ได้)
            </label>
            <textarea
              rows={3}
              placeholder="ระบุข้อความชี้แจงสำหรับผู้ยื่นคำขอ..."
              value={holdDetails}
              onChange={(e) => setHoldDetails(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                lineHeight: '1.5',
              }}
            />
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            💡 เมื่อบันทึกพักงาน ระบบจะเปลี่ยนสถานะเป็น <strong>พักงานชั่วคราว</strong> และส่งข้อความแจ้งเตือนพร้อมเหตุผลไปยังผู้ยื่นคำขอทาง Telegram ทันที
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
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
              padding: '0.5rem 1rem',
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
            disabled={actionLoading || (holdReason === 'อื่นๆ' && !holdCustomReason.trim())}
            onClick={handleHoldTask}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: '#d97706',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)',
            }}
          >
            {actionLoading ? <Clock size={16} className="animate-spin" /> : <PauseCircle size={16} />}
            <span>ยืนยันพักงาน</span>
          </button>
        </div>
      </div>
    </div>
  )
}
