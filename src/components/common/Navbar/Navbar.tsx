'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { siteConfig } from '@/config/site';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  FileText,
  Folder,
  ArrowRight,
  LogIn,
  ShieldCheck,
  Scale,
  Server,
  Phone,
} from 'lucide-react';
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils';
import { getInitials } from '@/lib/formatters';
import '../../../../opendesigner/build/css/tokens.css';
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
  id: string;
  label: string;
  href?: string;
  overviewHref?: string;
  overviewLabel?: string;
  submenu?: SubmenuItem[];
  isGovernance?: boolean;
}

interface MemberBrief {
  id?: number;
  username: string;
  email?: string;
  role?: string;
  name?: string | null;
  hasProfileImage?: boolean;
}

const FIXED_NAVBAR_HEIGHT = '64px';

/**
 * Primary navigation bar for Thoen Hospital Web Portal.
 * Follows OpenDesigner DESIGN.md tokens ("Quiet Chrome, clinical paper")
 * with accessible button-triggered directory popovers and GPU-composited mobile sheet.
 */
export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [member, setMember] = useState<MemberBrief | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState<number>(0);
  const [rduFolders, setRduFolders] = useState<RduFolder[]>([]);
  const [expandedSubgroup, setExpandedSubgroup] = useState<'ethics' | 'rdu' | null>(null);

  const memberAvatarSrc =
    member?.hasProfileImage && member?.id && !avatarLoadError
      ? `/api/member/profile/image?userId=${member.id}${avatarVersion ? `&t=${avatarVersion}` : ''}`
      : null;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const yearParam = searchParams.get('year');

  const navRef = useRef<HTMLElement>(null);
  const closeHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearHoverTimer = useCallback(() => {
    if (closeHoverTimerRef.current) {
      clearTimeout(closeHoverTimerRef.current);
      closeHoverTimerRef.current = null;
    }
  }, []);

  const canHover = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const handleDropdownMouseEnter = (id: string) => {
    if (!canHover()) return;
    clearHoverTimer();
    setActiveDropdown(id);
  };

  const handleDropdownMouseLeave = () => {
    if (!canHover()) return;
    clearHoverTimer();
    closeHoverTimerRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 120);
  };

  // Sync fixed --navbar-height token and subtle scroll border elevation (no layout/height shift)
  useEffect(() => {
    document.documentElement.style.setProperty('--navbar-height', FIXED_NAVBAR_HEIGHT);

    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsOpen(false);
    setActiveDropdown(null);
    setExpandedSubgroup(null);
  }, [pathname, searchParams]);

  // Outside click & Escape key to close dropdowns or drawer
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
      clearHoverTimer();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [clearHoverTimer]);

  // Fetch RDU dynamic menu items
  useEffect(() => {
    let active = true;
    async function fetchRdu() {
      try {
        const res = await fetch('/api/rdu');
        if (res.ok && active) {
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
    return () => {
      active = false;
    };
  }, []);

  // Check if member is logged in
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !member) {
        const cached = sessionStorage.getItem('thoen_member_brief');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.username) setMember(parsed);
        }
      }
    } catch {}

    async function checkMember() {
      try {
        const res = await fetch(`/api/member/me?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.member) {
            setAvatarLoadError(false);
            setMember(data.member);
            try {
              sessionStorage.setItem('thoen_member_brief', JSON.stringify(data.member));
            } catch {}
          } else {
            setMember(null);
            try {
              sessionStorage.removeItem('thoen_member_brief');
            } catch {}
          }
        } else {
          setMember(null);
          try {
            sessionStorage.removeItem('thoen_member_brief');
          } catch {}
        }
      } catch (err) {
        console.error('Failed to verify member session in navbar:', err);
      }
    }

    checkMember();

    const handleProfileUpdated = (event: Event) => {
      const updatedAt = (event as CustomEvent<{ updatedAt?: number }>).detail?.updatedAt || Date.now();
      setAvatarLoadError(false);
      setAvatarVersion(updatedAt);
      setMember((prev) => {
        if (!prev) return prev;
        const next = { ...prev, hasProfileImage: true };
        try {
          sessionStorage.setItem('thoen_member_brief', JSON.stringify(next));
        } catch {}
        return next;
      });
      checkMember();
    };

    window.addEventListener('thoen:member-profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('thoen:member-profile-updated', handleProfileUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Auto-close mobile drawer when viewport expands to desktop
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
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

  const navItems: NavItem[] = [
    { id: 'home', href: '/', label: 'หน้าแรก' },
    {
      id: 'services',
      label: 'บริการ',
      overviewHref: '/package',
      overviewLabel: 'ดูแพ็กเกจและบริการทั้งหมด',
      submenu: [
        { href: '/package/health-check-1day', label: 'โปรแกรมตรวจสุขภาพ 1 วัน' },
        { href: '/package/specialized-clinics', label: 'คลินิกเฉพาะทาง' },
        { href: '/package/dentistry', label: 'บริการด้านทันตกรรม' },
        { href: '/package/thai-traditional-and-alternative-medicine', label: 'แพทย์แผนไทย' },
        { href: '/package/vip-room', label: 'ห้องพิเศษ VIP' },
        { href: '/package/childbirth', label: 'คลอดบุตร' },
      ],
    },
    {
      id: 'news',
      label: 'ข่าวสาร',
      overviewHref: '/news',
      overviewLabel: 'ดูข่าวสารทั้งหมด',
      submenu: [
        { href: '/news?category=PR', label: 'ข่าวสารประชาสัมพันธ์' },
        { href: '/news?category=TRAINING', label: 'ประชุมอบรม / สัมมนา' },
        { href: '/news?category=JOBS', label: 'ประกาศรับสมัครงาน' },
        { href: '/news?category=ANNOUNCEMENT', label: 'ประกาศ' },
        { href: '/gallery', label: 'ภาพข่าวและกิจกรรม' },
        { href: '/media', label: 'คลังสื่อออนไลน์' },
      ],
    },
    {
      id: 'governance',
      label: 'ธรรมาภิบาล',
      isGovernance: true,
    },
    {
      id: 'about',
      label: 'เกี่ยวกับเรา',
      overviewHref: '/about',
      overviewLabel: 'ผู้บริหารและภาพรวมโรงพยาบาล',
      submenu: [
        { href: '/about/history', label: 'ประวัติความเป็นมา' },
        { href: '/about/vision-mission', label: 'วิสัยทัศน์ ค่านิยม พันธกิจ' },
        { href: '/about/board', label: 'คณะกรรมการบริหาร' },
        { href: '/about/organization', label: 'โครงสร้างกลุ่มงานและบุคลากร' },
      ],
    },
    { id: 'contact', href: '/contact', label: 'ติดต่อเรา' },
  ];

  if (member) {
    navItems.push({ id: 'service', href: '/service', label: 'ระบบงานภายใน' });
  }

  const toggleDropdown = (id: string) => {
    clearHoverTimer();
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const closeAllMenus = () => {
    setActiveDropdown(null);
    setIsOpen(false);
  };

  return (
    <nav
      ref={navRef}
      data-theme="light"
      className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}
      aria-label="แถบนำทางหลัก"
    >
      <div className="navbar__container">
        {/* Brand Logo Lockup */}
        <Link href="/" className="navbar__logo" aria-label="กลับสู่หน้าแรกโรงพยาบาลเถิน">
          <Image
            src="/images/common/logo-website.webp"
            alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
            width={36}
            height={36}
            priority
            className="navbar__logo-img"
          />
          <div className="navbar__logo-text">
            <span className="navbar__logo-name">{siteConfig.name}</span>
            <span className="navbar__logo-sub">{siteConfig.englishName}</span>
          </div>
        </Link>

        {/* Primary Desktop Navigation */}
        <ul className="navbar__links" id="primary-navigation">
          {navItems.map((item) => {
            if (item.isGovernance) {
              const isOpenMenu = activeDropdown === item.id;

              return (
                <li
                  key={item.id}
                  className={`navbar__dropdown ${isOpenMenu ? 'is-open' : ''}`}
                  onMouseEnter={() => handleDropdownMouseEnter(item.id)}
                  onMouseLeave={handleDropdownMouseLeave}
                >
                  <button
                    type="button"
                    className={`navbar__trigger ${isGovernanceActive ? 'navbar__trigger--active' : ''}`}
                    onClick={() => toggleDropdown(item.id)}
                    aria-expanded={isOpenMenu}
                    aria-haspopup="true"
                  >
                    <span>{item.label}</span>
                    <ChevronDown size={16} strokeWidth={1.5} className="navbar__chevron" aria-hidden="true" />
                  </button>

                  <div
                    className="navbar__popover navbar__popover--directory"
                    role="region"
                    aria-label="เมนูข้อมูลองค์กรและธรรมาภิบาล"
                  >
                    <div className="navbar__directory-grid">
                      {/* Column 1: Governance & Transparency */}
                      <div className="navbar__directory-col">
                        <div className="navbar__directory-heading">
                          <ShieldCheck size={16} strokeWidth={1.5} className="navbar__directory-icon" aria-hidden="true" />
                          <span>ธรรมาภิบาลและความโปร่งใส</span>
                        </div>

                        <div className="navbar__directory-list">
                          <Link
                            href="/ita"
                            className={`navbar__directory-item ${pathname.startsWith('/ita') ? 'navbar__directory-item--active' : ''}`}
                            onClick={closeAllMenus}
                          >
                            <div className="navbar__directory-item-head">
                              <span className="navbar__directory-tag">ITA</span>
                              <span className="navbar__directory-title">การประเมิน ITA</span>
                            </div>
                            <p className="navbar__directory-desc">การประเมินคุณธรรมและความโปร่งใสในการดำเนินงาน</p>
                          </Link>

                          <div
                            className={`navbar__directory-item navbar__directory-item--grouped ${
                              pathname.startsWith('/ethics') ? 'navbar__directory-item--active' : ''
                            }`}
                          >
                            <Link href="/ethics" className="navbar__directory-item-link" onClick={closeAllMenus}>
                              <div className="navbar__directory-item-head">
                                <Scale size={16} strokeWidth={1.5} className="navbar__directory-icon" aria-hidden="true" />
                                <span className="navbar__directory-title">ชมรมจริยธรรม</span>
                              </div>
                              <p className="navbar__directory-desc">วัฒนธรรมองค์กร คุณธรรม และจริยธรรมบุคลากร</p>
                            </Link>
                            <div className="navbar__directory-chips">
                              {ethicsFiscalYears.map((year) => (
                                <Link
                                  key={year}
                                  href={`/ethics?year=${year}`}
                                  className="navbar__directory-chip"
                                  onClick={closeAllMenus}
                                >
                                  ปี {year}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Clinical Systems & RDU */}
                      <div className="navbar__directory-col">
                        <div className="navbar__directory-heading">
                          <Server size={16} strokeWidth={1.5} className="navbar__directory-icon" aria-hidden="true" />
                          <span>ระบบและข้อมูลวิชาการ</span>
                        </div>

                        <div className="navbar__directory-list">
                          <div
                            className={`navbar__directory-item navbar__directory-item--grouped ${
                              pathname.startsWith('/rdu') ? 'navbar__directory-item--active' : ''
                            }`}
                          >
                            <Link href="/rdu" className="navbar__directory-item-link" onClick={closeAllMenus}>
                              <div className="navbar__directory-item-head">
                                <span className="navbar__directory-tag">RDU</span>
                                <span className="navbar__directory-title">เอกสาร RDU</span>
                              </div>
                              <p className="navbar__directory-desc">โรงพยาบาลส่งเสริมการใช้ยาอย่างสมเหตุผล</p>
                            </Link>
                            {rduFolders.length > 0 && (
                              <div className="navbar__directory-chips">
                                {rduFolders.slice(0, 3).map((folder) => (
                                  <Link
                                    key={folder.id}
                                    href={`/rdu#folder-${folder.id}`}
                                    className="navbar__directory-chip"
                                    title={folder.folder_name}
                                    onClick={closeAllMenus}
                                  >
                                    {folder.folder_name}
                                  </Link>
                                ))}
                                {rduFolders.length > 3 && (
                                  <Link
                                    href="/rdu"
                                    className="navbar__directory-chip navbar__directory-chip--more"
                                    onClick={closeAllMenus}
                                  >
                                    +{rduFolders.length - 3} โฟลเดอร์
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>

                          <Link
                            href="/systems"
                            className={`navbar__directory-item ${pathname.startsWith('/systems') ? 'navbar__directory-item--active' : ''}`}
                            onClick={closeAllMenus}
                          >
                            <div className="navbar__directory-item-head">
                              <span className="navbar__directory-tag">SYS</span>
                              <span className="navbar__directory-title">ระบบสารสนเทศ</span>
                            </div>
                            <p className="navbar__directory-desc">ระบบสารสนเทศโรงพยาบาล บริการสำหรับประชาชนและบุคลากร</p>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            }

            if (item.submenu && item.overviewHref) {
              const isOpenMenu = activeDropdown === item.id;
              const isSubActive =
                isActiveLink(item.overviewHref) ||
                pathname.startsWith(item.overviewHref) ||
                item.submenu.some((sub) => isActiveLink(sub.href));

              return (
                <li
                  key={item.id}
                  className={`navbar__dropdown ${isOpenMenu ? 'is-open' : ''}`}
                  onMouseEnter={() => handleDropdownMouseEnter(item.id)}
                  onMouseLeave={handleDropdownMouseLeave}
                >
                  <button
                    type="button"
                    className={`navbar__trigger ${isSubActive ? 'navbar__trigger--active' : ''}`}
                    onClick={() => toggleDropdown(item.id)}
                    aria-expanded={isOpenMenu}
                    aria-haspopup="true"
                  >
                    <span>{item.label}</span>
                    <ChevronDown size={16} strokeWidth={1.5} className="navbar__chevron" aria-hidden="true" />
                  </button>

                  <div className="navbar__popover" role="region" aria-label={`เมนูย่อย ${item.label}`}>
                    <Link
                      href={item.overviewHref}
                      className={`navbar__popover-overview ${isActiveLink(item.overviewHref) ? 'navbar__popover-overview--active' : ''}`}
                      onClick={closeAllMenus}
                    >
                      <span>{item.overviewLabel}</span>
                      <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                    </Link>

                    <ul className="navbar__submenu">
                      {item.submenu.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className={`navbar__submenu-link ${isActiveLink(sub.href) ? 'navbar__submenu-link--active' : ''}`}
                            onClick={closeAllMenus}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <Link
                  href={item.href || '/'}
                  className={`navbar__link ${item.href && isActiveLink(item.href) ? 'navbar__link--active' : ''}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right Utility Zone (One Primary Action + Quiet Staff Access + Mobile Toggle) */}
        <div className="navbar__actions">
          <div className="navbar__cta-desktop">
            <Link href="/check-date" className="navbar__primary-btn" title="ตรวจสอบวันนัดหมายผู้ป่วย">
              <Calendar size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>ตรวจสอบวันนัดหมาย</span>
            </Link>

            {member ? (
              <Link href="/member" className="navbar__member-chip" title="เข้าสู่ระบบสมาชิก">
                <span className="navbar__member-avatar" aria-hidden="true">
                  {memberAvatarSrc ? (
                    <img
                      src={memberAvatarSrc}
                      alt=""
                      className="navbar__member-avatar-img"
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    getInitials(member.name || member.username)
                  )}
                  <span className="navbar__member-status-dot" />
                </span>
                <span className="navbar__member-name">{getDisplayName()}</span>
                <ChevronRight size={16} strokeWidth={1.5} className="navbar__member-arrow" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/member/login" className="navbar__staff-btn" title="เข้าสู่ระบบสมาชิก">
                <LogIn size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}
          </div>

          <button
            type="button"
            className="navbar__burger"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {isOpen ? <X size={20} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-navigation-drawer"
        className={`navbar__drawer ${isOpen ? 'navbar__drawer--open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="navbar__drawer-header">
          <Link href="/" className="navbar__drawer-brand" onClick={closeAllMenus}>
            <Image
              src="/images/common/logo-website.webp"
              alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
              width={32}
              height={32}
              className="navbar__drawer-logo"
            />
            <div className="navbar__drawer-brand-text">
              <span className="navbar__drawer-title">{siteConfig.name}</span>
              <span className="navbar__drawer-subtitle">{siteConfig.englishName}</span>
            </div>
          </Link>
          <button
            type="button"
            className="navbar__drawer-close"
            onClick={() => setIsOpen(false)}
            aria-label="ปิดเมนู"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {/* Mobile Quick Actions */}
        <div className="navbar__drawer-actions">
          <Link href="/check-date" className="navbar__mobile-primary-btn" onClick={closeAllMenus}>
            <Calendar size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>ตรวจสอบวันนัดหมาย</span>
            <ArrowRight size={16} strokeWidth={1.5} className="navbar__mobile-btn-arrow" aria-hidden="true" />
          </Link>

          {member ? (
            <Link href="/member" className="navbar__mobile-member-card" onClick={closeAllMenus}>
              <span className="navbar__member-avatar" aria-hidden="true">
                {memberAvatarSrc ? (
                  <img
                    src={memberAvatarSrc}
                    alt=""
                    className="navbar__member-avatar-img"
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  getInitials(member.name || member.username)
                )}
                <span className="navbar__member-status-dot" />
              </span>
              <div className="navbar__mobile-member-info">
                <span className="navbar__mobile-member-name">{getDisplayName()}</span>
                <span className="navbar__mobile-member-sub">เข้าสู่ระบบงานบุคลากร</span>
              </div>
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          ) : (
            <Link href="/member/login" className="navbar__mobile-staff-btn" onClick={closeAllMenus}>
              <LogIn size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>เข้าสู่ระบบสำหรับบุคลากร</span>
              <ChevronRight size={16} strokeWidth={1.5} className="navbar__mobile-btn-arrow" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Mobile Navigation List */}
        <div className="navbar__drawer-body">
          <span className="navbar__drawer-section-label">เมนูนำทาง</span>
          <ul className="navbar__mobile-list">
            {navItems.map((item) => {
              if (item.isGovernance) {
                const isExpanded = activeDropdown === item.id;

                return (
                  <li key={item.id} className="navbar__mobile-item">
                    <button
                      type="button"
                      className={`navbar__mobile-trigger ${isGovernanceActive ? 'navbar__mobile-link--active' : ''}`}
                      onClick={() => toggleDropdown(item.id)}
                      aria-expanded={isExpanded}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={1.5}
                        className={`navbar__mobile-chevron ${isExpanded ? 'is-rotated' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {isExpanded && (
                      <ul className="navbar__mobile-submenu">
                        <li>
                          <Link
                            href="/ita"
                            className={`navbar__mobile-sublink ${pathname.startsWith('/ita') ? 'navbar__mobile-sublink--active' : ''}`}
                            onClick={closeAllMenus}
                          >
                            <ShieldCheck size={16} strokeWidth={1.5} aria-hidden="true" />
                            <span>การประเมิน ITA</span>
                          </Link>
                        </li>

                        <li>
                          <div className="navbar__mobile-subrow">
                            <Link
                              href="/ethics"
                              className={`navbar__mobile-sublink ${pathname.startsWith('/ethics') ? 'navbar__mobile-sublink--active' : ''}`}
                              onClick={closeAllMenus}
                            >
                              <Scale size={16} strokeWidth={1.5} aria-hidden="true" />
                              <span>ชมรมจริยธรรม</span>
                            </Link>
                            <button
                              type="button"
                              className="navbar__mobile-subtoggle"
                              onClick={() => setExpandedSubgroup((prev) => (prev === 'ethics' ? null : 'ethics'))}
                              aria-expanded={expandedSubgroup === 'ethics'}
                              aria-label="แสดงปีงบประมาณจริยธรรม"
                            >
                              <ChevronDown
                                size={16}
                                strokeWidth={1.5}
                                className={`navbar__mobile-chevron ${expandedSubgroup === 'ethics' ? 'is-rotated' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                          {expandedSubgroup === 'ethics' && (
                            <ul className="navbar__mobile-filelist">
                              {ethicsFiscalYears.map((year) => (
                                <li key={year}>
                                  <Link href={`/ethics?year=${year}`} className="navbar__mobile-filelink" onClick={closeAllMenus}>
                                    จริยธรรมปีงบประมาณ {year}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>

                        <li>
                          <div className="navbar__mobile-subrow">
                            <Link
                              href="/rdu"
                              className={`navbar__mobile-sublink ${pathname.startsWith('/rdu') ? 'navbar__mobile-sublink--active' : ''}`}
                              onClick={closeAllMenus}
                            >
                              <Folder size={16} strokeWidth={1.5} aria-hidden="true" />
                              <span>เอกสาร RDU</span>
                            </Link>
                            {rduFolders.length > 0 && (
                              <button
                                type="button"
                                className="navbar__mobile-subtoggle"
                                onClick={() => setExpandedSubgroup((prev) => (prev === 'rdu' ? null : 'rdu'))}
                                aria-expanded={expandedSubgroup === 'rdu'}
                                aria-label="แสดงโฟลเดอร์เอกสาร RDU"
                              >
                                <ChevronDown
                                  size={16}
                                  strokeWidth={1.5}
                                  className={`navbar__mobile-chevron ${expandedSubgroup === 'rdu' ? 'is-rotated' : ''}`}
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                          {expandedSubgroup === 'rdu' && rduFolders.length > 0 && (
                            <ul className="navbar__mobile-filelist">
                              {rduFolders.map((folder) => (
                                <li key={folder.id}>
                                  <Link
                                    href={`/rdu#folder-${folder.id}`}
                                    className="navbar__mobile-filelink"
                                    onClick={closeAllMenus}
                                  >
                                    <FileText size={14} strokeWidth={1.5} aria-hidden="true" />
                                    <span>{folder.folder_name}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>

                        <li>
                          <Link
                            href="/systems"
                            className={`navbar__mobile-sublink ${pathname.startsWith('/systems') ? 'navbar__mobile-sublink--active' : ''}`}
                            onClick={closeAllMenus}
                          >
                            <Server size={16} strokeWidth={1.5} aria-hidden="true" />
                            <span>ระบบสารสนเทศ</span>
                          </Link>
                        </li>
                      </ul>
                    )}
                  </li>
                );
              }

              if (item.submenu && item.overviewHref) {
                const isExpanded = activeDropdown === item.id;
                const isSubActive =
                  isActiveLink(item.overviewHref) ||
                  pathname.startsWith(item.overviewHref) ||
                  item.submenu.some((sub) => isActiveLink(sub.href));

                return (
                  <li key={item.id} className="navbar__mobile-item">
                    <button
                      type="button"
                      className={`navbar__mobile-trigger ${isSubActive ? 'navbar__mobile-link--active' : ''}`}
                      onClick={() => toggleDropdown(item.id)}
                      aria-expanded={isExpanded}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={1.5}
                        className={`navbar__mobile-chevron ${isExpanded ? 'is-rotated' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {isExpanded && (
                      <ul className="navbar__mobile-submenu">
                        <li>
                          <Link
                            href={item.overviewHref}
                            className={`navbar__mobile-sublink navbar__mobile-sublink--overview ${
                              isActiveLink(item.overviewHref) ? 'navbar__mobile-sublink--active' : ''
                            }`}
                            onClick={closeAllMenus}
                          >
                            <span>{item.overviewLabel}</span>
                            <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
                          </Link>
                        </li>
                        {item.submenu.map((sub) => (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              className={`navbar__mobile-sublink ${isActiveLink(sub.href) ? 'navbar__mobile-sublink--active' : ''}`}
                              onClick={closeAllMenus}
                            >
                              <span>{sub.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li key={item.id} className="navbar__mobile-item">
                  <Link
                    href={item.href || '/'}
                    className={`navbar__mobile-link ${item.href && isActiveLink(item.href) ? 'navbar__mobile-link--active' : ''}`}
                    onClick={closeAllMenus}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quiet Hospital Contact Footer in Mobile Drawer */}
        <div className="navbar__drawer-footer">
          <Link href="/contact" className="navbar__drawer-contact" onClick={closeAllMenus}>
            <Phone size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>ติดต่อโรงพยาบาล {siteConfig.contact.hospitalPhone} · ฉุกเฉิน {siteConfig.contact.emergencyPhone}</span>
          </Link>
        </div>
      </div>

      {/* Mobile Scrim */}
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
