'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export default function SalaryLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autofilled, setAutofilled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function autofillFromMember() {
      try {
        const res = await fetch('/api/member/me')
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.member.salary_user && data.member.salary_pass) {
            setUsername(data.member.salary_user)
            setPassword(data.member.salary_pass)
            setAutofilled(true)
          }
        }
      } catch (err) {
        console.error('Failed to autofill salary credentials from member session:', err)
      }
    }
    autofillFromMember()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/salary/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/salary')
      } else {
        setError(data.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="salaryLoginContainer">
      <div className="salaryLoginCard card-glass">
        <div className="salaryLoginLogo">
          <Image
            src="/images/logo-website.webp"
            alt="โรงพยาบาลเถิน"
            width={80}
            height={80}
            priority
          />
          <h2>ระบบข้อมูลเงินเดือน</h2>
          <p>โรงพยาบาลเถิน จังหวัดลำปาง</p>
        </div>

        {error && <div className="salaryAlert alert-danger">{error}</div>}
        {autofilled && (
          <div className="salaryAlert alert-success" style={{ fontSize: '0.85rem', marginBottom: '15px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 12px', borderRadius: '6px' }}>
            ✓ นำเข้าชื่อผู้ใช้และรหัสผ่านจากระบบสมาชิกเรียบร้อยแล้ว
          </div>
        )}

        <form onSubmit={handleSubmit} className="salaryLoginForm">
          <div className="formGroup">
            <label htmlFor="username">ชื่อผู้ใช้งาน (Username)</label>
            <input
              id="username"
              type="text"
              className="formInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้งานของคุณ"
              required
              disabled={loading}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="password">รหัสผ่าน (Password)</label>
            <input
              id="password"
              type="password"
              className="formInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="salarySubmitBtn" disabled={loading}>
            {loading ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="salaryLoginFooter">
          <Link href="/systems">← กลับไปหน้าระบบสารสนเทศ</Link>
        </div>
      </div>
    </div>
  )
}
