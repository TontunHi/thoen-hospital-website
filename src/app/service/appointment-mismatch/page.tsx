import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AppointmentMismatchClient from './AppointmentMismatchClient'

export const metadata = {
  title: 'รายการนัดผิดห้องตรวจ | โรงพยาบาลเถิน',
  description: 'ระบบตรวจสอบรายการนัดหมายที่ระบุห้องตรวจผิด ทำให้ใช้เครื่องส่งตรวจอัตโนมัติไม่ได้ โรงพยาบาลเถิน',
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
