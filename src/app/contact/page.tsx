'use client'

import { Phone, Printer, Clock, MapPin, MessageSquare } from 'lucide-react'
import './page.css'

const FacebookIcon = (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg 
    width={props.size || 24} 
    height={props.size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const relatedOrgs = [
  { name: 'สสจ.ลำปาง', url: 'https://www.lpho.go.th/' },
  { name: 'สสอ.เถิน', url: 'https://www.thoenhealth.go.th/index.php' },
  { name: 'รพ.มะเร็งลำปาง', url: 'https://www.lpch.go.th/lpch/' },
  { name: 'รพ.ศูนย์ลำปาง', url: 'https://www.lph.go.th/lpweb/' },
  { name: 'รพ.เกาะคา', url: 'https://www.kokhahospital.go.th/' },
  { name: 'รพ.งาว', url: 'https://www.ngaohospital.com/' },
  { name: 'รพ.แจ้ห่ม', url: 'https://chaehomlampang.wordpress.com/' },
  { name: 'รพ.เมืองปาน', url: 'https://muangpan.moph.go.th/newsportal/' },
  { name: 'รพ.แม่ทะ', url: 'https://maethahospital.com/' },
  { name: 'รพ.แม่พริก', url: 'http://61.19.35.172/webmaeprik/' },
  { name: 'รพ.แม่เมาะ', url: 'https://www.maemohhospital.go.th/maemohhospital/index.php' },
  { name: 'รพ.วังเหนือ', url: 'http://www.wangnueahospital.com/' },
  { name: 'รพ.สบปราบ', url: 'https://www.sopprabhospital.go.th/' },
  { name: 'รพ.เสริมงาม', url: 'http://www.soemngamhospital.go.th/index.php?page=intro&language=th' },
  { name: 'รพ.ห้างฉัตร', url: 'https://www.hangchathospital.com/' },
];

export default function ContactPage() {
  return (
    <div className="contact-page">
      <div className="container">
        
        {/* Contact Header */}
        <div className="contactHeader">
          <h1 className="contactHeader__title">ติดต่อเรา</h1>
          <p className="contactHeader__desc">
            คุณสามารถติดต่อสอบถามข้อมูลการบริการ หรือส่งข้อคิดเห็น/ข้อร้องเรียนถึงโรงพยาบาลเถินได้ผ่านช่องทางด้านล่าง
          </p>
        </div>

        <div className="contactGrid">
          {/* Contact info side */}
          <div className="contactInfoSection">
            <div className="infoCard">
              <div className="card-header-with-icon">
                <span className="card-header-icon-wrap">
                  <MapPin size={22} />
                </span>
                <h2>โรงพยาบาลเถิน</h2>
              </div>
              <p className="addressText">
                เลขที่ 196 หมู่ 6 ถนนพหลโยธิน ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง 52160
              </p>

              <div className="infoItems">
                <div className="infoItem">
                  <div className="infoIcon">
                    <Phone size={18} />
                  </div>
                  <div className="infoItem__content">
                    <strong>เบอร์โทรศัพท์:</strong>
                    <p>054-292016, 054-292017</p>
                  </div>
                </div>

                <div className="infoItem">
                  <div className="infoIcon">
                    <Printer size={18} />
                  </div>
                  <div className="infoItem__content">
                    <strong>เบอร์โทรสาร (Fax):</strong>
                    <p>054-292015</p>
                  </div>
                </div>

                <div className="infoItem">
                  <div className="infoIcon">
                    <Clock size={18} />
                  </div>
                  <div className="infoItem__content">
                    <strong>เวลาทำการ:</strong>
                    <p>เปิดให้บริการทุกวัน ตลอด 24 ชั่วโมง (แผนกอุบัติเหตุและฉุกเฉิน)</p>
                    <p style={{ marginTop: '0.4rem' }}>แผนกผู้ป่วยนอก (OPD): วันจันทร์ - ศุกร์ เวลา 08.00 น. - 16.00 น.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact form side */}
          <div className="contactFormSection">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap gold-wrap">
                <MessageSquare size={22} />
              </span>
              <h2>ส่งเรื่องร้องเรียน / ข้อเสนอแนะ</h2>
            </div>
            <p className="formSubtitle">
              กรอกข้อมูลลงในแบบฟอร์มร้องเรียนด้านล่างเพื่อส่งข้อมูลตรงถึงผู้บริหาร
            </p>
            
            <div className="iframeContainer">
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSekKnRyhF09oqU1s4CThb4x99VJ3ZOaP2r7RWQ6Ey0LkMWahg/viewform?embedded=true"
                width="100%"
                height="750"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                style={{ border: 'none', background: 'transparent' }}
                title="แบบฟอร์มร้องเรียน โรงพยาบาลเถิน"
              >
                กำลังโหลด…
              </iframe>
            </div>
          </div>
        </div>

        {/* Social & Maps Section */}
        <div className="socialMapGrid">
          <div className="facebookEmbedCard">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap facebook-wrap">
                <FacebookIcon size={20} />
              </span>
              <h2>ติดตามเราบน Facebook</h2>
            </div>
            <p className="sectionSub">เกาะติดข่าวสารและกิจกรรมผ่าน Facebook Fanpage</p>
            <div className="facebookWrapper">
              <iframe
                src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FThoenHospital1669&tabs=timeline&width=500&height=450&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId"
                width="100%"
                height="450"
                style={{ border: 'none', overflow: 'hidden', borderRadius: '8px' }}
                scrolling="no"
                frameBorder="0"
                allowFullScreen={true}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                title="Facebook Page - โรงพยาบาลเถิน"
              />
            </div>
          </div>

          <div className="googleMapEmbedCard">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap map-wrap">
                <MapPin size={20} />
              </span>
              <h2>แผนที่และการเดินทาง</h2>
            </div>
            <p className="sectionSub">แผนที่แสดงพิกัดนำทางโรงพยาบาลเถิน จังหวัดลำปาง</p>
            <div className="mapWrapper">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3765.2312965383568!2d99.2379647!3d17.6371055!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30dea78c00000001%3A0xcab5fbfb134039ab!2sThoen%20Hospital!5e0!3m2!1sth!2sth!4v1716888495000!5m2!1sth!2sth"
                width="100%"
                height="450"
                style={{ border: 0, borderRadius: '8px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Maps - โรงพยาบาลเถิน"
              />
            </div>
          </div>
        </div>

        {/* RELATED ORGANIZATIONS SECTION */}
        <div className="relatedOrgsSection">
          <div className="sectionHeader">
            <h2>หน่วยงานที่เกี่ยวข้อง</h2>
            <p>ลิงก์เชื่อมโยงไปยังหน่วยงานราชการและสถานพยาบาลเครือข่ายที่เกี่ยวข้อง</p>
          </div>
          <div className="relatedOrgsGrid">
            {relatedOrgs.map((org, index) => {
              if (org.url) {
                return (
                  <a 
                    key={index} 
                    href={org.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="orgLinkBadge"
                  >
                    {org.name}
                  </a>
                );
              }
              return (
                <span 
                  key={index} 
                  className="orgLinkBadge disabled"
                  title="ยังไม่มีลิงก์เชื่อมโยง"
                >
                  {org.name}
                </span>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
