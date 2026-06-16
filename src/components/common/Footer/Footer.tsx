'use client';

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
        <div className="container">
          <p>© {currentYear} โรงพยาบาลเถิน จังหวัดลำปาง. สงวนลิขสิทธิ์</p>
        </div>
      </div>
    </footer>
  );
}

