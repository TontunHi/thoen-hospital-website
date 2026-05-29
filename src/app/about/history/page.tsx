import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export const metadata: Metadata = {
  title: 'ประวัติความเป็นมา | โรงพยาบาลเถิน',
  description: 'เส้นทางการเติบโตของโรงพยาบาลเถินตั้งแต่จุดเริ่มต้น พ.ศ. ๒๕๓๕ จนถึงปัจจุบัน และพื้นที่รับผิดชอบการดูแลสุขภาพ',
}

export default function HospitalHistoryPage() {
  const timelineEvents = [
    {
      year: 'พ.ศ. 2535',
      text: 'โรงพยาบาลเถินเริ่มก่อสร้าง มีข้าราชการจำนวน 2 คน โดยใช้เรือนจ่ายยาของสถานีอนามัยทำการตรวจรักษาคนไข้เบื้องต้น'
    },
    {
      year: 'พ.ศ. 2536',
      text: 'สำนักงานสาธารณสุขอำเภอได้จัดซื้อวัสดุครุภัณฑ์ทางการแพทย์ เพื่อเตรียมรองรับและขับเคลื่อนการทำงานในโรงพยาบาลชุมชนแห่งใหม่'
    },
    {
      year: 'พ.ศ. 2538',
      text: 'ดำเนินการก่อสร้างอาคารผู้ป่วยนอก (OPD) และอาคารหลักสำเร็จเสร็จสิ้น ณ บ้านแม่แก้ว หมู่ที่ 4 ตำบลล้อมแรด อำเภอเถิน'
    },
    {
      year: 'พ.ศ. 2540',
      text: 'ร่วมประชุมวางแผนงานเชิงนโยบายและจัดสรรงบประมาณจากการร่วมบริจาคของประชาชนในพื้นที่ เพื่อขยายศักยภาพความเป็นโรงพยาบาลในเขตหมู่ที่ 9 ตำบลล้อมแรด'
    },
    {
      year: 'ปัจจุบัน',
      text: 'โรงพยาบาลเถินเป็นโรงพยาบาลชุมชนระดับทุติยภูมิขนาด 90 เตียง มุ่งพัฒนาบริการและดูแลรักษาผู้ป่วยในพื้นที่อำเภอเถิน จังหวัดลำปาง'
    }
  ]

  const stats = [
    { value: '90', label: 'เตียง', sub: 'ขนาดบริการผู้ป่วยใน' },
    { value: '24', label: 'ชั่วโมง', sub: 'ระบบบริการฉุกเฉิน' },
    { value: '86,000', label: 'ประชากร', sub: 'ดูแลในเขตเครือข่าย' },
    { value: '3', label: 'อำเภอหลัก', sub: 'เถิน แม่พริก และใกล้เคียง' }
  ]

  return (
    <div className="historyPage">
      {/* Hero Section */}
      <section className="historyHero">
        <div className="container">
          <h1 className="heroTitle">ประวัติความเป็นมา</h1>
          <p className="heroDesc">โรงพยาบาลเถินใส่ใจชุมชน</p>
        </div>
      </section>

      <div className="container pageContent">
        {/* Intro Section with Image */}
        <section className="introSection card">
          <div className="introGrid">
            <div className="introContent">
              <span className="sectionTag">OUR STORY</span>
              <h2>เส้นทางการเติบโตของโรงพยาบาลเถิน</h2>
              <p className="introText">
                เส้นทางการเติบโตของโรงพยาบาลเถินตั้งแต่จุดเริ่มต้นเล็ก ๆ สู่การเป็นศูนย์บริการสุขภาพที่อบอุ่นและปลอดภัยของชุมชน 
                เราไม่หยุดพัฒนาเพื่อมอบบริการทางการแพทย์ที่มีมาตรฐาน ทั่วถึง และเท่าเทียมให้กับทุกคน
              </p>
              
              <div className="highlightFeatureGrid">
                <div className="featureItem">
                  <span className="featureIcon featureIcon--accent">—</span>
                  <div className="featureText">
                    <h4>บริการ 24 ชั่วโมง</h4>
                    <p>ระบบฉุกเฉินและการดูแลผู้รักษาพยาบาลตลอดวัน</p>
                  </div>
                </div>
                <div className="featureItem">
                  <span className="featureIcon featureIcon--accent">—</span>
                  <div className="featureText">
                    <h4>เครือข่ายชุมชน</h4>
                    <p>เชื่อมโยงประสานความร่วมมือหน่วยบริการสุขภาพอย่างใกล้ชิด</p>
                  </div>
                </div>
                <div className="featureItem">
                  <span className="featureIcon featureIcon--accent">—</span>
                  <div className="featureText">
                    <h4>มาตรฐานปลอดภัย</h4>
                    <p>บริการสุขภาพด้วยมาตรฐานความปลอดภัยระดับชุมชน</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="introImageWrapper">
              <Image
                src="/images/about-history-1.webp"
                alt="ประวัติโรงพยาบาลเถิน"
                width={600}
                height={400}
                style={{ objectFit: 'cover', borderRadius: '12px' }}
                priority
              />
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="timelineSection">
          <div className="sectionHeader textCenter">
            <span className="sectionTag">MILESTONES</span>
            <h2>เรื่องราวของเราและการเติบโต</h2>
            <p>บันทึกประวัติศาสตร์และการเปลี่ยนผ่านครั้งสำคัญของโรงพยาบาลเถิน</p>
          </div>

          <div className="timelineContainer">
            {timelineEvents.map((event, idx) => (
              <div key={idx} className="timelineItem">
                <div className="timelineBadge">{event.year}</div>
                <div className="timelineCard card">
                  <h3>{event.year}</h3>
                  <p>{event.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Vision & Care Section */}
        <section className="careVisionCard card bg-teal-dark">
          <div className="careVisionContent">
            <h2>วิสัยทัศน์การดูแลสุขภาพ</h2>
            <p>
              "เราให้ความสำคัญกับการบริการที่อบอุ่น ปลอดภัย และเข้าถึงง่าย 
              พร้อมทั้งเดินหน้ายกระดับการพัฒนาคุณภาพบริการด้วยมาตรฐานด้านสาธารณสุขอย่างต่อเนื่อง เพื่อสร้างสุขภาวะที่ดีอย่างยั่งยืนให้กับประชาชนทุกคน"
            </p>
          </div>
        </section>

        {/* Services & Responsibilities */}
        <section className="serviceSection card">
          <div className="serviceGrid">
            <div className="serviceImageWrapper">
              <Image
                src="/images/about-history-2.webp"
                alt="บทบาทและภารกิจการรักษา"
                width={600}
                height={400}
                style={{ objectFit: 'cover', borderRadius: '12px' }}
              />
            </div>

            <div className="serviceContent">
              <span className="sectionTag font-orange">ROLES & MISSION</span>
              <h2>การให้บริการ บทบาท และภารกิจ</h2>
              <p>
                โรงพยาบาลเถินดำเนินภารกิจด้านการให้บริการส่งเสริมสุขภาพ การป้องกันโรค การรักษาพยาบาล และการฟื้นฟูสมรรถภาพ โดยเน้นระบบบริการสุขภาพปฐมภูมิ ให้บริการตลอด 24 ชั่วโมงในปฏิบัติการฉุกเฉิน
              </p>
              <p>
                ให้บริการผู้ป่วยนอกและผู้ป่วยใน ด้วยความปลอดภัย เป็นมิตร และมีมาตรฐานระดับชุมชน เชื่อมกับหน่วยบริการสุขภาพเครือข่าย โรงพยาบาลแม่พริก และโรงพยาบาลเครือข่ายอื่น ๆ เป็นโครงข่ายบริการแบบบูรณาการ ร่วมกับภาคีเครือข่ายในพื้นที่ ทั้งหน่วยงานภาครัฐ เอกชน นักศึกษา และสถาบันการศึกษา
              </p>
            </div>
          </div>
        </section>

        {/* Areas & Statistics */}
        <section className="areasSection">
          <div className="areasGrid">
            <div className="areaInfoCard card">
              <span className="sectionTag">RESPONSIBILITY</span>
              <h2>พื้นที่รับผิดชอบและกลุ่มเป้าหมาย</h2>
              <p>
                เป็นพื้นที่ของโรงพยาบาลชุมชนขนาด 90 เตียง แต่งตั้งโรงพยาบาลชุมชนเป็นหน่วยงานหลัก ดูแลประชาชนในพื้นที่รับผิดชอบ ผู้มีสิทธิทุกระบบตามที่กฎหมายกำหนด
              </p>
              <p>
                มีระบบการบริหารการจัดการและสนับสนุนด้านสุขภาพในพื้นที่อย่างทั่วถึงตามนโยบายสาธารณสุข การบริการสุขภาพเชิงรุกต่อเนื่อง โดยมีการดำเนินงานในเขตเครือข่ายบริการ 86,000 คน แยกเป็นเด็กเล็ก เด็กวัยเรียน วัยทำงาน ผู้สูงอายุ และผู้ป่วย ครอบคลุมพื้นที่อำเภอเถิน อำเภอแม่พริก และอำเภอใกล้เคียง
              </p>
            </div>

            <div className="statsBlock card">
              <h3>ข้อมูลภาพรวมการบริการ</h3>
              <div className="statsGrid">
                {stats.map((stat, idx) => (
                  <div key={idx} className="statItem">
                    <span className="statValue">{stat.value}</span>
                    <span className="statLabel">{stat.label}</span>
                    <span className="statSub">{stat.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
