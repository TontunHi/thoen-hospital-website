'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import './Navbar.css';

const navLinks = [
  { href: '/', label: 'หน้าแรก' },
  {
    label: 'เกี่ยวกับเรา',
    submenu: [
      { href: '/about', label: 'ผู้บริหารโรงพยาบาล' },
      { href: '/about/history', label: 'ประวัติความเป็นมา' },
      { href: '/about/vision-mission', label: 'วิสัยทัศน์ ค่านิยม พันธกิจ' },
      { href: '/about/board', label: 'คณะกรรมการบริหาร' },
    ]
  },
  {
    label: 'ข่าวสาร',
    submenu: [
      { href: '/news', label: 'ข่าวสารทั้งหมด' },
      { href: '/news?category=PR', label: 'ข่าวสารประชาสัมพันธ์' },
      { href: '/news?category=TRAINING', label: 'ประชุมอบรม / สัมมนา' },
      { href: '/news?category=JOBS', label: 'ประกาศรับสมัครงาน' },
      { href: '/news?category=KNOWLEDGE', label: 'ข่าวสารความรู้' },
    ]
  },
  { href: '/systems', label: 'ระบบสารสนเทศ' },
  { href: '/contact', label: 'ติดต่อเรา' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    const [path, query] = href.split('?');
    if (pathname !== path) return false;
    if (query) {
      const hrefParams = new URLSearchParams(query);
      const category = hrefParams.get('category');
      return categoryParam === category;
    }
    return !categoryParam;
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__container container">
        <Link href="/" className="navbar__logo">
          <Image
            src="/images/logo-website.webp"
            alt="โรงพยาบาลเถิน"
            width={50}
            height={50}
            priority
          />
          <div className="navbar__logo-text">
            <span className="navbar__logo-name">โรงพยาบาลเถิน</span>
            <span className="navbar__logo-sub">Thoen Hospital</span>
          </div>
        </Link>

        <ul className={`navbar__links ${isOpen ? 'navbar__links--open' : ''}`}>
          {navLinks.map((link) => {
            if (link.submenu) {
              const isSubActive = link.submenu.some((sub) => isActiveLink(sub.href));
              return (
                <li key={link.label} className="navbar__dropdown">
                  <span className={`navbar__link navbar__dropdown-toggle ${isSubActive ? 'navbar__link--active' : ''}`}>
                    {link.label} <span className="dropdown-arrow">▼</span>
                  </span>
                  <ul className="navbar__submenu">
                    {link.submenu.map((sub) => (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          className={`navbar__submenu-link ${
                            isActiveLink(sub.href) ? 'navbar__submenu-link--active' : ''
                          }`}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`navbar__link ${
                    isActiveLink(link.href) ? 'navbar__link--active' : ''
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="navbar__actions">
          <button
            className={`navbar__burger ${isOpen ? 'navbar__burger--active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="เปิดเมนู"
            aria-expanded={isOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
      {isOpen && <div className="navbar__overlay" onClick={() => setIsOpen(false)} />}
    </nav>
  );
}
