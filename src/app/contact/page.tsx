'use client'

import { useState } from 'react'
import './page.css'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess('ส่งข้อความสำเร็จ! เจ้าหน้าที่จะดำเนินการตรวจสอบข้อมูลของคุณโดยเร็วที่สุด')
        setName('')
        setEmail('')
        setPhone('')
        setMessage('')
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการส่งข้อความ')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container contactPage">
      <div className="contactHeader">
        <h1>📞 ติดต่อเรา</h1>
        <p>คุณสามารถติดต่อสอบถามข้อมูลการบริการ หรือส่งข้อความถึงโรงพยาบาลเถินได้ผ่านช่องทางด้านล่าง</p>
      </div>

      <div className="contactGrid">
        {/* Contact info side */}
        <div className="contactInfoSection">
          <div className="infoCard card">
            <h2>🏥 โรงพยาบาลเถิน</h2>
            <p className="addressText">
              📍 เลขที่ 196 หมู่ 6 ถนนพหลโยธิน ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง 52160
            </p>

            <div className="infoItems">
              <div className="infoItem">
                <span className="infoIcon">📞</span>
                <div>
                  <strong>เบอร์โทรศัพท์:</strong>
                  <p>054-292016, 054-292017</p>
                </div>
              </div>

              <div className="infoItem">
                <span className="infoIcon">📠</span>
                <div>
                  <strong>เบอร์โทรสาร (Fax):</strong>
                  <p>054-292015</p>
                </div>
              </div>

              <div className="infoItem">
                <span className="infoIcon">⏰</span>
                <div>
                  <strong>เวลาทำการ:</strong>
                  <p>เปิดให้บริการทุกวัน ตลอด 24 ชั่วโมง (แผนกอุบัติเหตุและฉุกเฉิน)</p>
                  <p>แผนกผู้ป่วยนอก (OPD): วันจันทร์ - ศุกร์ เวลา 08.00 น. - 16.00 น.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Map wrapper */}
          <div className="mapCard card">
            <h2>🗺️ แผนที่การเดินทาง</h2>
            <div className="mapWrapper">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3790.312965383568!2d99.2155700759495!3d18.195034682830386!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30d9518d6a8ddda5%3A0xe54e60655c65f1e!2sThoen%20Hospital!5e0!3m2!1sen!2sth!4v1716888495000!5m2!1sen!2sth"
                width="100%"
                height="320"
                style={{ border: 0, borderRadius: '8px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Maps - โรงพยาบาลเถิน"
              />
            </div>
          </div>
        </div>

        {/* Contact form side */}
        <div className="contactFormSection card">
          <h2>✉️ ส่งข้อความถึงเรา</h2>
          <p className="formSubtitle">กรอกข้อมูลลงในแบบฟอร์มด้านล่างเพื่อติดต่อสอบถามหรือให้ข้อเสนอแนะ</p>
          
          {error && <div className="contactAlert alert-danger">{error}</div>}
          {success && <div className="contactAlert alert-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="formGroup">
              <label htmlFor="name">ชื่อ - นามสกุล *</label>
              <input
                id="name"
                type="text"
                className="formInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="กรอกชื่อและนามสกุลของคุณ"
                required
              />
            </div>

            <div className="formGroup">
              <label htmlFor="email">อีเมลติดต่อ *</label>
              <input
                id="email"
                type="email"
                className="formInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ เช่น example@domain.com"
                required
              />
            </div>

            <div className="formGroup">
              <label htmlFor="phone">เบอร์โทรศัพท์</label>
              <input
                id="phone"
                type="tel"
                className="formInput"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="กรอกเบอร์โทรศัพท์เพื่อการติดต่อกลับ"
              />
            </div>

            <div className="formGroup">
              <label htmlFor="message">ข้อความของคุณ *</label>
              <textarea
                id="message"
                className="formTextarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความของคุณที่นี่..."
                required
                style={{ minHeight: '150px' }}
              />
            </div>

            <button type="submit" className="contactSubmitBtn" disabled={loading}>
              {loading ? 'กำลังส่งข้อมูล...' : '✉️ ส่งข้อความ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
