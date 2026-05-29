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
      link: '/salary/login',
      btnText: 'ไปยังโปรแกรมเงินเดือน',
    },
    {
      title: 'สถานะห้องฉุกเฉิน',
      desc: 'แสดงข้อมูลและสถิติสถานะผู้ป่วยในห้องฉุกเฉินแบบเรียลไทม์ (รองรับการแสดงผลหน้าจอทีวี มือถือ และคอมพิวเตอร์)',
      link: '/systems/er-in-status',
      btnText: 'เปิดดูสถานะห้องฉุกเฉิน',
    },
    {
      title: 'โปรแกรมโพสข่าวประชาสัมพันธ์',
      desc: 'ระบบจัดการข่าวประชาสัมพันธ์ ข่าวรับสมัครงาน และข่าวกิจกรรมบนเว็บไซต์โรงพยาบาลเถิน',
      link: '/admin',
      btnText: 'จัดการข่าวประชาสัมพันธ์',
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
    <div className="container servicePage">
      <div className="serviceHeader">
        <h1>ระบบงานภายใน (Service)</h1>
        <p>ศูนย์รวมลิงก์ระบบสารสนเทศและเครื่องมือภายในสำหรับบุคลากรโรงพยาบาลเถิน</p>
      </div>

      <div className="serviceGrid">
        {internalSystems.map((sys, idx) => (
          <div key={idx} className="serviceCard card">
            <div className="cardHeader">
              <div className="iconWrapper">
                <Image
                  src="/images/logo-website.webp"
                  alt="Logo"
                  width={40}
                  height={40}
                />
              </div>
              <h3>{sys.title}</h3>
            </div>
            <p>{sys.desc}</p>
            <div className="cardActions">
              {sys.link.startsWith('http') ? (
                <a href={sys.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                  {sys.btnText}
                </a>
              ) : (
                <Link href={sys.link} className="btn btn-primary btn-sm">
                  {sys.btnText}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
