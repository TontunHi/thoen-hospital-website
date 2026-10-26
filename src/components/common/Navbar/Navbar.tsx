'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { 
  Calendar, 
  User, 
  ChevronDown, 
  ChevronRight, 
  Menu, 
  X,
  FileText,
  Folder,
  ArrowRight,
  Sparkles,
  LogIn,
  ShieldCheck,
  Scale,
  Server
} from 'lucide-react';
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils';
import './Navbar.css';

interface SubmenuItem {
  href: string;
  label: string;
}

interface RduFile {
  id: number;
  display_name: string;
  file_name: string;
  file_path: string;
}

interface RduFolder {
  id: number;
  folder_name: string;
  files: RduFile[];
}

interface NavItem {
  label: string;
  href?: string;
  submenu?: SubmenuItem[];
  isGovernance?: boolean;
  folders?: RduFolder[];
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [member, setMember] = useState<{ username: string; email?: string; role?: string; name?: string | null } | null>(null);
  const [rduFolders, setRduFolders] = useState<RduFolder[]>([]);
  const [expandedFolderId, setExpandedFolderId] = useState<number | null>(null);
  
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const yearParam = searchParams.get('year');
  const navRef = useRef<HTMLElement>(null);
  const burgerButtonRef = useRef<HTMLButtonElement>(null);

  const currentFiscalYear = parseInt(calculateThaiFiscalYear(), 10);
  const ethicsFiscalYears = [currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2];

