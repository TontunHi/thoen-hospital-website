import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export default async function ServicePage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const internalSystems = [
    {
      title: 'โปรแกรมเงินเดือน',
      desc: 'เข้าสู่ระบบเพื่อดูสลิปเงินเดือนและข้อมูลการจ่ายประจำเดือนสำหรับบุคลากรโรงพยาบาลเถิน',
      link: '/salary',
      btnText: 'ไปยังโปรแกรมเงินเดือน',
    },
    {
      title: 'ค้นหาผลแลป & ประวัติการรักษา',
      desc: 'ระบบค้นหาประวัติการรักษาพยาบาล รายการยา และรายงานผลการตรวจ LAB (Outpatient / Inpatient) ของโรงพยาบาลเถิน',
      link: '/service/lab',
      btnText: 'ค้นหาประวัติและผลแลป',
    },
    {
      title: 'รพ.สต. ติดตามผลแลป',
      desc: 'ระบบติดตามความคืบหน้าการส่งตรวจ LAB ประจำวัน จำแนกตามรายชื่อแพทย์และเจ้าหน้าที่ผู้สั่งตรวจสำหรับเครือข่าย รพ.สต.',
      link: '/service/lab-tracker',
      btnText: 'ติดตามผลแลปวันนี้',
    },
    {
      title: 'สถานะห้องฉุกเฉิน',
      desc: 'แสดงข้อมูลและสถิติสถานะผู้ป่วยในห้องฉุกเฉินแบบเรียลไทม์ (รองรับการแสดงผลหน้าจอทีวี มือถือ และคอมพิวเตอร์)',
      link: '/service/er-in-status',
      btnText: 'เปิดดูสถานะห้องฉุกเฉิน',
    },
    {
      title: 'ระบบลงทะเบียนหนังสือส่งออก Online',
      desc: 'ระบบสืบค้นและลงทะเบียนหนังสือส่งออกทางราชการของโรงพยาบาลเถิน แยกตามปีงบประมาณ',
      link: '/service/outgoing-document',
      btnText: 'ลงทะเบียนหนังสือส่งออก',
    },
    {
      title: 'ติดตามการจ่ายยา\nลอราทาดีน',
      desc: 'ระบบติดตามรายชื่อและสถิติการจ่ายยาลอราทาดีนทั้งโรงพยาบาลแบบเรียลไทม์ สำหรับกลุ่มงานการแพทย์แผนไทยฯ',
      link: '/service/loratadine-dispense',
      btnText: 'ติดตามการจ่ายยา',
    },
    {
      title: 'โปรแกรม COC Lampang',
      desc: 'เชื่อมต่อระบบ COC โรงพยาบาลลำปาง สำหรับจัดการข้อมูลและการติดตามดูแลผู้ป่วยต่อเนื่อง',
      link: 'http://coc.lph.go.th/',
      btnText: 'ไปยังโปรแกรม COC Lampang',
    },
    {
      title: 'ระบบ Back Office',
      desc: 'เชื่อมต่อระบบ Back Office โรงพยาบาลเถิน สำหรับงานสารบรรณ พัสดุ ทรัพยากรบุคคล และการติดตามงาน',
      link: 'https://11152.gtwoffice.com/',
      btnText: 'ไปยังระบบ Back Office',
    },
    {
      title: 'HDC Lampang',
      desc: 'เชื่อมต่อคลังข้อมูลบริการสาธารณสุข (Health Data Center) จังหวัดลำปาง เพื่อการวิเคราะห์ข้อมูลและติดตามงาน',
      link: 'https://hdc.moph.go.th/lpg/public/main',
      btnText: 'ไปยัง HDC Lampang',
    },
  ]



  return (
    <div className="servicePage">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="glowOrb glowOrb3"></div>
      
      <div className="serviceWrapper">
        <div className="serviceHeader">
          <h1>ระบบงานภายใน</h1>
          <p>ศูนย์รวมลิงก์ระบบสารสนเทศและเครื่องมือภายในสำหรับบุคลากรโรงพยาบาลเถิน</p>
        </div>

        <div className="serviceGrid">
          {internalSystems.map((sys, idx) => (
            <div key={idx} className="serviceCard">
              <div className="cardHeader">
                <div className="iconWrapper">
                  <Image
                    src="/images/common/logo-website.webp"
                    alt="Logo"
                    width={40}
                    height={40}
                  />
                </div>
                <h3 style={{ whiteSpace: 'pre-line' }}>{sys.title}</h3>
              </div>
              <p>{sys.desc}</p>
              <div className="cardActions">
                {sys.link.startsWith('http') ? (
                  <a href={sys.link} target="_blank" rel="noopener noreferrer" className="btn">
                    {sys.btnText}
                  </a>
                ) : (
                  <Link href={sys.link} className="btn">
                    {sys.btnText}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
