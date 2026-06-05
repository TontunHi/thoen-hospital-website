'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export default function MemberLoginPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<1 | 2>(1) // 1: Input user/email, 2: Input OTP
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)

  const router = useRouter()

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/member/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      })

      const data = await res.json()

      if (res.ok) {
        setStep(2)
        setSuccess(`รหัส OTP ถูกส่งไปยังอีเมล ${email} เรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมาย`)
        setCountdown(60) // Cooldown 60s
      } else {
        setError(data.error || 'ไม่สามารถขอรหัส OTP ได้ในขณะนี้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, otp }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess('เข้าสู่ระบบสำเร็จ กำลังนำทางไปหน้าหลักสมาชิก...')
        setTimeout(() => {
          router.push('/member')
        }, 1500)
      } else {
        setError(data.error || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleEditInfo = () => {
    setStep(1)
    setOtp('')
    setError('')
    setSuccess('')
  }

  return (
    <div className="memberLoginContainer">
      <div className="memberLoginCard">
        <div className="memberLoginLogo">
          <Image
            src="/images/logo-website.webp"
            alt="โรงพยาบาลเถิน"
            width={80}
            height={80}
            priority
          />
          <h2>เข้าสู่ระบบ</h2>
          <p>โรงพยาบาลเถิน จังหวัดลำปาง</p>
        </div>

        {error && <div className="memberAlert alert-danger">{error}</div>}
        {success && <div className="memberAlert alert-success">{success}</div>}

        <form onSubmit={step === 1 ? handleRequestOtp : handleVerifyLogin} className="memberLoginForm">
          <div className="formGroup">
            <label htmlFor="username">ชื่อผู้ใช้งาน (Username)</label>
            <input
              id="username"
              type="text"
              className="formInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้งาน"
              required
              disabled={loading || step === 2}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="email">อีเมล (Email)</label>
            <input
              id="email"
              type="email"
              className="formInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="กรอกอีเมลของคุณ"
              required
              disabled={loading || step === 2}
            />
          </div>

          {step === 2 && (
            <div className="otpSection">
              <div className="formGroup">
                <label htmlFor="otp">รหัส OTP (6 หลัก)</label>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  className="formInput"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="กรอกรหัส OTP 6 หลัก"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="otpActions">
                <button
                  type="button"
                  className="editInfoBtn"
                  onClick={handleEditInfo}
                  disabled={loading}
                >
                  แก้ไขชื่อผู้ใช้ / อีเมล
                </button>
                
                <button
                  type="button"
                  className="resendBtn"
                  onClick={handleRequestOtp}
                  disabled={loading || countdown > 0}
                >
                  {countdown > 0 ? `ขอรหัสใหม่ได้ใน (${countdown} วินาที)` : 'ขอรหัส OTP อีกครั้ง'}
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="memberSubmitBtn" disabled={loading}>
            {loading
              ? 'กำลังดำเนินการ...'
              : step === 1
              ? 'ขอรหัส OTP'
              : 'เข้าสู่ระบบ'}
          </button>
        </form>


      </div>
    </div>
  )
}
