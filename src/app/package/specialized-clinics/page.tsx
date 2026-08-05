import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  Phone, 
  CheckCircle2, 
  Heart, 
  Sparkles,
  Building2
} from 'lucide-react'
import './page.css'

export const metadata: Metadata = {
  title: 'คลินิกเฉพาะทาง | โรงพยาบาลเถิน',
  description:
    'บริการตรวจรักษาโดยทีมแพทย์คลินิกเฉพาะทาง ครอบคลุมหลากหลายกลุ่มโรค โรงพยาบาลเถิน จังหวัดลำปาง',
}

interface ClinicItemData {
  name: string
  sub?: string
}

interface ScheduleDay {
  day: string
  dayEn: string
  color: string
  clinics: ClinicItemData[]
}

const scheduleData: ScheduleDay[] = [
  {
    day: 'วันจันทร์',
    dayEn: 'Monday',
    color: '#e0f2fe',
    clinics: [
      { name: 'โรคหัวใจ' },
      { name: 'โรคผิวหนัง' },
      { name: 'ไวรัสตับอักเสบ' },
      { name: 'บำบัดยาเสพติด' },
      { name: 'คลินิกเบาหวาน', sub: 'ความดัน (ปฐมภูมิฯ)' },
      { name: 'บริการ Telemedicine' },
    ],
  },
  {
    day: 'วันอังคาร',
    dayEn: 'Tuesday',
    color: '#fce7f3',
    clinics: [
      { name: 'โรคเบาหวาน' },
      { name: 'โรคระบบประสาทและสมอง' },
      { name: 'คลินิกจิตเวชเด็ก' },
      { name: 'บำบัดยาเสพติด', sub: 'บำบัดบุหรี่และสุรา' },
      { name: 'คลินิก ARV' },
      { name: 'บริการ Telemedicine' },
    ],
  },
  {
    day: 'วันพุธ',
    dayEn: 'Wednesday',
    color: '#dcfce7',
    clinics: [
      { name: 'โรคเบาหวาน' },
      { name: 'โรคไทรอยด์' },
      { name: 'โรคทางเดินอาหาร' },
      { name: 'คลินิกจิตเวชผู้ใหญ่' },
      { name: 'บริการ Telemedicine' },
    ],
  },
  {
    day: 'วันพฤหัสบดี',
    dayEn: 'Thursday',
    color: '#ffedd5',
    clinics: [
      { name: 'โรคความดันโลหิตสูง' },
      { name: 'รูมาตอยด์' },
      { name: 'โรคติดเชื้อ' },
      { name: 'บำบัดยาเสพติด', sub: 'บำบัดบุหรี่และสุรา' },
      { name: 'คลินิกสุขภาพเด็กดี' },
      { name: 'บริการ Telemedicine' },
    ],
  },
  {
    day: 'วันศุกร์',
    dayEn: 'Friday',
    color: '#e0e7ff',
    clinics: [
      { name: 'โรคปอดอุดกั้นเรื้อรัง' },
      { name: 'โรคหอบหืด' },
      { name: 'โรคไต' },
      { name: 'ไขมันในเส้นเลือด' },
      { name: 'บำบัดยาเสพติด' },
      { name: 'คลินิกโรคจากการทำงาน' },
      { name: 'คลินิกวัณโรค' },
      { name: 'บริการ Telemedicine' },
    ],
  },
]

