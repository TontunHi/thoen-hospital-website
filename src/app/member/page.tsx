import { getAuthenticatedMember, toClientMember } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import Link from 'next/link'
import ProfileBanner from './ProfileBanner'
import './page.css'

export default async function MemberDashboardPage() {
  const member = await getAuthenticatedMember()

  // Query pending tasks count in Unified Inbox for this member
  let pendingInboxCount = 0
  try {
    const inboxRows = await queryMemberDb(
      `SELECT COUNT(*) as cnt FROM inbox_tasks 
       WHERE status = 'PENDING' 
       AND (current_assignee = ? OR (\`current_role\` IS NOT NULL AND (\`current_role\` = ? OR \`current_role\` = ?)))`,
      [member.id, (member.position || '').trim(), member.role]
    )
    pendingInboxCount = inboxRows[0]?.cnt || 0
  } catch (err) {
    console.error('Error fetching inbox count:', err)
  }

  // Query pending registrations count for admin
  let pendingRegistrationsCount = 0
  if (member.role === 'admin') {
    try {
      const regRows = await queryMemberDb(
        `SELECT COUNT(*) as cnt FROM member_registrations WHERE status = 'pending'`
      )
      pendingRegistrationsCount = regRows[0]?.cnt || 0
    } catch (err) {
      console.error('Error fetching pending registrations count:', err)
    }
  }

  const isFinance = member.can('upload_salary')
  const isItaAuthorized = member.can('manage_ita')
  const isNewsAuthorized = member.can('manage_news')
  const isAllSalaryAuthorized = member.can('view_all_salary')
  const isRduAuthorized = member.can('manage_rdu')
  const isOutgoingDocAuthorized = member.can('manage_outgoing_doc')
  const isEthicsAuthorized = member.can('manage_ethics')
  const isLocationsAuthorized = member.can('manage_locations') || member.isAdmin
  const isAssetsAuthorized = member.can('manage_assets') || member.isAdmin

  // Check if there are any departmental/hospital management features available
  const hasHospitalAdminFeatures =
    isAssetsAuthorized ||
    (isNewsAuthorized && !member.isAdmin) ||
    (isItaAuthorized && member.hasAccess('feature_ita')) ||
    (isRduAuthorized && member.hasAccess('feature_rdu')) ||
    isOutgoingDocAuthorized ||
    isEthicsAuthorized ||
    isFinance ||
    isAllSalaryAuthorized

  return (
    <div className="memberDashboardContainer">
      <div className="glowOrb glowOrb1" aria-hidden="true" />
      <div className="glowOrb glowOrb2" aria-hidden="true" />
      <div className="glowOrb glowOrb3" aria-hidden="true" />

      <div className="dashboardWrapper">
        {/* ── Banner Section / Profile Card ── */}
        <ProfileBanner
          member={toClientMember(member)}
          initials={member.initials}
          displayRole={member.displayRole}
          isTelegramLinked={member.isTelegramLinked}
        />

        {/* ── Subdistrict (รพ.สต.) Notice ── */}
        {member.role === 'subdistrict' ? (
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
            {/* ══════════════════════════════════════════════════════════════
               Category 1: Primary Daily Services & Requisitions
               ══════════════════════════════════════════════════════════════ */}
            <section aria-labelledby="section-primary-services">
              <div className="sectionHeaderRow">
                <div className="sectionTitleWrap">
                  <h3 id="section-primary-services" className="sectionTitle">
                    บริการและคำร้องหลักประจำวัน
                  </h3>
                  <p className="sectionSubtitle">
                    ศูนย์รวมการยื่นคำร้อง ติดตามสถานะงาน สลิปเงินเดือน และจัดการลายเซ็นดิจิทัล
                  </p>
                </div>
              </div>

              <div className="servicesGrid">
                {/* 1. กล่องงานและคำร้อง (Unified Task Inbox) */}
                {member.hasAccess('feature_inbox') && (
                  <Link 
                    href="/member/inbox" 
                    className={`serviceCard cardInbox ${pendingInboxCount > 0 ? 'hasPendingTasks' : ''}`}
                  >
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper inboxIcon">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          inbox
                        </span>
                      </div>
                      {pendingInboxCount > 0 ? (
                        <span className="cardStatusBadge badgeAlert">
                          <span className="badgePulseDot" />
                          {pendingInboxCount} งานรอคุณ
                        </span>
                      ) : (
                        <span className="cardStatusBadge badgeOk">
                          อัปเดตล่าสุด
                        </span>
                      )}
                    </div>
                    <div className="serviceCardBody">
                      <h4>กล่องงานและคำร้อง</h4>
                      <p>ตรวจสอบและพิจารณาอนุมัติงานที่ส่งถึงคุณ พร้อมติดตามสถานะใบแจ้งซ่อมและคำร้องที่คุณส่งขอ</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">เปิดกล่องงาน</span>
                      <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                )}

                {/* 2. ระบบแจ้งซ่อมบำรุง (Maintenance & Asset Repairs) */}
                {member.hasAccess('feature_repair') && (
                  <Link href="/member/repairs/new" className="serviceCard cardRepair">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper repairIcon">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          build
                        </span>
                      </div>
                      <span className="cardTagPill tagRepair">แจ้งซ่อมด่วน</span>
                    </div>
                    <div className="serviceCardBody">
                      <h4>แจ้งซ่อมบำรุงและอุปกรณ์</h4>
                      <p>ยื่นคำขอแจ้งซ่อมคอมพิวเตอร์ งานช่างทั่วไป และเครื่องมือแพทย์ พร้อมส่งแจ้งเตือนเข้ากลุ่มช่างทันที</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">ยื่นใบแจ้งซ่อมใหม่</span>
                      <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                )}

                {/* 3. ระบบขอสื่อประชาสัมพันธ์ (Media & PR Request) */}
                {member.hasAccess('feature_media_request') && (
                  <Link href="/member/media-requests" className="serviceCard cardMedia">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper mediaIcon">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          palette
                        </span>
                      </div>
                      <span className="cardTagPill tagMedia">PR Service</span>
                    </div>
                    <div className="serviceCardBody">
                      <h4>ระบบขอสื่อประชาสัมพันธ์</h4>
                      <p>ยื่นคำขอจัดทำป้ายไวนิล แผ่นพับ Infographic โปสเตอร์ AW และวิดีโอ พร้อมระบบลงนามอนุมัติ</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">จัดการและขอสื่อประชาสัมพันธ์</span>
                      <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                )}

                {/* 4. สลิปเงินเดือนออนไลน์ (E-Pay Slip) */}
                {member.hasAccess('feature_salary') && (
                  <Link href="/salary" className="serviceCard cardSalary">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper salaryIcon">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          receipt_long
                        </span>
                      </div>
                      <span className="cardTagPill tagSalary">ความปลอดภัยสูง</span>
                    </div>
                    <div className="serviceCardBody">
                      <h4>ระบบสลิปเงินเดือนออนไลน์</h4>
                      <p>เรียกดูข้อมูลสลิปเงินเดือน ประวัติรายได้ประจำเดือน และค่าตอบแทนล่วงเวลา (OT) ผ่านระบบรหัสผ่านคุ้มครอง</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">เข้าสู่ระบบสลิปเงินเดือน</span>
                      <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                )}

                {/* 5. จัดการลายเซ็นดิจิทัล (Digital E-Signature) */}
                {member.hasAccess('feature_signature') && (
                  <Link href="/member/signature" className="serviceCard cardSignature">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper signatureIcon">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          draw
                        </span>
                      </div>
                      <span className="cardTagPill tagSignature">e-Signature</span>
                    </div>
                    <div className="serviceCardBody">
                      <h4>จัดการลายเซ็นดิจิทัล</h4>
                      <p>ลงทะเบียน วาดลายเส้น หรืออัปโหลดรูปภาพลายเซ็นอิเล็กทรอนิกส์สำหรับใช้ลงนามอนุมัติเอกสาร</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">ตั้งค่าลายเซ็นดิจิทัล</span>
                      <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                        chevron_right
                      </span>
                    </div>
                  </Link>
                )}

                {/* 6. ระบบยืม-คืนอุปกรณ์และพัสดุ (Equipment Borrowing) */}
                <Link href="/member/equipment-borrow" className="serviceCard cardBorrow">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ background: '#dcfce7', color: '#15803d' }}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        inventory_2
                      </span>
                    </div>
                    <span className="cardTagPill" style={{ background: '#d1fae5', color: '#065f46' }}>บริการยืม-คืน</span>
                  </div>
                  <div className="serviceCardBody">
                    <h4>ระบบยืม-คืนอุปกรณ์และพัสดุ</h4>
                    <p>ยืม-คืนอุปกรณ์ ครุภัณฑ์ เบิกจ่ายวัสดุสำหรับกิจกรรมและการปฏิบัติงาน พร้อมติดตามสถานะแบบเรียลไทม์</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#059669' }}>
                    <span className="actionText">เข้าสู่ระบบยืม-คืนอุปกรณ์</span>
                    <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                      chevron_right
                    </span>
                  </div>
                </Link>

                {/* 7. ระบบกิจกรรมและคะแนนการมีส่วนร่วม (Hospital Events & Points) */}
                <Link href="/member/events" className="serviceCard cardEvents">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ background: '#fef3c7', color: '#b45309' }}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        event_available
                      </span>
                    </div>
                    <span className="cardTagPill" style={{ background: '#fef9c3', color: '#854d0e' }}>ThaID Check-in</span>
                  </div>
                  <div className="serviceCardBody">
                    <h4>ระบบกิจกรรมและสะสมคะแนน</h4>
                    <p>ติดตามกิจกรรมเร็วๆ นี้ ลงทะเบียนล่วงหน้า สแกน QR Code ผ่าน ThaID และดูกระดานคะแนน</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#d97706' }}>
                    <span className="actionText">ดูกิจกรรมและกระดานคะแนน</span>
                    <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                      chevron_right
                    </span>
                  </div>
                </Link>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
               Category 2: Hospital Management & Information Systems
               ══════════════════════════════════════════════════════════════ */}
            {hasHospitalAdminFeatures && (
              <section aria-labelledby="section-hospital-mgmt" className="mt-6">
                <div className="sectionHeaderRow">
                  <div className="sectionTitleWrap">
                    <h3 id="section-hospital-mgmt" className="sectionTitle sectionTitleInfo">
                      ระบบงานสารสนเทศและบริหารจัดการข้อมูล
                    </h3>
                    <p className="sectionSubtitle">
                      ระบบข้อมูลครุภัณฑ์ ข่าวสาร เอกสารเผยแพร่ และงานสารสนเทศตามสิทธิ์การปฏิบัติงาน
                    </p>
                  </div>
                </div>

                <div className="servicesGrid">
                  {/* ระบบจัดการข้อมูลครุภัณฑ์ */}
                  {isAssetsAuthorized && (
                    <Link href="/member/assets" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper assetIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            devices_other
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>ระบบจัดการข้อมูลครุภัณฑ์</h4>
                        <p>ตรวจสอบทะเบียนครุภัณฑ์โรงพยาบาล ตรวจสอบสถานะการรับประกัน ยี่ห้อ/รุ่น จุดติดตั้ง และประวัติพัสดุ</p>
                      </div>
                      <div className="serviceCardFooter footerBlue">
                        <span className="actionText">เข้าสู่ระบบจัดการครุภัณฑ์</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* โปรแกรมโพสข่าวประชาสัมพันธ์ */}
                  {isNewsAuthorized && !member.isAdmin && (
                    <Link href="/member/news" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper newsIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            newspaper
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>โปรแกรมโพสข่าวประชาสัมพันธ์</h4>
                        <p>จัดการและโพสข่าวประชาสัมพันธ์ กิจกรรม ข่าวรับสมัครงาน เพื่อแสดงผลบนหน้าเว็บไซต์หลักโรงพยาบาลเถิน</p>
                      </div>
                      <div className="serviceCardFooter footerSky">
                        <span className="actionText">จัดการข่าวประชาสัมพันธ์</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* จัดการบทความ ITA */}
                  {isItaAuthorized && member.hasAccess('feature_ita') && (
                    <Link href="/member/ita" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper itaIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            public
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>จัดการบทความ ITA</h4>
                        <p>เขียนบทความ ปรับแต่งเนื้อหา และเผยแพร่ข้อมูลการประเมินคุณธรรมและความโปร่งใสสู่สาธารณะ</p>
                      </div>
                      <div className="serviceCardFooter footerBlue">
                        <span className="actionText">เข้าสู่หน้าจัดการบทความ</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* ระบบจัดการเอกสาร RDU */}
                  {isRduAuthorized && member.hasAccess('feature_rdu') && (
                    <Link href="/member/rdu" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper rduIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            medication
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>ระบบจัดการเอกสาร RDU</h4>
                        <p>จัดการโฟลเดอร์ปี อัปโหลดและแก้ไขไฟล์ PDF การใช้ยาอย่างสมเหตุผล พร้อมเผยแพร่บน Navbar</p>
                      </div>
                      <div className="serviceCardFooter footerTeal">
                        <span className="actionText">เข้าสู่ระบบจัดการ RDU</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* จัดการระบบหนังสือส่งออก Online */}
                  {isOutgoingDocAuthorized && (
                    <Link href="/member/outgoing-document" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper outgoingIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            description
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>จัดการระบบหนังสือส่งออก Online</h4>
                        <p>ระบบจัดการลิงก์ Google Sheets ทะเบียนหนังสือส่งออกโรงพยาบาลเถิน แยกตามปีงบประมาณ</p>
                      </div>
                      <div className="serviceCardFooter footerEmerald">
                        <span className="actionText">เข้าสู่หน้าจัดการหนังสือส่งออก</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* จัดการเอกสารชมรมจริยธรรม */}
                  {isEthicsAuthorized && (
                    <Link href="/member/ethics" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper ethicsIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            gavel
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>จัดการเอกสารชมรมจริยธรรม</h4>
                        <p>จัดการปีงบประมาณ คำสั่งคณะทำงาน แผนปฏิบัติการ และอัปโหลดไฟล์ PDF รายงานผลชมรมจริยธรรม</p>
                      </div>
                      <div className="serviceCardFooter footerIndigo">
                        <span className="actionText">เข้าสู่หน้าจัดการเอกสารจริยธรรม</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* ระบบนำเข้าข้อมูลการเงิน (Finance) */}
                  {isFinance && (
                    <Link href="/member/upload-salary" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper uploadSalaryIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            upload_file
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>ระบบนำเข้าข้อมูลการเงิน</h4>
                        <p>บันทึกงวดนำเข้า และอัปโหลดไฟล์ Excel/CSV ข้อมูลสลิปเงินเดือนและ OT ของบุคลากรโรงพยาบาลเถิน</p>
                      </div>
                      <div className="serviceCardFooter footerOrange">
                        <span className="actionText">เข้าสู่หน้านำเข้าข้อมูลการเงิน</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}

                  {/* สลิปเงินเดือนบุคลากรทั้งหมด */}
                  {isAllSalaryAuthorized && (
                    <Link href="/member/all-salary" className="serviceCard">
                      <div className="serviceCardHeader">
                        <div className="serviceIconWrapper allSalaryIcon">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            folder_shared
                          </span>
                        </div>
                      </div>
                      <div className="serviceCardBody">
                        <h4>สลิปเงินเดือนบุคลากรทั้งหมด</h4>
                        <p>ค้นหาและเรียกดูข้อมูลสลิปเงินเดือนและค่าล่วงเวลา (OT) ของบุคลากรทุกคนในโรงพยาบาลเถิน</p>
                      </div>
                      <div className="serviceCardFooter footerGreen">
                        <span className="actionText">ค้นหาสลิปเงินเดือนบุคลากร</span>
                        <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                          chevron_right
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Category 3: System Administration (Admin Only)
           ══════════════════════════════════════════════════════════════ */}
        {member.role === 'admin' && (
          <section aria-labelledby="section-admin-settings" className="mt-6">
            <div className="adminSectionDivider" />
            <div className="sectionHeaderRow">
              <div className="sectionTitleWrap">
                <h3 id="section-admin-settings" className="sectionTitle adminSectionTitle">
                  ระบบควบคุมและตั้งค่า (สำหรับผู้ดูแลระบบ)
                </h3>
                <p className="sectionSubtitle">
                  ศูนย์ควบคุมสิทธิ์สมาชิก การเปิด/ปิดฟังก์ชัน จัดการสถานที่ และตรวจสอบความปลอดภัย
                </p>
              </div>
            </div>

            <div className="servicesGrid">
              {/* เปิด/ปิดฟังก์ชันและตั้งค่าระบบ */}
              <Link href="/member/settings" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper settingsIcon">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      admin_panel_settings
                    </span>
                  </div>
                  <span className="cardTagPill tagAdmin">ตั้งค่าระบบ</span>
                </div>
                <div className="serviceCardBody">
                  <h4>เปิด/ปิดฟังก์ชันและตั้งค่าระบบ</h4>
                  <p>จัดการสิทธิ์และควบคุมการเข้าใช้งานของสมาชิกทั่วไป เช่น เปิด/ปิดฟังก์ชันกล่องงาน, แจ้งซ่อม, ลายเซ็น และสลิปเงินเดือน</p>
                </div>
                <div className="serviceCardFooter footerEmerald">
                  <span className="actionText">เข้าสู่หน้าตั้งค่าระบบ</span>
                  <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                    chevron_right
                  </span>
                </div>
              </Link>

              {/* โปรแกรมโพสข่าวประชาสัมพันธ์ */}
              <Link href="/member/news" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper newsIcon">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      newspaper
                    </span>
                  </div>
                  <span className="cardTagPill tagAdmin">ประชาสัมพันธ์</span>
                </div>
                <div className="serviceCardBody">
                  <h4>โปรแกรมโพสข่าวประชาสัมพันธ์</h4>
                  <p>จัดการและโพสข่าวประชาสัมพันธ์ กิจกรรม ข่าวรับสมัครงาน เพื่อแสดงผลบนหน้าเว็บไซต์หลักโรงพยาบาลเถิน</p>
                </div>
                <div className="serviceCardFooter footerSky">
                  <span className="actionText">จัดการข่าวประชาสัมพันธ์</span>
                  <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                    chevron_right
                  </span>
                </div>
              </Link>

              {/* ตรวจสอบคำขอลงทะเบียนบุคลากร */}
              <Link href="/member/registrations" className={`serviceCard ${pendingRegistrationsCount > 0 ? 'hasPendingTasks' : ''}`}>
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ background: '#ecfdf5', color: '#047857' }}>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      person_add_alt
                    </span>
                  </div>
                  {pendingRegistrationsCount > 0 ? (
                    <span className="cardStatusBadge badgeAlert">
                      <span className="badgePulseDot" />
                      {pendingRegistrationsCount} คำขอรออนุมัติ
                    </span>
                  ) : (
                    <span className="cardTagPill tagAdmin">คำขอใหม่</span>
                  )}
                </div>
                <div className="serviceCardBody">
                  <h4>ตรวจสอบคำขอลงทะเบียนบุคลากร</h4>
                  <p>ตรวจสอบและพิจารณาอนุมัติคำขอเปิดบัญชีเข้าใช้งานระบบจากบุคลากรใหม่ พร้อมประวัติย้อนหลัง</p>
                </div>
                <div className="serviceCardFooter footerEmerald">
                  <span className="actionText">จัดการคำขอลงทะเบียน</span>
                  <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                    chevron_right
                  </span>
                </div>
              </Link>

              {/* แดชบอร์ดจัดการสมาชิก */}
              <Link href="/member/member" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper membersIcon">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      manage_accounts
                    </span>
                  </div>
                  <span className="cardTagPill tagAdmin">บัญชีผู้ใช้</span>
                </div>
                <div className="serviceCardBody">
                  <h4>แดชบอร์ดจัดการสมาชิก</h4>
                  <p>ตรวจสอบรายชื่อบุคลากรทั้งหมด แก้ไขข้อมูลสมาชิก จัดการบัญชีเงินเดือน และสิทธิ์การเข้าใช้งานทั่วไป</p>
                </div>
                <div className="serviceCardFooter footerPurple">
                  <span className="actionText">จัดการข้อมูลสมาชิก</span>
                  <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                    chevron_right
                  </span>
                </div>
              </Link>

              {/* จัดการสถานที่ ตึก-ชั้น-ห้อง */}
              {isLocationsAuthorized && (
                <Link href="/member/locations" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper locationsIcon">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        location_city
                      </span>
                    </div>
                    <span className="cardTagPill tagAdmin">สถานที่ รพ.</span>
                  </div>
                  <div className="serviceCardBody">
                    <h4>จัดการสถานที่ ตึก-ชั้น-ห้อง</h4>
                    <p>แดชบอร์ดจัดการข้อมูลสถานที่ ตรวจสอบความถูกต้อง เปิด/ปิดใช้งาน และแก้ไขชื่อห้องสำหรับระบบแจ้งซ่อม</p>
                  </div>
                  <div className="serviceCardFooter footerEmerald">
                    <span className="actionText">จัดการข้อมูลสถานที่</span>
                    <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                      chevron_right
                    </span>
                  </div>
                </Link>
              )}

              {/* ระบบประวัติการใช้งาน (Audit Logs) */}
              <Link href="/member/audit-logs" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper auditIcon">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      shield
                    </span>
                  </div>
                  <span className="cardTagPill tagAudit">ความปลอดภัย</span>
                </div>
                <div className="serviceCardBody">
                  <h4>ระบบประวัติการใช้งาน (Audit Logs)</h4>
                  <p>ระบบติดตามความปลอดภัยและประวัติการทำรายการ ตรวจสอบข้อมูลการเข้าสู่ระบบ การแก้ไขข้อมูล และสถิติการใช้งาน</p>
                </div>
                <div className="serviceCardFooter footerRose">
                  <span className="actionText">ตรวจสอบประวัติการใช้งาน</span>
                  <span className="material-symbols-outlined chevronIcon" aria-hidden="true">
                    chevron_right
                  </span>
                </div>
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
