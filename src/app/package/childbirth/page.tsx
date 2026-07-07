import Image from 'next/image'
import Link from 'next/link'
import { Check, X, Phone, Calendar, Heart, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react'
import './page.css'

export const metadata = {
  title: 'แพ็กเกจคลอดบุตร | โรงพยาบาลเถิน',
  description: 'แพ็กเกจคลอดบุตร โรงพยาบาลเถิน ลำปาง - บริการคลอดปกติ ผ่าตัดคลอด พร้อมอัตราค่าบริการและสิ่งอำนวยความสะดวกครบครัน',
}

export default function ChildbirthPackagePage() {
  const packageItems = [
    {
      name: 'คลอดปกติ (2 คืน 3 วัน)',
      normalRoom: '5,000',
      standardRoom: '6,200',
      vipRoom: '6,800',
    },
    {
      name: 'คลอดปกติ + ทำหมัน',
      normalRoom: '9,500',
      standardRoom: '12,000',
      vipRoom: '12,600',
    },
    {
      name: 'ผ่าตัดคลอด (3 คืน 4 วัน)',
      normalRoom: '15,500',
      standardRoom: '17,000',
      vipRoom: '17,600',
    },
    {
      name: 'ผ่าตัดคลอด + ทำหมัน',
      normalRoom: '22,000',
      standardRoom: '25,000',
      vipRoom: '25,600',
    },
  ]

  const inclusions = [
    'ค่าแพทย์และทีมพยาบาลทำคลอด/ผ่าตัดคลอด',
    'ค่าห้องพักฟื้นและค่าอาหารตามเวลาพักฟื้นที่กำหนด',
    'ค่ายา เวชภัณฑ์ และน้ำเกลือระหว่างการพักฟื้น',
    'การบริการดูแลสอนทักษะการเลี้ยงลูกด้วยนมแม่และการอาบน้ำบุตร',
  ]

  const exclusions = [
    'ค่าใช้จ่ายส่วนตัวของบุตร (เช่น นมผง ผ้าอ้อมสำเร็จรูป)',
    'ภาวะแทรกซ้อนที่เกิดขึ้นนอกเหนือจากรายการทำคลอดปกติ',
    'ค่าห้องพักฟื้นและค่าอาหารส่วนเกินกรณีพักฟื้นเกินกำหนด',
  ]

  const supportedRights = [
    { name: 'จ่ายเงินเอง', desc: 'ชำระค่าบริการตามจริงของราคาแพ็กเกจ' },
    { name: 'สิทธิประกันสังคม', desc: 'ใช้สิทธิคลอดบุตรประกันสังคม เบิกจ่ายตามเกณฑ์' },
    { name: 'สิทธิบัตรทอง (30 บาท)', desc: 'ใช้สิทธิได้ตามเงื่อนไข (ยกเว้นค่าห้องพิเศษส่วนเกิน)' },
    { name: 'สิทธิข้าราชการ (จ่ายตรง)', desc: 'เบิกได้ตามสิทธิราชการ (ยกเว้นค่าห้องพิเศษส่วนเกิน)' },
  ]

  return (
    <div className="childbirthPage">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
        

        {/* Hero Section */}
        <section className="childbirthHero">
          <div className="childbirthHero__bg">
            <Image
              src="/images/package/childbirth/childbirth.webp"
              alt="แพ็กเกจคลอดบุตร โรงพยาบาลเถิน"
              fill
              priority
              style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
              sizes="100vw"
            />
            <div className="childbirthHero__overlay" />
          </div>
          <div className="childbirthHero__content">
            <span className="childbirthHero__badge">
              <Heart size={16} fill="currentColor" />
              MATERNITY PACKAGE
            </span>
            <h1 className="childbirthHero__title">
              คลอดบุตร (Childbirth Packages)
              <span className="childbirthHero__subTitle">โรงพยาบาลเถิน THOEN HOSPITAL</span>
            </h1>
            <p className="childbirthHero__slogan">
              "ให้เราได้ดูแลคุณและคนที่คุณรัก ในช่วงเวลาที่สำคัญที่สุด"
            </p>
          </div>
        </section>

        {/* Content Layout */}
        <div className="childbirthGrid">
          
          <div className="childbirthMainContent">
            

            {/* Pricing Section */}
            <section className="childbirthSection card">
              <h2 className="sectionTitle">1. อัตราค่าบริการคลอดบุตร</h2>
              <p className="sectionSubtitle">*ราคารวมครอบคลุมระยะเวลาพักฟื้นตามมาตรฐานทางการแพทย์</p>
              
              {/* Responsive Desktop Table */}
              <div className="tableResponsive">
                <table className="pricingTable">
                  <thead>
                    <tr>
                      <th>ประเภทการคลอด / บริการ</th>
                      <th>ห้องธรรมดา</th>
                      <th>ห้องพิเศษ (Standard)</th>
                      <th>ห้องพิเศษ (VIP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packageItems.map((pkg, idx) => (
                      <tr key={idx}>
                        <td className="packageName">{pkg.name}</td>
                        <td className="priceCell">{pkg.normalRoom}.-</td>
                        <td className="priceCell highlightCell">{pkg.standardRoom}.-</td>
                        <td className="priceCell">{pkg.vipRoom}.-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout for Table */}
              <div className="mobilePricingCards">
                {packageItems.map((pkg, idx) => (
                  <div key={idx} className="mobilePricingCard">
                    <h4>{pkg.name}</h4>
                    <div className="mobilePriceRow">
                      <span className="roomType">ห้องธรรมดา:</span>
                      <span className="roomPrice">{pkg.normalRoom}.-</span>
                    </div>
                    <div className="mobilePriceRow highlightRow">
                      <span className="roomType">ห้องพิเศษ (Standard):</span>
                      <span className="roomPrice">{pkg.standardRoom}.-</span>
                    </div>
                    <div className="mobilePriceRow">
                      <span className="roomType">ห้องพิเศษ (VIP):</span>
                      <span className="roomPrice">{pkg.vipRoom}.-</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Inclusions and Exclusions Details */}
            <section className="childbirthSection card conditionsSection">
              <h2 className="sectionTitle">2. รายละเอียดและเงื่อนไขการใช้บริการ</h2>
              <p className="sectionSubtitle">รายละเอียดรายการต่าง ๆ ที่รวมและไม่รวมอยู่ในอัตราค่าบริการของแพ็กเกจ</p>
              
              <div className="conditionsGrid">
                {/* Inclusions Card */}
                <div className="conditionCard inclusions">
                  <div className="conditionHeader text-teal">
                    <Check size={20} />
                    <h3>รายการที่รวมในแพ็กเกจ</h3>
                  </div>
                  <ul className="conditionList">
                    {inclusions.map((item, idx) => (
                      <li key={idx}>
                        <Check size={16} className="listIcon" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exclusions Card */}
                <div className="conditionCard exclusions">
                  <div className="conditionHeader text-rose">
                    <X size={20} />
                    <h3>รายการที่ไม่รวมในแพ็กเกจ</h3>
                  </div>
                  <ul className="conditionList">
                    {exclusions.map((item, idx) => (
                      <li key={idx}>
                        <AlertCircle size={16} className="listIcon" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Supported Rights Section */}
            <section className="childbirthSection card">
              <h2 className="sectionTitle">3. สิทธิการรักษาที่รองรับ</h2>
              <p className="sectionSubtitle">โรงพยาบาลเถินรองรับสิทธิการรักษาหลากหลายรูปแบบเพื่อลดภาระค่าใช้จ่ายสำหรับผู้รับบริการ</p>
              
              <div className="rightsGrid">
                {supportedRights.map((right, idx) => (
                  <div key={idx} className="rightCard">
                    <div className="rightIconWrapper">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="rightContent">
                      <h3>{right.name}</h3>
                      <p>{right.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Contact / CTA Section */}
            <section className="childbirthSection card contactSection">
              <h2 className="sectionTitle">4. สอบถามรายละเอียดเพิ่มเติมและนัดหมาย</h2>
              <p className="sectionSubtitle">ติดต่อสอบถามข้อมูลการฝากครรภ์ การทำคลอด หรือการเข้าพักฟื้น</p>
              
              <div className="contactInfoGrid">
                <div className="contactLinkCard">
                  <div className="contactIconWrapper">
                    <Phone size={24} />
                  </div>
                  <div className="contactDetails">
                    <h4 className="contactTitleText">ห้องคลอด โรงพยาบาลเถิน</h4>
                    <span className="phoneNum">088-2902395</span>
                  </div>
                </div>

                <div className="contactLinkCard">
                  <div className="contactIconWrapper">
                    <Phone size={24} />
                  </div>
                  <div className="contactDetails">
                    <h4 className="contactTitleText">เบอร์โทรศัพท์อัตโนมัติ (สายตรง)</h4>
                    <span className="phoneNum">054-291585 ต่อ 1504 , 1509</span>
                  </div>
                </div>
              </div>

              <div className="socialLinks">
                <div className="socialItem">
                  <strong>Facebook Page:</strong> โรงพยาบาลเถิน ลำปาง
                </div>
                <div className="socialItem">
                  <strong>LINE Official:</strong> ช่องทาง Scan QR Code ในสื่อประชาสัมพันธ์ของโรงพยาบาล
                </div>
              </div>
            </section>

            {/* Display Image at the Bottom */}
            <div className="childbirthDisplayImage" style={{ marginTop: '2rem', textAlign: 'center' }}>
              <div className="childbirthLargeImageWrapper" style={{ maxWidth: '680px', margin: '0 auto', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 8px 30px rgba(219, 39, 119, 0.08)', border: '1px solid rgba(251, 207, 232, 0.5)' }}>
                <Image
                  src="/images/package/childbirth/childbirth.webp"
                  alt="ตารางและรายละเอียดแพ็กเกจคลอดบุตร โรงพยาบาลเถิน"
                  width={720}
                  height={720}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
