'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

function MemberLoginForm() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<1 | 2>(1) // 1: Input user/email, 2: Input OTP
  const [loading, setLoading] = useState(false)
  const [thaidLoading, setThaidLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle URL error parameters (e.g. from ThaID redirect)
  useEffect(() => {
    const errCode = searchParams.get('error')
    if (errCode) {
      switch (errCode) {
        case 'not_registered':
          setError('ไม่พบเลขบัตรประชาชนนี้ในระบบบุคลากรโรงพยาบาลเถิน กรุณาติดต่อผู้ดูแลระบบ/งานเทคโนโลยีสารสนเทศ')
          break
        case 'thaid_denied':
          setError('การยืนยันตัวตนด้วย ThaID ถูกยกเลิก หรือไม่ได้รับความยินยอม กรุณาลองใหม่อีกครั้ง')
          break
        case 'thaid_exchange_failed':
          setError('ไม่สามารถเชื่อมต่อแลกเปลี่ยนข้อมูลกับระบบ ThaID ได้ กรุณาลองใหม่ หรือใช้วิธี OTP ทางอีเมล')
          break
        case 'thaid_invalid_state':
          setError('เซสชันการยืนยันตัวตนหมดอายุ กรุณากดเข้าสู่ระบบด้วย ThaID ใหม่อีกครั้ง')
          break
        case 'thaid_not_configured':
          setError('ระบบ ThaID ยังไม่ได้กำหนดค่าการเชื่อมต่อ กรุณาติดต่อผู้ดูแลระบบหรือใช้วิธี OTP')
          break
        case 'thaid_server_error':
          setError('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง')
          break
        default:
          setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง')
      }
    }
  }, [searchParams])

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleThaidLogin = () => {
    setError('')
    setSuccess('')
    setThaidLoading(true)
    // Redirect to backend authorize endpoint
    window.location.href = '/api/auth/thaid/authorize'
  }

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
        setSuccess(`รหัส OTP ถูกส่งไปยังอีเมล ${email} เรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมาย หรือกล่องจดหมายขยะ`)
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
    <div className="memberLoginCard">
      <div className="memberLoginLogo">
        <Image
          src="/images/common/logo-website.webp"
          alt="โรงพยาบาลเถิน"
          width={80}
          height={80}
          priority
        />
        <h2>เข้าสู่ระบบบุคลากร</h2>
        <p>โรงพยาบาลเถิน จังหวัดลำปาง</p>
      </div>

      {error && <div className="memberAlert alert-danger">{error}</div>}
      {success && <div className="memberAlert alert-success">{success}</div>}

      {/* Primary Option: ThaID Digital ID Login */}
      <div className="thaidSection">
        <button
          type="button"
          className="thaidLoginBtn"
          onClick={handleThaidLogin}
          disabled={loading || thaidLoading}
        >
          <span className="thaidIconWrapper">
            <Image
              src="/images/common/logo-thaid.webp"
              alt="ThaID Logo"
              width={36}
              height={36}
              className="thaidLogoImg"
              priority
            />
          </span>
          <div className="thaidBtnText">
            <span className="thaidBtnTitle">
              {thaidLoading ? 'กำลังเชื่อมต่อไปยัง ThaID...' : 'เข้าสู่ระบบด้วย ThaID'}
            </span>
            <span className="thaidBtnSubtitle">บัตรประชาชนดิจิทัล (DOPA Digital ID)</span>
          </div>
        </button>
      </div>

      {/* Divider */}
      <div className="loginDivider">
        <span>หรือ เข้าสู่ระบบด้วย OTP (อีเมล)</span>
      </div>

      {/* Secondary Option: Username + Email + OTP Form */}
      <form onSubmit={step === 1 ? handleRequestOtp : handleVerifyLogin} className="memberLoginForm">
        <div className="formGroup">
          <label htmlFor="username">ชื่อผู้ใช้งาน (Username / เลขบัตรประชาชน)</label>
          <input
            id="username"
            type="text"
            className="formInput"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="กรอกชื่อผู้ใช้งาน หรือเลขบัตรประชาชน"
            required
            disabled={loading || step === 2 || thaidLoading}
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
            disabled={loading || step === 2 || thaidLoading}
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

        <button type="submit" className="memberSubmitBtn" disabled={loading || thaidLoading}>
          {loading
            ? 'กำลังดำเนินการ...'
            : step === 1
            ? 'ขอรหัส OTP ทางอีเมล'
            : 'เข้าสู่ระบบ'}
        </button>
      </form>

      {/* Footer Legal & Navigation Links */}
      <div className="memberLoginFooter">
        <div className="legalLinks">
          <Link href="/policy" target="_blank" rel="noopener noreferrer">
            นโยบายความเป็นส่วนตัว
          </Link>
          <span className="dot">•</span>
          <Link href="/terms-of-use" target="_blank" rel="noopener noreferrer">
            ข้อกำหนดการใช้งาน
          </Link>
        </div>
        <div className="backHomeLink">
          <Link href="/">← กลับสู่หน้าหลักโรงพยาบาลเถิน</Link>
        </div>
      </div>
    </div>
  )
}

export default function MemberLoginPage() {
  return (
    <div className="memberLoginContainer">
      <Suspense fallback={<div className="memberLoginCard"><p style={{ color: '#fff', textAlign: 'center' }}>กำลังโหลด...</p></div>}>
        <MemberLoginForm />
      </Suspense>
    </div>
  )
}
