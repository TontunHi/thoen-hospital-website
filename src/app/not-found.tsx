'use client'

import Link from 'next/link'
import { Home, Phone, AlertCircle, Calendar, Newspaper, Layers, Search } from 'lucide-react'
import { siteConfig } from '@/config/site'
import './not-found.css'

export default function NotFound() {
  return (
    <div className="notfound-container">
      <div className="notfound-card card-glass animate-fadeInUp">
        {/* Animated ECG Pulse / Warning Icon area */}
        <div className="ecg-pulse-wrapper">
          <div className="pulse-svg-container">
            <svg viewBox="0 0 300 100" className="ecg-wave">
              <path
                d="M 0 50 L 80 50 L 90 35 L 100 65 L 110 50 L 140 50 L 148 10 L 156 90 L 164 50 L 180 50 L 190 40 L 200 60 L 210 50 L 300 50"
                fill="none"
                stroke="var(--primary, #0D7446)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="heart-pulse-node"></div>
          </div>
          <div className="error-icon-overlay">
            <AlertCircle size={40} className="error-icon" />
          </div>
        </div>

        {/* Text Area */}
        <h1 className="notfound-title">404</h1>
        <h2 className="notfound-subtitle">ไม่พบหน้าเว็บที่คุณต้องการ</h2>
        <p className="notfound-text">
          ขออภัย หน้าเว็บที่คุณพยายามเข้าถึงอาจถูกย้าย เปลี่ยนชื่อ หรือไม่มีอยู่ในระบบโรงพยาบาลเถิน
        </p>

        {/* Popular Quick Links (F5) */}
        <div style={{ margin: '1.5rem 0', width: '100%', textAlign: 'left' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gray-500)', display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
            บริการยอดนิยมที่คุณอาจกำลังมองหา:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
            <Link href="/check-date" className="btn btn-outline touch-target" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}>
              <Calendar size={14} />
              <span>ตรวจตารางนัดหมาย</span>
            </Link>
            <Link href="/package" className="btn btn-outline touch-target" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}>
              <Layers size={14} />
              <span>แพ็กเกจบริการ</span>
            </Link>
            <Link href="/news" className="btn btn-outline touch-target" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}>
              <Newspaper size={14} />
              <span>ข่าวสารโรงพยาบาล</span>
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="notfound-actions">
          <Link href="/" className="btn btn-primary touch-target">
            <Home size={18} />
            <span>กลับสู่หน้าแรก</span>
          </Link>
          <Link href="/contact" className="btn btn-outline touch-target">
            <Phone size={18} />
            <span>ติดต่อโรงพยาบาล ({siteConfig.contact.hospitalPhone})</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
