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
    'SELECT username, email, salary_user, salary_pass FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    // If not found in DB but session exists (unexpected), clear and redirect
    redirect('/member/login')
  }

  const member = users[0]
  const hasSalaryCredentials = !!(member.salary_user && member.salary_pass)

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
                <span className="label">ชื่อผู้ใช้งาน (Username)</span>
                <span className="value">{member.username}</span>
              </div>
              <div className="infoItem">
                <span className="label">อีเมลติดต่อ (Email)</span>
                <span className="value">{member.email}</span>
              </div>
            </div>
          </div>

          {/* Future Integration Panel */}
          <div className="featureSection">
            <div>
              <h3>ฟังก์ชันและการเชื่อมต่อระบบ</h3>
              <div className="futureBadge">กำลังพัฒนาเพิ่มเติมในอนาคต</div>
              <div className="featureContent">
                <p>
                  ระบบสมาชิกนี้ใช้สำหรับผูกเชื่อมโยงสิทธิ์การใช้งานเข้ากับบริการต่าง ๆ ภายในเว็บไซต์โรงพยาบาลเถิน
                  เช่น ระบบข้อมูลเงินเดือนและโอที (Salary & OT) ข้อมูลประกาศภายใน และสิทธิ์ผู้ใช้งานเฉพาะส่วน
                </p>
              </div>
            </div>

            <div className="salaryCredentialsCard">
              <p>สถานะการเชื่อมต่อข้อมูลเงินเดือน (Salary Credentials):</p>
              <div className="credentialStatus">
                {hasSalaryCredentials ? (
                  <span className="status-linked">● เชื่อมต่อข้อมูลสำเร็จ (salary_user: {member.salary_user})</span>
                ) : (
                  <span className="status-notlinked">● ยังไม่ได้เชื่อมต่อข้อมูลเงินเดือน</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
