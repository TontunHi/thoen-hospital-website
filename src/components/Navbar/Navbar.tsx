'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import './Navbar.css';

const navLinks = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/about', label: 'เกี่ยวกับเรา' },
  { href: '/news', label: 'ข่าวสาร' },
  { href: '/contact', label: 'ติดต่อเรา' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

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
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`navbar__link ${
                  pathname === link.href ? 'navbar__link--active' : ''
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="navbar__cta-mobile">
            <Link href="/contact" className="btn btn-primary btn-sm">
              นัดหมาย
            </Link>
          </li>
        </ul>

        <div className="navbar__actions">
          <Link href="/contact" className="btn btn-primary btn-sm navbar__cta-desktop">
            นัดหมาย
          </Link>
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
