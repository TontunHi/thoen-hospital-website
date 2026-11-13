import { Suspense } from 'react'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeRegistryClient from './PalliativeRegistryClient'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ทะเบียน Palliative Care | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'ระบบบันทึกและติดตามทะเบียนผู้ป่วย Palliative Care โรงพยาบาลเถิน',
}

export default async function PalliativeRegistryPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  const member = await fetchAuthenticatedMember(session.username, session.email)
  if (!member) {
    redirect('/member/login')
  }

  const canView =
    member.isAdmin ||
    member.role === 'staff' ||
    member.can([
      'view_palliative_registry',
      'edit_palliative_registry',
      'manage_palliative_registry',
    ])

  if (!canView) {
    redirect('/service/dashboard-rcm/palliative-care/pc-1')
  }

  const canManage = member.isAdmin || member.can('manage_palliative_registry')
  const canEdit =
    canManage || member.can('edit_palliative_registry')

  const initialPermissions = {
    canView: true,
    canEdit,
    canManage,
  }

  let initialData: (Awaited<ReturnType<typeof PalliativeRegistryService.listRegistries>> & {
    permissions?: typeof initialPermissions
  }) | null = null
  try {
    const data = await PalliativeRegistryService.listRegistries({
      page: 1,
      limit: 50,
    })
    initialData = {
      ...data,
      permissions: initialPermissions,
    }
  } catch (error) {
    console.error('Failed to prefetch Palliative Registry SSR data:', error)
  }

  return (
    <Suspense
      fallback={
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
          กำลังโหลดทะเบียน Palliative Care...
        </div>
      }
    >
      <PalliativeRegistryClient
        userRole={session.role}
        username={session.username}
        initialData={initialData}
        initialPermissions={initialPermissions}
      />
    </Suspense>
  )
}
