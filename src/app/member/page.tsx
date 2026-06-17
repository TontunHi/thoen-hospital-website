import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileBanner from './ProfileBanner'
import { PenTool, CheckCircle, AlertCircle, FileText, ChevronRight, User, Shield, Briefcase, Calendar, Lock, Image, ClipboardCheck } from 'lucide-react'
import './page.css'

export default async function MemberDashboardPage() {
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
  const isFeatureEnabled = (key: string) => settings[key] !== '0'
  const hasAccess = (key: string) => isAdmin || isFeatureEnabled(key)

  const roleTranslation: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ (Admin)',
    member: 'สมาชิกทั่วไป (Member)'
  }
  const displayRole = roleTranslation[member.role] || member.role || 'สมาชิกทั่วไป'

  const registrationDate = member.created_at
    ? new Date(member.created_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '-'

  const hasSignature = !!member.signature_path
  const hasSalary = !!member.salary_user

  // Get user avatar initials
  const initials = member.name 
    ? member.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('')
    : member.username.substring(0, 2).toUpperCase()

  return (
    <div className="memberDashboardContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="glowOrb glowOrb3"></div>
      <div className="dashboardWrapper">
        
        {/* Banner Section / Profile Card */}
        <ProfileBanner member={member} initials={initials} displayRole={displayRole} />

        {/* Services / Features Grid */}
        <h3 className="sectionTitle">บริการและฟังก์ชันการใช้งานภายใน</h3>
        
        <div className="servicesGrid">
          
          {/* Card 1: Digital Signature */}
          {hasAccess('feature_signature') ? (
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
          )}

          {/* Card 2: Salary Slip */}
          {hasAccess('feature_salary') ? (
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
          )}

          {/* Card 3: PR Media Production */}
          {hasAccess('feature_pr_requests') ? (
            <Link href="/member/pr-requests" className="serviceCard">
              <div className="serviceCardHeader">
                <div className="serviceIconWrapper prIcon">
                  <Image size={24} />
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
          )}

          {/* Card 4: Unified Approvals Inbox */}
          {hasAccess('feature_approvals') ? (
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
          )}


        </div>

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
            </div>
          </>
        )}

      </div>
    </div>
  )
}
