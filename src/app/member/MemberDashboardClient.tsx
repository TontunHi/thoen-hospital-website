'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import ProfileBanner from './ProfileBanner'

export interface MemberDashboardClientProps {
  member: {
    id: number
    username: string
    email: string
    name: string | null
    department: string | null
    position: string | null
    profile_path: string | null
    role?: string
    hasSignature?: boolean
  }
  initials: string
  displayRole: string
  isTelegramLinked: boolean
  pendingInboxCount: number
  pendingRegistrationsCount: number
  permissions: {
    hasInbox: boolean
    hasRepair: boolean
    hasMediaRequest: boolean
    hasSalary: boolean
    hasSignature: boolean
    hasEquipmentBorrow: boolean
    hasEvents: boolean
    isAssetsAuthorized: boolean
    isNewsAuthorized: boolean
    isItaAuthorized: boolean
    isRduAuthorized: boolean
    isOutgoingDocAuthorized: boolean
    isEthicsAuthorized: boolean
    isKpiAuthorized?: boolean
    isFinance: boolean
    isAllSalaryAuthorized: boolean
    isAdmin: boolean
    isLocationsAuthorized: boolean
    isSubdistrict: boolean
  }
}

interface MenuItem {
  id: string
  title: string
  shortDesc: string
  href: string
  icon: string
  category: 'daily' | 'system' | 'admin'
  categoryLabel: string
  keywords: string[]
  isFeatured?: boolean
  badge?: string
  badgeAlert?: boolean
  visible: boolean
}

