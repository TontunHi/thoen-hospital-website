import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import LoratadineDispenseClient from './LoratadineDispenseClient'

export const metadata = {
  title: 'ระบบติดตามการจ่ายยาลอราทาดีน (แพทย์แผนไทย) | โรงพยาบาลเถิน',
  description: 'ระบบตรวจสอบรายชื่อและประวัติการจ่ายยาลอราทาดีนทั้งโรงพยาบาล ประจำวัน สำหรับกลุ่มงานแพทย์แผนไทยฯ โรงพยาบาลเถิน',
}

export default async function LoratadineDispensePage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <LoratadineDispenseClient />
}
