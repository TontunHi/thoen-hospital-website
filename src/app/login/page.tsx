'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import './page.css'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  
  // 2FA state variables
  const [requiresOtp, setRequiresOtp] = useState(false)
  const [otp, setOtp] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [emailMasked, setEmailMasked] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let bodyData = {}
      if (requiresOtp) {
        bodyData = { otp, tempToken }
      } else {
        bodyData = { username, password }
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.requiresOtp) {
          setRequiresOtp(true)
          setTempToken(data.tempToken)
          setEmailMasked(data.emailMasked)
        } else if (data.success) {
          router.push('/admin')
        }
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setRequiresOtp(false)
    setOtp('')
    setTempToken('')
    setError('')
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
          {!requiresOtp ? (
            <>
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
            </>
          ) : (
            <>
              <div className="formGroup">
                <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', color: 'var(--primary-dark)' }}>
                  ระบบได้ส่งรหัสผ่าน 2FA OTP ไปที่อีเมลของคุณแล้ว (ส่งไปที่ <strong>{emailMasked}</strong>) กรุณาตรวจสอบและกรอกรหัสยืนยัน
                </div>
                <label htmlFor="otp">รหัสผ่านครั้งเดียว (OTP)</label>
                <input
                  id="otp"
                  type="text"
                  className="formInput"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="กรอกรหัส OTP 6 หลัก"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="loginButton"
            disabled={loading}
          >
            {loading ? 'กำลังดำเนินการ...' : (requiresOtp ? 'ยืนยันรหัส OTP' : 'เข้าสู่ระบบ')}
          </button>

          {requiresOtp && (
            <button
              type="button"
              className="loginButton"
              style={{ backgroundColor: 'var(--gray-300)', color: 'var(--gray-800)', marginTop: '8px' }}
              onClick={handleReset}
            >
              กลับหน้าหลัก
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
