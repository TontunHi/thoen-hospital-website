'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log client-side error without leaking PHI
    console.error('Application Error Boundary caught error:', error.message)
  }, [error])

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#f8fafc',
      fontFamily: 'var(--font-sarabun, sans-serif)',
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        textAlign: 'center',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: '#ef4444',
          marginBottom: '1.25rem',
        }}>
          <AlertTriangle size={32} />
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#0f172a',
          margin: '0 0 0.5rem 0',
        }}>
          เกิดข้อผิดพลาดในการโหลดข้อมูล
        </h1>

        <p style={{
          fontSize: '0.95rem',
          color: '#64748b',
          lineHeight: '1.6',
          margin: '0 0 1.5rem 0',
        }}>
          ระบบไม่สามารถประมวลผลคำขอของท่านได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบโรงพยาบาลเถิน
        </p>

        {error.digest && (
          <div style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            backgroundColor: '#f1f5f9',
            padding: '0.5rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontFamily: 'monospace',
          }}>
            Error Reference: {error.digest}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: '#0D7446',
              color: '#ffffff',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'background-color 0.2s',
            }}
          >
            <RefreshCw size={18} />
            ลองใหม่อีกครั้ง
          </button>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              fontWeight: '600',
              textDecoration: 'none',
              fontSize: '0.95rem',
              border: '1px solid #e2e8f0',
            }}
          >
            <Home size={18} />
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  )
}
