'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import './Navbar.css';


export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [member, setMember] = useState<{ username: string; name?: string | null } | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  const getDisplayName = () => {
    if (!member) return '';
    if (member.name) {
      const parts = member.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return parts[1]; // First name only
      }
      return parts[0];
    }
    if (member.username.length === 13 && /^\d+$/.test(member.username)) {
      return `${member.username.substring(0, 3)}...${member.username.substring(10)}`;
    }
    return member.username;
  };

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
    if (pathname && !pathname.startsWith('/admin-news') && !pathname.startsWith('/news-login') && !pathname.startsWith('/salary')) {
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

  if (pathname && pathname.includes('/tv-mode')) {
    return null;
  }

  const navLinks = [
    { href: '/', label: 'หน้าแรก' },
    {
      label: 'การบริการ',
      href: '/package',
      submenu: [
        { href: '/package/health-check-1day', label: 'โปรแกรมตรวจสุขภาพ 1 วัน' },
        { href: '/package/dentistry', label: 'บริการด้านทันตกรรม' }
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
      label: 'ชมรมจริยธรรม',
      submenu: [
        { href: '/ethics?year=2569', label: 'จริยธรรมปีงบประมาณ 2569' },
        { href: '/ethics?year=2568', label: 'จริยธรรมปีงบประมาณ 2568' },
        { href: '/ethics?year=2567', label: 'จริยธรรมปีงบประมาณ 2567' },
      ]
    },
    {
      label: 'ITA',
      submenu: [
        { href: '/ita', label: 'ITA ทั้งหมด' },
        { href: 'https://sites.google.com/thoenhospital.com/ita-2569-11152/ita', label: 'ITA 2569' },
        { href: 'https://sites.google.com/thoenhospital.com/ita-11152/ita', label: 'ITA 2568' },
        { href: 'http://www.thlp.moph.go.th/11152/ITA/2567/index.php', label: 'ITA 2567' },
        { href: 'http://www.thlp.moph.go.th/11152/ITA/2567/index.php', label: 'ITA 2566' },
        { href: 'http://www.thlp.moph.go.th/11152/ITA/2565/index.php', label: 'ITA 2565' },
      ]
    },
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
                    {link.submenu.map((sub, idx) => (
                      <li key={`${sub.label}-${idx}`}>
                        {sub.href.startsWith('http') ? (
                          <a
                            href={sub.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="navbar__submenu-link"
                          >
                            {sub.label}
                          </a>
                        ) : (
                          <Link
                            href={sub.href}
                            className={`navbar__submenu-link ${
                              isActiveLink(sub.href) ? 'navbar__submenu-link--active' : ''
                            }`}
                          >
                            {sub.label}
                          </Link>
                        )}
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
                ระบบสมาชิก ({getDisplayName()})
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
                  {getDisplayName()}
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
