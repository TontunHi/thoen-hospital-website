import Image from 'next/image'
import Link from 'next/link'
import { Check, Info, Calendar, Clock, Phone, Sparkles, ShieldAlert, ArrowLeft } from 'lucide-react'
import './page.css'

export default function DentistryPage() {
  const dentalServices = [
    { name: 'ตรวจฟัน', desc: 'ตรวจสุขภาพช่องปากและฟันโดยทันตแพทย์ผู้เชี่ยวชาญเพื่อประเมินแผนการรักษา' },
    { name: 'อุดฟัน', desc: 'รักษาฟันผุด้วยวัสดุอุดฟันคุณภาพสูง สีเหมือนฟันธรรมชาติหรือวัสดุอมัลกัม' },
    { name: 'ขูดหินปูน', desc: 'กำจัดคราบหินปูนและคราบแบคทีเรีย ป้องกันโรคเหงือกอักเสบและกลิ่นปาก' },
    { name: 'รักษารากฟัน', desc: 'รักษาการติดเชื้อของเนื้อเยื่อในโพรงประสาทฟันเพื่อรักษาฟันธรรมชาติไว้' },
    { name: 'ถอนฟัน / ผ่าฟันคุด', desc: 'บริการถอนฟันและการผ่าตัดฟันคุดที่ฝังตัวในกระดูกขากรรไกรด้วยยาชาอย่างปลอดภัย' },
    { name: 'ทำฟันปลอม / ครอบฟัน', desc: 'บูรณะฟันและทดแทนฟันที่สูญเสียไปด้วยฟันปลอมฐานพลาสติก/โลหะ ครอบฟัน หรือสะพานฟัน' },
  ]

  return (
    <div className="dentistryPage">
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
        


        {/* Hero Section */}
        <section className="dentalHero">
          <div className="dentalHero__bg" aria-hidden="true" />
          <div className="dentalHero__content">
            <span className="dentalHero__badge">
              <Sparkles size={16} />
              DENTAL CARE SERVICE
            </span>
            <h1 className="dentalHero__title">
              บริการด้านทันตกรรม (Dental Services)
              <span className="dentalHero__subTitle">โรงพยาบาลเถิน THOEN HOSPITAL</span>
            </h1>
            <p className="dentalHero__slogan">
              "เพื่อรอยยิ้มที่มั่นใจ และสุขภาพช่องปากที่ดีของชาวเถิน"
            </p>
          </div>
        </section>

        {/* Content Layout */}
        <div className="dentalGrid">
          
          <div className="dentalMainContent">
            
            {/* Unit & Date Badge */}
            <div className="dentalMetaCard card-glass">
              <div className="metaItem">
                <span className="metaLabel">หน่วยงานผู้ให้บริการ:</span>
                <span className="metaValue highlight">ฝ่ายทันตกรรม โรงพยาบาลเถิน</span>
              </div>
              <div className="metaItem">
                <span className="metaLabel">วันที่มีผลบังคับใช้:</span>
                <span className="metaValue">เริ่มตั้งแต่วันที่ 1 เมษายน 2567 เป็นต้นไป</span>
              </div>
            </div>

            {/* Services Section */}
            <section className="dentalSection card">
              <h2 className="sectionTitle">1. รายการบริการทันตกรรมที่เปิดให้บริการ</h2>
              <p className="sectionSubtitle">เราให้บริการตรวจและรักษาโรคในช่องปากครบวงจรด้วยเครื่องมือที่ทันสมัยและระบบปลอดเชื้อมาตรฐานสากล</p>
              
              <div className="servicesGrid">
                {dentalServices.map((service, idx) => (
                  <div key={idx} className="serviceItemCard">
                    <div className="serviceIconWrapper">
                      <Check size={18} />
                    </div>
                    <div className="serviceContent">
                      <h3>{service.name}</h3>
                      <p>{service.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Shift/Timing Section */}
            <section className="dentalSection card">
              <h2 className="sectionTitle">2. การแบ่งเวลาให้บริการ (Service Shifts)</h2>
              <p className="sectionSubtitle">เพื่อความรวดเร็วและลดความแออัดในการรับบริการ กรุณาเข้าติดต่อตามเวลาดังต่อไปนี้</p>
              
              <div className="shiftsContainer">
                {/* Morning Shift */}
                <div className="shiftCard morning">
                  <div className="shiftHeader">
                    <Clock size={20} />
                    <h3>ช่วงเช้า (รอบเช้า)</h3>
                  </div>
                  <div className="shiftBody">
                    <div className="shiftTime">08:00 น. - 12:00 น.</div>
                    <p className="shiftDesc">
                      <strong>ให้บริการผู้ป่วยนอกทั่วไป (OPD)</strong> สำหรับการรักษาทั่วไป เช่น ตรวจฟัน อุดฟัน ขูดหินปูน ถอนฟัน โดยรับคิวรับบริการ ณ จุดลงทะเบียนทันตกรรมตามลำดับ
                    </p>
                  </div>
                </div>

                {/* Afternoon Shift */}
                <div className="shiftCard afternoon">
                  <div className="shiftHeader">
                    <Clock size={20} />
                    <h3>ช่วงบ่าย (รอบบ่าย)</h3>
                  </div>
                  <div className="shiftBody">
                    <div className="shiftTime">13:00 น. - 16:00 น.</div>
                    <p className="shiftDesc">
                      <strong>ให้บริการเฉพาะผู้ป่วยนัดหมาย และผู้ป่วยฉุกเฉินเท่านั้น</strong> เช่น การรักษารากฟัน งานฟันปลอม งานครอบฟัน หรือกรณีอุบัติเหตุฉุกเฉินทางทันตกรรมเพื่อการดูแลอย่างใกล้ชิด
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Contact / QR Section */}
            <section className="dentalSection card contactSection">
              <h2 className="sectionTitle">3. ช่องทางการติดต่อและนัดหมาย</h2>
              <p className="sectionSubtitle" style={{ marginBottom: '2rem' }}>
                ท่านสามารถแอดไลน์โดยการสแกน QR Code หรือโทรศัพท์ติดต่อเพื่อขอรายละเอียดเพิ่มเติมและทำนัดหมายตรวจสุขภาพฟันได้จากรูปภาพประชาสัมพันธ์ด้านล่างนี้
              </p>
              
              {/* Large Image and QR Code Display Section */}
              <div className="dentalQrcodeDisplay" style={{ textAlign: 'center' }}>
                <div className="dentalLargeImageWrapper" style={{ maxWidth: '680px', margin: '0 auto', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 8px 30px rgba(8, 145, 178, 0.08)', border: '1px solid rgba(207, 250, 254, 0.5)' }}>
                  <Image
                    src="/images/package/dentistry/dentistry.webp"
                    alt="ตารางและช่องทางนัดหมายติดต่อทันตกรรม โรงพยาบาลเถิน"
                    width={720}
                    height={720}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
                <span className="qrcodeCaption" style={{ display: 'block', marginTop: '1rem', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
                  * ท่านสามารถกดค้างที่รูปภาพเพื่อบันทึกรูป หรือสแกน QR Code เพื่อเพิ่มเพื่อนใน LINE ทันตกรรม โรงพยาบาลเถิน ได้โดยตรง
                </span>
              </div>
            </section>

          </div>

        </div>

      </div>
    </div>
  )
}
