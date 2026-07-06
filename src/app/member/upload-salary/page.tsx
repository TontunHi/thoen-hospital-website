import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import UploadSalaryClient from './UploadSalaryClient'

export const metadata = {
  title: 'นำเข้าข้อมูลการเงิน | โรงพยาบาลเถิน',
  description: 'ระบบอัปโหลดไฟล์เอกสารเงินเดือนและค่าตอบแทน โรงพยาบาลเถิน',
}

export default async function UploadSalaryPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const users = await queryMemberDb(
    'SELECT role, position FROM members WHERE username = ? AND email = ?',
    [session.username, session.email]
  )

  if (!users || users.length === 0) {
    redirect('/unauthorized')
  }

  const member = users[0]
  let isFinance = member.role === 'admin' || (member.position && member.position.includes('เจ้าพนักงานการเงินและบัญชี'))

  if (!isFinance && member.position) {
    const finPerms = await queryMemberDb(
      "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'upload_salary' AND TRIM(position_name) = TRIM(?)",
      [member.position]
    )
    isFinance = (finPerms[0]?.count || 0) > 0
  }

  if (!isFinance) {
    redirect('/unauthorized')
  }

  return <UploadSalaryClient />
}
