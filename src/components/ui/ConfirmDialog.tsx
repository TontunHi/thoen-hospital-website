'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info' | 'success'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  type = 'warning',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Focus on the confirm button when opened
      confirmBtnRef.current?.focus()

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (!loading) onCancel()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, loading, onCancel])

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle size={28} className="confirm-icon-danger" style={{ color: 'var(--danger)' }} />
      case 'warning':
        return <AlertTriangle size={28} className="confirm-icon-warning" style={{ color: 'var(--warning)' }} />
      case 'success':
        return <CheckCircle2 size={28} className="confirm-icon-success" style={{ color: 'var(--success)' }} />
      case 'info':
      default:
        return <Info size={28} className="confirm-icon-info" style={{ color: 'var(--info)' }} />
    }
  }

  const getConfirmButtonClass = () => {
    if (type === 'danger') return 'btn btn-danger'
    if (type === 'warning') return 'btn btn-primary'
    return 'btn btn-primary'
  }

  return (
    <div
      className="confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-desc' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-box animate-fadeInUp"
        style={{
          backgroundColor: 'var(--white)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.75rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: 'var(--shadow-2xl)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          aria-label="ปิด"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--gray-400)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor:
                type === 'danger'
                  ? 'var(--danger-bg)'
                  : type === 'warning'
                  ? 'var(--warning-bg)'
                  : 'var(--info-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {getIcon()}
          </div>
          <div style={{ flex: 1 }}>
            <h3 id="confirm-dialog-title" style={{ fontSize: 'var(--font-size-xl)', marginBottom: '0.375rem' }}>
              {title}
            </h3>
            {description && (
              <p id="confirm-dialog-desc" style={{ color: 'var(--gray-600)', fontSize: 'var(--font-size-sm)' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
            style={{ minHeight: '42px', padding: '0.5rem 1.25rem' }}
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={getConfirmButtonClass()}
            onClick={onConfirm}
            disabled={loading}
            style={{ minHeight: '42px', padding: '0.5rem 1.25rem' }}
          >
            {loading ? 'กำลังดำเนินการ...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
