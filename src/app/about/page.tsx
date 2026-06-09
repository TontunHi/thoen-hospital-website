import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export const metadata = {
  title: 'เกี่ยวกับเรา | โรงพยาบาลเถิน',
  description: 'วิสัยทัศน์ พันธกิจ ประวัติความเป็นมา และผู้บริหารของโรงพยาบาลเถิน จังหวัดลำปาง',
}

export default function AboutPage() {
  return (
    <div className="container aboutPage">
      <div className="aboutHeader">
        <h1>เกี่ยวกับเรา</h1>
        <p>โรงพยาบาลเถิน มุ่งมั่นให้บริการด้านการแพทย์และส่งเสริมสุขภาพอย่างมีมาตรฐานเพื่อประชาชน</p>
      </div>

      <div className="aboutGrid">
        {/* History card */}
        <div className="aboutCard card">
          <h2>ประวัติความเป็นมา</h2>
          <p>
            โรงพยาบาลเถิน จังหวัดลำปาง ตั้งอยู่ในอำเภอเถิน เป็นโรงพยาบาลชุมชนขนาด 90 เตียง สังกัดกระทรวงสาธารณสุข 
            ให้บริการครอบคลุมพื้นที่การแพทย์และการสาธารณสุขแก่ประชาชนอำเภอเถินและพื้นที่เขตติดต่อใกล้เคียง
          </p>
          <p>
            เรามีการพัฒนาโครงสร้างพื้นฐาน บริการทางการแพทย์เฉพาะทาง ระบบการส่งต่อผู้ป่วยฉุกเฉินที่มีประสิทธิภาพ 
            และการขยายเครือข่ายความร่วมมือกับ รพ.สต. และหน่วยงานท้องถิ่นอย่างต่อเนื่อง เพื่อให้ตอบสนองต่อทุกมิติทางด้านสุขภาพของพี่น้องประชาชนในพื้นที่
          </p>
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Link href="/about/history" className="btn btn-primary btn-sm">
              อ่านประวัติความเป็นมา
            </Link>
          </div>
        </div>

        {/* Vision & Mission card */}
        <div className="aboutCard card bg-primary-light">
          <h2>วิสัยทัศน์ & พันธกิจ</h2>
          <div className="visionSection">
            <h3>วิสัยทัศน์ (Vision)</h3>
            <blockquote>
              "เป็นโรงพยาบาลชุมชนเข้มแข็ง ที่มีคุณภาพมาตรฐาน ประชาชนไว้วางใจ บุคลากรมีความสุข ในปี 2571"
            </blockquote>
          </div>
          <div className="missionSection">
            <h3>พันธกิจ (Mission)</h3>
            <ul>
              <li>ให้บริการรักษาระดับปฐมภูมิและทุติยภูมิที่มีคุณภาพและปลอดภัย</li>
              <li>พัฒนาระบบสุขภาพชุมชนและการป้องกันรักษาเชิงรุกอย่างยั่งยืน</li>
              <li>พัฒนาศักยภาพบุคลากรและระบบทำงานด้วยความสุขและมีคุณธรรม</li>
              <li>ส่งเสริมและสนับสนุนเครือข่ายสุขภาพในท้องถิ่นให้เข้มแข็ง</li>
            </ul>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <Link href="/about/vision-mission" className="btn btn-primary btn-sm">
              ดูวิสัยทัศน์ ค่านิยม T-H-O-E-N แบบเต็ม
            </Link>
          </div>
        </div>
      </div>

      {/* Director Card */}
      <div className="directorProfileCard card">
        <div className="directorProfileGrid">
          <div className="directorProfileImage">
            <Image
              src="/images/about/board/ceo-thoen.webp"
              alt="พญ.นฤนาท จอมภาปิน ผู้อำนวยการโรงพยาบาลเถิน"
              width={300}
              height={380}
              style={{ objectFit: 'cover', borderRadius: '12px' }}
              priority
            />
          </div>
          <div className="directorProfileContent">
            <span className="profileBadge">ผู้อำนวยการโรงพยาบาล</span>
            <h2>พญ.นฤนาท จอมภาปิน</h2>
            <p className="profileTitle">ผู้อำนวยการโรงพยาบาลเถิน</p>
            <div className="profileQuote">
              <p>
                "โรงพยาบาลเถินมุ่งเน้นการพัฒนาระบบบริการให้ประชาชนได้รับการดูแลอย่างทั่วถึงและรวดเร็ว 
                ทั้งด้านการส่งต่อผู้ป่วยฉุกเฉิน การดูแลผู้ป่วยเรื้อรัง และการส่งเสริมสุขภาพในชุมชน"
              </p>
              <p>
                "ทีมสหสาขาวิชาชีพพร้อมให้บริการด้วยมาตรฐานความปลอดภัย พร้อมขยายเครือข่ายความร่วมมือกับหน่วยงานท้องถิ่น 
                เพื่อยกระดับคุณภาพชีวิตของประชาชนในพื้นที่"
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <Link href="/about/board" className="btn btn-outline btn-sm">
                คณะกรรมการบริหารโรงพยาบาล
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
