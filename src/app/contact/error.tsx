'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'

export default function ContactError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Contact page error:', error)
  }, [error])

  return (
    <div className="contact-page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <AlertCircle size={32} />
          </div>

          <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: '0.75rem' }}>
            ไม่สามารถโหลดข้อมูลหน้าติดต่อเราได้
          </h2>
          <p style={{ color: 'var(--gray-600)', marginBottom: '1.75rem' }}>
            เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง หรือกลับสู่หน้าหลัก
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              className="btn btn-primary touch-target"
            >
              <RotateCcw size={16} />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
            <Link href="/" className="btn btn-outline touch-target">
              <Home size={16} />
              <span>กลับสู่หน้าหลัก</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
