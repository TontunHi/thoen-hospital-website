import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileBanner from './ProfileBanner'
import { PenTool, CheckCircle, AlertCircle, FileText, ChevronRight, User, Shield, Lock, Image as ImageIcon, ClipboardCheck, Laptop, Globe, Newspaper, Building2, Pill } from 'lucide-react'
import './page.css'

async function getMemberDashboardData() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Fetch complete member profile including position, signature_path, and profile_path
  const users = await queryMemberDb(
    'SELECT id, username, email, name, department, position, salary_user, role, created_at, signature_path, profile_path FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    redirect('/member/login')
  }

  const member = users[0]

  // Query pending approvals count for this member
  const pendingApprovalsRes = await queryMemberDb(
    "SELECT COUNT(*) as count FROM approval_tickets WHERE current_approver_id = ? AND status = 'PENDING'",
    [member.id]
  )
  const pendingCount = pendingApprovalsRes[0]?.count || 0

  // Fetch settings config for features control
  const settingsRows = await queryMemberDb('SELECT config_key, config_value FROM member_system_settings')
  const settings: Record<string, string> = {}
  settingsRows.forEach((row) => {
    settings[row.config_key] = row.config_value
  })

  const isAdmin = member.role === 'admin'

  const userPosition = (member.position || '').trim()
  let isWorkAuthorized = member.role === 'admin'
  if (!isWorkAuthorized && userPosition) {
    const workPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key IN ('create_work', 'view_all_work') AND TRIM(position_name) = TRIM(?)",
      [userPosition]
    )
    isWorkAuthorized = (workPerms[0]?.count || 0) > 0
  }

  const roleTranslation: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ (Admin)',
    member: 'สมาชิกทั่วไป (Member)',
    subdistrict: 'รพ.สต.'
  }
  const displayRole = roleTranslation[member.role] || member.role || 'สมาชิกทั่วไป'

  const hasSignature = !!member.signature_path
  const hasSalary = !!member.salary_user

  // Get user avatar initials
  const initials = member.name 
    ? member.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('')
    : member.username.substring(0, 2).toUpperCase()

  let isFinance = member.role === 'admin' || (member.position && member.position.includes('เจ้าพนักงานการเงินและบัญชี'))
  if (!isFinance && member.position) {
    const finPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'upload_salary' AND TRIM(position_name) = TRIM(?)",
      [member.position]
    )
    isFinance = (finPerms[0]?.count || 0) > 0
  }

  let isItaAuthorized = member.role === 'admin'
  if (!isItaAuthorized && userPosition) {
    const itaPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'manage_ita' AND TRIM(position_name) = TRIM(?)",
      [userPosition]
    )
    isItaAuthorized = (itaPerms[0]?.count || 0) > 0
  }

  let isNewsAuthorized = member.role === 'admin'
  if (!isNewsAuthorized && userPosition) {
    const newsPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'manage_news' AND TRIM(position_name) = TRIM(?)",
      [userPosition]
    )
    isNewsAuthorized = (newsPerms[0]?.count || 0) > 0
  }

  let isAllSalaryAuthorized = member.role === 'admin'
  if (!isAllSalaryAuthorized && userPosition) {
    const salaryAllPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'view_all_salary' AND TRIM(position_name) = TRIM(?)",
      [userPosition]
    )
    isAllSalaryAuthorized = (salaryAllPerms[0]?.count || 0) > 0
  }

  let isRduAuthorized = member.role === 'admin'
  if (!isRduAuthorized && userPosition) {
    const rduPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'manage_rdu' AND TRIM(position_name) = TRIM(?)",
      [userPosition]
    )
    isRduAuthorized = (rduPerms[0]?.count || 0) > 0
  }

  return {
    member,
    pendingCount,
    settings,
    isWorkAuthorized,
    isAdmin,
    isFinance,
    isItaAuthorized,
    isNewsAuthorized,
    isAllSalaryAuthorized,
    isRduAuthorized,
    displayRole,
    hasSignature,
    hasSalary,
    initials
  }
}

