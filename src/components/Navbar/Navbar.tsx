'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import './Navbar.css';


export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [member, setMember] = useState<{ username: string } | null>(null);
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

  // Check if member is logged in
  useEffect(() => {
    async function checkMember() {
      try {
        const res = await fetch('/api/member/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setMember(data.member);
          } else {
            setMember(null);
          }
        } else {
          setMember(null);
        }
      } catch (err) {
        console.error('Failed to verify member session in navbar:', err);
        setMember(null);
      }
    }
    
    // Only check if it's not administrative or salary systems
    if (pathname && !pathname.startsWith('/admin') && !pathname.startsWith('/login') && !pathname.startsWith('/salary')) {
      checkMember();
    }
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

  if (pathname && (pathname.startsWith('/admin') || pathname.includes('/tv-mode'))) {
    return null;
  }

  const navLinks = [
    { href: '/', label: 'หน้าแรก' },
    {
      label: 'การบริการ',
      href: '/package',
      submenu: [
        { href: '/package/health-check-1day', label: 'โปรแกรมตรวจสุขภาพ 1 วัน' }
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
    {
      label: 'เกี่ยวกับเรา',
      submenu: [
        { href: '/about', label: 'ผู้บริหารโรงพยาบาล' },
        { href: '/about/history', label: 'ประวัติความเป็นมา' },
        { href: '/about/vision-mission', label: 'วิสัยทัศน์ ค่านิยม พันธกิจ' },
        { href: '/about/board', label: 'คณะกรรมการบริหาร' },
      ]
    },
    { href: '/contact', label: 'ติดต่อเรา' },
  ];

  if (member) {
    navLinks.push({ href: '/service', label: 'ระบบงานภายใน' });
  }

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
              const hasHeaderLink = !!link.href;
              return (
                <li key={link.label} className="navbar__dropdown">
                  {hasHeaderLink ? (
                    <Link
                      href={link.href!}
                      className={`navbar__link navbar__dropdown-toggle ${
                        isSubActive || isActiveLink(link.href!) ? 'navbar__link--active' : ''
                      }`}
                    >
                      {link.label} <span className="dropdown-arrow">▼</span>
                    </Link>
                  ) : (
                    <span className={`navbar__link navbar__dropdown-toggle ${isSubActive ? 'navbar__link--active' : ''}`}>
                      {link.label} <span className="dropdown-arrow">▼</span>
                    </span>
                  )}
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
          {/* Member link inside mobile menu */}
          <li className="navbar__cta-mobile">
            <Link href="/check-date" className="btn btn-outline" style={{ display: 'flex', justifyContent: 'center', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
              ตรวจสอบนัดหมาย
            </Link>
            {member ? (
              <Link href="/member" className="btn btn-primary">
                ระบบสมาชิก ({member.username.length === 13 && /^\d+$/.test(member.username) ? `${member.username.substring(0, 3)}...${member.username.substring(10)}` : member.username})
              </Link>
            ) : (
              <Link href="/member/login" className="btn btn-outline">
                เข้าสู่ระบบสมาชิก
              </Link>
            )}
          </li>
        </ul>

        <div className="navbar__actions">
          {/* Member status on desktop */}
          <div className="navbar__cta-desktop" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/check-date" className="navbar__login-btn" style={{ borderColor: '#0d9488', color: '#0d9488' }}>
              ตรวจสอบนัดหมาย
            </Link>
            {member ? (
              <Link href="/member" className="navbar__member-btn">
                <span className="navbar__member-icon">👤</span>
                <span className="navbar__member-name">
                  {member.username.length === 13 && /^\d+$/.test(member.username)
                    ? `${member.username.substring(0, 3)}...${member.username.substring(10)}`
                    : member.username}
                </span>
              </Link>
            ) : (
              <Link href="/member/login" className="navbar__login-btn">
                เข้าสู่ระบบสมาชิก
              </Link>
            )}
          </div>

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
