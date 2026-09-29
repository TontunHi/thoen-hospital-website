'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

export interface ToastMessage {
  id: string
  title?: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '380px',
        width: 'calc(100% - 3rem)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const duration = toast.duration ?? 4000

  useEffect(() => {
    if (duration <= 0) return
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'var(--success-bg)',
          border: 'var(--success-border)',
          color: 'var(--success)',
          icon: <CheckCircle2 size={20} color="var(--success)" />,
        }
      case 'error':
        return {
          bg: 'var(--danger-bg)',
          border: 'var(--danger-border)',
          color: 'var(--danger)',
          icon: <AlertCircle size={20} color="var(--danger)" />,
        }
      case 'warning':
        return {
          bg: 'var(--warning-bg)',
          border: 'var(--warning-border)',
          color: 'var(--warning)',
          icon: <AlertTriangle size={20} color="var(--warning)" />,
        }
      case 'info':
      default:
        return {
          bg: 'var(--info-bg)',
          border: 'var(--info-border)',
          color: 'var(--info)',
          icon: <Info size={20} color="var(--info)" />,
        }
    }
  }

  const { bg, border, color, icon } = getStyle()

  return (
    <div
      role="status"
      className="animate-fadeInUp"
      style={{
        backgroundColor: 'var(--white)',
        borderLeft: `4px solid ${color}`,
        borderTop: `1px solid var(--gray-200)`,
        borderRight: `1px solid var(--gray-200)`,
        borderBottom: `1px solid var(--gray-200)`,
        borderRadius: 'var(--radius-lg)',
        padding: '0.875rem 1rem',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ marginTop: '2px', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        {toast.title && (
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '2px' }}>
            {toast.title}
          </h5>
        )}
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-700)', margin: 0, lineHeight: 1.4 }}>
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="ปิดแจ้งเตือน"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--gray-400)',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
