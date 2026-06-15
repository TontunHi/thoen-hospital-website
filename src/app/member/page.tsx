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

          {/* Card 5: Room Booking */}
          <Link href="/member/room-bookings" className="serviceCard">
            <div className="serviceCardHeader">
              <div className="serviceIconWrapper bookingIcon">
                <Calendar size={24} />
              </div>
              <div className="statusIndicator success">
                <span>เปิดใช้งาน</span>
              </div>
            </div>
            <div className="serviceCardBody">
              <h4>ระบบจองห้องประชุม</h4>
              <p>ตรวจสอบตารางปฏิทิน จองห้องประชุม และติดตามสถานะคำขอใช้ห้องประชุมของโรงพยาบาล</p>
            </div>
            <div className="serviceCardFooter">
              <span className="actionText">เข้าสู่ระบบจองห้องประชุม</span>
              <ChevronRight size={16} className="chevronIcon" />
            </div>
          </Link>

          {/* Card 6: Room Booking Admin Settings (Visible to Admins only) */}
          {member.role === 'admin' && (
            <Link href="/member/room-bookings/admin" className="serviceCard">
              <div className="serviceCardHeader">
                <div className="serviceIconWrapper bookingIcon" style={{ backgroundColor: '#fff1f2', color: '#f43f5e', borderColor: '#ffe4e6' }}>
                  <Shield size={24} />
                </div>
                <div className="statusIndicator error">
                  <span>ผู้ดูแลระบบ</span>
                </div>
              </div>
              <div className="serviceCardBody">
                <h4>จัดการระบบห้องประชุม (แอดมิน)</h4>
                <p>จัดการข้อมูลห้องประชุม อุปกรณ์อาหารเสิร์ฟ และตรวจสอบอนุมัติการจองห้องประชุมทั้งหมด</p>
              </div>
              <div className="serviceCardFooter">
                <span className="actionText" style={{ color: '#e11d48' }}>เข้าสู่ระบบจัดการแอดมิน</span>
                <ChevronRight size={16} className="chevronIcon" style={{ color: '#e11d48' }} />
              </div>
            </Link>
          )}

        </div>

      </div>
    </div>
  )
}
