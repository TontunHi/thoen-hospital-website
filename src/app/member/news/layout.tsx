import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import AdminLayoutClient from './AdminLayoutClient'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const isAuthorized = session.role === 'admin' || (await checkPositionPermission(session.username, 'manage_news'))

  if (!isAuthorized) {
    redirect('/unauthorized')
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}


