import Link from 'next/link'
import Image from 'next/image'
import { HeartPulse, ChevronRight, Sparkles } from 'lucide-react'
import './page.css'

export default function PackagePage() {
  return (
    <div className="packagePage">
      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '5rem' }}>
        
        <header className="packageHeader">
          <span className="packageBadge">SERVICE PACKAGES</span>
          <h1>อัตราค่าบริการและโปรแกรมการรักษา</h1>
          <p>เลือกรับบริการตรวจสุขภาพและโปรแกรมการดูแลสุขภาพจากทีมแพทย์ผู้เชี่ยวชาญ โรงพยาบาลเถิน</p>
        </header>

        <div className="packageGrid">
          
          {/* Card 1: Health Check 1 Day */}
          <div className="packageCard card-glass">
            <div className="packageCard__image">
              <Image
                src="/images/package/health-check-1day/health-check.webp"
                alt="โปรแกรมตรวจสุขภาพ รู้ผลได้ใน 1 วัน"
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="packageCard__body">
              <div className="packageCard__icon">
                <HeartPulse size={24} />
              </div>
              <h3>โปรแกรมตรวจสุขภาพ รู้ผลได้ใน 1 วัน</h3>
              <p>
                บริการตรวจวิเคราะห์ครอบคลุมระดับน้ำตาล ไขมัน การทำงานของไต ตับ เอ็กซเรย์ปอด และคลื่นไฟฟ้าหัวใจ ทราบผลและแปลผลตรวจโดยแพทย์ภายในวันเดียว
              </p>
              <div className="packageCard__footer">
                <span className="packageCard__price">เริ่มต้น 50.- บาท</span>
                <Link href="/package/health-check-1day" className="packageCard__btn">
                  ดูรายละเอียด
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 2: Dentistry Services */}
          <div className="packageCard card-glass">
            <div className="packageCard__image">
              <Image
                src="/images/package/dentistry/dentistry.webp"
                alt="บริการด้านทันตกรรม โรงพยาบาลเถิน"
                fill
                style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="packageCard__body">
              <div className="packageCard__icon">
                <Sparkles size={24} />
              </div>
              <h3>บริการด้านทันตกรรม (Dental Care)</h3>
              <p>
                บริการตรวจสุขภาพฟัน อุดฟัน ขูดหินปูน ถอนฟัน รักษารากฟัน ผ่าฟันคุด ทำฟันปลอม และครอบฟัน โดยทีมทันตแพทย์ผู้เชี่ยวชาญพร้อมอุปกรณ์มาตรฐานสากล
              </p>
              <div className="packageCard__footer">
                <span className="packageCard__price">เริ่มตั้งแต่วันที่ 1 เม.ย. 67</span>
                <Link href="/package/dentistry" className="packageCard__btn">
                  ดูรายละเอียด
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>
          {/* Card 3: VIP Room */}
          <div className="packageCard card-glass">
            <div className="packageCard__image">
              <Image
                src="/images/package/vip-room/vip_room_1.webp"
                alt="ห้องพิเศษ VIP โรงพยาบาลเถิน"
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="packageCard__body">
              <div className="packageCard__icon">
                <Sparkles size={24} />
              </div>
              <h3>ห้องพิเศษ VIP และห้องพิเศษเดี่ยว</h3>
              <p>
                ห้องพักฟื้นระดับพรีเมียม ตกแต่งอย่างอบอุ่น พร้อมสิ่งอำนวยความสะดวกครบครัน
                รองรับทั้งผู้ใหญ่และเด็ก เพื่อความเป็นส่วนตัวตลอดช่วงเวลาการพักฟื้น
              </p>
              <div className="packageCard__footer">
                <span className="packageCard__price">เริ่มต้น 1,200 บาท / วัน</span>
                <Link href="/package/vip-room" className="packageCard__btn">
                  ดูรายละเอียด
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 4: Childbirth Packages */}
          <div className="packageCard card-glass">
            <div className="packageCard__image">
              <Image
                src="/images/package/childbirth/childbirth.webp"
                alt="คลอดบุตร โรงพยาบาลเถิน"
                fill
                style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="packageCard__body">
              <div className="packageCard__icon">
                <HeartPulse size={24} />
              </div>
              <h3>คลอดบุตร (Childbirth Packages)</h3>
              <p>
                โปรแกรมเตรียมคลอดปกติ คลอดปกติพร้อมทำหมัน ผ่าตัดคลอด และผ่าตัดคลอดพร้อมทำหมัน ดูแลอย่างอบอุ่นโดยแพทย์และทีมพยาบาลผู้เชี่ยวชาญ
              </p>
              <div className="packageCard__footer">
                <span className="packageCard__price">เริ่มต้น 5,000.- บาท</span>
                <Link href="/package/childbirth" className="packageCard__btn">
                  ดูรายละเอียด
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
