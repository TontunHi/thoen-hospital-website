import { getAuthenticatedMember, toClientMember } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import Link from 'next/link'
import ProfileBanner from './ProfileBanner'
import { 
  PenTool, 
  FileText, 
  ChevronRight, 
  User, 
  Shield, 
  Globe, 
  Newspaper, 
  Building2, 
  Pill, 
  FileSpreadsheet, 
  Scale, 
  Inbox, 
  Wrench, 
  MapPin,
  Package,
  Palette
} from 'lucide-react'
import './page.css'

function SignatureCard({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <Link href="/member/signature" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper signatureIcon">
          <PenTool size={24} />
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>จัดการลายเซ็นดิจิทัล</h4>
        <p>ลงทะเบียน วาดลายเส้น หรืออัปโหลดรูปภาพลายเซ็นของคุณสำหรับใช้ลงนามอนุมัติเอกสารภายในโรงพยาบาล</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">ตั้งค่าลายเซ็น</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  )
}

function SalaryCard({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <Link href="/salary" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper salaryIcon">
          <FileText size={24} />
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>ระบบสลิปเงินเดือนออนไลน์</h4>
        <p>เรียกดูข้อมูลสลิปเงินเดือน ประวัติรายได้ประจำเดือน และข้อมูลสวัสดิการของทางโรงพยาบาล</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">เข้าสู่ระบบสลิปเงินเดือน</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  )
}

function InboxCard({ show, pendingInboxCount }: { show: boolean; pendingInboxCount: number }) {
  if (!show) return null

  return (
    <Link href="/member/inbox" className="serviceCard" style={{ border: pendingInboxCount > 0 ? '1.5px solid #3b82f6' : undefined }}>
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#dbeafe', borderWidth: '1px', borderStyle: 'solid' }}>
          <Inbox size={24} />
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>กล่องงาน</h4>
        <p>ตรวจสอบและดำเนินการงานที่ส่งมาถึงคุณ พร้อมติดตามสถานะงานที่คุณยื่นขอ</p>
      </div>
      <div className="serviceCardFooter" style={{ color: '#2563eb' }}>
        <span className="actionText">เปิดกล่องงาน</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  )
}

function RepairCard({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <Link href="/member/repairs/new" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#dcfce7', borderWidth: '1px', borderStyle: 'solid' }}>
          <Wrench size={24} />
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>แจ้งซ่อมบำรุง</h4>
        <p>ยื่นคำขอแจ้งซ่อมงานช่าง คอมพิวเตอร์ และเครื่องมือแพทย์ พร้อมระบุครุภัณฑ์และสถานที่</p>
      </div>
      <div className="serviceCardFooter" style={{ color: '#16a34a' }}>
        <span className="actionText">ยื่นใบแจ้งซ่อม</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  )
}

function MediaRequestCard({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <Link href="/member/media-requests" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper" style={{ backgroundColor: '#f0fdfa', color: '#0d9488', borderColor: '#ccfbf1', borderWidth: '1px', borderStyle: 'solid' }}>
          <Palette size={24} />
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>ระบบขอสื่อประชาสัมพันธ์</h4>
        <p>ยื่นคำขอจัดทำสื่อ แผ่นพับ โปสเตอร์ AW วิดีโอ พร้อมระบบพิจารณาอนุมัติและลงนามดิจิทัล</p>
      </div>
      <div className="serviceCardFooter" style={{ color: '#0d9488' }}>
        <span className="actionText">ขอสื่อประชาสัมพันธ์</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  )
}

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

  const isFinance = member.can('upload_salary')
  const isItaAuthorized = member.can('manage_ita')
  const isNewsAuthorized = member.can('manage_news')
  const isAllSalaryAuthorized = member.can('view_all_salary')
  const isRduAuthorized = member.can('manage_rdu')
  const isOutgoingDocAuthorized = member.can('manage_outgoing_doc')
  const isEthicsAuthorized = member.can('manage_ethics')
  const isLocationsAuthorized = member.can('manage_locations') || member.isAdmin
  const isAssetsAuthorized = member.can('manage_assets') || member.isAdmin

  return (
    <div className="memberDashboardContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="glowOrb glowOrb3"></div>
      <div className="dashboardWrapper">
        
        {/* Banner Section / Profile Card */}
        <ProfileBanner
          member={toClientMember(member)}
          initials={member.initials}
          displayRole={member.displayRole}
          isTelegramLinked={member.isTelegramLinked}
        />

        {/* Services / Features Section */}
        {member.role === 'subdistrict' ? (
          <div className="subdistrictNotice">
            <div className="subdistrictNoticeIcon">
              <Building2 size={32} />
            </div>
            <h3>บัญชีผู้ใช้หน่วยบริการ รพ.สต.</h3>
            <p>
              บัญชีผู้ใช้งานนี้ได้รับสิทธิ์ในระดับ <strong>รพ.สต.</strong> เพื่อเข้าถึงระบบสารสนเทศทางการแพทย์และการติดตามผลแลปภายนอกโรงพยาบาล ไม่มีฟังก์ชันบริการงานภายในโรงพยาบาลในหน้านี้
            </p>
            <Link href="/service" className="subdistrictNoticeBtn">
              <span>เข้าสู่หน้าระบบงานสารสนเทศ (Services)</span>
              <ChevronRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <h3 className="sectionTitle">บริการและฟังก์ชันการใช้งานภายใน</h3>
            
            <div className="servicesGrid">
              
              {/* Card 0: กล่องงาน (Unified Task Inbox) */}
              <InboxCard 
                show={member.hasAccess('feature_inbox')} 
                pendingInboxCount={pendingInboxCount} 
              />

              {/* Card 0.5: ระบบแจ้งซ่อม (Repair Request) */}
              <RepairCard 
                show={member.hasAccess('feature_repair')} 
              />

              {/* Card 0.75: ระบบขอสื่อประชาสัมพันธ์ (Media & PR Request) */}
              <MediaRequestCard 
                show={member.hasAccess('feature_media_request')} 
              />

              {/* Card 1: Digital Signature */}
              <SignatureCard show={member.hasAccess('feature_signature')} />

              {/* Card 2: Salary Slip */}
              <SalaryCard show={member.hasAccess('feature_salary')} />

              {/* Card 6: Upload Salary (Visible only to admin or finance position) */}
              {isFinance && (
                <Link href="/member/upload-salary" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper salaryIcon" style={{ backgroundColor: '#fff7ed', color: '#ea580c', borderColor: '#ffedd5', borderWidth: '1px', borderStyle: 'solid' }}>
                      <FileText size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>ระบบนำเข้าข้อมูลการเงิน</h4>
                    <p>ระบบบันทึกงวดนำเข้า และอัปโหลดไฟล์ Excel/CSV ข้อมูลสลิปเงินเดือนและ OT ของบุคลากรโรงพยาบาลเถิน</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#ea580c' }}>
                    <span className="actionText">เข้าสู่หน้านำเข้าข้อมูลการเงิน</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 7: ITA Blog Management */}
              {isItaAuthorized && member.hasAccess('feature_ita') && (
                <Link href="/member/ita" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#dbeafe', borderWidth: '1px', borderStyle: 'solid' }}>
                      <Globe size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>จัดการบทความ ITA</h4>
                    <p>ระบบเขียนบทความ ปรับแต่งเนื้อหา และเผยแพร่ข้อมูลการประเมินคุณธรรมและความโปร่งใสสู่สาธารณะ</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#2563eb' }}>
                    <span className="actionText">เข้าสู่หน้าจัดการบทความ</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 8: PR News Posting Program (Visible to authorized members who are not admins) */}
              {isNewsAuthorized && !member.isAdmin && (
                <Link href="/member/news" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#f0f9ff', color: '#0284c7', borderColor: '#e0f2fe', borderWidth: '1px', borderStyle: 'solid' }}>
                      <Newspaper size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>โปรแกรมโพสข่าวประชาสัมพันธ์</h4>
                    <p>ระบบจัดการและโพสข่าวประชาสัมพันธ์ กิจกรรม ข่าวรับสมัครงาน เพื่อแสดงผลบนหน้าเว็บไซต์หลักโรงพยาบาลเถิน</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#0284c7' }}>
                    <span className="actionText">จัดการข่าวประชาสัมพันธ์</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 9: All Staff Salary Slip (Visible to authorized members or admins) */}
              {isAllSalaryAuthorized && (
                <Link href="/member/all-salary" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#dcfce7', borderWidth: '1px', borderStyle: 'solid' }}>
                      <FileText size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>สลิปเงินเดือนบุคลากรทั้งหมด</h4>
                    <p>ระบบค้นหาและเรียกดูข้อมูลสลิปเงินเดือนและค่าล่วงเวลา (OT) ของบุคลากรทุกคนในโรงพยาบาลเถิน</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#16a34a' }}>
                    <span className="actionText">ค้นหาสลิปเงินเดือนบุคลากร</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 10: RDU Document Management */}
              {isRduAuthorized && member.hasAccess('feature_rdu') && (
                <Link href="/member/rdu" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#f0fdfa', color: '#0d9488', borderColor: '#ccfbf1', borderWidth: '1px', borderStyle: 'solid' }}>
                      <Pill size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>ระบบจัดการเอกสาร RDU</h4>
                    <p>จัดการโฟลเดอร์ปี อัปโหลดและแก้ไขชื่อไฟล์ PDF การใช้ยาอย่างสมเหตุผล พร้อมเผยแพร่บน Navbar</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#0d9488' }}>
                    <span className="actionText">เข้าสู่ระบบจัดการ RDU</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 11: Outgoing Document Management (Visible to authorized members or admins) */}
              {isOutgoingDocAuthorized && (
                <Link href="/member/outgoing-document" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#d1fae5', borderWidth: '1px', borderStyle: 'solid' }}>
                      <FileSpreadsheet size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>จัดการระบบหนังสือส่งออก Online</h4>
                    <p>ระบบจัดการลิงก์ Google Sheets ทะเบียนหนังสือส่งออกโรงพยาบาลเถิน แยกตามปีงบประมาณ</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#059669' }}>
                    <span className="actionText">เข้าสู่หน้าจัดการหนังสือส่งออก</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 12: Ethics Document Management (Visible to authorized members or admins) */}
              {isEthicsAuthorized && (
                <Link href="/member/ethics" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#eef2ff', color: '#4f46e5', borderColor: '#e0e7ff', borderWidth: '1px', borderStyle: 'solid' }}>
                      <Scale size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>จัดการเอกสารชมรมจริยธรรม</h4>
                    <p>จัดการปีงบประมาณ คำสั่งคณะทำงาน แผนปฏิบัติการ และอัปโหลดไฟล์ PDF รายงานผลชมรมจริยธรรม</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#4f46e5' }}>
                    <span className="actionText">เข้าสู่หน้าจัดการเอกสารจริยธรรม</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

              {/* Card 13: Hospital Asset Management (Visible to authorized members or admins) */}
              {isAssetsAuthorized && (
                <Link href="/member/assets" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd', borderWidth: '1px', borderStyle: 'solid' }}>
                      <Package size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>ระบบจัดการข้อมูลครุภัณฑ์</h4>
                    <p>แดชบอร์ดตรวจสอบทะเบียนครุภัณฑ์ ตรวจสอบสถานะการรับประกัน ยี่ห้อ/รุ่น จุดติดตั้ง และประวัติพัสดุ</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#0284c7' }}>
                    <span className="actionText">เข้าสู่ระบบจัดการครุภัณฑ์</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}

            </div>
          </>
        )}

        {/* Admin Section (Visible only to admins) */}
        {member.role === 'admin' && (
          <>
            <div className="adminSectionDivider"></div>
            <h3 className="sectionTitle adminSectionTitle">ระบบควบคุมและตั้งค่า (สำหรับผู้ดูแลระบบ)</h3>
            <div className="servicesGrid">
              {/* Card 7: System Feature Access Toggles */}
              <Link href="/member/settings" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#d1fae5', borderWidth: '1px', borderStyle: 'solid' }}>
                    <Shield size={24} />
                  </div>
                </div>
                <div className="serviceCardBody">
                  <h4>เปิด/ปิดฟังก์ชันและตั้งค่าระบบ</h4>
                  <p>จัดการสิทธิ์และควบคุมการเข้าใช้งานของสมาชิกทั่วไป เช่น เปิด/ปิดฟังก์ชันกล่องงาน, แจ้งซ่อม, ลายเซ็น และสลิปเงินเดือน</p>
                </div>
                <div className="serviceCardFooter" style={{ color: '#059669' }}>
                  <span className="actionText">เข้าสู่หน้าตั้งค่าระบบ</span>
                  <ChevronRight size={16} className="chevronIcon" />
                </div>
              </Link>

              {/* Card 8: PR News Posting Program */}
              <Link href="/member/news" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#f0f9ff', color: '#0284c7', borderColor: '#e0f2fe', borderWidth: '1px', borderStyle: 'solid' }}>
                    <FileText size={24} />
                  </div>
                </div>
                <div className="serviceCardBody">
                  <h4>โปรแกรมโพสข่าวประชาสัมพันธ์</h4>
                  <p>ระบบจัดการและโพสข่าวประชาสัมพันธ์ กิจกรรม ข่าวรับสมัครงาน เพื่อแสดงผลบนหน้าเว็บไซต์หลักโรงพยาบาลเถิน</p>
                </div>
                <div className="serviceCardFooter" style={{ color: '#0284c7' }}>
                  <span className="actionText">จัดการข่าวประชาสัมพันธ์</span>
                  <ChevronRight size={16} className="chevronIcon" />
                </div>
              </Link>

              {/* Card 9: Members Directory Management */}
              <Link href="/member/member" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#faf5ff', color: '#7c3aed', borderColor: '#f3e8ff', borderWidth: '1px', borderStyle: 'solid' }}>
                    <User size={24} />
                  </div>
                </div>
                <div className="serviceCardBody">
                  <h4>แดชบอร์ดจัดการสมาชิก</h4>
                  <p>ระบบตรวจสอบรายชื่อบุคลากรทั้งหมด แก้ไขข้อมูลสมาชิก จัดการบัญชีเงินเดือน และสิทธิ์การเข้าใช้งานทั่วไป</p>
                </div>
                <div className="serviceCardFooter" style={{ color: '#7c3aed' }}>
                  <span className="actionText">จัดการข้อมูลสมาชิก</span>
                  <ChevronRight size={16} className="chevronIcon" />
                </div>
              </Link>

              {/* Card 10: Audit Log Viewer */}
              <Link href="/member/audit-logs" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#fff1f2', color: '#e11d48', borderColor: '#ffe4e6', borderWidth: '1px', borderStyle: 'solid' }}>
                    <Shield size={24} />
                  </div>
                </div>
                <div className="serviceCardBody">
                  <h4>ระบบประวัติการใช้งาน (Audit Logs)</h4>
                  <p>ระบบติดตามความปลอดภัยและประวัติการทำรายการต่างๆ ตรวจสอบข้อมูลการเข้าสู่ระบบ, การทำ CRUD บนฐานข้อมูล, และการเข้าชมเว็บของเจ้าหน้าที่</p>
                </div>
                <div className="serviceCardFooter" style={{ color: '#e11d48' }}>
                  <span className="actionText">ตรวจสอบประวัติการใช้งาน</span>
                  <ChevronRight size={16} className="chevronIcon" />
                </div>
              </Link>

              {/* Card 11: Hospital Locations Management */}
              {isLocationsAuthorized && (
                <Link href="/member/locations" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#d1fae5', borderWidth: '1px', borderStyle: 'solid' }}>
                      <MapPin size={24} />
                    </div>
                  </div>
                  <div className="serviceCardBody">
                    <h4>จัดการสถานที่ ตึก-ชั้น-ห้อง</h4>
                    <p>แดชบอร์ดจัดการข้อมูลสถานที่ ตรวจสอบความถูกต้อง เปิด/ปิดใช้งาน และแก้ไขชื่อห้องสำหรับระบบแจ้งซ่อม</p>
                  </div>
                  <div className="serviceCardFooter" style={{ color: '#059669' }}>
                    <span className="actionText">จัดการข้อมูลสถานที่</span>
                    <ChevronRight size={16} className="chevronIcon" />
                  </div>
                </Link>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
