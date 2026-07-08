import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Leaf, 
  Clock, 
  Phone, 
  MapPin, 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2,
  Sparkles,
  Calendar
} from 'lucide-react'
import { FacebookIcon } from '@/components/common/Icons'
import './page.css'

export const metadata: Metadata = {
  title: 'กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก | โรงพยาบาลเถิน',
  description:
    'บริการดูแลสุขภาพด้วยศาสตร์การแพทย์แผนไทย มุ่งเน้นการรักษา ฟื้นฟู และส่งเสริมสุขภาพด้วยภูมิปัญญาไทย โดยทีมแพทย์แผนไทยประยุกต์และเจ้าหน้าที่ผู้เชี่ยวชาญ โรงพยาบาลเถิน ลำปาง',
}

const servicesList = [
  {
    title: 'นวดรักษา',
    description: 'การนวดเพื่อบำบัดรักษาโรค อาการปวดเมื่อย กล้ามเนื้อตึง หรืออาการทางระบบโครงร่างและกล้ามเนื้อ โดยการตรวจวินิจฉัยจากแพทย์แผนไทย',
  },
  {
    title: 'ประคบสมุนไพร',
    description: 'การใช้ลูกประคบสมุนไพรสดหรือแห้งนึ่งร้อน ประคบบริเวณที่มีอาการเพื่อช่วยกระตุ้นการไหลเวียนโลหิต ลดอาการปวด บวม และอักเสบของกล้ามเนื้อ',
  },
  {
    title: 'พอกเข่าด้วยยาสมุนไพร',
    description: 'การใช้ยาสมุนไพรสูตรเฉพาะพอกบริเวณข้อเข่า เพื่อบรรเทาอาการปวดเข่า เข่าเสื่อม หรืออาการอักเสบของข้อเข่า',
  },
  {
    title: 'สักยาน้ำมันสมุนไพร',
    description: 'ศาสตร์การรักษาเฉพาะทาง โดยการใช้ตัวยาสมุนไพรควบคู่กับน้ำมันงาหรือน้ำมันสมุนไพร แทรกซึมเข้าสู่ผิวหนังเพื่อรักษาอาการปวดเรื้อรัง พังผืด หรืออาการทางระบบประสาท',
  },
  {
    title: 'อบสมุนไพร',
    description: 'การเข้าตู้อบไอน้ำที่ต้มด้วยสมุนไพรสดหลากชนิด ช่วยขับเหงื่อ ขับสารพิษ ผ่อนคลายกล้ามเนื้อ และบำรุงผิวพรรณ',
  },
  {
    title: 'ฟื้นฟูสุขภาพหลังคลอด (อยู่ไฟ)',
    description: 'โปรแกรมดูแลคุณแม่หลังคลอด เพื่อช่วยขับน้ำคาวปลา ช่วยให้มดลูกเข้าอู่เร็วขึ้น และกระตุ้นการน้ำนมด้วยศาสตร์แผนไทย',
  },
]

