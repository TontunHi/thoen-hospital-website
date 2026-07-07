'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import './Navbar.css';


export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [member, setMember] = useState<{ username: string; name?: string | null } | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const prevCountRef = useRef<number>(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  const getDisplayName = () => {
    if (!member) return '';
    if (member.name) {
      const parts = member.name.trim().split(/\s+/);
      return parts[1] || parts[0];
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

  // Polling for pending approvals count
  useEffect(() => {
    if (!member) {
      setPendingCount(0);
      prevCountRef.current = 0;
      return;
    }

    // Request notification permission if not yet decided
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    async function fetchCount() {
      try {
        const res = await fetch(`/api/member/approvals/count?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const count = data.count;
            setPendingCount(count);
            
            // Trigger notification if count has increased
            if (count > prevCountRef.current) {
              setToastMessage(`คุณมีรายการงานอนุมัติใหม่ค้างอยู่ในระบบทั้งหมด ${count} รายการ`);
              setShowToast(true);
              
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
                new Notification('มีงานอนุมัติใหม่เข้ามา 👤', {
                  body: `คุณมีงานรออนุมัติค้างอยู่ในระบบทั้งหมด ${count} รายการ`,
                  icon: '/images/common/logo-website.webp'
                });
              }
            }
            prevCountRef.current = count;
          }
        }
      } catch (err) {
        console.error('Failed to fetch approvals count:', err);
      }
    }

    fetchCount(); // Initial fetch

    const interval = setInterval(fetchCount, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [member]);

  // Toast auto-hide
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Document Title Badge count update
  useEffect(() => {
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) งานรออนุมัติ | โรงพยาบาลเถิน`;
    } else {
      document.title = "โรงพยาบาลเถิน | Thoen Hospital ลำปาง";
    }
  }, [pendingCount]);

  // Check if member is logged in
  useEffect(() => {
    async function checkMember() {
      try {
        const res = await fetch(`/api/member/me?t=${Date.now()}`, { cache: 'no-store' });

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
    if (pathname && !pathname.startsWith('/member/news') && !pathname.startsWith('/news-login') && !pathname.startsWith('/salary')) {
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
        { href: '/package/dentistry', label: 'บริการด้านทันตกรรม' },
        { href: '/package/vip-room', label: 'ห้องพิเศษ VIP' },
        { href: '/package/childbirth', label: 'คลอดบุตร' },
      ]
    },
    {
      label: 'ข่าวสาร',
      submenu: [
        { href: '/news', label: 'ข่าวสารทั้งหมด' },
        { href: '/news?category=PR', label: 'ข่าวสารประชาสัมพันธ์' },
        { href: '/news?category=TRAINING', label: 'ประชุมอบรม / สัมมนา' },
        { href: '/news?category=JOBS', label: 'ประกาศรับสมัครงาน' },
        { href: '/news?category=ANNOUNCEMENT', label: 'ประกาศ' },
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
      <div className="navbar__mourning-ribbon">
        <Image
          src="/images/home/black.webp"
          alt="ไว้อาลัย"
          width={40}
          height={80}
          priority
        />
      </div>
      <div className="navbar__container container">
        <Link href="/" className="navbar__logo">
          <Image
            src="/images/common/logo-website.webp"
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
              <Link href="/member" className="btn btn-primary" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                ระบบสมาชิก ({getDisplayName()})
                {pendingCount > 0 && <span className="navbar__badge-mobile">{pendingCount}</span>}
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
          <div className="navbar__cta-desktop">
            <Link href="/check-date" className="navbar__check-date-btn">
              ตรวจสอบนัดหมาย
            </Link>

            {member ? (
              <>
                <Link href="/member" className="navbar__member-btn">
                  <span className="navbar__member-name">
                    {getDisplayName()}
                  </span>
                </Link>
                <Link href="/member/approvals" className="navbar__bell-btn" title="กล่องงานรออนุมัติ">
                  <span className="navbar__bell-icon">🔔</span>
                  {pendingCount > 0 && <span className="navbar__bell-badge">{pendingCount}</span>}
                </Link>
              </>
            ) : (
              <Link href="/member/login" className="navbar__login-btn">
                เข้าสู่ระบบสมาชิก
              </Link>
            )}
          </div>

          {member && (
            <Link href="/member/approvals" className="navbar__bell-btn navbar__bell-btn--mobile" title="กล่องงานรออนุมัติ">
              <span className="navbar__bell-icon">🔔</span>
              {pendingCount > 0 && <span className="navbar__bell-badge">{pendingCount}</span>}
            </Link>
          )}

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
      {isOpen && (
        <div 
          className="navbar__overlay" 
          onClick={() => setIsOpen(false)} 
          role="button"
          aria-label="ปิดเมนู"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              setIsOpen(false)
            }
          }}
        />
      )}
      
      {showToast && (
        <div className="navbar__toast">
          <div className="navbar__toast-content">
            <span className="navbar__toast-icon">🔔</span>
            <div className="navbar__toast-text">
              <div className="navbar__toast-title">มีงานรออนุมัติใหม่</div>
              <div className="navbar__toast-desc">{toastMessage}</div>
            </div>
            <button className="navbar__toast-close" onClick={() => setShowToast(false)}>×</button>
          </div>
        </div>
      )}
    </nav>
  );
}