function SignatureCard({ hasAccess, hasSignature }: { hasAccess: (k: string) => boolean; hasSignature: boolean }) {
  return hasAccess('feature_signature') ? (
    <Link href="/member/signature" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper signatureIcon">
          <PenTool size={24} />
        </div>
        <div className={`statusIndicator ${hasSignature ? 'success' : 'warning'}`}>
          {hasSignature ? (
            <>
              <CheckCircle size={14} />
              <span>ตั้งค่าแล้ว</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} />
              <span>ยังไม่ตั้งค่า</span>
            </>
          )}
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
  ) : (
    <div className="serviceCard serviceCardDisabled">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper signatureIcon" style={{ opacity: 0.5 }}>
          <Lock size={24} />
        </div>
        <div className="statusIndicator error">
          <span>ปิดบริการชั่วคราว</span>
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>จัดการลายเซ็นดิจิทัล</h4>
        <p>ลงทะเบียน วาดลายเส้น หรืออัปโหลดรูปภาพลายเซ็นของคุณสำหรับใช้ลงนามอนุมัติเอกสารภายในโรงพยาบาล</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">ผู้ดูแลระบบปิดการใช้งาน</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </div>
  )
}

function SalaryCard({ hasAccess, hasSalary }: { hasAccess: (k: string) => boolean; hasSalary: boolean }) {
  return hasAccess('feature_salary') ? (
    <Link href="/salary" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper salaryIcon">
          <FileText size={24} />
        </div>
        <div className={`statusIndicator ${hasSalary ? 'success' : 'error'}`}>
          {hasSalary ? (
            <>
              <CheckCircle size={14} />
              <span>ผูกบัญชีแล้ว</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} />
              <span>ยังไม่ได้ผูก</span>
            </>
          )}
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
  ) : (
    <div className="serviceCard serviceCardDisabled">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper salaryIcon" style={{ opacity: 0.5 }}>
          <Lock size={24} />
        </div>
        <div className="statusIndicator error">
          <span>ปิดบริการชั่วคราว</span>
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>ระบบสลิปเงินเดือนออนไลน์</h4>
        <p>เรียกดูข้อมูลสลิปเงินเดือน ประวัติรายได้ประจำเดือน และข้อมูลสวัสดิการของทางโรงพยาบาล</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">ผู้ดูแลระบบปิดการใช้งาน</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </div>
  )
}

function PrRequestsCard({ hasAccess }: { hasAccess: (k: string) => boolean }) {
  return hasAccess('feature_pr_requests') ? (
    <Link href="/member/pr-requests" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper prIcon">
          <ImageIcon size={24} />
        </div>
        <div className="statusIndicator success">
          <span>เปิดใช้งาน</span>
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>ร้องขอผลิตสื่อประชาสัมพันธ์</h4>
        <p>ระบบจัดทำฟอร์มขอผลิตสื่อ ไวนิล โปสเตอร์ และอนุมัติใบงานประชาสัมพันธ์ด้วยลายเซ็นดิจิทัล</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">ส่งใบคำขอผลิตสื่อ</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  ) : (
    <div className="serviceCard serviceCardDisabled">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper prIcon" style={{ opacity: 0.5 }}>
          <Lock size={24} />
        </div>
        <div className="statusIndicator error">
          <span>ปิดบริการชั่วคราว</span>
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>ร้องขอผลิตสื่อประชาสัมพันธ์</h4>
        <p>ระบบจัดทำฟอร์มขอผลิตสื่อ ไวนิล โปสเตอร์ และอนุมัติใบงานประชาสัมพันธ์ด้วยลายเซ็นดิจิทัล</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">ผู้ดูแลระบบปิดการใช้งาน</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </div>
  )
}

function ApprovalsCard({ hasAccess, pendingCount }: { hasAccess: (k: string) => boolean; pendingCount: number }) {
  return hasAccess('feature_approvals') ? (
    <Link href="/member/approvals" className="serviceCard">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper docIcon" style={{ position: 'relative' }}>
          <ClipboardCheck size={24} />
          {pendingCount > 0 && <span className="card-badge-dot"></span>}
        </div>
        <div className={`statusIndicator ${pendingCount > 0 ? 'error' : 'success'}`}>
          {pendingCount > 0 ? (
            <>
              <AlertCircle size={14} className="pulseAnimation" />
              <span>มีงานค้าง {pendingCount} รายการ</span>
            </>
          ) : (
            <span>ไม่มีงานค้าง</span>
          )}
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>กล่องงานรอการอนุมัติ</h4>
        <p>กล่องงานตรวจสอบใบคำขอและเอกสารต่างๆ ที่ส่งเสนอเข้ามา และอนุมัติออนไลน์ด้วยลายเซ็นของคุณ</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">เข้าสู่กล่องงานรอการอนุมัติ</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </Link>
  ) : (
    <div className="serviceCard serviceCardDisabled">
      <div className="serviceCardHeader">
        <div className="serviceIconWrapper docIcon" style={{ opacity: 0.5 }}>
          <Lock size={24} />
        </div>
        <div className="statusIndicator error">
          <span>ปิดบริการชั่วคราว</span>
        </div>
      </div>
      <div className="serviceCardBody">
        <h4>กล่องงานรอการอนุมัติ</h4>
        <p>กล่องงานตรวจสอบใบคำขอและเอกสารต่างๆ ที่ส่งเสนอเข้ามา และอนุมัติออนไลน์ด้วยลายเซ็นของคุณ</p>
      </div>
      <div className="serviceCardFooter">
        <span className="actionText">ผู้ดูแลระบบปิดการใช้งาน</span>
        <ChevronRight size={16} className="chevronIcon" />
      </div>
    </div>
  )
}

