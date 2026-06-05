'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Mail } from 'lucide-react';
import { usePathname } from 'next/navigation';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();

  if (pathname && (pathname.startsWith('/admin-news') || pathname.startsWith('/news-login') || pathname.startsWith('/salary') || pathname.includes('/tv-mode'))) {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer__wave">
        <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V100H0V40Z" fill="currentColor" />
        </svg>
      </div>

      <div className="footer__content">
        <div className="container">
          <div className="footer__grid">
            {/* Hospital Info */}
            <div className="footer__col footer__col--info">
              <div className="footer__brand">
                <Image
                  src="/images/logo-website.webp"
                  alt="โรงพยาบาลเถิน"
                  width={50}
                  height={50}
                />
                <div>
                  <h3 className="footer__title">โรงพยาบาลเถิน</h3>
                  <span className="footer__subtitle">Thoen Hospital</span>
                </div>
              </div>
              <p className="footer__desc">
                โรงพยาบาลชุมชนขนาด 90 เตียง ให้บริการด้านสุขภาพอย่างครบวงจร
                แก่ประชาชนในอำเภอเถินและพื้นที่ใกล้เคียง จังหวัดลำปาง
              </p>
            </div>

            {/* Quick Links */}
            <div className="footer__col">
              <h4 className="footer__heading">ลิงก์ด่วน</h4>
              <ul className="footer__links">
                <li><Link href="/">หน้าแรก</Link></li>
                <li><Link href="/about">เกี่ยวกับเรา</Link></li>
                <li><Link href="/news">ข่าวสาร</Link></li>
                <li><Link href="/contact">ติดต่อเรา</Link></li>
              </ul>
            </div>

            {/* Services */}
            <div className="footer__col">
              <h4 className="footer__heading">บริการของเรา</h4>
              <ul className="footer__links">
                <li><span>โปรแกรมตรวจสุขภาพ 1 วัน</span></li>
                <li><span>คลินิกเฉพาะทาง</span></li>
                <li><span>ทันตกรรม</span></li>
                <li><span>แพทย์แผนไทย</span></li>
                <li><span>อัตราค่าบริการห้องพิเศษ</span></li>
                <li><span>สูตินรีเวชกรรม</span></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="footer__col">
              <h4 className="footer__heading">ติดต่อเรา</h4>
              <ul className="footer__contact">
                <li>
                  <MapPin size={16} className="footer__contact-icon" />
                  <span>อ.เถิน จ.ลำปาง 52160</span>
                </li>
                <li>
                  <Phone size={16} className="footer__contact-icon" />
                  <span>054-292016, 054-292017</span>
                </li>
                <li>
                  <Mail size={16} className="footer__contact-icon" />
                  <span>thoen.hospital@gmail.com</span>
                </li>
              </ul>

              <div className="footer__social">
                <a
                  href="https://www.facebook.com/ThoenHospital1669"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__social-link"
                  aria-label="Facebook"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container">
          <p>© {currentYear} โรงพยาบาลเถิน จังหวัดลำปาง. สงวนลิขสิทธิ์</p>
        </div>
      </div>
    </footer>
  );
}
