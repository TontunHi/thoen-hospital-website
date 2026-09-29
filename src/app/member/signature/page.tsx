import { getAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import MemberSignatureClient from './MemberSignatureClient'

export const dynamic = 'force-dynamic'

export default async function MemberSignaturePage() {
  const member = await getAuthenticatedMember({
    requiredFeature: 'feature_signature',
    redirectTo: '/unauthorized',
  })

  if (member.role === 'subdistrict') {
    redirect('/member')
  }

  return <MemberSignatureClient />
}
