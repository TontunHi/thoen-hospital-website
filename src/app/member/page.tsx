import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MemberLogoutButton from './LogoutButton'
import { PenTool, CheckCircle, AlertCircle, FileText, ChevronRight, User, Shield, Briefcase, Calendar, Lock, Image, ClipboardCheck } from 'lucide-react'
import './page.css'

export default async function MemberDashboardPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Fetch complete member profile including position and signature_path
  const users = await queryMemberDb(
    'SELECT id, username, email, name, department, position, salary_user, role, created_at, signature_path FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    redirect('/member/login')
  }

  const member = users[0]

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
        <div className="profileBannerCard">
          <div className="bannerBackground"></div>
          <div className="profileBannerContent">
            <div className="avatarWrapper">
              <div className="userAvatar">{initials}</div>
              <div className="userRoleBadge">{displayRole}</div>
            </div>
            
            <div className="userInfoGroup">
              <div className="userNameArea">
                <h2>{member.name || 'ไม่ได้ระบุชื่อ-นามสกุล'}</h2>
                <span className="usernameTag">@{member.username}</span>
              </div>
              
              <div className="userDetailsGrid">
                <div className="userDetailItem">
                  <Briefcase size={16} className="detailIcon" />
                  <span>ตำแหน่ง: <strong>{member.position || 'ไม่ได้ระบุ'}</strong></span>
                </div>
                <div className="userDetailItem">
                  <Shield size={16} className="detailIcon" />
                  <span>แผนก/กลุ่มงาน: <strong>{member.department || 'ไม่ได้ระบุ'}</strong></span>
                </div>
              </div>
            </div>

            <div className="logoutButtonWrapper">
              <MemberLogoutButton />
            </div>
          </div>
        </div>

        {/* Services / Features Grid */}
        <h3 className="sectionTitle">บริการและฟังก์ชันการใช้งานภายใน</h3>
        
        <div className="servicesGrid">
          
          {/* Card 1: Digital Signature */}
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

          {/* Card 2: Salary Slip */}
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

          {/* Card 3: PR Media Production */}
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

          {/* Card 4: Unified Approvals Inbox */}
          <Link href="/member/approvals" className="serviceCard">
            <div className="serviceCardHeader">
              <div className="serviceIconWrapper docIcon">
                <ClipboardCheck size={24} />
              </div>
              <div className="statusIndicator success">
                <span>เปิดใช้งาน</span>
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

        </div>

      </div>
    </div>
  )
}
