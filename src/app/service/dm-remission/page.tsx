import { redirect } from 'next/navigation'
import { checkPositionPermission, verifyMemberSession } from '@/lib/memberAuth'
import DmRemissionClient from './DmRemissionClient'
import '../../../../opendesigner/build/css/tokens.css'
import './page.css'

export const metadata = {
  title: 'ระบบติดตามและ Dashboard DM Remission | โรงพยาบาลเถิน',
  description:
    'ระบบลงทะเบียน ติดตามผลลัพธ์ทางคลินิก และ Dashboard สรุปผู้ป่วยเบาหวานเข้าสู่ระยะสงบ (DM Remission) แยกตามปีงบประมาณและ รพ.สต.',
}

export default async function DmRemissionPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const canManage =
    session.role === 'admin' ||
    (await checkPositionPermission(session.username, 'manage_dm_remission'))

  return (
    <DmRemissionClient
      userRole={session.role}
      canManage={canManage}
    />
  )
}
