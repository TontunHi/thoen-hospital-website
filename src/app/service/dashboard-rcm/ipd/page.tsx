import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import IpdClient from './IpdClient'

export const metadata = {
  title: 'สรุปผู้ป่วยใน IPD (2.1.2.1) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'รายงานสรุปการให้บริการผู้ป่วยในโรงพยาบาลเถิน จำแนกตามหอผู้ป่วยและแพทย์ผู้สั่งจำหน่าย',
}

export default async function IpdPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff') {
    redirect('/service')
  }

  return <IpdClient />
}
