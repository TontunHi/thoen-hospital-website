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
  clinics: string[]
}

const scheduleData: ScheduleDay[] = [
  {
    day: 'วันจันทร์',
    dayEn: 'Monday',
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
    clinics: [
      'โรคเบาหวาน',
      'โรคระบบประสาทและสมอง',
      'คลินิกจิตเวชเด็ก',
      'บำบัดยาเสพติด',
      'บำบัดบุหรี่และสุรา',
      'คลินิก ARV',
      'บริการ Telemedicine',
    ],
  },
  {
    day: 'วันพุธ',
    dayEn: 'Wednesday',
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
    clinics: [
      'โรคความดันโลหิตสูง',
      'รูมาตอยด์',
      'โรคติดเชื้อ',
      'บำบัดยาเสพติด',
      'บำบัดบุหรี่และสุรา',
      'คลินิกสุขภาพเด็กดี',
      'บริการ Telemedicine',
    ],
  },
  {
    day: 'วันศุกร์',
    dayEn: 'Friday',
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
              คลินิกเฉพาะทาง โรงพยาบาลเถิน
              <span className="specializedHero__subTitle">THOEN HOSPITAL</span>
            </h1>
            <p className="specializedHero__slogan">
              "ให้เราได้ดูแลคุณและคนที่คุณรัก" — ได้รับการรับรองมาตรฐานโรงพยาบาลและการบริการสุขภาพ (HA)
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
              <span className="operatingLabel">วันเปิดให้บริการ</span>
              <strong className="operatingValue">
                วันจันทร์ - วันศุกร์
                <span className="operatingNote">
                  (ในวันและเวลาราชการเท่านั้น
                  <br />
                  *หยุดวันเสาร์ - อาทิตย์ และวันหยุดนักขัตฤกษ์*)
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
              <strong className="operatingValue highlightTime">08.00 - 16.00 น.</strong>
            </div>
          </div>
        </div>

        {/* Weekly Schedule Section */}
        <section className="scheduleSection">
          <div className="sectionHeader">
            <h2 className="sectionTitle">ตารางการเปิดให้บริการคลินิกเฉพาะทาง</h2>
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
                    <strong>เบอร์โทรศัพท์:</strong>
                    <span className="phoneNum">054-291585 (เบอร์โทรศัพท์อัตโนมัติ)</span>
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
