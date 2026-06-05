import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AdminLoginPageClient from './LoginPageClient'

export default async function NewsLoginPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  return <AdminLoginPageClient />
}
