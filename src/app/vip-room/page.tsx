import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export const metadata: Metadata = {
  title: 'อัตราค่าบริการห้องพิเศษ | โรงพยาบาลเถิน',
  description:
    'อัตราค่าบริการห้องพิเศษ VIP และห้องพิเศษเดี่ยว/เด็ก โรงพยาบาลเถิน ลำปาง พร้อมสิ่งอำนวยความสะดวกครบครัน',
}

const vipAmenities = [
  'เครื่องปรับอากาศ และ พัดลม',
  'โทรทัศน์',
  'ตู้เย็น',
  'ไมโครเวฟ',
  'กาน้ำร้อน',
  'โซฟารับแขก',
  'โต๊ะอาหาร',
  'ห้องน้ำส่วนตัว พร้อมเครื่องทำน้ำอุ่น',
]

const singleAmenities = [
  'เครื่องปรับอากาศ และ พัดลม',
  'โทรทัศน์',
  'ตู้เย็น',
  'โซฟารับแขก',
  'โต๊ะอาหาร',
  'ห้องน้ำส่วนตัว พร้อมเครื่องทำน้ำอุ่น',
]

export default function VipRoomPage() {
  return (
    <div className="vip-page">
      {/* Hero Banner */}
      <section className="vip-hero">
        <div className="vip-hero__bg" aria-hidden="true" />
        <div className="container vip-hero__content">
          <p className="vip-hero__eyebrow">โรงพยาบาลเถิน · Thoen Hospital</p>
          <h1 className="vip-hero__title">อัตราค่าบริการห้องพิเศษ</h1>
          <p className="vip-hero__desc">
            โรงพยาบาลเถินมุ่งมั่นให้บริการดูแลคุณและคนที่คุณรัก ด้วยมาตรฐานโรงพยาบาลและบริการสุขภาพ
            พรั่งพร้อมด้วยสิ่งอำนวยความสะดวกครบครัน เพื่อความสะดวกสบายและความเป็นส่วนตัวตลอดช่วงเวลาการพักฟื้น
          </p>
        </div>
      </section>

      <div className="container vip-content">

        {/* ─── ห้อง VIP ─── */}
        <section id="vip" className="room-section">
          <div className="room-section__badge vip-badge">ห้องพิเศษ VIP</div>

          <div className="room-section__grid">
            {/* Image */}
            <div className="room-section__images">
              <div className="room-img-wrap">
                <Image
                  src="/images/vip_room_1.webp"
                  alt="ห้องพิเศษ VIP โรงพยาบาลเถิน"
                  fill
                  sizes="(max-width:768px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                  className="room-img"
                  priority
                />
              </div>
            </div>

            {/* Details */}
            <div className="room-section__details">
              <div className="room-price-card vip-price">
                <span className="room-price-label">อัตราค่าบริการ</span>
                <span className="room-price-value">1,500</span>
                <span className="room-price-unit">บาท / วัน</span>
              </div>

              <p className="room-desc">
                ห้องพักฟื้นระดับพรีเมียม ตกแต่งอย่างอบอุ่น กว้างขวาง
                พร้อมสิ่งอำนวยความสะดวกที่ครบครันที่สุด เพื่อผู้ป่วยและญาติสนิท
              </p>

              <h3 className="amenities-title">สิ่งอำนวยความสะดวกภายในห้องพัก</h3>
              <ul className="amenities-list">
                {vipAmenities.map((item) => (
                  <li key={item} className="amenities-item">
                    <span className="amenities-icon" aria-hidden="true">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── ห้องพิเศษเดี่ยว / เด็ก ─── */}
        <section id="single" className="room-section">
          <div className="room-section__badge single-badge">ห้องพิเศษเดี่ยว / ห้องพิเศษเด็ก</div>

          <div className="room-section__grid room-section__grid--reverse">
            {/* Details */}
            <div className="room-section__details">
              <div className="room-price-card single-price">
                <span className="room-price-label">อัตราค่าบริการ</span>
                <span className="room-price-value">1,200</span>
                <span className="room-price-unit">บาท / วัน</span>
              </div>

              <p className="room-desc">
                ห้องพักฟื้นที่เน้นความเป็นส่วนตัว ตอบโจทย์ทั้งผู้ใหญ่และเด็ก
                สำหรับห้องพิเศษเด็กมีการตกแต่งด้วยบรรยากาศและชุดเครื่องนอนที่สดใส เหมาะสมกับวัยของเด็ก
              </p>

              <h3 className="amenities-title">สิ่งอำนวยความสะดวกภายในห้องพัก</h3>
              <ul className="amenities-list">
                {singleAmenities.map((item) => (
                  <li key={item} className="amenities-item">
                    <span className="amenities-icon" aria-hidden="true">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Image */}
            <div className="room-section__images">
              <div className="room-img-wrap">
                <Image
                  src="/images/vip_room_2.webp"
                  alt="ห้องพิเศษเดี่ยว และห้องพิเศษเด็ก โรงพยาบาลเถิน"
                  fill
                  sizes="(max-width:768px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                  className="room-img"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── หมายเหตุ ─── */}
        <div className="vip-notice">
          <span className="vip-notice__icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>หมายเหตุสำคัญ:</strong>
            <ul className="vip-notice__list">
              <li>อัตราค่าบริการดังกล่าวยังไม่รวมค่าอาหารและบริการทางการแพทย์</li>
              <li>ผู้ป่วยสามารถใช้สิทธิ์เบิกค่าใช้จ่ายได้ตามสิทธิการรักษาพยาบาลที่มี</li>
            </ul>
          </div>
        </div>

        {/* ─── ติดต่อสอบถาม ─── */}
        <section className="vip-contact">
          <h2 className="vip-contact__title">ช่องทางการติดต่อและสอบถามข้อมูลเพิ่มเติม</h2>
          <div className="vip-contact__grid">
            <a href="tel:054291585" className="vip-contact__card" id="vip-contact-phone">
              <span className="vip-contact__card-icon">📞</span>
              <div>
                <div className="vip-contact__card-label">โทรศัพท์ (ระบบอัตโนมัติ)</div>
                <div className="vip-contact__card-value">054-291585</div>
              </div>
            </a>
            <a
              href="https://www.facebook.com/thoenhospital"
              target="_blank"
              rel="noopener noreferrer"
              className="vip-contact__card"
              id="vip-contact-facebook"
            >
              <span className="vip-contact__card-icon">📘</span>
              <div>
                <div className="vip-contact__card-label">Facebook Page</div>
                <div className="vip-contact__card-value">โรงพยาบาลเถิน ลำปาง</div>
              </div>
            </a>
            <Link href="/contact" className="vip-contact__card" id="vip-contact-website">
              <span className="vip-contact__card-icon">🌐</span>
              <div>
                <div className="vip-contact__card-label">ติดต่อเรา</div>
                <div className="vip-contact__card-value">โรงพยาบาลเถิน</div>
              </div>
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
