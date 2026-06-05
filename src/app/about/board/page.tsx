import { Metadata } from 'next'
import Image from 'next/image'
import './page.css'

export const metadata: Metadata = {
  title: 'คณะกรรมการบริหาร | โรงพยาบาลเถิน',
  description: 'คณะกรรมการบริหารโรงพยาบาลเถิน ร่วมกำหนดนโยบายและขับเคลื่อนการให้บริการเพื่อดูแลประชาชนในพื้นที่อย่างมีมาตรฐาน',
}

interface BoardMember {
  id: number
  name: string
  position: string
  department: string
  image?: string
}

export default function BoardOfDirectorsPage() {
  const boardMembers: BoardMember[] = [
    {
      id: 1,
      name: 'แพทย์หญิงนฤณาท จอมภาปิน',
      position: 'ผู้อำนวยการโรงพยาบาลเถิน',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน',
      image: '/images/ceo-thoen.webp' // Existing CEO image
    },
    {
      id: 2,
      name: 'นายแพทย์สาธิต ปทุมมัง',
      position: 'นายแพทย์เชี่ยวชาญ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 3,
      name: 'ทพญ.จุฑารัตน์ รัศมีเหลืองอ่อน',
      position: 'ทันตแพทย์เชี่ยวชาญ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 4,
      name: 'นายแพทย์สืบสกุล ต๊ะปัญญา',
      position: 'นายแพทย์ชำนาญการพิเศษ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 5,
      name: 'ทพญ.ภรินยา วงศ์ฟู',
      position: 'ทันตแพทย์ชำนาญการพิเศษ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 6,
      name: 'นายแพทย์ศิริชัย เชื้อเมืองพาน',
      position: 'นายแพทย์ชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 7,
      name: 'แพทย์หญิงคนึงนิจ ฉัตรหลวง',
      position: 'นายแพทย์ชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 8,
      name: 'แพทย์หญิงวิเศษลักษณ์ ศรีสุริยะธาดา',
      position: 'นายแพทย์ชำนาญการพิเศษ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 9,
      name: 'แพทย์หญิงธัญจิรา แซ่ล้อ',
      position: 'นายแพทย์ชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 10,
      name: 'นางอภิวัน ชาวดง',
      position: 'พยาบาลวิชาชีพชำนาญการพิเศษ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 11,
      name: 'ภก.มนตรี วงศ์คำมา',
      position: 'เภสัชกรชำนาญการพิเศษ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 12,
      name: 'นางพัชรินทร์ เขตประทุม',
      position: 'พยาบาลวิชาชีพชำนาญการพิเศษ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 13,
      name: 'นายทินทรรศน์ ศิริโรจน์ฤชาชัย',
      position: 'นักเทคนิคการแพทย์ชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 14,
      name: 'นางยุวลี ขาปาง',
      position: 'พยาบาลวิชาชีพชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 15,
      name: 'นายทัตธนพงษ์ เชื้อแดง',
      position: 'แพทย์แผนไทยชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 16,
      name: 'ทพญ.ณชนก เกศพิชญวัฒนา',
      position: 'ทันตแพทย์ชำนาญการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 17,
      name: 'นายนนธภพ ยาระพัฒน์',
      position: 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    },
    {
      id: 18,
      name: 'นางสาวพิญญดา ดวงสาร',
      position: 'นักจัดการงานทั่วไปปฏิบัติการ',
      department: 'คณะกรรมการบริหาร โรงพยาบาลเถิน'
    }
  ]

  const stats = [
    { value: '18', label: 'รายชื่อกรรมการ' },
    { value: '90', label: 'เตียงบริการ' },
    { value: 'ลำปาง', label: 'จังหวัดที่ดูแล' }
  ]

  // Render SVG avatar placeholder for members
  const renderPlaceholderAvatar = (name: string) => {
    return (
      <div className="avatarPlaceholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="boardPage">
      {/* Hero Section */}
      <section className="boardHero">
        <div className="container">
          <h1 className="heroTitle">คณะกรรมการบริหารโรงพยาบาลเถิน</h1>
          <p className="heroDesc">
            รายชื่อคณะกรรมการบริหารที่ร่วมกำหนดนโยบายและขับเคลื่อนการให้บริการ เพื่อดูแลประชาชนในพื้นที่อย่างทั่วถึง โปร่งใส และมีมาตรฐาน.
          </p>
        </div>
      </section>

      <div className="container pageContent">
        {/* Stats Summary Bar */}
        <section className="statsSummary card">
          <div className="statsGrid">
            {stats.map((stat, idx) => (
              <div key={idx} className="statItem">
                <span className="statValue">{stat.value}</span>
                <span className="statLabel">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Executive Policy Section */}
        <section className="policySection card">
          <div className="policyHeader">
            <span className="sectionTag">EXECUTIVE POLICY</span>
            <h2>นโยบายผู้บริหาร</h2>
            <p className="policySubtitle">ขับเคลื่อนองค์กรด้วยคุณภาพ ความปลอดภัย และความโปร่งใส</p>
            <p className="policyDesc">
              โรงพยาบาลเถินมุ่งมั่นพัฒนาการบริการให้ครอบคลุมทั้งคุณภาพ มาตรฐาน และเทคโนโลยี เพื่อให้ประชาชนได้รับการดูแลที่ดีที่สุดอย่างต่อเนื่อง
            </p>
          </div>

          <div className="policyFocusGrid">
            <div className="focusBadge">คุณภาพบริการ</div>
            <div className="focusBadge">ความปลอดภัยผู้ป่วย</div>
            <div className="focusBadge">ธรรมาภิบาล</div>
          </div>

          <div className="policyCardsGrid">
            <div className="policyCard">
              <span className="policyCardNumber">01</span>
              <h4>ยกระดับคุณภาพบริการและความปลอดภัยผู้ป่วย</h4>
              <p>เน้นมาตรฐานความปลอดภัย ลดความเสี่ยง และสร้างประสบการณ์ที่อบอุ่นสำหรับผู้รับบริการ</p>
            </div>
            <div className="policyCard">
              <span className="policyCardNumber">02</span>
              <h4>พัฒนาระบบดิจิทัลและสารสนเทศ</h4>
              <p>ยกระดับงานบริการด้วยระบบข้อมูลที่ทันสมัย เชื่อมโยงรวดเร็ว และโปร่งใส</p>
            </div>
            <div className="policyCard">
              <span className="policyCardNumber">03</span>
              <h4>ธรรมาภิบาล โปร่งใส ตรวจสอบได้</h4>
              <p>บริหารด้วยความซื่อสัตย์ มีระบบติดตามผล และเปิดเผยข้อมูลอย่างเหมาะสม</p>
            </div>
          </div>

          <div className="policyGuidelines">
            <h3>แนวทางการปฏิบัติเพื่อขับเคลื่อนนโยบาย</h3>
            <ul className="guidelinesList">
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge-number">1</span>
                <p style={{ margin: 0 }}>บริการด้วยหัวใจและความเข้าใจ ให้ความสำคัญกับผู้ป่วยและญาติเป็นอันดับแรก</p>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge-number">2</span>
                <p style={{ margin: 0 }}>ทำงานเป็นทีม สื่อสารชัดเจน เคารพบทบาทซึ่งกันและกัน</p>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge-number">3</span>
                <p style={{ margin: 0 }}>ใช้ข้อมูลและเทคโนโลยีสนับสนุนการตัดสินใจอย่างแม่นยำ</p>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge-number">4</span>
                <p style={{ margin: 0 }}>ติดตามผลลัพธ์การให้บริการและพัฒนาปรับปรุงอย่างต่อเนื่อง</p>
              </li>
            </ul>
          </div>
        </section>

        {/* Directory Section Intro */}
        <section className="boardIntro">
          <h2>รายชื่อคณะกรรมการบริหาร</h2>
          <p>เรียงตามลำดับตำแหน่ง เพื่อสะท้อนความเชี่ยวชาญในแต่ละสาขา</p>
        </section>

        {/* Board Grid */}
        <section className="boardGrid">
          {boardMembers.map((member) => (
            <div key={member.id} className="boardMemberCard card">
              <div className="memberBadge">{member.id}</div>
              <div className="memberImageContainer">
                {member.image ? (
                  <div className="memberImageWrapper">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                  </div>
                ) : (
                  renderPlaceholderAvatar(member.name)
                )}
              </div>
              <div className="memberInfo">
                <h3 className="memberName">{member.name}</h3>
                <p className="memberPosition">{member.position}</p>
                <div className="memberDivider"></div>
                <p className="memberDept">{member.department}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
