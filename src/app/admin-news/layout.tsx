import { verifyMemberSession } from '@/lib/memberAuth'
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

  if (session.role !== 'admin') {
    redirect('/unauthorized')
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}