export default function MemberDashboardClient({
  member,
  initials,
  displayRole,
  isTelegramLinked,
  pendingInboxCount,
  pendingRegistrationsCount,
  permissions,
}: MemberDashboardClientProps) {
  // Define all available services based on design spec
  const allItems: MenuItem[] = useMemo(() => {
    return [
      // ── Category 1: Daily Services (งานประจำวัน) ──
      {
        id: 'inbox',
        title: 'กล่องงานและคำร้อง',
        shortDesc: 'ตรวจสอบและพิจารณางานที่ส่งถึงคุณ พร้อมติดตามสถานะใบแจ้งซ่อมและคำร้อง',
        href: '/member/inbox',
        icon: 'inbox',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        isFeatured: true,
        badge: pendingInboxCount > 0 ? `${pendingInboxCount} งานรอคุณ` : 'อัปเดตล่าสุด',
        badgeAlert: pendingInboxCount > 0,
        keywords: ['กล่องงาน', 'คำร้อง', 'inbox', 'อนุมัติ', 'ติดตามสถานะ', 'ใบแจ้งซ่อม', 'งานรอคุณ'],
        visible: permissions.hasInbox,
      },
      {
        id: 'repair',
        title: 'แจ้งซ่อมบำรุงและอุปกรณ์',
        shortDesc: 'ยื่นใบแจ้งซ่อมคอมพิวเตอร์ งานช่าง และเครื่องมือแพทย์',
        href: '/member/repairs/new',
        icon: 'build',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        keywords: ['แจ้งซ่อม', 'ซ่อม', 'คอมพิวเตอร์', 'งานช่าง', 'เครื่องมือแพทย์', 'repair'],
        visible: permissions.hasRepair,
      },
      {
        id: 'media_request',
        title: 'ระบบขอสื่อประชาสัมพันธ์',
        shortDesc: 'ขอทำป้ายไวนิล แผ่นพับ โปสเตอร์ และวิดีโอ',
        href: '/member/media-requests',
        icon: 'palette',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        keywords: ['สื่อประชาสัมพันธ์', 'ป้ายไวนิล', 'แผ่นพับ', 'โปสเตอร์', 'วิดีโอ', 'pr', 'media'],
        visible: permissions.hasMediaRequest,
      },
      {
        id: 'salary',
        title: 'ระบบสลิปเงินเดือนออนไลน์',
        shortDesc: 'ดูสลิปเงินเดือนและค่าล่วงเวลา (OT) ผ่านรหัสผ่านคุ้มครอง',
        href: '/salary',
        icon: 'receipt_long',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        keywords: ['สลิปเงินเดือน', 'เงินเดือน', 'ot', 'ค่าล่วงเวลา', 'salary', 'payslip'],
        visible: permissions.hasSalary,
      },
      {
        id: 'signature',
        title: 'จัดการลายเซ็นดิจิทัล',
        shortDesc: 'ลงทะเบียนลายเซ็นอิเล็กทรอนิกส์สำหรับเอกสาร',
        href: '/member/signature',
        icon: 'draw',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        keywords: ['ลายเซ็น', 'ดิจิทัล', 'e-signature', 'ลงนาม', 'signature'],
        visible: permissions.hasSignature,
      },
      {
        id: 'equipment_borrow',
        title: 'ระบบยืม-คืนอุปกรณ์และพัสดุ',
        shortDesc: 'ยืม-คืนครุภัณฑ์และเบิกวัสดุ พร้อมติดตามสถานะ',
        href: '/member/equipment-borrow',
        icon: 'inventory_2',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        keywords: ['ยืม', 'คืน', 'อุปกรณ์', 'พัสดุ', 'เบิกวัสดุ', 'ครุภัณฑ์', 'borrow'],
        visible: permissions.hasEquipmentBorrow,
      },
      {
        id: 'events',
        title: 'ระบบกิจกรรมและสะสมคะแนน',
        shortDesc: 'สแกน QR ผ่าน ThaID และดูกระดานคะแนน',
        href: '/member/events',
        icon: 'event_available',
        category: 'daily',
        categoryLabel: 'งานประจำวัน',
        keywords: ['กิจกรรม', 'สะสมคะแนน', 'thaid', 'สแกน qr', 'กระดานคะแนน', 'events'],
        visible: permissions.hasEvents,
      },

      // ── Category 2: Information Systems & Documents (ระบบสารสนเทศและเอกสาร) ──
      {
        id: 'assets',
        title: 'ระบบจัดการข้อมูลครุภัณฑ์',
        shortDesc: 'ตรวจสอบทะเบียนครุภัณฑ์โรงพยาบาล ตรวจสอบสถานะการรับประกัน',
        href: '/member/assets',
        icon: 'devices_other',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['ครุภัณฑ์', 'ทะเบียนครุภัณฑ์', 'asset', 'ทรัพย์สิน', 'gotowin'],
        visible: permissions.isAssetsAuthorized,
      },
      {
        id: 'ita',
        title: 'จัดการบทความ ITA',
        shortDesc: 'เขียนบทความ ปรับแต่งเนื้อหา และเผยแพร่ข้อมูล ITA สู่สาธารณะ',
        href: '/member/ita',
        icon: 'public',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['ita', 'บทความ', 'ประเมินคุณธรรม', 'ความโปร่งใส'],
        visible: permissions.isItaAuthorized,
      },
      {
        id: 'rdu',
        title: 'ระบบจัดการเอกสาร RDU',
        shortDesc: 'จัดการโฟลเดอร์ปี อัปโหลดและแก้ไขไฟล์ PDF การใช้ยาอย่างสมเหตุผล',
        href: '/member/rdu',
        icon: 'medication',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['rdu', 'ยา', 'การใช้ยา', 'เอกสารยา', 'pdf', 'โฟลเดอร์'],
        visible: permissions.isRduAuthorized,
      },
      {
        id: 'outgoing_doc',
        title: 'จัดการระบบหนังสือส่งออก Online',
        shortDesc: 'ระบบจัดการลิงก์ Google Sheets ทะเบียนหนังสือส่งออกโรงพยาบาลเถิน',
        href: '/member/outgoing-document',
        icon: 'description',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['หนังสือส่งออก', 'หนังสือ', 'ทะเบียนหนังสือ', 'google sheets', 'outgoing'],
        visible: permissions.isOutgoingDocAuthorized,
      },
      {
        id: 'ethics',
        title: 'จัดการเอกสารชมรมจริยธรรม',
        shortDesc: 'จัดการปีงบประมาณ คำสั่งคณะทำงาน แผนปฏิบัติการ และไฟล์ PDF',
        href: '/member/ethics',
        icon: 'gavel',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['จริยธรรม', 'ชมรมจริยธรรม', 'คำสั่ง', 'แผนปฏิบัติการ', 'ethics'],
        visible: permissions.isEthicsAuthorized,
      },
      {
        id: 'upload_salary',
        title: 'ระบบนำเข้าข้อมูลการเงิน',
        shortDesc: 'บันทึกงวดนำเข้า และอัปโหลดไฟล์ Excel/CSV ข้อมูลสลิปเงินเดือนและ OT',
        href: '/member/upload-salary',
        icon: 'upload_file',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['นำเข้าข้อมูลการเงิน', 'เงินเดือน', 'excel', 'csv', 'อัปโหลดสลิป'],
        visible: permissions.isFinance,
      },
      {
        id: 'all_salary',
        title: 'สลิปเงินเดือนบุคลากรทั้งหมด',
        shortDesc: 'ค้นหาและเรียกดูข้อมูลสลิปเงินเดือนและค่าล่วงเวลา (OT) ของบุคลากรทุกคน',
        href: '/member/all-salary',
        icon: 'folder_shared',
        category: 'system',
        categoryLabel: 'ระบบสารสนเทศและเอกสาร',
        keywords: ['สลิปเงินเดือนบุคลากรทั้งหมด', 'ค้นหาสลิป', 'เงินเดือนทุกคน', 'all salary'],
        visible: permissions.isAllSalaryAuthorized,
      },

      // ── Category 3: System Administration (สำหรับผู้ดูแลระบบ) ──
      {
        id: 'settings',
        title: 'ตั้งค่าระบบและเปิด/ปิดฟังก์ชัน',
        shortDesc: 'จัดการสิทธิ์และควบคุมการเข้าใช้งานของสมาชิกทั่วไป เช่น เปิด/ปิดฟังก์ชัน',
        href: '/member/settings',
        icon: 'admin_panel_settings',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        keywords: ['ตั้งค่าระบบ', 'เปิดปิดฟังก์ชัน', 'ควบคุมสิทธิ์', 'settings', 'admin'],
        visible: permissions.isAdmin,
      },
      {
        id: 'news',
        title: 'โปรแกรมโพสข่าวประชาสัมพันธ์',
        shortDesc: 'จัดการและโพสข่าวประชาสัมพันธ์ กิจกรรม ข่าวรับสมัครงาน',
        href: '/member/news',
        icon: 'newspaper',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        keywords: ['โพสข่าว', 'ข่าวประชาสัมพันธ์', 'กิจกรรม', 'รับสมัครงาน', 'news'],
        visible: permissions.isAdmin || permissions.isNewsAuthorized,
      },
      {
        id: 'registrations',
        title: 'ตรวจสอบคำขอลงทะเบียน',
        shortDesc: 'ตรวจสอบและพิจารณาอนุมัติคำขอเปิดบัญชีเข้าใช้งานระบบจากบุคลากรใหม่',
        href: '/member/registrations',
        icon: 'person_add_alt',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        badge: pendingRegistrationsCount > 0 ? `${pendingRegistrationsCount} คำขอใหม่` : 'คำขอใหม่',
        badgeAlert: pendingRegistrationsCount > 0,
        keywords: ['คำขอลงทะเบียน', 'อนุมัติ', 'ลงทะเบียน', 'คำขอใหม่', 'บุคลากรใหม่', 'registrations'],
        visible: permissions.isAdmin,
      },
      {
        id: 'member_admin',
        title: 'แดชบอร์ดจัดการสมาชิก',
        shortDesc: 'ตรวจสอบรายชื่อบุคลากรทั้งหมด แก้ไขข้อมูลสมาชิก จัดการบัญชีเงินเดือน',
        href: '/member/member',
        icon: 'manage_accounts',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        keywords: ['จัดการสมาชิก', 'รายชื่อบุคลากร', 'สมาชิก', 'users', 'บัญชีผู้ใช้'],
        visible: permissions.isAdmin,
      },
      {
        id: 'organization',
        title: 'ผังกลุ่มงานและสมาชิก',
        shortDesc: 'จัดการโครงสร้างกลุ่มงาน หน่วยงานย่อย และรายชื่อบุคลากรประจำแต่ละแผนก',
        href: '/member/organization',
        icon: 'account_tree',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        keywords: ['ผังกลุ่มงาน', 'แผนผัง', 'บุคลากร', 'องค์กร', 'โครงสร้าง', 'organization', 'department'],
        visible: permissions.isAdmin,
      },
      {
        id: 'locations',
        title: 'จัดการสถานที่ ตึก-ชั้น-ห้อง',
        shortDesc: 'แดชบอร์ดจัดการข้อมูลสถานที่ ตรวจสอบความถูกต้อง เปิด/ปิดใช้งาน',
        href: '/member/locations',
        icon: 'location_city',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        keywords: ['สถานที่', 'ตึก', 'ชั้น', 'ห้อง', 'locations', 'room'],
        visible: permissions.isLocationsAuthorized,
      },
      {
        id: 'audit_logs',
        title: 'ประวัติการใช้งาน (Audit Logs)',
        shortDesc: 'ระบบติดตามความปลอดภัยและประวัติการทำรายการ ตรวจสอบข้อมูลการเข้าสู่ระบบ',
        href: '/member/audit-logs',
        icon: 'shield',
        category: 'admin',
        categoryLabel: 'สำหรับผู้ดูแลระบบ',
        keywords: ['audit logs', 'ประวัติการใช้งาน', 'ความปลอดภัย', 'audit', 'logs'],
        visible: permissions.isAdmin,
      },
    ]
  }, [permissions, pendingInboxCount, pendingRegistrationsCount])

  // Filter visible items
  const visibleItems = useMemo(() => allItems.filter((item) => item.visible), [allItems])

  // Group items by category for standard view
  const dailyItems = useMemo(
    () => visibleItems.filter((i) => i.category === 'daily'),
    [visibleItems]
  )
  const systemItems = useMemo(
    () => visibleItems.filter((i) => i.category === 'system'),
    [visibleItems]
  )
  const adminItems = useMemo(
    () => visibleItems.filter((i) => i.category === 'admin'),
    [visibleItems]
  )

  const featuredDailyCard = dailyItems.find((i) => i.isFeatured)
  const secondaryDailyCards = dailyItems.filter((i) => !i.isFeatured)

  return (
    <div className="memberDashboardContainer">
      <div className="dashboardWrapper">
        {/* ── Section 2: Profile Banner ── */}
        <ProfileBanner
          member={member}
          initials={initials}
          displayRole={displayRole}
          isTelegramLinked={isTelegramLinked}
        />

        {/* ── Subdistrict (รพ.สต.) Notice ── */}
        {permissions.isSubdistrict ? (
          <div className="subdistrictNotice">
            <div className="subdistrictNoticeIcon">
              <span className="material-symbols-outlined" style={{ fontSize: '32px' }} aria-hidden="true">
                domain
              </span>
            </div>
            <h3>บัญชีผู้ใช้หน่วยบริการ รพ.สต.</h3>
            <p>
              บัญชีผู้ใช้งานนี้ได้รับสิทธิ์ในระดับ <strong>รพ.สต.</strong> เพื่อเข้าถึงระบบสารสนเทศทางการแพทย์และการติดตามผลแลปภายนอกโรงพยาบาล ไม่มีฟังก์ชันบริการงานภายในโรงพยาบาลในหน้านี้
            </p>
            <Link href="/service" className="subdistrictNoticeBtn">
              <span>เข้าสู่หน้าระบบงานสารสนเทศ (Services)</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                chevron_right
              </span>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Section 4: Daily Services (งานประจำวัน) ── */}
            {dailyItems.length > 0 && (
                  <section aria-labelledby="section-daily-services" className="memberSection">
                    <h3 id="section-daily-services" className="memberSectionTitle">
                      งานประจำวัน
                    </h3>
                    <div className="dailyGrid">
                      {/* Featured Card ("กล่องงานและคำร้อง") */}
                      {featuredDailyCard && (
                        <Link href={featuredDailyCard.href} className="featuredCard">
                          <div>
                            <div className="featuredCardHeader">
                              <div className="featuredIconBox">
                                <span className="material-symbols-outlined" aria-hidden="true">
                                  {featuredDailyCard.icon}
                                </span>
                              </div>
                              {featuredDailyCard.badge && (
                                <span
                                  className={`featuredBadge ${
                                    featuredDailyCard.badgeAlert ? 'featuredBadgeAlert' : ''
                                  }`}
                                >
                                  {featuredDailyCard.badgeAlert && (
                                    <span className="featuredPulseDot" aria-hidden="true" />
                                  )}
                                  {featuredDailyCard.badge}
                                </span>
                              )}
                            </div>
                            <div className="featuredCardBody">
                              <h4 className="featuredTitle">{featuredDailyCard.title}</h4>
                              <p className="featuredDesc">{featuredDailyCard.shortDesc}</p>
                            </div>
                          </div>
                          <div className="featuredCardFooter">
                            <span>เปิดกล่องงาน</span>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">
                              chevron_right
                            </span>
                          </div>
                        </Link>
                      )}

                      {/* 6 Secondary Cards */}
                      {secondaryDailyCards.map((card) => (
                        <Link key={card.id} href={card.href} className="secondaryCard">
                          <div className="secondaryIconBox">
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {card.icon}
                            </span>
                          </div>
                          <h4 className="secondaryTitle">{card.title}</h4>
                          <p className="secondaryDesc">{card.shortDesc}</p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Section 5: Information Systems & Documents (ระบบสารสนเทศและเอกสาร) ── */}
                {systemItems.length > 0 && (
                  <section aria-labelledby="section-system-docs" className="memberSection">
                    <h3 id="section-system-docs" className="memberSectionTitle">
                      ระบบสารสนเทศและเอกสาร
                    </h3>
                    <div className="docsGrid">
                      {systemItems.map((item) => (
                        <Link key={item.id} href={item.href} className="rowItem">
                          <div className="rowLeft">
                            <div className="rowIconBox">
                              <span className="material-symbols-outlined" aria-hidden="true">
                                {item.icon}
                              </span>
                            </div>
                            <span className="rowTitle">{item.title}</span>
                          </div>
                          <div className="rowRight">
                            <span className="material-symbols-outlined rowChevron" aria-hidden="true">
                              chevron_right
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Section 6: System Administration (สำหรับผู้ดูแลระบบ) ── */}
                {adminItems.length > 0 && (
                  <section aria-labelledby="section-admin" className="memberSection">
                    <div className="adminContainer">
                      <h3 id="section-admin" className="memberSectionTitle">
                        {permissions.isAdmin ? 'สำหรับผู้ดูแลระบบ' : 'การจัดการระบบที่ได้รับมอบหมาย'}
                      </h3>
                      <div className="adminGrid">
                        {adminItems.map((item) => (
                          <Link key={item.id} href={item.href} className="adminRowItem">
                            <div className="rowLeft">
                              <div className="rowIconBox">
                                <span className="material-symbols-outlined" aria-hidden="true">
                                  {item.icon}
                                </span>
                              </div>
                              <span className="rowTitle">{item.title}</span>
                            </div>
                            <div className="rowRight">
                              {item.badge ? (
                                <span
                                  className={
                                    item.badgeAlert ? 'adminBadgePill' : 'adminBadgeNormal'
                                  }
                                >
                                  {item.badge}
                                </span>
                              ) : (
                                <span
                                  className="material-symbols-outlined rowChevron"
                                  aria-hidden="true"
                                >
                                  chevron_right
                                </span>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
      </div>
    </div>
  )
}
