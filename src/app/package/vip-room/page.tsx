import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Wind, 
  Tv, 
  Sofa, 
  Refrigerator, 
  Thermometer, 
  Fan, 
  Microwave, 
  Utensils, 
  Coffee, 
  ShowerHead,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Crown
} from 'lucide-react'
import './page.css'

export const metadata: Metadata = {
  title: 'อัตราค่าบริการห้องพิเศษ | โรงพยาบาลเถิน',
  description:
    'อัตราค่าบริการห้องพิเศษ VIP และห้องพิเศษเดี่ยว/เด็ก โรงพยาบาลเถิน ลำปาง พร้อมสิ่งอำนวยความสะดวกครบครัน',
}

const vipAmenities = [
  'เครื่องปรับอากาศ',
  'ห้องน้ำส่วนตัว',
  'ตู้เย็น',
  'เครื่องทำน้ำอุ่น',
  'พัดลม',
  'โซฟา',
  'โทรทัศน์',
  'ไมโครเวฟ',
  'โต๊ะอาหาร',
  'กาน้ำร้อน',
]

const singleAmenities = [
  'เครื่องปรับอากาศ',
  'ห้องน้ำส่วนตัว',
  'ตู้เย็น',
  'เครื่องทำน้ำอุ่น',
  'พัดลม',
  'โซฟา',
  'โทรทัศน์',
  'โต๊ะอาหาร',
]

const getAmenityIcon = (name: string) => {
  switch (name) {
    case 'เครื่องปรับอากาศ': return <Wind size={16} />
    case 'ห้องน้ำส่วนตัว': return <ShowerHead size={16} />
    case 'ตู้เย็น': return <Refrigerator size={16} />
    case 'เครื่องทำน้ำอุ่น': return <Thermometer size={16} />
    case 'พัดลม': return <Fan size={16} />
    case 'โซฟา': return <Sofa size={16} />
    case 'โทรทัศน์': return <Tv size={16} />
    case 'ไมโครเวฟ': return <Microwave size={16} />
    case 'โต๊ะอาหาร': return <Utensils size={16} />
    case 'กาน้ำร้อน': return <Coffee size={16} />
    default: return <CheckCircle2 size={16} />
  }
}

export default function VipRoomPage() {
  return (
    <div className="vip-page">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
        {/* Hero Banner */}
        <section className="vip-hero">
          <div className="vip-hero__bg" aria-hidden="true" />
          <div className="vip-hero__content">
            <span className="vip-hero__badge">
              <Crown size={14} />
              PREMIUM SERVICES
            </span>
            <h1 className="vip-hero__title">
              อัตราค่าบริการห้องพิเศษ
              <span className="vip-hero__subtitle">โรงพยาบาลเถิน THOEN HOSPITAL</span>
            </h1>
            <p className="vip-hero__desc">
              โรงพยาบาลเถินมุ่งมั่นให้บริการดูแลคุณและคนที่คุณรัก ด้วยมาตรฐานโรงพยาบาลและบริการสุขภาพ
              พร้อมด้วยสิ่งอำนวยความสะดวกครบครัน และความเป็นส่วนตัวตลอดช่วงเวลาการพักฟื้น
            </p>
          </div>
        </section>

        <div className="vip-content">
        <div className="vip-rooms-grid">
          {/* ─── ห้อง VIP ─── */}
          <section id="vip" className="room-card vip-theme">
            <div className="room-card__image-container">
              <Image
                src="/images/package/vip-room/vip_room_1.webp"
                alt="ห้องพิเศษ VIP โรงพยาบาลเถิน"
                width={800}
                height={550}
                className="room-card__img"
                priority
              />
              <div className="room-card__badge-tag">ห้องพิเศษ VIP</div>
            </div>

            <div className="room-card__info">
              <div className="room-card__price-section">
                <span className="price-tag">1,500</span>
                <span className="price-unit">บาท / วัน</span>
              </div>

              <h2 className="room-card__title">ห้องพิเศษ VIP</h2>
              <p className="room-card__desc">
                ห้องพักฟื้นระดับพรีเมียม ตกแต่งอย่างอบอุ่น กว้างขวาง
                พร้อมสิ่งอำนวยความสะดวกที่ครบครันที่สุด เพื่อผู้ป่วยและญาติสนิท
              </p>

              <div className="room-card__amenities">
                <h3 className="amenities-heading">สิ่งอำนวยความสะดวกภายในห้องพัก</h3>
                <ul className="amenities-grid">
                  {vipAmenities.map((item) => (
                    <li key={item} className="amenity-tag">
                      <span className="amenity-icon-wrap">{getAmenityIcon(item)}</span>
                      <span className="amenity-text">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ─── ห้องพิเศษเดี่ยว / เด็ก ─── */}
          <section id="single" className="room-card single-theme">
            <div className="room-card__image-container">
              <Image
                src="/images/package/vip-room/vip_room_2.webp"
                alt="ห้องพิเศษเดี่ยว และห้องพิเศษเด็ก โรงพยาบาลเถิน"
                width={800}
                height={550}
                className="room-card__img"
              />
              <div className="room-card__badge-tag">ห้องพิเศษเดี่ยว / ห้องพิเศษเด็ก</div>
            </div>

            <div className="room-card__info">
              <div className="room-card__price-section">
                <span className="price-tag">1,200</span>
                <span className="price-unit">บาท / วัน</span>
              </div>

              <h2 className="room-card__title">ห้องพิเศษเดี่ยว / ห้องพิเศษเด็ก</h2>
              <p className="room-card__desc">
                ห้องพักฟื้นที่เน้นความเป็นส่วนตัว ตอบโจทย์ทั้งผู้ใหญ่และเด็ก
                สำหรับห้องพิเศษเด็กมีการตกแต่งด้วยบรรยากาศและชุดเครื่องนอนที่สดใส เหมาะสมกับวัยของเด็ก
              </p>

              <div className="room-card__amenities">
                <h3 className="amenities-heading">สิ่งอำนวยความสะดวกภายในห้องพัก</h3>
                <ul className="amenities-grid">
                  {singleAmenities.map((item) => (
                    <li key={item} className="amenity-tag">
                      <span className="amenity-icon-wrap">{getAmenityIcon(item)}</span>
                      <span className="amenity-text">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* ─── หมายเหตุ ─── */}
        <div className="vip-notice-box">
          <div className="notice-icon-circle">
            <AlertTriangle size={24} />
          </div>
          <div className="notice-details">
            <strong className="notice-title">หมายเหตุสำคัญ:</strong>
            <ul className="notice-list">
              <li>อัตราค่าบริการดังกล่าวยังไม่รวมค่าอาหารและบริการทางการแพทย์</li>
              <li>ผู้ป่วยสามารถใช้สิทธิ์เบิกค่าใช้จ่ายได้ตามสิทธิการรักษาพยาบาลที่มี</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
