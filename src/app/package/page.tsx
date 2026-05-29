import Link from 'next/link'
import Image from 'next/image'
import { HeartPulse, ChevronRight } from 'lucide-react'
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
                src="/images/health-check.webp"
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

        </div>

      </div>
    </div>
  )
}