export default function SpecializedClinicsPage() {
  return (
    <div className="specializedPage">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
        
        {/* Hero Banner */}
        <section className="specializedHero">
          <div className="specializedHero__bg" aria-hidden="true" />
          <div className="specializedHero__content">
            <span className="specializedHero__badge">
              <Stethoscope size={16} />
              SPECIALTY CLINICS
            </span>
            <h1 className="specializedHero__title">
              คลินิกเฉพาะทาง (Specialized Clinics)
              <span className="specializedHero__subTitle">โรงพยาบาลเถิน THOEN HOSPITAL</span>
            </h1>
            <p className="specializedHero__slogan">
              โรงพยาบาลเถินพร้อมให้บริการตรวจรักษาโดยทีมแพทย์คลินิกเฉพาะทาง ครอบคลุมหลากหลายกลุ่มโรค
              เพื่อให้ผู้ป่วยได้รับบริการที่ตรงจุด มีคุณภาพ และมีประสิทธิภาพสูงสุด
            </p>
          </div>
        </section>

        {/* Operating Hours Card */}
        <div className="operatingHoursCard card-glass">
          <div className="operatingItem">
            <div className="operatingIcon">
              <Calendar size={24} />
            </div>
            <div className="operatingDetails">
              <span className="operatingLabel">วันเปิดทำการ</span>
              <strong className="operatingValue">
                วันจันทร์ – วันศุกร์
                <span className="operatingNote">
                  (ในวันและเวลาราชการเท่านั้น
                  <br />
                  *ยกเว้นวันหยุดราชการและวันหยุดนักขัตฤกษ์*)
                </span>
              </strong>
            </div>
          </div>
          <div className="operatingDivider" />
          <div className="operatingItem">
            <div className="operatingIcon">
              <Clock size={24} />
            </div>
            <div className="operatingDetails">
              <span className="operatingLabel">เวลาทำการ</span>
              <strong className="operatingValue highlightTime">08:00 - 16:00 น.</strong>
            </div>
          </div>
        </div>

        {/* Weekly Schedule Section */}
        <section className="scheduleSection">
          <div className="sectionHeader">
            <h2 className="sectionTitle">ตารางการออกตรวจ คลินิกเฉพาะทาง</h2>
            <p className="sectionSubtitle">
              ให้บริการออกตรวจโรคและคลินิกเฉพาะทางประจำวัน จันทร์ - ศุกร์ โดยทีมแพทย์และบุคลากรทางการแพทย์
            </p>
          </div>

          <div className="scheduleGrid">
            {scheduleData.map((item) => (
              <div key={item.day} className="dayCard">
                <div className="dayHeader">
                  <div className="dayBadge">
                    <span className="dayTitle">{item.day}</span>
                    <span className="dayEn">({item.dayEn})</span>
                  </div>
                </div>

                <ul className="clinicList">
                  {item.clinics.map((clinic, idx) => (
                    <li key={idx} className="clinicItem">
                      <CheckCircle2 size={16} className="clinicIcon" />
                      <div className="clinicText">
                        <span className="clinicName">{clinic.name}</span>
                        {clinic.sub && <span className="clinicSub">{clinic.sub}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Poster Image Section */}
        <section className="posterSection card">
          <div className="posterImageWrapper">
            <Image
              src="/images/package/specialized-clinics/specialized-clinics.webp"
              alt="ตารางการออกตรวจ คลินิกเฉพาะทาง โรงพยาบาลเถิน"
              width={900}
              height={1200}
              className="posterImg"
              priority
            />
          </div>
        </section>

        {/* Contact & Footer Section */}
        <section className="contactCard">
          <div className="contactGrid">
            <div className="contactInfoGroup">
              <h3 className="contactTitle">
                <Building2 size={20} />
                ช่องทางการติดต่อ
              </h3>
              <ul className="contactList">
                <li>
                  <Phone size={18} className="iconPhone" />
                  <div>
                    <strong>เบอร์โทรศัพท์ (ระบบอัตโนมัติ):</strong>
                    <span className="phoneNum">054-291585</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="sloganBox">
              <div className="heartIconWrap">
                <Heart size={28} />
              </div>
              <blockquote className="sloganText">
                "ให้เราได้ดูแลคุณ และคนที่คุณรัก — มาตรฐานโรงพยาบาลและการบริการสุขภาพ"
              </blockquote>
              <span className="hospitalTag">โรงพยาบาลเถิน จังหวัดลำปาง</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