  const getDisplayName = useCallback(() => {
    if (!member) return '';
    if (member.name) {
      const parts = member.name.trim().split(/\s+/);
      return parts[1] || parts[0];
    }
    if (member.username.length === 13 && /^\d+$/.test(member.username)) {
      return `${member.username.substring(0, 3)}...${member.username.substring(10)}`;
    }
    return member.username;
  }, [member]);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsOpen(false);
    setActiveDropdown(null);
    setExpandedFolderId(null);
  }, [pathname, searchParams]);

  // Outside click & Escape key to close dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch RDU dynamic menu items
  useEffect(() => {
    async function fetchRdu() {
      try {
        const res = await fetch('/api/rdu');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.folders)) {
            setRduFolders(data.folders);
          }
        }
      } catch (err) {
        console.error('Failed to fetch RDU menu data:', err);
      }
    }
    fetchRdu();
  }, []);

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

    if (pathname && !pathname.startsWith('/member/news') && !pathname.startsWith('/news-login') && !pathname.startsWith('/salary')) {
      checkMember();
    }
  }, [pathname]);

  // Lock body scroll when mobile menu is open
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
      const year = hrefParams.get('year');
      if (category) return categoryParam === category;
      if (year) return yearParam === year;
      return true;
    }
    return !categoryParam && !yearParam;
  };

  const isGovernanceActive = 
    pathname.startsWith('/ita') || 
    pathname.startsWith('/ethics') || 
    pathname.startsWith('/rdu') || 
    pathname.startsWith('/systems');

  if (pathname && pathname.includes('/tv-mode')) {
    return null;
  }

  const navLinks: NavItem[] = [
    { href: '/', label: 'หน้าแรก' },
    {
      label: 'แพ็กเกจและบริการ',
      href: '/package',
      submenu: [
        { href: '/package/health-check-1day', label: 'โปรแกรมตรวจสุขภาพ 1 วัน' },
        { href: '/package/specialized-clinics', label: 'คลินิกเฉพาะทาง' },
        { href: '/package/dentistry', label: 'บริการด้านทันตกรรม' },
        { href: '/package/thai-traditional-and-alternative-medicine', label: 'แพทย์แผนไทย' },
        { href: '/package/vip-room', label: 'ห้องพิเศษ VIP' },
        { href: '/package/childbirth', label: 'คลอดบุตร' },
      ]
    },
    {
      label: 'ข่าวสาร',
      href: '/news',
      submenu: [
        { href: '/news', label: 'ข่าวสารทั้งหมด' },
        { href: '/news?category=PR', label: 'ข่าวสารประชาสัมพันธ์' },
        { href: '/news?category=TRAINING', label: 'ประชุมอบรม / สัมมนา' },
        { href: '/news?category=JOBS', label: 'ประกาศรับสมัครงาน' },
        { href: '/news?category=ANNOUNCEMENT', label: 'ประกาศ' },
      ]
    },
    {
      label: 'ข้อมูลองค์กรและธรรมาภิบาล',
      isGovernance: true,
      folders: rduFolders
    },
    {
      label: 'เกี่ยวกับเรา',
      href: '/about',
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

  const toggleDropdown = (label: string) => {
    setActiveDropdown((prev) => (prev === label ? null : label));
  };

  return (
    <nav ref={navRef} className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`} aria-label="แถบนำทางหลัก">
      <div className="navbar__container">
        {/* Brand Logo */}
        <Link href="/" className="navbar__logo" aria-label="กลับสู่หน้าแรกโรงพยาบาลเถิน">
          <div className="navbar__logo-badge">
            <Image
              src="/images/common/logo-website.webp"
              alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
              width={44}
              height={44}
              priority
              className="navbar__logo-img"
            />
          </div>
          <div className="navbar__logo-text">
            <span className="navbar__logo-name">{siteConfig.name}</span>
            <span className="navbar__logo-sub">{siteConfig.englishName}</span>
          </div>
        </Link>

        {/* Primary Desktop Navigation */}
        <ul className="navbar__links" id="primary-navigation">
          {navLinks.map((link) => {
            // Grouped Governance Dropdown (Hallmark & Superfuture Card Architecture)
            if (link.isGovernance) {
              const isDropdownOpen = activeDropdown === link.label;
              const folders = link.folders || [];

              return (
                <li
                  key={link.label}
                  className={`navbar__dropdown navbar__dropdown--governance ${isDropdownOpen ? 'is-active-dropdown' : ''}`}
                >
                  <div className="navbar__dropdown-trigger-row">
                    <button
                      type="button"
                      className={`navbar__link navbar__link--has-sub ${isGovernanceActive ? 'navbar__link--active' : ''}`}
                      onClick={() => toggleDropdown(link.label)}
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="true"
                    >
                      <span>{link.label}</span>
                      <ChevronDown size={14} strokeWidth={2.5} className="dropdown-arrow" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="navbar__grouped-dropdown" role="region" aria-label="เมนูข้อมูลองค์กรและธรรมาภิบาล">
                    <div className="navbar__grouped-grid">
                      {/* Column 1: ธรรมาภิบาลและความโปร่งใส */}
                      <div className="navbar__grouped-col">
                        <div className="navbar__grouped-col-header">
                          <ShieldCheck size={16} className="navbar__grouped-col-icon" aria-hidden="true" />
                          <span>ธรรมาภิบาล & ความโปร่งใส</span>
                        </div>
                        <div className="navbar__grouped-cards">
                          {/* ITA Card */}
                          <Link
                            href="/ita"
                            className={`navbar__grouped-card ${pathname.startsWith('/ita') ? 'navbar__grouped-card--active' : ''}`}
                          >
                            <div className="navbar__grouped-card-head">
                              <span className="navbar__grouped-card-badge">ITA</span>
                              <span className="navbar__grouped-card-title">การประเมิน ITA</span>
                            </div>
                            <p className="navbar__grouped-card-desc">การประเมินคุณธรรมและความโปร่งใสในการดำเนินงาน</p>
                          </Link>

                          {/* ชมรมจริยธรรม Card */}
                          <div className={`navbar__grouped-card ${pathname.startsWith('/ethics') ? 'navbar__grouped-card--active' : ''}`}>
                            <Link
                              href="/ethics"
                              className="navbar__grouped-card-head-link"
                            >
                              <div className="navbar__grouped-card-head">
                                <Scale size={15} className="navbar__grouped-card-icon" aria-hidden="true" />
                                <span className="navbar__grouped-card-title">ชมรมจริยธรรม</span>
                              </div>
                              <p className="navbar__grouped-card-desc">วัฒนธรรมองค์กร คุณธรรม และจริยธรรมบุคลากร</p>
                            </Link>
                            <div className="navbar__grouped-subtags">
                              {ethicsFiscalYears.map((year) => (
                                <Link key={year} href={`/ethics?year=${year}`} className="navbar__grouped-subtag">
                                  ปี {year}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: ระบบงานและข้อมูลวิชาการ */}
                      <div className="navbar__grouped-col">
                        <div className="navbar__grouped-col-header">
                          <Server size={16} className="navbar__grouped-col-icon" aria-hidden="true" />
                          <span>ระบบ & ข้อมูลวิชาการ</span>
                        </div>
                        <div className="navbar__grouped-cards">
                          {/* RDU Card */}
                          <div className={`navbar__grouped-card ${pathname.startsWith('/rdu') ? 'navbar__grouped-card--active' : ''}`}>
                            <Link
                              href="/rdu"
                              className="navbar__grouped-card-head-link"
                            >
                              <div className="navbar__grouped-card-head">
                                <span className="navbar__grouped-card-badge navbar__grouped-card-badge--rdu">RDU</span>
                                <span className="navbar__grouped-card-title">เอกสาร RDU</span>
                              </div>
                              <p className="navbar__grouped-card-desc">โรงพยาบาลส่งเสริมการใช้ยาอย่างสมเหตุผล</p>
                            </Link>
                            {folders.length > 0 && (
                              <div className="navbar__grouped-rdu-folders">
                                <span className="navbar__grouped-rdu-label">โฟลเดอร์เอกสาร:</span>
                                <div className="navbar__grouped-subtags">
                                  {folders.slice(0, 3).map((f) => (
                                    <Link key={f.id} href={`/rdu#folder-${f.id}`} className="navbar__grouped-subtag" title={f.folder_name}>
                                      {f.folder_name}
                                    </Link>
                                  ))}
                                  {folders.length > 3 && (
                                    <Link href="/rdu" className="navbar__grouped-subtag navbar__grouped-subtag--more">
                                      +{folders.length - 3} โฟลเดอร์
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ระบบสารสนเทศ Card */}
                          <Link
                            href="/systems"
                            className={`navbar__grouped-card ${pathname.startsWith('/systems') ? 'navbar__grouped-card--active' : ''}`}
                          >
                            <div className="navbar__grouped-card-head">
                              <span className="navbar__grouped-card-badge navbar__grouped-card-badge--sys">SYSTEMS</span>
                              <span className="navbar__grouped-card-title">ระบบสารสนเทศ</span>
                            </div>
                            <p className="navbar__grouped-card-desc">ระบบสารสนเทศโรงพยาบาล บริการสำหรับประชาชนและบุคลากร</p>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            }

            // Normal dropdown menu items
            if (link.submenu) {
              const isSubActive = link.submenu.some((sub) => isActiveLink(sub.href));
              const isDropdownOpen = activeDropdown === link.label;

              return (
                <li
                  key={link.label}
                  className={`navbar__dropdown ${isDropdownOpen ? 'is-active-dropdown' : ''}`}
                >
                  <div className="navbar__dropdown-trigger-row">
                    <Link
                      href={link.href || '#'}
                      className={`navbar__link navbar__link--has-sub ${
                        isSubActive || (link.href && isActiveLink(link.href)) ? 'navbar__link--active' : ''
                      }`}
                    >
                      <span>{link.label}</span>
                      <ChevronDown size={14} strokeWidth={2.5} className="dropdown-arrow" aria-hidden="true" />
                    </Link>
                  </div>

                  <ul className="navbar__submenu" aria-label={`เมนูย่อย ${link.label}`}>
                    {link.submenu.map((sub, idx) => (
                      <li key={`${sub.label}-${idx}`}>
                        {sub.href.startsWith('http') ? (
                          <a
                            href={sub.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="navbar__submenu-link"
                          >
                            <span>{sub.label}</span>
                          </a>
                        ) : (
                          <Link
                            href={sub.href}
                            className={`navbar__submenu-link ${
                              isActiveLink(sub.href) ? 'navbar__submenu-link--active' : ''
                            }`}
                          >
                            <span>{sub.label}</span>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }

            // Normal Single Links
            return (
              <li key={link.href}>
                <Link
                  href={link.href || '#'}
                  className={`navbar__link ${
                    link.href && isActiveLink(link.href) ? 'navbar__link--active' : ''
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Action Buttons (Desktop CTAs + Mobile Burger Toggle) */}
        <div className="navbar__actions">
          {/* Member status on desktop */}
          <div className="navbar__cta-desktop">
            <Link href="/check-date" className="navbar__check-date-btn" title="ตรวจสอบวันนัดหมายผู้ป่วย">
              <span className="navbar__check-date-icon-wrap">
                <Calendar size={15} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="navbar__check-date-text-full">ตรวจสอบวันนัดหมาย</span>
              <span className="navbar__check-date-text-short">วันนัดหมาย</span>
            </Link>

            {member ? (
              <Link href="/member" className="navbar__member-btn" title="เข้าสู่ระบบสมาชิก">
                <div className="navbar__member-avatar">
                  <User size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span className="navbar__member-status-dot" aria-label="สถานะออนไลน์" />
                </div>
                <div className="navbar__member-info">
                  <span className="navbar__member-name">{getDisplayName()}</span>
                </div>
                <ChevronRight size={14} className="navbar__member-arrow" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/member/login" className="navbar__login-btn" title="เข้าสู่ระบบสมาชิก">
                <span className="navbar__login-icon-wrap">
                  <User size={15} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}
          </div>

          {/* Mobile Burger Menu Button */}
          <button
            ref={burgerButtonRef}
            type="button"
            className={`navbar__burger touch-target ${isOpen ? 'navbar__burger--active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {isOpen ? <X size={24} strokeWidth={2.2} /> : <Menu size={24} strokeWidth={2.2} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <div 
        id="mobile-navigation-drawer" 
        className={`navbar__drawer ${isOpen ? 'navbar__drawer--open' : ''}`}
        aria-hidden={!isOpen}
      >
        {/* Drawer Header */}
        <div className="navbar__drawer-header">
          <Link href="/" className="navbar__drawer-brand" onClick={() => setIsOpen(false)}>
            <Image
              src="/images/common/logo-website.webp"
              alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
              width={36}
              height={36}
              className="navbar__drawer-logo"
            />
            <div className="navbar__drawer-brand-text">
              <span className="navbar__drawer-title">{siteConfig.name}</span>
              <span className="navbar__drawer-subtitle">ระบบบริการประชาชนและบุคลากร</span>
            </div>
          </Link>
          <button
            type="button"
            className="navbar__drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="ปิดเมนู"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Drawer CTAs */}
        <div className="navbar__drawer-cta-section">
          <Link
            href="/check-date"
            className="navbar__mobile-check-date-card"
            onClick={() => setIsOpen(false)}
          >
            <div className="navbar__mobile-card-icon">
              <Calendar size={20} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="navbar__mobile-card-info">
              <span className="navbar__mobile-card-title">ตรวจสอบวันนัดหมาย</span>
              <span className="navbar__mobile-card-sub">ค้นหาข้อมูลและกำหนดการนัดตรวจ</span>
            </div>
            <ArrowRight size={16} className="navbar__mobile-card-arrow" />
          </Link>

          {member ? (
            <Link
              href="/member"
              className="navbar__mobile-member-card"
              onClick={() => setIsOpen(false)}
            >
              <div className="navbar__mobile-avatar-wrap">
                <User size={20} strokeWidth={2.2} aria-hidden="true" />
                <span className="navbar__member-status-dot" />
              </div>
              <div className="navbar__mobile-card-info">
                <div className="navbar__mobile-card-header">
                  <span className="navbar__mobile-card-title">{getDisplayName()}</span>
                  <span className="navbar__mobile-badge">ออนไลน์</span>
                </div>
                <span className="navbar__mobile-card-sub">ระบบงานและบริการภายใน</span>
              </div>
              <ChevronRight size={16} className="navbar__mobile-card-arrow" />
            </Link>
          ) : (
            <Link 
              href="/member/login" 
              className="navbar__mobile-login-card"
              onClick={() => setIsOpen(false)}
            >
              <div className="navbar__mobile-card-icon navbar__mobile-card-icon--gray">
                <LogIn size={20} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="navbar__mobile-card-info">
                <span className="navbar__mobile-card-title">เข้าสู่ระบบสมาชิก</span>
                <span className="navbar__mobile-card-sub">สำหรับบุคลากรโรงพยาบาลเถิน</span>
              </div>
              <ChevronRight size={16} className="navbar__mobile-card-arrow" />
            </Link>
          )}
        </div>

        {/* Drawer Navigation Links */}
        <div className="navbar__drawer-links-section">
          <span className="navbar__drawer-section-label">เมนูนำทาง</span>
          <ul className="navbar__mobile-links">
            {navLinks.map((link) => {
              // Grouped Governance Dropdown in Mobile Drawer (Accordion)
              if (link.isGovernance) {
                const isDropdownOpen = activeDropdown === link.label;
                const folders = link.folders || [];

                return (
                  <li key={link.label} className="navbar__mobile-item">
                    <div className="navbar__mobile-row">
                      <button
                        type="button"
                        className={`navbar__mobile-link navbar__mobile-link--btn ${isGovernanceActive ? 'navbar__mobile-link--active' : ''}`}
                        onClick={() => toggleDropdown(link.label)}
                        aria-expanded={isDropdownOpen}
                      >
                        {link.label}
                      </button>
                      <button
                        type="button"
                        className="navbar__mobile-accordion-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(link.label);
                        }}
                        aria-expanded={isDropdownOpen}
                        aria-label={`ขยายเมนู ${link.label}`}
                      >
                        <ChevronDown 
                          size={18} 
                          className={`navbar__mobile-chevron ${isDropdownOpen ? 'is-rotated' : ''}`} 
                        />
                      </button>
                    </div>

                    {isDropdownOpen && (
                      <ul className="navbar__mobile-submenu">
                        {/* ITA */}
                        <li>
                          <Link
                            href="/ita"
                            className={`navbar__mobile-sublink ${pathname.startsWith('/ita') ? 'navbar__mobile-sublink--active' : ''}`}
                            onClick={() => setIsOpen(false)}
                          >
                            <ShieldCheck size={15} className="navbar__mobile-subicon" aria-hidden="true" />
                            <span>การประเมิน ITA</span>
                          </Link>
                        </li>

                        {/* ชมรมจริยธรรม */}
                        <li className="navbar__mobile-subfolder">
                          <div className="navbar__mobile-row">
                            <Link
                              href="/ethics"
                              className={`navbar__mobile-sublink ${pathname.startsWith('/ethics') ? 'navbar__mobile-sublink--active' : ''}`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Scale size={15} className="navbar__mobile-subicon" aria-hidden="true" />
                              <span>ชมรมจริยธรรม</span>
                            </Link>
                            <button
                              type="button"
                              className="navbar__mobile-subfolder-trigger-btn"
                              onClick={() => setExpandedFolderId(expandedFolderId === -1 ? null : -1)}
                              aria-label="แสดงปีงบประมาณจริยธรรม"
                            >
                              <ChevronDown
                                size={14}
                                className={`navbar__mobile-subchevron ${expandedFolderId === -1 ? 'is-rotated' : ''}`}
                              />
                            </button>
                          </div>
                          {expandedFolderId === -1 && (
                            <ul className="navbar__mobile-filelist">
                              {ethicsFiscalYears.map((year) => (
                                <li key={year}>
                                  <Link
                                    href={`/ethics?year=${year}`}
                                    className="navbar__mobile-filelink"
                                    onClick={() => setIsOpen(false)}
                                  >
                                    <span>จริยธรรมปีงบประมาณ {year}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>

                        {/* RDU */}
                        <li className="navbar__mobile-subfolder">
                          <div className="navbar__mobile-row">
                            <Link
                              href="/rdu"
                              className={`navbar__mobile-sublink ${pathname.startsWith('/rdu') ? 'navbar__mobile-sublink--active' : ''}`}
                              onClick={() => setIsOpen(false)}
                            >
                              <Folder size={15} className="navbar__mobile-subicon" aria-hidden="true" />
                              <span>เอกสาร RDU ทั้งหมด</span>
                            </Link>
                            {folders.length > 0 && (
                              <button
                                type="button"
                                className="navbar__mobile-subfolder-trigger-btn"
                                onClick={() => setExpandedFolderId(expandedFolderId === -2 ? null : -2)}
                                aria-label="แสดงโฟลเดอร์เอกสาร RDU"
                              >
                                <ChevronDown
                                  size={14}
                                  className={`navbar__mobile-subchevron ${expandedFolderId === -2 ? 'is-rotated' : ''}`}
                                />
                              </button>
                            )}
                          </div>
                          {expandedFolderId === -2 && folders.length > 0 && (
                            <ul className="navbar__mobile-filelist">
                              {folders.map((folder) => (
                                <li key={`mobile-rdu-${folder.id}`}>
                                  <Link
                                    href={`/rdu#folder-${folder.id}`}
                                    className="navbar__mobile-filelink"
                                    onClick={() => setIsOpen(false)}
                                  >
                                    <FileText size={13} aria-hidden="true" />
                                    <span>{folder.folder_name}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>

                        {/* ระบบสารสนเทศ */}
                        <li>
                          <Link
                            href="/systems"
                            className={`navbar__mobile-sublink ${pathname.startsWith('/systems') ? 'navbar__mobile-sublink--active' : ''}`}
                            onClick={() => setIsOpen(false)}
                          >
                            <Server size={15} className="navbar__mobile-subicon" aria-hidden="true" />
                            <span>ระบบสารสนเทศ</span>
                          </Link>
                        </li>
                      </ul>
                    )}
                  </li>
                );
              }

              if (link.submenu) {
                const isSubActive = link.submenu.some((sub) => isActiveLink(sub.href));
                const isDropdownOpen = activeDropdown === link.label;

                return (
                  <li key={link.label} className="navbar__mobile-item">
                    <div className="navbar__mobile-row">
                      <Link
                        href={link.href || '#'}
                        className={`navbar__mobile-link ${
                          isSubActive || (link.href && isActiveLink(link.href)) ? 'navbar__mobile-link--active' : ''
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {link.label}
                      </Link>
                      <button
                        type="button"
                        className="navbar__mobile-accordion-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(link.label);
                        }}
                        aria-expanded={isDropdownOpen}
                        aria-label={`ขยายเมนู ${link.label}`}
                      >
                        <ChevronDown 
                          size={18} 
                          className={`navbar__mobile-chevron ${isDropdownOpen ? 'is-rotated' : ''}`} 
                        />
                      </button>
                    </div>

                    {isDropdownOpen && (
                      <ul className="navbar__mobile-submenu">
                        {link.submenu.map((sub, idx) => (
                          <li key={`sub-${idx}`}>
                            {sub.href.startsWith('http') ? (
                              <a
                                href={sub.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="navbar__mobile-sublink"
                                onClick={() => setIsOpen(false)}
                              >
                                <span>{sub.label}</span>
                              </a>
                            ) : (
                              <Link
                                href={sub.href}
                                className={`navbar__mobile-sublink ${
                                  isActiveLink(sub.href) ? 'navbar__mobile-sublink--active' : ''
                                }`}
                                onClick={() => setIsOpen(false)}
                              >
                                <span>{sub.label}</span>
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li key={link.href} className="navbar__mobile-item">
                  <Link
                    href={link.href || '#'}
                    className={`navbar__mobile-link ${
                      link.href && isActiveLink(link.href) ? 'navbar__mobile-link--active' : ''
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Backdrop Overlay for Mobile Drawer */}
      {isOpen && (
        <div
          className="navbar__overlay"
          onClick={() => setIsOpen(false)}
          role="button"
          aria-label="ปิดเมนูนำทาง"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              setIsOpen(false);
            }
          }}
        />
      )}
    </nav>
  );
}
