import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { HeartPulse, ChevronRight, Sparkles, Leaf, Stethoscope, Layers } from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { siteConfig } from '@/config/site'
import './page.css'

export const metadata: Metadata = {
  title: 'แพ็กเกจและบริการทางการแพทย์',
  description: 'อัตราค่าบริการและโปรแกรมการรักษา โรงพยาบาลเถิน ตรวจสุขภาพประจำปี ทันตกรรม คลอดบุตร ห้องพิเศษ VIP แพทย์แผนไทย และคลินิกเฉพาะทาง',
  openGraph: {
    title: `แพ็กเกจและบริการ | ${siteConfig.name}`,
    description: 'อัตราค่าบริการและโปรแกรมการรักษา โรงพยาบาลเถิน จังหวัดลำปาง',
  },
}

export default function PackagePage() {
  return (
    <div className="packagePage">
      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '5rem' }}>
        {/* Breadcrumb (N5) */}
        <Breadcrumb items={[{ label: 'แพ็กเกจและบริการ' }]} />

        <header className="packageHeader animate-fadeInUp">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '50px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>
            <Layers size={16} />
            <span>Service Packages & Clinics</span>
          </div>
          <h1>อัตราค่าบริการและโปรแกรมการรักษา</h1>
          <p>เลือกรับบริการตรวจสุขภาพและโปรแกรมการดูแลสุขภาพจากทีมแพทย์ผู้เชี่ยวชาญ โรงพยาบาลเถิน</p>
        </header>

        <div className="packageGrid animate-fadeInUp">
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
                <Link href="/package/health-check-1day" className="packageCard__btn touch-target">
                  <span>ดูรายละเอียด</span>
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
                <Link href="/package/dentistry" className="packageCard__btn touch-target">
                  <span>ดูรายละเอียด</span>
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
                <Link href="/package/vip-room" className="packageCard__btn touch-target">
                  <span>ดูรายละเอียด</span>
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
                <Link href="/package/childbirth" className="packageCard__btn touch-target">
                  <span>ดูรายละเอียด</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 5: Thai Traditional Medicine */}
          <div className="packageCard card-glass">
            <div className="packageCard__image">
              <Image
                src="/images/package/thai-traditional-medicine/thai-traditional-medicine.webp"
                alt="กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก โรงพยาบาลเถิน"
                fill
                style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="packageCard__body">
              <div className="packageCard__icon">
                <Leaf size={24} />
              </div>
              <h3>กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก</h3>
              <p>
                บริการดูแลสุขภาพด้วยศาสตร์แพทย์แผนไทย การนวดรักษา ประคบสมุนไพร พอกเข่า สักยาน้ำมันสมุนไพร อบสมุนไพร และฟื้นฟูสุขภาพหลังคลอด (อยู่ไฟ)
              </p>
              <div className="packageCard__footer">
                <span className="packageCard__price">รับเฉพาะสิทธิเบิกได้</span>
                <Link href="/package/thai-traditional-and-alternative-medicine" className="packageCard__btn touch-target">
                  <span>ดูรายละเอียด</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 6: Specialized Clinics */}
          <div className="packageCard card-glass">
            <div className="packageCard__image">
              <Image
                src="/images/package/specialized-clinics/specialized-clinics.webp"
                alt="คลินิกเฉพาะทาง โรงพยาบาลเถิน"
                fill
                style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="packageCard__body">
              <div className="packageCard__icon">
                <Stethoscope size={24} />
              </div>
              <h3>คลินิกเฉพาะทาง (Specialized Clinics)</h3>
              <p>
                ตรวจรักษาโดยทีมแพทย์คลินิกเฉพาะทาง ครอบคลุมหลากหลายกลุ่มโรค เช่น โรคหัวใจ ผิวหนัง เบาหวาน ความดัน ระบบประสาท โรคไต และบริการ Telemedicine
              </p>
              <div className="packageCard__footer">
                <span className="packageCard__price">เปิดบริการ จ.-ศ. (08:00-16:00 น.)</span>
                <Link href="/package/specialized-clinics" className="packageCard__btn touch-target">
                  <span>ดูรายละเอียด</span>
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
