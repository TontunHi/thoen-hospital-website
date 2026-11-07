'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ChevronRight, ArrowLeft, X } from 'lucide-react'
import './page.css'

function MemberLoginForm() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [thaidLoading, setThaidLoading] = useState(false)
  const [healthIdLoading, setHealthIdLoading] = useState(false)
  const [providerIdLoading, setProviderIdLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()

  const isAnyBusy = loading || thaidLoading || healthIdLoading || providerIdLoading

  useEffect(() => {
    const errCode = searchParams.get('error')
    if (errCode) {
      switch (errCode) {
        case 'not_registered':
          setError('ไม่พบเลขบัตรประชาชนนี้ในทะเบียนบุคลากรโรงพยาบาลเถิน กรุณาติดต่อกลุ่มงานเทคโนโลยีสารสนเทศ')
          break
        case 'thaid_denied':
          setError('ยกเลิกการยืนยันตัวตนผ่าน ThaID แล้ว หากต้องการเข้าสู่ระบบกรุณาลองใหม่อีกครั้ง')
          break
        case 'thaid_exchange_failed':
          setError('ไม่สามารถเชื่อมต่อข้อมูลกับระบบ ThaID ได้ในขณะนี้ กรุณาลองใหม่หรือรับรหัส OTP ทางอีเมล')
          break
        case 'thaid_invalid_state':
          setError('เซสชันการยืนยันตัวตนหมดอายุ กรุณากดเข้าสู่ระบบด้วย ThaID ใหม่อีกครั้ง')
          break
        case 'thaid_not_configured':
          setError('ระบบ ThaID ยังไม่พร้อมใช้งานชั่วคราว กรุณาเข้าสู่ระบบด้วยรหัส OTP ทางอีเมล')
          break
        case 'thaid_server_error':
          setError('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง')
          break
        case 'health_id_denied':
          setError('ยกเลิกการยืนยันตัวตนผ่าน Health ID แล้ว หากต้องการเข้าสู่ระบบกรุณาลองใหม่อีกครั้ง')
          break
        case 'health_id_exchange_failed':
          setError('ไม่สามารถเชื่อมต่อข้อมูลกับระบบ Health ID ได้ในขณะนี้ กรุณาลองใหม่หรือใช้วิธีอื่น')
          break
        case 'health_id_invalid_state':
          setError('เซสชันการยืนยันตัวตนหมดอายุ กรุณากดเข้าสู่ระบบด้วย Health ID ใหม่อีกครั้ง')
          break
        case 'health_id_not_configured':
          setError('ระบบ Health ID ยังไม่พร้อมใช้งานชั่วคราว กรุณาเข้าสู่ระบบด้วยรหัส OTP ทางอีเมล')
          break
        case 'provider_id_denied':
          setError('ยกเลิกการยืนยันตัวตนผ่าน Provider ID แล้ว หากต้องการเข้าสู่ระบบกรุณาลองใหม่อีกครั้ง')
          break
        case 'provider_id_exchange_failed':
          setError('ไม่สามารถเชื่อมต่อข้อมูลกับระบบ Provider ID ได้ในขณะนี้ กรุณาลองใหม่หรือใช้วิธีอื่น')
          break
        case 'provider_id_invalid_state':
          setError('เซสชันการยืนยันตัวตนหมดอายุ กรุณากดเข้าสู่ระบบด้วย Provider ID ใหม่อีกครั้ง')
          break
        case 'provider_id_not_configured':
          setError('ระบบ Provider ID ยังไม่พร้อมใช้งานชั่วคราว กรุณาเข้าสู่ระบบด้วยรหัส OTP ทางอีเมล')
          break
        case 'provider_id_not_provider':
          setError('ไม่พบข้อมูลบุคลากรสาธารณสุขในบัญชี Provider ID นี้ กรุณาใช้ ThaID หรือรหัส OTP ทางอีเมล')
          break
        default:
          setError('ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleThaidLogin = async () => {
    if (isAnyBusy) return
    setError('')
    setSuccess('')
    setThaidLoading(true)

    try {
      const res = await fetch('/api/auth/thaid/authorize?format=json')
      const data = await res.json()

      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setError(data.error || 'ไม่สามารถเชื่อมต่อกับระบบ ThaID ได้ กรุณาลองใหม่อีกครั้ง')
        setThaidLoading(false)
      }
    } catch {
      window.location.href = '/api/auth/thaid/authorize'
    }
  }

  const handleHealthIdLogin = async () => {
    if (isAnyBusy) return
    setError('')
    setSuccess('')
    setHealthIdLoading(true)

    try {
      const res = await fetch('/api/auth/health-id/authorize?format=json')
      const data = await res.json()

      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setError(data.error || 'ไม่สามารถเชื่อมต่อกับระบบ Health ID ได้ กรุณาลองใหม่อีกครั้ง')
        setHealthIdLoading(false)
      }
    } catch {
      window.location.href = '/api/auth/health-id/authorize'
    }
  }

  const handleProviderIdLogin = async () => {
    if (isAnyBusy) return
    setError('')
    setSuccess('')
    setProviderIdLoading(true)

    try {
      const res = await fetch('/api/auth/provider-id/authorize?format=json')
      const data = await res.json()

      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setError(data.error || 'ไม่สามารถเชื่อมต่อกับระบบ Provider ID ได้ กรุณาลองใหม่อีกครั้ง')
        setProviderIdLoading(false)
      }
    } catch {
      window.location.href = '/api/auth/provider-id/authorize'
    }
  }

  const handleRequestOtp = async (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    if (isAnyBusy) return
    setError('')
    setModalError('')
    setSuccess('')
    setModalSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/member/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      })

      const data = await res.json()

      if (res.ok) {
        setShowOtpModal(true)
        setModalSuccess(`ส่งรหัส OTP 6 หลักไปยัง ${email} แล้ว`)
        setCountdown(60)
      } else {
        setError(data.error || 'ไม่สามารถส่งรหัส OTP ได้ในขณะนี้')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAnyBusy) return
    setModalError('')
    setModalSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, otp }),
      })

      const data = await res.json()

      if (res.ok) {
        setModalSuccess('ยืนยันรหัสสำเร็จ กำลังเข้าสู่ระบบ...')
        setTimeout(() => {
          router.push('/member')
        }, 1000)
      } else {
        setModalError(data.error || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบอีกครั้ง')
      }
    } catch {
      setModalError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseModal = () => {
    setShowOtpModal(false)
    setOtp('')
    setModalError('')
    setModalSuccess('')
  }

  return (
    <>
      <div className="memberLoginCard">
        <header className="memberLoginHeader">
          <Image
            src="/images/common/logo-website.webp"
            alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
            width={56}
            height={56}
            className="memberLoginCrest"
            priority
          />
          <div className="memberLoginTitleGroup">
            <h1>เข้าสู่ระบบบุคลากร</h1>
            <p>โรงพยาบาลเถิน จังหวัดลำปาง</p>
          </div>
        </header>

        {error && (
          <div className="memberAlert alertDanger" role="alert">
            <AlertCircle size={18} strokeWidth={1.5} className="alertIcon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="memberAlert alertSuccess" role="status">
            <CheckCircle2 size={18} strokeWidth={1.5} className="alertIcon" aria-hidden="true" />
            <span>{success}</span>
          </div>
        )}

        <section className="digitalIdSection" aria-label="ยืนยันตัวตนด้วย Digital ID">
          <button
            type="button"
            className="thaidLoginBtn"
            onClick={handleThaidLogin}
            disabled={isAnyBusy}
          >
            <span className="thaidIconFrame">
              <Image
                src="/images/common/logo-thaid.webp"
                alt=""
                width={36}
                height={36}
                className="thaidLogoImg"
                priority
              />
            </span>
            <span className="digitalIdTextGroup">
              <span className="digitalIdTitle">
                {thaidLoading ? 'กำลังเชื่อมต่อระบบ ThaID' : 'เข้าสู่ระบบด้วย ThaID'}
              </span>
              <span className="digitalIdSubtitle">บัตรประชาชนดิจิทัล กรมการปกครอง</span>
            </span>
            <ChevronRight size={18} strokeWidth={1.5} className="digitalIdChevron" aria-hidden="true" />
          </button>

          <div className="mophIdRow">
            <button
              type="button"
              className="mophIdBtn"
              onClick={handleHealthIdLogin}
              disabled={isAnyBusy}
            >
              <span className="mophBrandRow">
                <span className="mophLogoPlate">
                  <Image
                    src="/images/common/logo-Health-ID-g.webp"
                    alt=""
                    width={92}
                    height={40}
                    className="mophWordmarkImg"
                    priority
                  />
                </span>
                <ChevronRight size={18} strokeWidth={1.5} className="digitalIdChevron" aria-hidden="true" />
              </span>
              <span className="mophCaptionGroup">
                <span className="mophBtnTitle">
                  {healthIdLoading ? 'กำลังเชื่อมต่อ Health ID' : 'Health ID'}
                </span>
                <span className="mophBtnSubtitle">กระทรวงสาธารณสุข</span>
              </span>
            </button>

            <button
              type="button"
              className="mophIdBtn"
              onClick={handleProviderIdLogin}
              disabled={isAnyBusy}
            >
              <span className="mophBrandRow">
                <span className="mophLogoPlate">
                  <Image
                    src="/images/common/logo-provider-id.webp"
                    alt=""
                    width={98}
                    height={40}
                    className="mophWordmarkImg"
                    priority
                  />
                </span>
                <ChevronRight size={18} strokeWidth={1.5} className="digitalIdChevron" aria-hidden="true" />
              </span>
              <span className="mophCaptionGroup">
                <span className="mophBtnTitle">
                  {providerIdLoading ? 'กำลังเชื่อมต่อ Provider ID' : 'Provider ID'}
                </span>
                <span className="mophBtnSubtitle">บุคลากรสาธารณสุข</span>
              </span>
            </button>
          </div>
        </section>

        <div className="loginDivider" role="separator">
          <span>หรือรับรหัส OTP ทางอีเมล</span>
        </div>

        <form onSubmit={handleRequestOtp} className="memberLoginForm">
          <div className="formGroup">
            <label htmlFor="username">ชื่อผู้ใช้งาน หรือเลขบัตรประชาชน</label>
            <input
              id="username"
              type="text"
              className="formInput tabularNums"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ชื่อผู้ใช้งาน หรือเลข 13 หลัก"
              autoComplete="username"
              required
              disabled={isAnyBusy}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="email">อีเมลที่ลงทะเบียนไว้</label>
            <input
              id="email"
              type="email"
              className="formInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
              disabled={isAnyBusy}
            />
          </div>

          <button type="submit" className="memberSubmitBtn" disabled={isAnyBusy}>
            {loading ? 'กำลังส่งรหัส OTP...' : 'ขอรหัส OTP ทางอีเมล'}
          </button>
        </form>

        <footer className="memberLoginFooter">
          <Link href="/" className="backHomeLink">
            <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>กลับหน้าหลักโรงพยาบาลเถิน</span>
          </Link>
          <div className="legalLinks">
            <Link href="/policy" target="_blank" rel="noopener noreferrer">
              นโยบายความเป็นส่วนตัว
            </Link>
            <span className="legalDot" aria-hidden="true">·</span>
            <Link href="/terms-of-use" target="_blank" rel="noopener noreferrer">
              ข้อกำหนดการใช้งาน
            </Link>
          </div>
        </footer>
      </div>

      {/* OTP Popup Modal */}
      {showOtpModal && (
        <div className="otpModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="otpModalTitle">
          <div className="otpModalPanel">
            <div className="otpModalHeader">
              <div className="otpModalTitleWrap">
                <h2 id="otpModalTitle">กรอกรหัสยืนยัน OTP</h2>
                <p className="otpModalSubtitle">
                  ระบบได้ส่งรหัส 6 หลักไปยังอีเมล <strong>{email}</strong>
                </p>
              </div>
              <button
                type="button"
                className="otpModalCloseBtn"
                onClick={handleCloseModal}
                aria-label="ปิดหน้าต่างกรอก OTP"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {modalError && (
              <div className="memberAlert alertDanger" role="alert">
                <AlertCircle size={18} strokeWidth={1.5} className="alertIcon" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="memberAlert alertSuccess" role="status">
                <CheckCircle2 size={18} strokeWidth={1.5} className="alertIcon" aria-hidden="true" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleVerifyLogin} className="otpModalForm">
              <div className="formGroup">
                <label htmlFor="modalOtp">รหัสยืนยัน OTP 6 หลัก</label>
                <input
                  id="modalOtp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="formInput otpInput tabularNums"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="memberSubmitBtn otpModalSubmitBtn"
                disabled={loading || otp.length < 6}
              >
                {loading ? 'กำลังตรวจสอบรหัส...' : 'ยืนยันรหัสเข้าสู่ระบบ'}
              </button>

              <div className="otpResendRow">
                <span className="otpResendHint">ยังไม่ได้รับอีเมลใช่หรือไม่</span>
                <button
                  type="button"
                  className="resendBtn tabularNums"
                  onClick={() => handleRequestOtp()}
                  disabled={loading || countdown > 0}
                >
                  {countdown > 0 ? `ขอรหัสใหม่ใน ${countdown} วินาที` : 'ส่งรหัสอีกครั้ง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function YeePengLantern({ size = 32 }: { size?: number }) {
  const width = size
  const height = size * 1.3
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="yeePengGrad" x1="16" y1="2" x2="16" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#fed7aa" stopOpacity="0.9" />
          <stop offset="85%" stopColor="#f97316" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="yeePengFire" cx="16" cy="35" r="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fef08a" />
          <stop offset="90%" stopColor="#ea580c" />
        </radialGradient>
      </defs>

      {/* Outer Halo Glow */}
      <circle cx="16" cy="24" r="14" fill="#fbbf24" fillOpacity="0.25" />

      {/* Main Lantern Silhouette */}
      <path
        d="M8 7C8 4.2 11.5 2 16 2C20.5 2 24 4.2 24 7L26 31C26 34 21.5 36 16 36C10.5 36 6 34 6 31L8 7Z"
        fill="url(#yeePengGrad)"
        stroke="#fdba74"
        strokeWidth="0.8"
      />

      {/* Traditional Frame Rims */}
      <ellipse cx="16" cy="7" rx="8" ry="2" stroke="#ea580c" strokeWidth="0.7" fill="none" opacity="0.6" />
      <ellipse cx="16" cy="20" rx="9.5" ry="2.2" stroke="#ea580c" strokeWidth="0.6" fill="none" opacity="0.4" />
      <ellipse cx="16" cy="31" rx="10" ry="2.5" stroke="#9a3412" strokeWidth="0.8" fill="none" opacity="0.7" />

      {/* Bamboo Rim at the base */}
      <ellipse cx="16" cy="35.5" rx="7.5" ry="1.8" fill="#78350f" />

      {/* Flame Light Source */}
      <circle cx="16" cy="34" r="4.5" fill="url(#yeePengFire)" />
      <ellipse cx="16" cy="35" rx="2" ry="1" fill="#ffffff" />
    </svg>
  )
}

export default function MemberLoginPage() {
  return (
    <div className="memberLoginContainer">
      {/* Vibrant Painted Loy Krathong Scene */}
      <div className="memberSceneArtWrapper">
        <Image
          src="/images/seasonal/loy-krathong-vibrant.webp"
          alt="ภาพวาดทิวทัศน์เทศกาลลอยกระทง สีสันสดใส เปล่งประกายแสงเทียนและโคมลอยเหนือสายน้ำยามพลบค่ำ"
          width={1376}
          height={768}
          priority
          sizes="100vw"
          className="memberSceneArtImg"
        />
        <div className="memberSceneEdgeMask" aria-hidden="true" />

        {/* Ambient floating Yee Peng lanterns ascending into the night sky */}
        <div className="ambientLanternsLayer" aria-hidden="true">
          <span className="floatingLantern lantern1"><YeePengLantern size={26} /></span>
          <span className="floatingLantern lantern2"><YeePengLantern size={34} /></span>
          <span className="floatingLantern lantern3"><YeePengLantern size={20} /></span>
          <span className="floatingLantern lantern4"><YeePengLantern size={38} /></span>
          <span className="floatingLantern lantern5"><YeePengLantern size={24} /></span>
          <span className="floatingLantern lantern6"><YeePengLantern size={30} /></span>
          <span className="floatingLantern lantern7"><YeePengLantern size={18} /></span>
          <span className="floatingLantern lantern8"><YeePengLantern size={22} /></span>
        </div>
      </div>

      <div className="memberLoginStage memberLoginStageSingle">
        {/* Authentication Card */}
        <div className="memberAuthColumn">
          <Suspense
            fallback={
              <div className="memberLoginCard memberLoginSkeleton" aria-busy="true">
                <p className="skeletonLabel">กำลังเตรียมหน้าเข้าสู่ระบบ</p>
              </div>
            }
          >
            <MemberLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
