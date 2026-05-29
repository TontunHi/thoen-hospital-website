'use client'

import Link from 'next/link'
import './page.css'

export default function UnauthorizedPage() {
  return (
    <div className="unauthorizedContainer">
      <div className="unauthorizedCard">
        <div className="unauthorizedIcon">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h1>ไม่มีสิทธิ์เข้าถึง</h1>
        <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบหากคุณเชื่อว่านี่คือข้อผิดพลาด</p>
        <div className="unauthorizedActions">
          <Link href="/" className="btnPrimary">
            กลับหน้าหลัก
          </Link>
          <Link href="/login" className="btnSecondary">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  )
}
