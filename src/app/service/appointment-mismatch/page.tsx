import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import '../../../../opendesigner/build/css/tokens.css'
import AppointmentMismatchClient from './AppointmentMismatchClient'

export const metadata = {
  title: 'รายการนัดผิดห้องตรวจ | โรงพยาบาลเถิน',
  description:
    'ระบบตรวจสอบรายการนัดหมายที่ระบุห้องตรวจผิด เพื่อป้องกันปัญหาเครื่องส่งตรวจอัตโนมัติ โรงพยาบาลเถิน',
}

export default async function AppointmentMismatchPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role === 'subdistrict') {
    redirect('/service')
  }

  return <AppointmentMismatchClient />
}
