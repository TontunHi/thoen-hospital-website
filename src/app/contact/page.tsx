'use client'

import './page.css'

export default function ContactPage() {
  return (
    <div className="container contactPage">
      <div className="contactHeader">
        <h1>📞 ติดต่อเรา</h1>
        <p>คุณสามารถติดต่อสอบถามข้อมูลการบริการ หรือส่งข้อคิดเห็น/ข้อร้องเรียนถึงโรงพยาบาลเถินได้ผ่านช่องทางด้านล่าง</p>
      </div>

      <div className="contactGrid">
        {/* Contact info side */}
        <div className="contactInfoSection">
          <div className="infoCard card">
            <h2>🏥 โรงพยาบาลเถิน</h2>
            <p className="addressText">
              📍 เลขที่ 196 หมู่ 6 ถนนพหลโยธิน ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง 52160
            </p>

            <div className="infoItems">
              <div className="infoItem">
                <span className="infoIcon">📞</span>
                <div>
                  <strong>เบอร์โทรศัพท์:</strong>
                  <p>054-292016, 054-292017</p>
                </div>
              </div>

              <div className="infoItem">
                <span className="infoIcon">📠</span>
                <div>
                  <strong>เบอร์โทรสาร (Fax):</strong>
                  <p>054-292015</p>
                </div>
              </div>

              <div className="infoItem">
                <span className="infoIcon">⏰</span>
                <div>
                  <strong>เวลาทำการ:</strong>
                  <p>เปิดให้บริการทุกวัน ตลอด 24 ชั่วโมง (แผนกอุบัติเหตุและฉุกเฉิน)</p>
                  <p>แผนกผู้ป่วยนอก (OPD): วันจันทร์ - ศุกร์ เวลา 08.00 น. - 16.00 น.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact form side (Replaced with Google Form for complaints) */}
        <div className="contactFormSection card" style={{ padding: '2rem 1rem' }}>
          <h2>✉️ ส่งเรื่องร้องเรียน / ข้อเสนอแนะ</h2>
          <p className="formSubtitle" style={{ marginBottom: '1.5rem', paddingLeft: '1rem' }}>
            กรอกข้อมูลลงในแบบฟอร์มร้องเรียนด้านล่างเพื่อส่งข้อมูลตรงถึงผู้บริหาร
          </p>
          
          <div style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}>
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
      <div className="socialMapSection card">
        <div className="socialMapGrid">
          <div className="facebookEmbedCard">
            <h2>📱 ติดตามเราบน Facebook</h2>
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
            <h2>🗺️ แผนที่และการเดินทาง</h2>
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
      </div>
    </div>
  )
}
