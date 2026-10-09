'use client'

import { useState, type FormEvent } from 'react'
import './page.css'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; message: string } | { kind: 'error'; message: string }

export default function RegisterClientView() {
  const [form, setForm] = useState({ citizenId: '', firstNameTh: '', lastNameTh: '', email: '' })
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus({ kind: 'done', message: data.message ?? 'ได้รับคำขอสมัครแล้ว' })
      } else {
        setStatus({ kind: 'error', message: data.error ?? 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่' })
      }
    } catch {
      setStatus({ kind: 'error', message: 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่' })
    }
  }

  if (status.kind === 'done') {
    return (
      <main className="registerPage">
        <section className="registerCard" role="status">
          <h1 className="registerTitle">ส่งคำขอเรียบร้อย</h1>
          <p className="registerDesc">{status.message}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="registerPage">
      <form className="registerCard" onSubmit={handleSubmit} noValidate>
        <h1 className="registerTitle">ลงทะเบียนบุคลากร</h1>
        <p className="registerDesc">โรงพยาบาลเถิน กรอกข้อมูลเพื่อขอเข้าใช้งานระบบ ผู้ดูแลระบบจะตรวจสอบก่อนเปิดบัญชี</p>

        <label className="registerField">
          <span>เลขบัตรประชาชน</span>
          <input inputMode="numeric" maxLength={13} autoComplete="off" required value={form.citizenId} onChange={update('citizenId')} />
        </label>
        <label className="registerField">
          <span>ชื่อ (ภาษาไทย)</span>
          <input required maxLength={100} value={form.firstNameTh} onChange={update('firstNameTh')} />
        </label>
        <label className="registerField">
          <span>นามสกุล (ภาษาไทย)</span>
          <input required maxLength={100} value={form.lastNameTh} onChange={update('lastNameTh')} />
        </label>
        <label className="registerField">
          <span>อีเมล</span>
          <input type="email" required autoComplete="email" maxLength={100} value={form.email} onChange={update('email')} />
        </label>

        {status.kind === 'error' && <p className="registerError" role="alert">{status.message}</p>}

        <button type="submit" className="btn btn-primary registerSubmit" disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'กำลังส่ง…' : 'ส่งคำขอสมัคร'}
        </button>
      </form>
    </main>
  )
}
