'use client'

import { Phone, Printer, Clock, MapPin, MessageSquare, ExternalLink } from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { FacebookIcon } from '@/components/common/Icons'
import { siteConfig } from '@/config/site'
import { relatedOrgs } from '@/config/home'
import './page.css'

export default function ContactClientView() {
  return (
    <div className="contact-page">
      <div className="container">
        {/* Breadcrumb (N5) */}
        <Breadcrumb items={[{ label: 'ติดต่อเรา' }]} />

        {/* Contact Header */}
        <div className="contactHeader animate-fadeInUp">
          <h1 className="contactHeader__title">ติดต่อเรา</h1>
          <p className="contactHeader__desc">
            สามารถติดต่อสอบถามข้อมูลการบริการ ปรึกษาปัญหาสุขภาพ หรือส่งเรื่องร้องเรียน/ข้อเสนอแนะถึงโรงพยาบาลเถินได้ผ่านช่องทางด้านล่าง
          </p>
        </div>

        <div className="contactGrid animate-fadeInUp">
          {/* Contact info side */}
          <div className="infoCard">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <MapPin size={22} />
              </span>
              <h2>{siteConfig.name}</h2>
            </div>
            <p className="addressText">
              {siteConfig.contact.address}
            </p>

            <div className="infoItems">
              <div className="infoItem">
                <div className="infoIcon" style={{ color: 'var(--danger)' }}>
                  <Phone size={18} />
                </div>
                <div className="infoItem__content">
                  <strong>สายด่วนอุบัติเหตุและฉุกเฉิน (24 ชม.):</strong>
                  <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1.125rem' }}>
                    {siteConfig.contact.emergencyPhone} หรือ {siteConfig.contact.hospitalPhone}
                  </p>
                </div>
              </div>

              <div className="infoItem">
                <div className="infoIcon">
                  <Printer size={18} />
                </div>
                <div className="infoItem__content">
                  <strong>เบอร์โทรสาร (Fax):</strong>
                  <p>{siteConfig.contact.fax}</p>
                </div>
              </div>

              <div className="infoItem">
                <div className="infoIcon">
                  <Clock size={18} />
                </div>
                <div className="infoItem__content">
                  <strong>เวลาทำการ:</strong>
                  <p>• {siteConfig.hours.emergency}</p>
                  <p style={{ marginTop: '0.25rem' }}>• แผนกผู้ป่วยนอก (OPD): {siteConfig.hours.opd}</p>
                  <p style={{ marginTop: '0.25rem' }}>• แพทย์แผนไทย: {siteConfig.hours.traditionalMedicine}</p>
                </div>
              </div>
            </div>

            <div className="infoCard__actions">
              <a
                href={siteConfig.contact.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary touch-target"
                style={{ width: '100%' }}
              >
                <MapPin size={16} />
                <span>เปิดแผนที่นำทาง (Google Maps)</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Contact form side */}
          <div className="contactFormSection">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap gold-wrap" style={{ backgroundColor: 'var(--accent-gold-light)', color: 'var(--accent-gold-dark)' }}>
                <MessageSquare size={22} />
              </span>
              <h2>ส่งเรื่องร้องเรียน / ข้อเสนอแนะ</h2>
            </div>
            <p className="formSubtitle">
              กรอกข้อมูลลงในแบบฟอร์มด้านล่าง ข้อมูลของท่านจะถูกส่งตรงถึงผู้บริหารโรงพยาบาลเถินเพื่อปรับปรุงการบริการ
            </p>

            <div className="iframeContainer">
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSekKnRyhF09oqU1s4CThb4x99VJ3ZOaP2r7RWQ6Ey0LkMWahg/viewform?embedded=true"
                width="100%"
                height="100%"
                style={{ border: 'none', background: 'transparent', minHeight: '480px' }}
                title="แบบฟอร์มร้องเรียน โรงพยาบาลเถิน"
                loading="lazy"
              >
                กำลังโหลดแบบฟอร์ม…
              </iframe>
            </div>
          </div>
        </div>

        {/* Social & Maps Section */}
        <div className="socialMapGrid animate-fadeInUp">
          <div className="facebookEmbedCard card">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap facebook-wrap" style={{ backgroundColor: '#EBF5FF', color: '#1877F2' }}>
                <FacebookIcon size={20} />
              </span>
              <h2>Facebook โรงพยาบาลเถิน</h2>
            </div>
            <p className="sectionSub">เกาะติดข่าวสารและสาระสุขภาพผ่าน Facebook Fanpage</p>
            <div className="facebookWrapper">
              <iframe
                src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FThoenHospital1669&tabs=timeline&width=500&height=450&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId"
                width="100%"
                height="450"
                style={{ border: 'none', overflow: 'hidden', borderRadius: '8px' }}
                scrolling="no"
                allowFullScreen={true}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                title="Facebook Page - โรงพยาบาลเถิน"
                loading="lazy"
              />
            </div>
          </div>

          <div className="googleMapEmbedCard card">
            <div className="card-header-with-icon">
              <span className="card-header-icon-wrap map-wrap" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <MapPin size={20} />
              </span>
              <h2>แผนที่และการเดินทาง</h2>
            </div>
            <p className="sectionSub">แผนที่แสดงพิกัดที่ตั้งโรงพยาบาลเถิน ริมถนนพหลโยธิน</p>
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
        <div className="relatedOrgsSection animate-fadeInUp">
          <div className="sectionHeader">
            <h2>หน่วยงานที่เกี่ยวข้อง</h2>
            <p>เครือข่ายบริการสุขภาพและสถานพยาบาลในจังหวัดลำปาง</p>
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
                    className="orgLinkBadge touch-target"
                  >
                    <span>{org.name}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )
              }
              return (
                <span
                  key={index}
                  className="orgLinkBadge disabled"
                  title="ยังไม่มีลิงก์เชื่อมโยง"
                >
                  {org.name}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
