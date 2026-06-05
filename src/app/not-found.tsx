'use client'

import Link from 'next/link'
import { Home, Phone, AlertCircle } from 'lucide-react'
import './not-found.css'

export default function NotFound() {
  return (
    <div className="notfound-container">
      <div className="notfound-card card-glass">
        {/* Animated ECG Pulse / Warning Icon area */}
        <div className="ecg-pulse-wrapper">
          <div className="pulse-svg-container">
            <svg viewBox="0 0 300 100" className="ecg-wave">
              <path
                d="M 0 50 L 80 50 L 90 35 L 100 65 L 110 50 L 140 50 L 148 10 L 156 90 L 164 50 L 180 50 L 190 40 L 200 60 L 210 50 L 300 50"
                fill="none"
                stroke="var(--primary-color, #008080)"
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
          ขออภัยด้วยค่ะ หน้าเว็บที่คุณพยายามเข้าถึงอาจถูกลบไปแล้ว เปลี่ยนชื่อใหม่ หรือไม่เปิดให้บริการชั่วคราว
        </p>

        {/* Action Buttons */}
        <div className="notfound-actions">
          <Link href="/" className="btn-primary notfound-btn">
            <Home size={18} />
            กลับสู่หน้าแรก
          </Link>
          <Link href="/contact" className="btn-outline notfound-btn-outline">
            <Phone size={18} />
            ติดต่อโรงพยาบาล
          </Link>
        </div>
      </div>
    </div>
  )
}
