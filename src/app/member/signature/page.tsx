import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import MemberSignatureClient from './MemberSignatureClient'

export default async function MemberSignaturePage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    const settingsRows = await queryMemberDb("SELECT config_value FROM member_system_settings WHERE config_key = 'feature_signature'")
    const isEnabled = settingsRows.length === 0 || settingsRows[0].config_value !== '0'
    if (!isEnabled) {
      redirect('/unauthorized')
    }
  }

  return <MemberSignatureClient />
}