export default function ThaiTraditionalMedicinePage() {
  return (
    <div className="traditionalMedicinePage">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
        
        {/* Hero Section */}
        <section className="medicineHero">
          <div className="medicineHero__bg" aria-hidden="true" />
          <div className="medicineHero__content">
            <span className="medicineHero__badge">
              <Sparkles size={14} />
              Thai Traditional and Alternative Medicine Department
            </span>
            <h1 className="medicineHero__title">
              การแพทย์แผนไทยและการแพทย์ทางเลือก
              <span className="medicineHero__subTitle">โรงพยาบาลเถิน THOEN HOSPITAL</span>
            </h1>
            <p className="medicineHero__slogan">
              บริการดูแลสุขภาพด้วยศาสตร์การแพทย์แผนไทย มุ่งเน้นการรักษา ฟื้นฟู และส่งเสริมสุขภาพด้วยภูมิปัญญาไทย โดยทีมแพทย์แผนไทยประยุกต์และเจ้าหน้าที่ผู้เชี่ยวชาญ
            </p>
          </div>
        </section>

        {/* Content Layout */}
        <div className="medicineLayout">
          {/* Main Content Area */}
          <div className="medicineMain">
            <section className="medicineSection">
              <h2 className="sectionTitle">
                <Leaf size={24} />
                บริการของเรา (Our Services)
              </h2>
              <p className="sectionSubtitle">
                เรามีบริการที่หลากหลายเพื่อตอบสนองความต้องการในการรักษาและฟื้นฟูร่างกาย ดังนี้
              </p>

              <div className="servicesGrid">
                {servicesList.map((service, index) => (
                  <div className="serviceItemCard" key={index}>
                    <div className="serviceIconWrapper">
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="serviceContent">
                      <h3>{index + 1}. {service.title}</h3>
                      <p>{service.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <aside className="medicineSidebar">
            {/* Hours */}
            <div className="hoursCard">
              <h3 className="hoursTitle">
                <Clock size={20} />
                เวลาทำการ (Service Hours)
              </h3>
              <ul className="hoursList">
                <li>
                  <span className="hoursDay">วันจันทร์ - วันศุกร์</span>
                  <span className="hoursTime">08.00 - 16.00 น.</span>
                </li>
                <li>
                  <span className="hoursDay">นอกเวลาราชการ (วันเสาร์)</span>
                  <span className="hoursTime">08.00 - 16.00 น.</span>
                </li>
              </ul>
            </div>

            {/* Contact & Booking */}
            <div className="contactCard">
              <h3 className="contactTitle">
                <Calendar size={20} />
                ติดต่อสอบถามและนัดหมาย
              </h3>
              <p className="sectionSubtitle" style={{ marginBottom: '1.25rem' }}>
                กรุณาโทรสอบถามหรือนัดหมายล่วงหน้าก่อนเข้ารับบริการเพื่อความสะดวกของท่าน
              </p>
              <div className="contactInfoList">
                <div className="contactInfoItem">
                  <Phone size={18} className="contactInfoIcon" />
                  <div className="contactInfoText">
                    <span className="contactInfoLabel">เบอร์โทรศัพท์ภายใน</span>
                    <span className="contactInfoVal">054-292016 ต่อ 2108</span>
                  </div>
                </div>
                <div className="contactInfoItem">
                  <Phone size={18} className="contactInfoIcon" />
                  <div className="contactInfoText">
                    <span className="contactInfoLabel">เบอร์โทรศัพท์อัตโนมัติ (รพ.เถิน)</span>
                    <span className="contactInfoVal">054-291585</span>
                  </div>
                </div>
                <div className="contactInfoItem">
                  <FacebookIcon className="contactInfoIcon" style={{ width: '18px', height: '18px' }} />
                  <div className="contactInfoText">
                    <span className="contactInfoLabel">Facebook Page</span>
                    <span className="contactInfoVal">
                      <a href="https://www.facebook.com/thoenhospital" target="_blank" rel="noopener noreferrer">
                        โรงพยาบาลเถิน ลำปาง
                      </a>
                    </span>
                  </div>
                </div>
                <div className="contactInfoItem">
                  <MapPin size={18} className="contactInfoIcon" />
                  <div className="contactInfoText">
                    <span className="contactInfoLabel">สถานที่ตั้ง</span>
                    <span className="contactInfoVal">กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก โรงพยาบาลเถิน จังหวัดลำปาง</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Poster Image Section */}
        <section className="medicineImageSection">
          <div className="imageWrapper">
            <Image
              src="/images/package/thai-traditional-medicine/thai-traditional-medicine.webp"
              alt="บริการแพทย์แผนไทยและการแพทย์ทางเลือก โรงพยาบาลเถิน"
              width={800}
              height={800}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </section>

      </div>
    </div>
  )
}
