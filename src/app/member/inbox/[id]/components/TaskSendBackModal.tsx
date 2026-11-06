'use client'

import React from 'react'
import { AlertCircle, X, Clock, Undo2, ArrowLeft } from 'lucide-react'

export interface TaskSendBackModalStep {
  id: string
  step_no: number
  step_name: string
  assigned_role?: string | null
  assigned_to_name?: string | null
}

export interface TaskSendBackModalProps {
  isOpen: boolean
  onClose: () => void
  taskNo: string
  taskTitle: string
  requesterName: string
  currentStepNo: number
  currentStepName?: string
  steps: TaskSendBackModalStep[]
  selectedTargetStepNo: number | null
  setSelectedTargetStepNo: (stepNo: number | null) => void
  sendToRequester: boolean
  setSendToRequester: (val: boolean) => void
  comment: string
  setComment: (val: string) => void
  actionLoading: boolean
  onConfirm: () => void
}

export default function TaskSendBackModal({
  isOpen,
  onClose,
  taskNo,
  taskTitle,
  requesterName,
  currentStepNo,
  currentStepName,
  steps,
  selectedTargetStepNo,
  setSelectedTargetStepNo,
  sendToRequester,
  setSendToRequester,
  comment,
  setComment,
  actionLoading,
  onConfirm,
}: TaskSendBackModalProps) {
  if (!isOpen) return null

  // Sort previous steps descending (e.g. step 2 then step 1 if current is step 3)
  const previousSteps = steps
    .filter((s) => s.step_no < currentStepNo)
    .sort((a, b) => b.step_no - a.step_no)

  const isCommentEmpty = !comment.trim()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-back-modal-title"
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
          maxWidth: '540px',
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
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#b45309',
              }}
            >
              <Undo2 size={18} />
            </div>
            <div>
              <h3
                id="send-back-modal-title"
                style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#92400e' }}
              >
                ส่งกลับไปแก้ไข (Send Back)
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                เลขที่: <strong>{taskNo}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            style={{
              background: 'none',
              border: 'none',
              color: '#92400e',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Current Step Notice */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              color: '#475569',
            }}
          >
            <div>หัวข้อ: <strong>{taskTitle}</strong></div>
            <div style={{ marginTop: '0.25rem' }}>
              ขั้นตอนปัจจุบัน: <strong>ลำดับที่ {currentStepNo}</strong>
              {currentStepName ? ` (${currentStepName})` : ''}
            </div>
          </div>

          {/* Target Step Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#1e293b',
                marginBottom: '0.5rem',
              }}
            >
              เลือกขั้นตอนที่ต้องการส่งกลับไป:
            </label>

            {currentStepNo > 1 && previousSteps.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {previousSteps.map((s) => {
                  const isImmediatePrevious = s.step_no === currentStepNo - 1
                  const isSelected = !sendToRequester && selectedTargetStepNo === s.step_no

                  return (
                    <label
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.625rem',
                        border: isSelected ? '2px solid #d97706' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#fffbeb' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="targetStep"
                        checked={isSelected}
                        onChange={() => {
                          setSendToRequester(false)
                          setSelectedTargetStepNo(s.step_no)
                        }}
                        style={{ marginTop: '0.25rem', accentColor: '#d97706' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                            ขั้นตอนที่ {s.step_no}: {s.step_name}
                          </span>
                          {isImmediatePrevious && (
                            <span
                              style={{
                                fontSize: '0.725rem',
                                fontWeight: 600,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                              }}
                            >
                              ขั้นตอนก่อนหน้า
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                          ผู้รับผิดชอบ: {s.assigned_to_name || s.assigned_role || 'ผู้รับมอบหมาย'}
                        </div>
                      </div>
                    </label>
                  )
                })}

                {/* Option to send all the way back to the Requester */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.625rem',
                    border: sendToRequester ? '2px solid #d97706' : '1px solid #e2e8f0',
                    backgroundColor: sendToRequester ? '#fffbeb' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="targetStep"
                    checked={sendToRequester}
                    onChange={() => {
                      setSendToRequester(true)
                      setSelectedTargetStepNo(1)
                    }}
                    style={{ marginTop: '0.25rem', accentColor: '#d97706' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                      ผู้ยื่นคำขอรับบริการ (ส่งกลับผู้ขอเพื่อแก้ไขข้อมูล)
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                      ผู้ยื่นคำขอ: <strong>{requesterName}</strong> (งานจะย้อนกลับไปจุดเริ่มต้นให้ผู้ขอแก้ไขและส่งใหม่)
                    </div>
                  </div>
                </label>
              </div>
            ) : (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.625rem',
                  border: '1px solid #fde68a',
                  backgroundColor: '#fffbeb',
                  fontSize: '0.85rem',
                  color: '#92400e',
                }}
              >
                ส่งกลับไปยัง <strong>ผู้ยื่นคำขอรับบริการ ({requesterName})</strong> เพื่อแก้ไขรายละเอียดคำขอ
              </div>
            )}
          </div>

          {/* Comment / Instruction textarea */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#1e293b',
                marginBottom: '0.4rem',
              }}
            >
              เหตุผล / ข้อความสั่งการที่ต้องแก้ไข <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="ระบุเหตุผลหรือจุดที่ต้องแก้ไขอย่างชัดเจน เพื่อให้ผู้รับผิดชอบขั้นตอนก่อนหน้าแก้ไขได้ถูกต้อง..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {isCommentEmpty && (
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                * จำเป็นต้องระบุเหตุผลในการส่งกลับแก้ไข
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={actionLoading || isCommentEmpty}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: actionLoading || isCommentEmpty ? '#cbd5e1' : '#d97706',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: actionLoading || isCommentEmpty ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: actionLoading || isCommentEmpty ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
          >
            {actionLoading ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Undo2 size={16} />
                <span>ยืนยันส่งกลับแก้ไข</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
