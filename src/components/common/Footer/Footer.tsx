'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();

  if (pathname && (pathname.startsWith('/member/news') || pathname.startsWith('/news-login') || pathname.startsWith('/salary') || pathname.includes('/tv-mode'))) {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer__bottom">
        <div className="container footer__bottom-container">
          <p>© {currentYear} โรงพยาบาลเถิน จังหวัดลำปาง. สงวนลิขสิทธิ์</p>
          <div className="footer__legal-links">
            <Link href="/policy">นโยบายความเป็นส่วนตัว</Link>
            <span className="footer__legal-dot">•</span>
            <Link href="/terms-of-use">ข้อกำหนดการใช้งาน</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

