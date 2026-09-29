'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { Calendar, User, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
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
  isRdu?: boolean;
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
  const navRef = useRef<HTMLElement>(null);

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
      return categoryParam === category;
    }
    return !categoryParam;
  };

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
    { href: '/systems', label: 'ระบบสารสนเทศ' },
    {
      label: 'ชมรมจริยธรรม',
      href: '/ethics',
      submenu: [
        { href: '/ethics?year=2569', label: 'จริยธรรมปีงบประมาณ 2569' },
        { href: '/ethics?year=2568', label: 'จริยธรรมปีงบประมาณ 2568' },
        { href: '/ethics?year=2567', label: 'จริยธรรมปีงบประมาณ 2567' },
      ]
    },
    { href: '/ita', label: 'ITA' },
    {
      label: 'RDU',
      href: '/rdu',
      isRdu: true,
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
      {/* Mourning Ribbon (Configurable via siteConfig - D7) */}
      {siteConfig.features.showMourningRibbon && (
        <div className="navbar__mourning-ribbon">
          <Image
            src="/images/home/black.webp"
            alt="ไว้อาลัย"
            width={40}
            height={80}
            priority
          />
        </div>
      )}

      <div className="navbar__container container">
        <Link href="/" className="navbar__logo" aria-label="กลับสู่หน้าแรกโรงพยาบาลเถิน">
          <Image
            src="/images/common/logo-website.webp"
            alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
            width={46}
            height={46}
            priority
          />
          <div className="navbar__logo-text">
            <span className="navbar__logo-name">{siteConfig.name}</span>
            <span className="navbar__logo-sub">{siteConfig.englishName}</span>
          </div>
        </Link>

        <ul className={`navbar__links ${isOpen ? 'navbar__links--open' : ''}`} id="primary-navigation">
          {navLinks.map((link) => {
            if (link.isRdu) {
              const isRduActive = pathname === '/rdu';
              const folders = link.folders || [];
              const isDropdownOpen = activeDropdown === link.label;

              return (
                <li
                  key={link.label}
                  className={`navbar__dropdown navbar__dropdown--rdu ${isDropdownOpen ? 'is-active-dropdown' : ''}`}
                >
                  <div className="navbar__dropdown-trigger-row">
                    <Link
                      href="/rdu"
                      className={`navbar__link navbar__link--has-sub ${isRduActive ? 'navbar__link--active' : ''}`}
                    >
                      <span>{link.label}</span>
                      <ChevronDown size={14} strokeWidth={2.5} className="dropdown-arrow" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="dropdown-arrow-btn dropdown-arrow-btn--mobile touch-target"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(link.label);
                      }}
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="true"
                      aria-label="เปิดเมนูย่อย RDU"
                    >
                      <ChevronDown size={14} strokeWidth={2.5} className="dropdown-arrow" aria-hidden="true" />
                    </button>
                  </div>

                  <ul
                    className="navbar__submenu navbar__submenu--rdu"
                    aria-hidden={!isDropdownOpen}
                  >
                    <li key="rdu-main">
                      <Link
                        href="/rdu"
                        className={`navbar__submenu-link ${isRduActive ? 'navbar__submenu-link--active' : ''}`}
                      >
                        หน้าหลักเอกสาร RDU ทั้งหมด
                      </Link>
                    </li>
                    {folders.length > 0 && <li className="navbar__submenu-divider" />}
                    {folders.map((folder) => {
                      const hasFiles = folder.files && folder.files.length > 0;
                      const isExpanded = expandedFolderId === folder.id;

                      return (
                        <li
                          key={`folder-${folder.id}`}
                          className={`navbar__nested-item ${hasFiles ? 'has-sub' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                        >
                          <button
                            type="button"
                            className="navbar__nested-trigger"
                            aria-expanded={isExpanded}
                            onClick={() => {
                              if (hasFiles) {
                                setExpandedFolderId(isExpanded ? null : folder.id);
                              }
                            }}
                          >
                            <span className="navbar__nested-title">{folder.folder_name}</span>
                            {hasFiles && <ChevronRight size={14} strokeWidth={2.5} className="nested-arrow" aria-hidden="true" />}
                          </button>

                          {hasFiles && (
                            <ul className={`navbar__nested-menu ${isExpanded ? 'navbar__nested-menu--open' : ''}`}>
                              {folder.files.map((file) => (
                                <li key={`file-${file.id}`}>
                                  <a
                                    href={file.file_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="navbar__nested-file-link"
                                    title={`เปิดอ่าน ${file.display_name}`}
                                  >
                                    <span>{file.display_name}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            }

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

                    <button
                      type="button"
                      className="dropdown-arrow-btn dropdown-arrow-btn--mobile touch-target"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(link.label);
                      }}
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="true"
                      aria-label={`เปิดเมนูย่อย ${link.label}`}
                    >
                      <ChevronDown size={14} strokeWidth={2.5} className="dropdown-arrow" aria-hidden="true" />
                    </button>
                  </div>

                  <ul className="navbar__submenu" aria-hidden={!isDropdownOpen}>
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

          {/* Member link inside mobile drawer */}
          <li className="navbar__cta-mobile">
            <Link
              href="/check-date"
              className="navbar__mobile-check-date-card"
            >
              <div className="navbar__mobile-card-icon">
                <Calendar size={20} aria-hidden="true" />
              </div>
              <div className="navbar__mobile-card-info">
                <span className="navbar__mobile-card-title">ตรวจสอบวันนัดหมาย</span>
                <span className="navbar__mobile-card-sub">ค้นหาข้อมูลวันนัดตรวจของท่าน</span>
              </div>
              <ChevronRight size={16} className="navbar__mobile-card-arrow" />
            </Link>

            {member ? (
              <Link
                href="/member"
                className="navbar__mobile-member-card"
              >
                <div className="navbar__mobile-avatar-wrap">
                  <User size={20} aria-hidden="true" />
                  <span className="navbar__member-status-dot" />
                </div>
                <div className="navbar__mobile-card-info">
                  <div className="navbar__mobile-card-header">
                    <span className="navbar__mobile-card-title">{getDisplayName()}</span>
                  </div>
                  <span className="navbar__mobile-card-sub">เข้าสู่หน้าระบบสมาชิกและบริการภายใน</span>
                </div>
                <ChevronRight size={16} className="navbar__mobile-card-arrow" />
              </Link>
            ) : (
              <Link href="/member/login" className="navbar__mobile-login-card">
                <div className="navbar__mobile-card-icon navbar__mobile-card-icon--gray">
                  <User size={20} aria-hidden="true" />
                </div>
                <div className="navbar__mobile-card-info">
                  <span className="navbar__mobile-card-title">เข้าสู่ระบบสมาชิก</span>
                  <span className="navbar__mobile-card-sub">สำหรับบุคลากรโรงพยาบาลเถิน</span>
                </div>
                <ChevronRight size={16} className="navbar__mobile-card-arrow" />
              </Link>
            )}
          </li>
        </ul>

        <div className="navbar__actions">
          {/* Member status on desktop */}
          <div className="navbar__cta-desktop">
            <Link href="/check-date" className="navbar__check-date-btn" title="ตรวจสอบวันนัดหมายผู้ป่วย">
              <span className="navbar__check-date-icon-wrap">
                <Calendar size={15} aria-hidden="true" />
              </span>
              <span>ตรวจสอบวันนัดหมาย</span>
            </Link>

            {member ? (
              <Link href="/member" className="navbar__member-btn" title="เข้าสู่ระบบสมาชิก">
                <div className="navbar__member-avatar">
                  <User size={15} aria-hidden="true" />
                  <span className="navbar__member-status-dot" aria-label="สถานะออนไลน์" />
                </div>
                <div className="navbar__member-info">
                  <span className="navbar__member-name">{getDisplayName()}</span>
                </div>
                <ChevronRight size={14} className="navbar__member-arrow" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/member/login" className="navbar__login-btn" title="เข้าสู่ระบบ">
                <span className="navbar__login-icon-wrap">
                  <User size={15} aria-hidden="true" />
                </span>
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}
          </div>

          <button
            type="button"
            className={`navbar__burger touch-target ${isOpen ? 'navbar__burger--active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={isOpen}
            aria-controls="primary-navigation"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="navbar__overlay"
          onClick={() => setIsOpen(false)}
          role="button"
          aria-label="ปิดเมนู"
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
