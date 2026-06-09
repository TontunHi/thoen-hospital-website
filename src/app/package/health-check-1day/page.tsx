import Image from 'next/image'
import Link from 'next/link'
import { Check, Info, Calendar, Clock, HeartPulse } from 'lucide-react'
import './page.css'

interface HealthProgramItem {
  name: string
  price: number | string
  male: boolean
  female: boolean
  remark?: string
  isClaimable?: boolean
  isFemaleOnly?: boolean
  isNonClaimable?: boolean
}

const healthPrograms: HealthProgramItem[] = [
  {
    name: 'การตรวจวัดพื้นฐาน (สัญญาณชีพ, ดัชนีมวลกาย) และค่าบริการทางการแพทย์',
    price: 50,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจความสมบูรณ์ของเม็ดเลือดและเกล็ดเลือด (CBC with Platelet)',
    price: 90,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจระดับน้ำตาลในเลือด (FBS)',
    price: 40,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจระดับไขมันในเลือด (Lipid profile): Cholesterol',
    price: 60,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจระดับไขมันในเลือด (Lipid profile): Triglyceride',
    price: 60,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจระดับไขมันในเลือด (Lipid profile): HDL',
    price: 100,
    male: true,
    female: true,
    remark: 'เบิกไม่ได้',
    isNonClaimable: true,
  },
  {
    name: 'ตรวจระดับไขมันในเลือด (Lipid profile): LDL',
    price: 200,
    male: true,
    female: true,
    remark: 'เบิกไม่ได้',
    isNonClaimable: true,
  },
  {
    name: 'ตรวจการทำงานของไต (BUN, Cr)',
    price: 80,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจความสมบูรณ์ของปัสสาวะ (Urine analysis)',
    price: 60,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจอุจจาระและเม็ดเลือดแดง (Stool exam and Occult blood)',
    price: 90,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจกรดยูริคในเลือด (โรคเก๊าท์)',
    price: 60,
    male: true,
    female: true,
  },
  {
    name: 'ตรวจสมรรถภาพตับ (SGPT, SGOT, ALK)',
    price: 120,
    male: true,
    female: true,
  },
  {
    name: 'การตรวจเอ็กซเรย์ปอด (CXR)',
    price: 250,
    male: true,
    female: true,
    remark: 'เบิกได้ 170 บาท',
    isClaimable: true,
  },
  {
    name: 'การตรวจคลื่นไฟฟ้าหัวใจ (EKG 12 lead)',
    price: 200,
    male: true,
    female: true,
    remark: 'เบิกไม่ได้',
    isNonClaimable: true,
  },
  {
    name: 'ตรวจการติดเชื้อไวรัสตับอักเสบ (HBsAg, Anti HBS, AntiHBc)',
    price: 420,
    male: true,
    female: true,
    remark: 'เบิกไม่ได้',
    isNonClaimable: true,
  },
  {
    name: 'ตรวจฮอร์โมนไทรอยด์ (TFT)',
    price: 490,
    male: true,
    female: true,
    remark: 'เบิกไม่ได้',
    isNonClaimable: true,
  },
  {
    name: 'ตรวจสุขภาพฟัน (ตามสิทธิ์)',
    price: 'ตามสิทธิ์',
    male: true,
    female: true,
  },
  {
    name: 'ตรวจภายในและมะเร็งปากมดลูก',
    price: 220,
    male: false,
    female: true,
    remark: 'เฉพาะผู้หญิง',
    isFemaleOnly: true,
  },
  {
    name: 'อัลตร้าซาวด์ทั่วไป',
    price: 800,
    male: true,
    female: true,
  },
  {
    name: 'เอกซเรย์คอมพิวเตอร์สมอง (CT-Brain)',
    price: '3,500',
    male: true,
    female: true,
  },
  {
    name: 'เอกซเรย์คอมพิวเตอร์ช่องท้อง (CT-Whole Abdomen)',
    price: '10,000',
    male: true,
    female: true,
  },
]

