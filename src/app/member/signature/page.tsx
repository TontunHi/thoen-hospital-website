import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import MemberSignatureClient from './MemberSignatureClient'

export default async function MemberSignaturePage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <MemberSignatureClient />
}
