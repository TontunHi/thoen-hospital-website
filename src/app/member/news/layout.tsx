import { getAuthenticatedMember } from '@/lib/memberAuth'
import AdminLayoutClient from './AdminLayoutClient'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await getAuthenticatedMember({
    requiredPermission: 'manage_news',
    redirectTo: '/unauthorized',
  })

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}