export default function HealthCheckPage() {
  return (
    <div className="healthCheckPage">
      <div className="container" style={{ paddingTop: '2rem' }}>
        


        {/* Hero Section */}
        <section className="healthHero">
          <div className="healthHero__bg">
            <Image
              src="/images/package/health-check-1day/health-check.webp"
              alt="โปรแกรมตรวจสุขภาพ รู้ผลได้ใน 1 วัน"
              fill
              priority
              style={{ objectFit: 'cover' }}
              sizes="100vw"
            />
            <div className="healthHero__overlay" />
          </div>
          <div className="healthHero__content">
            <span className="healthHero__badge">
              <HeartPulse size={16} style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
              HEALTH PROGRAM
            </span>
            <h1 className="healthHero__title">
              โปรแกรมตรวจสุขภาพ (Health Check Up Program)
              <br />
              <span style={{ fontSize: '1.8rem', fontWeight: 'normal' }}>โรงพยาบาลเถิน THOEN HOSPITAL</span>
            </h1>
            <p className="healthHero__slogan">
              "ใกล้บ้านใกล้ใจ รู้ผลได้ในหนึ่งวัน"
            </p>
          </div>
        </section>

        {/* Info Grid */}
        <div className="healthGrid">
          <section className="healthInfoCard">
            <h2>รายการตรวจสุขภาพและราคา</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              บริการตรวจสุขภาพครบวงจรเพื่อการป้องกันและค้นหาความเสี่ยงสุขภาพอย่างรวดเร็ว แม่นยำ รายงานผลฉับไวใน 1 วัน
            </p>

            <div className="tableContainer">
              <table className="pricingTable">
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>รายการตรวจวิเคราะห์และประเมินผล</th>
                    <th style={{ textAlign: 'center' }}>ชาย</th>
                    <th style={{ textAlign: 'center' }}>หญิง</th>
                    <th style={{ textAlign: 'center' }}>ราคา (บาท)</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {healthPrograms.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        {item.male ? (
                          <span className="checkIcon">✓</span>
                        ) : (
                          <span className="dashIcon">-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.female ? (
                          <span className="checkIcon">✓</span>
                        ) : (
                          <span className="dashIcon">-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {typeof item.price === 'number' ? (
                          <span className="priceBadge">{item.price.toLocaleString()}</span>
                        ) : (
                          <span className="priceFree">{item.price}</span>
                        )}
                      </td>
                      <td>
                        {item.remark && (
                          <span className={`remarkBadge ${
                            item.isFemaleOnly ? 'remarkFemale' : 
                            item.isClaimable ? 'remarkClaimable' : ''
                          }`}>
                            {item.remark}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note instructions section */}
            <div className="healthNotes">
              <h3>
                <Info size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#0d9488' }} />
                ข้อปฏิบัติการเตรียมตัวเข้ารับการตรวจสุขภาพ:
              </h3>
              <ul>
                <li>กรุณางดน้ำและอาหารอย่างน้อย 8 - 12 ชั่วโมงก่อนเข้ารับการบริการ (สามารถจิบน้ำเปล่าได้เล็กน้อย)</li>
                <li>สำหรับผู้ที่รับการตรวจปัสสาวะและอุจจาระ ควรเก็บตัวอย่างในภาชนะที่สะอาดและนำมาส่งในวันตรวจ</li>
                <li>สิทธิ์ในการเบิกสวัสดิการข้าราชการหรือสิทธิ์ประกันสังคม สามารถติดต่อเจ้าหน้าที่ฝ่ายการเงินเพื่อสอบถามรายละเอียดเพิ่มเติม</li>
                <li>กรุณานำบัตรประจำตัวประชาชนตัวจริงมาเพื่อแสดงตนเข้ารับบริการ</li>
              </ul>
            </div>

            {/* QR Code and Contact Image Section */}
            <div className="healthContactSection" style={{ marginTop: '2.5rem', textAlign: 'center' }}>
              <h3 style={{ color: '#0f766e', fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 700 }}>
                สอบถามข้อมูลเพิ่มเติมเกี่ยวกับโปรแกรมตรวจสุขภาพ
              </h3>
              <div className="healthQrcodeWrapper" style={{ maxWidth: '480px', margin: '0 auto', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 8px 30px rgba(13, 148, 136, 0.08)', border: '1px solid rgba(204, 251, 241, 0.5)' }}>
                <Image
                  src="/images/package/health-check-1day/health-check-qrcode.webp"
                  alt="สอบถามข้อมูลเพิ่มเติมและสแกนคิวอาร์โค้ดติดต่อแผนกตรวจสุขภาพ โรงพยาบาลเถิน"
                  width={500}
                  height={500}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  )
}