export default async function MemberDashboardPage() {
  const {
    member,
    pendingCount,
    settings,
    isWorkAuthorized,
    isAdmin,
    isFinance,
    isItaAuthorized,
    isNewsAuthorized,
    isAllSalaryAuthorized,
    isRduAuthorized,
    displayRole,
    hasSignature,
    hasSalary,
    initials
  } = await getMemberDashboardData()

  const isFeatureEnabled = (key: string) => settings[key] !== '0'
  const hasAccess = (key: string) => isAdmin || isFeatureEnabled(key)

  return (
    <div className="memberDashboardContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="glowOrb glowOrb3"></div>
      <div className="dashboardWrapper">
        
        {/* Banner Section / Profile Card */}
        <ProfileBanner member={member} initials={initials} displayRole={displayRole} />

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
              
              {/* Card 1: Digital Signature */}
              <SignatureCard hasAccess={hasAccess} hasSignature={hasSignature} />

              {/* Card 2: Salary Slip */}
              <SalaryCard hasAccess={hasAccess} hasSalary={hasSalary} />

              {/* Card 3: PR Media Production */}
              <PrRequestsCard hasAccess={hasAccess} />

              {/* Card 4: Unified Approvals Inbox */}
              <ApprovalsCard hasAccess={hasAccess} pendingCount={pendingCount} />

              {/* Card 6: Upload Salary (Visible only to admin or finance position) */}
              {isFinance && (
                <Link href="/member/upload-salary" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper salaryIcon" style={{ backgroundColor: '#fff7ed', color: '#ea580c', borderColor: '#ffedd5', borderWidth: '1px', borderStyle: 'solid' }}>
                      <FileText size={24} />
                    </div>
                    <div className="statusIndicator success" style={{ backgroundColor: '#ffedd5', color: '#c2410c', borderColor: '#fed7aa' }}>
                      <span>นำเข้าข้อมูลการเงิน</span>
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
              {isItaAuthorized && (
                hasAccess('feature_ita') ? (
                  <Link href="/member/ita" className="serviceCard">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#dbeafe', borderWidth: '1px', borderStyle: 'solid' }}>
                        <Globe size={24} />
                      </div>
                      <div className="statusIndicator success" style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' }}>
                        <span>เปิดใช้งาน</span>
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
                ) : (
                  <div className="serviceCard serviceCardDisabled">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper" style={{ opacity: 0.5, backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#dbeafe', borderWidth: '1px', borderStyle: 'solid' }}>
                        <Lock size={24} />
                      </div>
                      <div className="statusIndicator error">
                        <span>ปิดบริการชั่วคราว</span>
                      </div>
                    </div>
                    <div className="serviceCardBody">
                      <h4>จัดการบทความ ITA</h4>
                      <p>ระบบเขียนบทความ ปรับแต่งเนื้อหา และเผยแพร่ข้อมูลการประเมินคุณธรรมและความโปร่งใสสู่สาธารณะ</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">ผู้ดูแลระบบปิดการใช้งาน</span>
                      <ChevronRight size={16} className="chevronIcon" />
                    </div>
                  </div>
                )
              )}

              {/* Card 8: PR News Posting Program (Visible to authorized members who are not admins) */}
              {isNewsAuthorized && !isAdmin && (
                <Link href="/member/news" className="serviceCard">
                  <div className="serviceCardHeader">
                    <div className="serviceIconWrapper" style={{ backgroundColor: '#f0f9ff', color: '#0284c7', borderColor: '#e0f2fe', borderWidth: '1px', borderStyle: 'solid' }}>
                      <Newspaper size={24} />
                    </div>
                    <div className="statusIndicator success" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                      <span>จัดการเว็บไซต์</span>
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
                    <div className="statusIndicator success" style={{ backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }}>
                      <span>สิทธิ์ธุรการ</span>
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
              {isRduAuthorized && (
                hasAccess('feature_rdu') ? (
                  <Link href="/member/rdu" className="serviceCard">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper" style={{ backgroundColor: '#f0fdfa', color: '#0d9488', borderColor: '#ccfbf1', borderWidth: '1px', borderStyle: 'solid' }}>
                        <Pill size={24} />
                      </div>
                      <div className="statusIndicator success" style={{ backgroundColor: '#ccfbf1', color: '#0f766e', borderColor: '#99f6e4' }}>
                        <span>เปิดใช้งาน</span>
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
                ) : (
                  <div className="serviceCard serviceCardDisabled">
                    <div className="serviceCardHeader">
                      <div className="serviceIconWrapper" style={{ opacity: 0.5, backgroundColor: '#f0fdfa', color: '#0d9488', borderColor: '#ccfbf1', borderWidth: '1px', borderStyle: 'solid' }}>
                        <Lock size={24} />
                      </div>
                      <div className="statusIndicator error">
                        <span>ปิดบริการชั่วคราว</span>
                      </div>
                    </div>
                    <div className="serviceCardBody">
                      <h4>ระบบจัดการเอกสาร RDU</h4>
                      <p>จัดการโฟลเดอร์ปี อัปโหลดและแก้ไขชื่อไฟล์ PDF การใช้ยาอย่างสมเหตุผล พร้อมเผยแพร่บน Navbar</p>
                    </div>
                    <div className="serviceCardFooter">
                      <span className="actionText">ผู้ดูแลระบบปิดการใช้งาน</span>
                      <ChevronRight size={16} className="chevronIcon" />
                    </div>
                  </div>
                )
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
              {/* Card 7: System Feature Access Toggles (Visible to Admins only) */}
              <Link href="/member/settings" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#d1fae5', borderWidth: '1px', borderStyle: 'solid' }}>
                    <Shield size={24} />
                  </div>
                  <div className="statusIndicator success" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }}>
                    <span>ตั้งค่าระบบ</span>
                  </div>
                </div>
                <div className="serviceCardBody">
                  <h4>เปิด/ปิดฟังก์ชันและตั้งค่าระบบ</h4>
                  <p>จัดการสิทธิ์และควบคุมการเข้าใช้งานของสมาชิกทั่วไป เช่น เปิด/ปิดฟังก์ชันลายเซ็น, สลิปเงินเดือน และขอผลิตสื่อ</p>
                </div>
                <div className="serviceCardFooter" style={{ color: '#059669' }}>
                  <span className="actionText">เข้าสู่หน้าตั้งค่าระบบ</span>
                  <ChevronRight size={16} className="chevronIcon" />
                </div>
              </Link>

              {/* Card 8: PR News Posting Program (Visible to Admins only) */}
              <Link href="/member/news" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#f0f9ff', color: '#0284c7', borderColor: '#e0f2fe', borderWidth: '1px', borderStyle: 'solid' }}>
                    <FileText size={24} />
                  </div>
                  <div className="statusIndicator success" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                    <span>จัดการเว็บไซต์</span>
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

              {/* Card 9: Members Directory Management (Visible to Admins only) */}
              <Link href="/member/member" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#faf5ff', color: '#7c3aed', borderColor: '#f3e8ff', borderWidth: '1px', borderStyle: 'solid' }}>
                    <User size={24} />
                  </div>
                  <div className="statusIndicator success" style={{ backgroundColor: '#f3e8ff', color: '#6d28d9', borderColor: '#e9d5ff' }}>
                    <span>ข้อมูลสมาชิก</span>
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

              {/* Card 10: Audit Log Viewer (Visible to Admins only) */}
              <Link href="/member/audit-logs" className="serviceCard">
                <div className="serviceCardHeader">
                  <div className="serviceIconWrapper" style={{ backgroundColor: '#fff1f2', color: '#e11d48', borderColor: '#ffe4e6', borderWidth: '1px', borderStyle: 'solid' }}>
                    <Shield size={24} />
                  </div>
                  <div className="statusIndicator success" style={{ backgroundColor: '#ffe4e6', color: '#9f1239', borderColor: '#fecdd3' }}>
                    <span>ความปลอดภัย</span>
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
            </div>
          </>
        )}

      </div>
    </div>
  )
}
