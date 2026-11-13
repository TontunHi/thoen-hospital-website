import { Suspense } from 'react'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import LtcRegistryClient from './LtcRegistryClient'
import { LtcRegistryService } from '@/lib/clinical/ltcRegistryService'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ทะเบียน Long Term Care (LTC) | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'ระบบบันทึกและจัดการทะเบียนผู้ป่วย Long Term Care (LTC) โรงพยาบาลเถิน',
}

export default async function LtcRegistryPage() {
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
    member.can([
      'view_ltc_registry',
      'edit_ltc_registry',
      'manage_ltc_registry',
    ])

  if (!canView) {
    redirect('/service/dashboard-rcm/palliative-care/pc-1')
  }

  const canManage = member.isAdmin || member.can('manage_ltc_registry')
  const canEdit = canManage || member.can('edit_ltc_registry')

  const initialPermissions = {
    canView: true,
    canEdit,
    canManage,
  }

  let initialData: (Awaited<ReturnType<typeof LtcRegistryService.listRegistries>> & {
    permissions?: typeof initialPermissions
  }) | null = null
  try {
    const data = await LtcRegistryService.listRegistries({
      page: 1,
      limit: 50,
    })
    initialData = {
      ...data,
      permissions: initialPermissions,
    }
  } catch (error) {
    console.error('Failed to prefetch LTC Registry SSR data:', error)
  }

  return (
    <Suspense
      fallback={
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
          กำลังโหลดทะเบียน Long Term Care (LTC)...
        </div>
      }
    >
      <LtcRegistryClient
        userRole={session.role}
        username={session.username}
        isAdmin={Boolean(member.isAdmin)}
        canEdit={canEdit}
        canManage={canManage}
        initialData={initialData}
      />
    </Suspense>
  )
}
