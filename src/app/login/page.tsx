'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import './page.css'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/admin')
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginHeader">
          <div className="loginLogo">
            <Image
              src="/images/logo-website.webp"
              alt="โลโก้โรงพยาบาลเถิน"
              width={100}
              height={100}
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>
          <h1>โรงพยาบาลเถิน</h1>
          <p>เข้าสู่ระบบจัดการเว็บไซต์</p>
        </div>

        {error && <div className="errorMessage">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="formGroup">
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <input
              id="username"
              type="text"
              className="formInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้"
              required
              autoFocus
            />
          </div>

          <div className="formGroup">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              className="formInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน"
              required
            />
          </div>

          <button
            type="submit"
            className="loginButton"
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}
