import { redirect } from 'next/navigation'
import { checkPositionPermission, verifyMemberSession } from '@/lib/memberAuth'
import { getCurrentThaiFiscalYear } from '@/lib/clinical/fctHomeVisitDomain'
import FctHomeVisitClient from './FctHomeVisitClient'
import '../../../../opendesigner/build/css/tokens.css'
import './page.css'

export const metadata = {
  title: 'ระบบเยี่ยมบ้านทีม FCT | โรงพยาบาลเถิน',
  description:
    'ระบบลงทะเบียน ติดตามผลการเยี่ยมบ้านทีมสหวิชาชีพ (FCT) ประเมิน ADL และ Dashboard สรุปผลแยกตามปีงบประมาณและ รพ.สต.',
}

export default async function FctHomeVisitPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const canManage =
    session.role === 'admin' ||
    (await checkPositionPermission(session.username, 'manage_fct_home_visit'))

  return (
    <FctHomeVisitClient
      userRole={session.role}
      canManage={canManage}
      initialFiscalYear={getCurrentThaiFiscalYear()}
    />
  )
}
