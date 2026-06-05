import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import MemberLogoutButton from './LogoutButton'
import './page.css'

export default async function MemberDashboardPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Fetch complete member profile from separate DB
  const users = await queryMemberDb(
    'SELECT username, email, name, department, salary_user, role, created_at FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    // If not found in DB but session exists (unexpected), clear and redirect
    redirect('/member/login')
  }

  const member = users[0]

  const roleTranslation: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ (Admin)',
    hr: 'เจ้าหน้าที่ฝ่ายบุคคล (HR)',
    doctor: 'นายแพทย์ / แพทย์หญิง (Doctor)',
    nurse: 'พยาบาล (Nurse)',
    patient: 'ผู้ป่วย / บุคคลทั่วไป (Patient)',
    member: 'สมาชิกทั่วไป (Member)'
  }
  const displayRole = roleTranslation[member.role] || member.role || 'สมาชิกทั่วไป'

  const registrationDate = member.created_at
    ? new Date(member.created_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-'

  return (
    <div className="memberDashboardContainer">
      <div className="memberDashboardCard">
        <div className="memberHeader">
          <div className="memberTitle">
            <h1>ระบบสมาชิกผู้ใช้งาน</h1>
            <p>โรงพยาบาลเถิน จังหวัดลำปาง</p>
          </div>
          <MemberLogoutButton />
        </div>

        <div className="memberGrid">
          {/* Profile Details */}
          <div className="profileSection">
            <h3>ข้อมูลโปรไฟล์ของท่าน</h3>
            <div className="infoList">
              <div className="infoItem">
                <span className="label">ชื่อ-นามสกุล (Name)</span>
                <span className="value">{member.name || '-'}</span>
              </div>
              <div className="infoItem">
                <span className="label">กลุ่มงาน / แผนก (Department)</span>
                <span className="value">{member.department || '-'}</span>
              </div>
              <div className="infoItem">
                <span className="label">ชื่อผู้ใช้งาน (Username)</span>
                <span className="value">{member.username}</span>
              </div>
              <div className="infoItem">
                <span className="label">อีเมลติดต่อ (Email)</span>
                <span className="value">{member.email}</span>
              </div>
              <div className="infoItem">
                <span className="label">สิทธิ์การใช้งาน (Role)</span>
                <span className="value">{displayRole}</span>
              </div>
              <div className="infoItem">
                <span className="label">รหัสผูกบัญชีเงินเดือน (Salary Linked ID)</span>
                <span className="value">{member.salary_user || 'ยังไม่ได้ผูกบัญชีเงินเดือน'}</span>
              </div>
              <div className="infoItem">
                <span className="label">วันที่ลงทะเบียน (Registered Date)</span>
                <span className="value">{registrationDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
