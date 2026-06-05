import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import OutgoingDocClient from './OutgoingDocClient'

export const metadata = {
  title: 'ระบบลงทะเบียนหนังสือส่งออก Online',
  description: 'ระบบสืบค้นและลงทะเบียนหนังสือส่งออกทางราชการของโรงพยาบาลเถิน แยกตามปีงบประมาณ',
}

export default async function OutgoingDocumentPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <OutgoingDocClient />
}
