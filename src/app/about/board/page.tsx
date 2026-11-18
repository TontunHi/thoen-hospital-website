import { Metadata } from 'next'
import Breadcrumb from '@/components/ui/Breadcrumb'
import './page.css'

export const metadata: Metadata = {
  title: 'คณะกรรมการบริหาร | โรงพยาบาลเถิน',
  description: 'คณะกรรมการบริหารโรงพยาบาลเถิน ร่วมกำหนดนโยบายและขับเคลื่อนการให้บริการเพื่อดูแลประชาชนในพื้นที่อย่างมีมาตรฐาน',
}

export default function BoardOfDirectorsPage() {
  const stats = [
    { value: '18', label: 'รายชื่อกรรมการ' },
    { value: '90', label: 'เตียงบริการ' },
    { value: 'ลำปาง', label: 'จังหวัดที่ดูแล' }
  ]

  return (
    <div className="boardPage">
      {/* Hero Section */}
      <section className="boardHero">
        <div className="container">
          <Breadcrumb variant="light" items={[{ label: 'เกี่ยวกับเรา', href: '/about' }, { label: 'คณะกรรมการบริหาร' }]} />
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
      </div>
    </div>
  )
}
