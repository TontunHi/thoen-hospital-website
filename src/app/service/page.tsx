import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  Activity, 
  FlaskConical, 
  Stethoscope, 
  Bed, 
  Pill, 
  CalendarClock, 
  FileText, 
  BarChart3, 
  Building2, 
  ScanLine, 
  Share2, 
  Database,
  ExternalLink,
  ChevronRight,
  Target,
  Coins
} from 'lucide-react'
import './page.css'

interface SystemItem {
  title: string
  desc: string
  link: string
  btnText: string
  category: 'clinical' | 'admin' | 'network'
  icon: typeof Activity
}

export default async function ServicePage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const internalSystems: SystemItem[] = [
    // Clinical & Patient Care
    {
      title: 'EMR Online',
      desc: 'ระบบค้นหาประวัติการรักษาพยาบาล รายการยา และรายงานผลการตรวจ LAB (Outpatient / Inpatient) ของโรงพยาบาลเถิน',
      link: '/service/lab',
      btnText: 'ค้นหาประวัติและผลแลป',
      category: 'clinical',
      icon: Activity,
    },
    {
      title: 'รพ.สต. ติดตามผลแลป',
      desc: 'ระบบติดตามความคืบหน้าการส่งตรวจ LAB ประจำวัน จำแนกตามรายชื่อแพทย์และเจ้าหน้าที่ผู้สั่งตรวจสำหรับเครือข่าย รพ.สต.',
      link: '/service/lab-tracker',
      btnText: 'ติดตามผลแลปวันนี้',
      category: 'clinical',
      icon: FlaskConical,
    },
    {
      title: 'สถานะห้องฉุกเฉิน (ER)',
      desc: 'แสดงข้อมูลและสถิติสถานะผู้ป่วยในห้องฉุกเฉินแบบเรียลไทม์ รองรับการแสดงผลหน้าจอทีวี มือถือ และคอมพิวเตอร์',
      link: '/service/er-in-status',
      btnText: 'เปิดดูสถานะห้องฉุกเฉิน',
      category: 'clinical',
      icon: Stethoscope,
    },
    {
      title: 'สถานะผู้ป่วยใน (IPD)',
      desc: 'ระบบติดตามสถานะผู้ป่วยในและจำนวนเตียงว่างแยกตามหอผู้ป่วยแบบเรียลไทม์ (ชั้น 3 สามัญ, ICU, พิเศษ, ห้องคลอด, ศัลยกรรม)',
      link: '/service/ward-status',
      btnText: 'ดูสถานะผู้ป่วยใน',
      category: 'clinical',
      icon: Bed,
    },
    {
      title: 'อัตราการครองเตียง',
      desc: 'ระบบแสดงอัตราการใช้เตียงและครองเตียงผู้ป่วยในแต่ละหอผู้ป่วย (ชั้น 3 Ward, ICU, พิเศษ, ห้องคลอด, ร่มบุญ) แบบเรียลไทม์',
      link: '/service/bed-occupancy',
      btnText: 'ดูอัตราครองเตียง',
      category: 'clinical',
      icon: BarChart3,
    },
    {
      title: 'สถานะการรอรับยา OPD',
      desc: 'ระบบติดตามคิวและระยะเวลารอรับยาของผู้ป่วยนอกแบบเรียลไทม์ สำหรับงานเภสัชกรรมและผู้รับบริการ',
      link: '/service/status-drug',
      btnText: 'ดูสถานะการรอรับยา',
      category: 'clinical',
      icon: Pill,
    },
    {
      title: 'รายการนัดผิดห้องตรวจ',
      desc: 'ระบบตรวจสอบรายการนัดหมายที่ระบุห้องตรวจผิด เพื่อป้องกันข้อผิดพลาดในเครื่องส่งตรวจอัตโนมัติ',
      link: '/service/appointment-mismatch',
      btnText: 'ตรวจสอบรายการนัดผิด',
      category: 'clinical',
      icon: CalendarClock,
    },
    {
      title: 'ติดตามการจ่ายยาลอราทาดีน',
      desc: 'ระบบติดตามรายชื่อและสถิติการจ่ายยาลอราทาดีนทั้งโรงพยาบาลแบบเรียลไทม์ สำหรับกลุ่มงานการแพทย์แผนไทยฯ',
      link: '/service/loratadine-dispense',
      btnText: 'ติดตามการจ่ายยา',
      category: 'clinical',
      icon: Pill,
    },
    {
      title: 'ติดตามการทำ CXR ผู้ป่วย TB',
      desc: 'ระบบติดตามและตรวจสอบการตรวจภาพถ่ายรังสีทรวงอก (CXR) ในกลุ่มเสี่ยงและผู้ป่วยวัณโรค พร้อมระบบสลับสถานะและส่งออก Excel',
      link: '/service/tb-cxr-tracker',
      btnText: 'ติดตามการทำ CXR',
      category: 'clinical',
      icon: ScanLine,
    },

    // Administrative & Management
    {
      title: 'ติดตามงบประมาณประจำปี',
      desc: 'ระบบกำกับและติดตามงบประมาณรายกองทุน โรงพยาบาลเถิน เปรียบเทียบมาตรฐานเขตสุขภาพที่ 1 (MIS HOS เขต 1)',
      link: '/service/budget-tracker',
      btnText: 'เข้าสู่ระบบติดตามงบประมาณ',
      category: 'admin',
      icon: Coins,
    },
    {
      title: 'ติดตามตัวชี้วัด (KPI Tracking)',
      desc: 'ระบบกำกับและติดตามผลการดำเนินงานตัวชี้วัดโรงพยาบาลเถิน (THIP / HA / ยุทธศาสตร์) แยกตามปีงบประมาณและรอบเวลา',
      link: '/service/kpi-tracker',
      btnText: 'เข้าสู่ระบบติดตามตัวชี้วัด',
      category: 'admin',
      icon: Target,
    },
    {
      title: 'ระบบหนังสือส่งออก Online',
      desc: 'ระบบสืบค้นและลงทะเบียนหนังสือส่งออกทางราชการของโรงพยาบาลเถิน แยกตามปีงบประมาณ',
      link: '/service/outgoing-document',
      btnText: 'ลงทะเบียนหนังสือส่งออก',
      category: 'admin',
      icon: FileText,
    },
    {
      title: 'Dashboard-RCM',
      desc: 'ระบบนำเสนอและกำกับติดตามรายได้โรงพยาบาล สิทธิเบิกชดเชย e-Claim และลูกหนี้คงค้าง (ทันตกรรม ปกส., OPD รายแพทย์, IPD สรุปชาร์ต)',
      link: '/service/dashboard-rcm',
      btnText: 'เข้าสู่ Dashboard-RCM',
      category: 'admin',
      icon: BarChart3,
    },
    {
      title: 'ระบบ Back Office',
      desc: 'เชื่อมต่อระบบ Back Office โรงพยาบาลเถิน สำหรับงานสารบรรณ พัสดุ ทรัพยากรบุคคล และการติดตามงาน',
      link: 'https://11152.gtwoffice.com/',
      btnText: 'ไปยังระบบ Back Office',
      category: 'admin',
      icon: Building2,
    },

    // Community & Public Health Network
    {
      title: 'ระบบคัดกรองตรวจนอกพื้นที่',
      desc: 'ระบบอ่านบัตรประชาชน Smart Card และติดตามคิวผู้รับบริการสำหรับหน่วยคัดกรองตรวจสุขภาพเชิงรุกนอกสถานที่',
      link: '/service/screening',
      btnText: 'เข้าสู่ระบบคัดกรอง',
      category: 'network',
      icon: ScanLine,
    },
    {
      title: 'โปรแกรม COC Lampang',
      desc: 'เชื่อมต่อระบบ COC โรงพยาบาลลำปาง สำหรับจัดการข้อมูลและการติดตามดูแลผู้ป่วยต่อเนื่องในชุมชน',
      link: 'http://coc.lph.go.th/',
      btnText: 'ไปยังโปรแกรม COC Lampang',
      category: 'network',
      icon: Share2,
    },
    {
      title: 'HDC Lampang',
      desc: 'เชื่อมต่อคลังข้อมูลบริการสาธารณสุข (Health Data Center) จังหวัดลำปาง เพื่อการวิเคราะห์ข้อมูลและติดตามงานสาธารณสุข',
      link: 'https://hdc.moph.go.th/lpg/public/main',
      btnText: 'ไปยัง HDC Lampang',
      category: 'network',
      icon: Database,
    },
  ]

  const displaySystems = session.role === 'subdistrict'
    ? internalSystems.filter((sys) => sys.link === '/service/lab' || sys.link === '/service/lab-tracker')
    : internalSystems

  const categories = [
    { key: 'clinical', label: 'ระบบบริการคลินิกและผู้ป่วย', desc: 'เครื่องมือสนับสนุนงานรักษาพยาบาล หอผู้ป่วย ห้องฉุกเฉิน และเภสัชกรรม' },
    { key: 'admin', label: 'ระบบบริหารจัดการและสารบรรณ', desc: 'ระบบการเงิน สลิปเงินเดือน สารบรรณ และการกำกับติดตามรายได้' },
    { key: 'network', label: 'ระบบบริการเครือข่ายและสาธารณสุข', desc: 'ระบบสนับสนุนงานบริการปฐมภูมิ คัดกรองเชิงรุก และคลังข้อมูลสุขภาพ' },
  ]

  return (
    <div className="servicePage">
      <div className="serviceWrapper">
        {/* Navigation Breadcrumb / Member Portal Link */}
        <div className="serviceNavRow">
          <Link href="/member" className="serviceBackLink">
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            <span>กลับสู่หน้าหลักบุคลากร (Member Hub)</span>
          </Link>
        </div>

        {/* Header */}
        <header className="serviceHeader">
          <span className="serviceKicker">Thoen Hospital Clinical & Internal Portal</span>
          <h1>ระบบงานสารสนเทศภายใน</h1>
          <p>
            ศูนย์รวมระบบสารสนเทศทางการแพทย์ เครื่องมือบริหารจัดการ และระบบงานเครือข่ายสุขภาพสำหรับบุคลากรโรงพยาบาลเถิน
          </p>
        </header>

        {/* Categorized Systems */}
        {categories.map((cat) => {
          const items = displaySystems.filter((s) => s.category === cat.key)
          if (items.length === 0) return null

          return (
            <section key={cat.key} className="serviceSection">
              <div className="serviceSectionHeader">
                <div className="serviceSectionTitleGroup">
                  <h2 className="serviceSectionTitle">{cat.label}</h2>
                  <p className="serviceSectionDesc">{cat.desc}</p>
                </div>
                <span className="serviceSectionCount">{items.length} ระบบ</span>
              </div>

              <div className="serviceGrid">
                {items.map((sys, idx) => {
                  const Icon = sys.icon
                  const isExternal = sys.link.startsWith('http')

                  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
                    if (isExternal) {
                      return (
                        <a
                          href={sys.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="serviceCard touch-target"
                        >
                          {children}
                        </a>
                      )
                    }
                    return (
                      <Link href={sys.link} className="serviceCard touch-target">
                        {children}
                      </Link>
                    )
                  }

                  return (
                    <CardWrapper key={idx}>
                      <div className="cardHeader">
                        <div className="iconWrapper">
                          <Icon size={20} />
                        </div>
                      </div>
                      <h3 className="cardTitle">{sys.title}</h3>
                      <p className="cardDesc">{sys.desc}</p>
                      <div className="cardFooter">
                        <span className="cardBtnText">{sys.btnText}</span>
                        {isExternal ? (
                          <ExternalLink size={14} className="cardChevron" />
                        ) : (
                          <ChevronRight size={14} className="cardChevron" />
                        )}
                      </div>
                    </CardWrapper>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
