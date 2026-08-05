import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Heart, 
  Sparkles,
  Info,
  Building2
} from 'lucide-react'
import './page.css'

export const metadata: Metadata = {
  title: 'คลินิกเฉพาะทาง | โรงพยาบาลเถิน',
  description:
    'บริการตรวจรักษาโดยทีมแพทย์คลินิกเฉพาะทาง ครอบคลุมหลากหลายกลุ่มโรค โรงพยาบาลเถิน จังหวัดลำปาง',
}

interface ScheduleDay {
  day: string
  dayEn: string
  color: string
  clinics: string[]
}

const scheduleData: ScheduleDay[] = [
  {
    day: 'วันจันทร์',
    dayEn: 'Monday',
    color: '#e0f2fe',
    clinics: [
      'โรคหัวใจ',
      'โรคผิวหนัง',
      'ไวรัสตับอักเสบ',
      'บำบัดยาเสพติด',
      'คลินิกเบาหวาน / ความดัน (ปฐมภูมิฯ)',
      'บริการ Telemedicine',
    ],
  },
  {
    day: 'วันอังคาร',
    dayEn: 'Tuesday',
    color: '#fce7f3',
    clinics: [
      'โรคเบาหวาน',
      'โรคระบบประสาทและสมอง',
      'คลินิกจิตเวชเด็ก',
      'บำบัดยาเสพติด / บำบัดบุหรี่และสุรา',
      'คลินิก ARV',
      'บริการ Telemedicine',
    ],
  },
  {
    day: 'วันพุธ',
    dayEn: 'Wednesday',
    color: '#dcfce7',
    clinics: [
      'โรคเบาหวาน',
      'โรคไทรอยด์',
      'โรคทางเดินอาหาร',
      'คลินิกจิตเวชผู้ใหญ่',
      'บริการ Telemedicine',
    ],
  },
  {
    day: 'วันพฤหัสบดี',
    dayEn: 'Thursday',
    color: '#ffedd5',
    clinics: [
      'โรคความดันโลหิตสูง',
      'รูมาตอยด์',
      'โรคติดเชื้อ',
      'บำบัดยาเสพติด / บำบัดบุหรี่และสุรา',
      'คลินิกสุขภาพเด็กดี',
      'บริการ Telemedicine',
    ],
  },
  {
    day: 'วันศุกร์',
    dayEn: 'Friday',
    color: '#e0e7ff',
    clinics: [
      'โรคปอดอุดกั้นเรื้อรัง',
      'โรคหอบหืด',
      'โรคไต',
      'ไขมันในเส้นเลือด',
      'บำบัดยาเสพติด',
      'คลินิกโรคจากการทำงาน',
      'คลินิกวัณโรค',
      'บริการ Telemedicine',
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
                <span className="operatingNote"> (ในวันและเวลาราชการเท่านั้น *ยกเว้นวันหยุดราชการและวันหยุดนักขัตฤกษ์*)</span>
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
            <span className="sectionBadge">WEEKLY SCHEDULE</span>
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
                      <span>{clinic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Poster Image Section */}
        <section className="posterSection card">
          <div className="posterHeader">
            <Info size={20} />
            <h3>แผ่นพับประชาสัมพันธ์ตารางคลินิกเฉพาะทาง</h3>
          </div>
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
                <li>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="iconFb">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <div>
                    <strong>Facebook Fanpage:</strong>
                    <span>โรงพยาบาลเถิน ลำปาง</span>
                  </div>
                </li>
                <li>
                  <MapPin size={18} className="iconMap" />
                  <div>
                    <strong>สถานที่ตั้ง:</strong>
                    <span>โรงพยาบาลเถิน จังหวัดลำปาง</span>
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
