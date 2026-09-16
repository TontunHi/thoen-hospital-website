'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { ShieldAlert, RefreshCw, LayoutDashboard } from 'lucide-react'

export default function MemberError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Member portal error:', error.message)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: '#ef4444',
          marginBottom: '1rem',
        }}>
          <ShieldAlert size={28} />
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
          เกิดข้อผิดพลาดในระบบสมาชิก
        </h2>

        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
          ระบบไม่สามารถโหลดข้อมูลสิทธิ์การเข้าใช้งานหรือเอกสารได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
        </p>

        {error.digest && (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Reference: {error.digest}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: '#0D7446',
              color: '#ffffff',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            <RefreshCw size={16} />
            ลองใหม่อีกครั้ง
          </button>

          <Link
            href="/member"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              fontWeight: '600',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            <LayoutDashboard size={16} />
            หน้าหลักสมาชิก
          </Link>
        </div>
      </div>
    </div>
  )
}
