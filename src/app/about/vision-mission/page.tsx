import { Metadata } from 'next'
import { Eye } from 'lucide-react'
import './page.css'

export const metadata: Metadata = {
  title: 'วิสัยทัศน์ พันธกิจ และค่านิยม | โรงพยาบาลเถิน',
  description: 'วิสัยทัศน์ พันธกิจ ค่านิยมองค์กร T-H-O-E-N และแผนพัฒนาเป้าหมายระยะยาว โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง',
}

export default function VisionMissionPage() {
  const coreValues = [
    { letter: 'T', name: 'Team', desc: 'ทำงานร่วมกันอย่างเป็นหนึ่งเดียว', colorClass: 'value-t' },
    { letter: 'H', name: 'Humanization', desc: 'ดูแลด้วยหัวใจ เคารพศักดิ์ศรี', colorClass: 'value-h' },
    { letter: 'O', name: 'Organization Improvement', desc: 'พัฒนาองค์กรอย่างต่อเนื่อง', colorClass: 'value-o' },
    { letter: 'E', name: 'Environment', desc: 'สิ่งแวดล้อมปลอดภัย เอื้อต่อการรักษา', colorClass: 'value-e' },
    { letter: 'N', name: 'New Technology', desc: 'นำเทคโนโลยีใหม่ยกระดับบริการ', colorClass: 'value-n' },
  ]

  const missions = [
    { label: 'Service', desc: 'พัฒนาระบบบริการสุขภาพตอบสนองความต้องการ 4 มิติ', icon: '' },
    { label: 'Quality', desc: 'พัฒนาคุณภาพการให้บริการทางคลินิก ลดแผนผังคลินิก และมาตรการที่เพิ่มขึ้น ด้านความปลอดภัยในโรงพยาบาล', icon: '' },
    { label: 'Community', desc: 'ส่งเสริมระบบเครือข่ายชุมชนและประชาสังคม ให้มีส่วนร่วม ในสุขภาวะชุมชน', icon: '' },
    { label: 'Governance', desc: 'บริหารงานคลินิก โดยบุคลากรมีความสุข', icon: '' },
  ]

  const excellentPillars = [
    {
      title: 'PP&P Excellent',
      icon: '',
      items: [
        'ประชาชนมีสุขภาพดี มีสมรรถภาพด้านสุขภาพ',
        'เครื่องมือทางสุขภาพ ชุมชน และประชาสังคมเข้มแข็งในการสร้างเสริมสุขภาพ',
        'ภาวะป่วยใหม่ลดลง'
      ]
    },
    {
      title: 'Service Excellent',
      icon: '',
      items: [
        'ระบบบริการสุขภาพมีคุณภาพ มาตรฐานและปลอดภัย',
        'บุคลากรมีทักษะและสมรรถนะที่จำเป็น มีอุปกรณ์ทางการแพทย์ครบถ้วน ปลอดภัย ไว้ใจได้',
        'ระบบบริการสาธารณสุข ชุมชน และประชาสังคมร่วมกันในการบริหารจัดการและพัฒนา'
      ]
    },
    {
      title: 'People Excellent',
      icon: '',
      items: [
        'บุคลากรมีขีดสมรรถนะและสมรรถภาพตามมาตรฐานวิชาชีพ',
        'องค์กรแห่งความสุขและการใช้ชีวิตอย่างสมดุล (Happy Organization & Living)'
      ]
    },
    {
      title: 'Governance Excellent',
      icon: '',
      items: [
        'บริหารจัดการด้วยข้อมูล (Data-driven)',
        'คุณธรรมและธรรมาภิบาลการบริหาร',
        'โรงพยาบาลอัจฉริยะ (Smart Hospital)'
      ]
    }
  ]

  return (
    <div className="visionMissionPage">
      {/* Hero Section */}
      <section className="visionHero">
        <div className="container">
          <h1 className="heroTitle">วิสัยทัศน์ ค่านิยม พันธกิจ</h1>
          <p className="heroDesc">
            โรงพยาบาลเถิน มุ่งมั่นสู่การบริการที่เป็นเลิศ ชุมชนเข้มแข็ง และพัฒนาคุณภาพมาตรฐานอย่างไม่หยุดยั้ง
          </p>
        </div>
      </section>

      <div className="container pageContent">
        {/* Core Vision & Mission */}
        <section className="sectionMain">
          <div className="visionCard">
            <div className="visionIcon">
              <Eye size={36} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="visionContent">
              <h2>วิสัยทัศน์ (Vision)</h2>
              <p className="highlightText">
                “เป็นโรงพยาบาลชุมชนเข้มแข็ง ที่มีคุณภาพมาตรฐาน ประชาชนไว้วางใจ บุคลากรมีความสุข ในปี 2571”
              </p>
            </div>
          </div>

          <div className="missionSection">
            <div className="sectionHeader">
              <h2>พันธกิจ (Mission)</h2>
              <p>กรอบภารกิจมุ่งเน้นเพื่อยกระดับการจัดการและมาตรฐานสาธารณสุข</p>
            </div>
            <div className="missionGrid">
              {missions.map((m, idx) => (
                <div key={idx} className="missionCard card">

                  <div className="mContent">
                    <h3>{m.label}</h3>
                    <p>{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Values T-H-O-E-N */}
        <section className="sectionValues">
          <div className="sectionHeader textCenter">
            <span className="sectionTag">CORE VALUES</span>
            <h2>ค่านิยมหลักองค์กร (T-H-O-E-N)</h2>
            <p>แกนหลักสำคัญในการหล่อหลอมและขับเคลื่อนพฤติกรรมของบุคลากรโรงพยาบาลเถิน</p>
          </div>

          <div className="valuesGrid">
            {coreValues.map((v, idx) => (
              <div key={idx} className={`valueCard card ${v.colorClass}`}>
                <div className="valueLetter">{v.letter}</div>
                <div className="valueBody">
                  <h3>{v.name}</h3>
                  <p>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Strategic Pillars (4 Excellent & Goals) */}
        <section className="sectionStrategy">
          <div className="strategyGrid">
            <div className="strategyIntroCard card">
              <span className="strategyTag">GOALS & TARGETS</span>
              <h2>เป้าหมายระยะยาว</h2>
              <p className="boldIntro">
                สอดรับกับกระทรวงสาธารณสุข มุ่งเน้นภารกิจ บริการเป็นเลิศ ผลงานโดดเด่น บริหารจัดการแต้มต่อ และสอดรับนโยบายจากการปฏิบัติหน้าที่
              </p>
              <div className="targetPill">
                <span className="targetYear">ปีเป้าหมาย 2571</span>
                <span className="targetGoal">สร้างความเชื่อมั่นและความสุขร่วมกัน</span>
              </div>
              <div className="pointsGrid">
                <div className="pointItem">บริการเป็นเลิศ</div>
                <div className="pointItem">ชุมชนเข้มแข็ง</div>
                <div className="pointItem">มาตรฐานคุณภาพ</div>
                <div className="pointItem">บุคลากรมีความสุข</div>
                <div className="pointItem">เป้าหมายระยะยาว</div>
              </div>
            </div>

            <div className="excellentCard card">
              <h2>4 Excellent Pillars</h2>
              <p className="excellentSub">กรอบการดำเนินงานสู่ความเป็นเลิศในทุกด้าน</p>
              
              <div className="excellentAccordion">
                {excellentPillars.map((p, idx) => (
                  <div key={idx} className="accItem">
                    <div className="accHeader">
                      <h4>{p.title}</h4>
                    </div>
                    <ul className="accList">
                      {p.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Development & Safety Targets */}
        <section className="sectionDetailsGrid">
          <div className="detailBox card">
            <div className="boxHeader">

              <h3>แผนพัฒนา</h3>
            </div>
            <div className="boxContent">
              <div className="contentGroup">
                <h5>พัฒนาคุณภาพตามกลุ่มงาน 5 กลุ่ม:</h5>
                <p>กลุ่มปฐมภูมิ, แพทย์และสหสาขา, กลุ่มเครือข่าย, กลุ่มสนับสนุน, กลุ่มพัฒนาระบบ</p>
              </div>
              <div className="contentGroup">
                <h5>การบริหารจัดการ:</h5>
                <p>ระบบสมรรถนะ, มุ่งเน้นผลลัพธ์เชิงประจักษ์, และการจัดการความรู้องค์กร (KM)</p>
              </div>
              <div className="contentGroup">
                <h5>มาตรฐานบริการ:</h5>
                <p>เน้นยกระดับและพัฒนาคุณภาพมาตรฐานบริการทางคลินิกอย่างต่อเนื่อง</p>
              </div>
            </div>
          </div>

          <div className="detailBox card">
            <div className="boxHeader">

              <h3>เข็มมุ่งความปลอดภัย</h3>
            </div>
            <div className="boxContent">
              <div className="contentGroup">
                <h5>มาตรฐานสำคัญด้านไม่ผิดพลาดความปลอดภัย:</h5>
                <p>การป้องกันความผิดพลาดทางการรักษาพยาบาลทุกมิติเพื่อความปลอดภัยสูงสุดของผู้รับบริการ</p>
              </div>
              <div className="contentGroup">
                <h5>พัฒนาระบบการดูแลผู้ป่วยเสี่ยงสูง (3S):</h5>
                <p>การคัดกรอง เฝ้าระวัง และดูแลผู้ป่วยกลุ่มภาวะวิกฤต/กลุ่มโรคที่มีความเสี่ยงสูงอย่างมีประสิทธิภาพ</p>
              </div>
              <div className="contentGroup">
                <h5>การบริหารจัดการวัคซีนอย่างยั่งยืน:</h5>
                <p>เสริมสร้างภูมิคุ้มกันและบริหารจัดการระบบห่วงโซ่ความเย็นของวัคซีนให้ได้มาตรฐานสากล</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
