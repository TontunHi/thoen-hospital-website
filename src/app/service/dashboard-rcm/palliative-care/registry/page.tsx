import { Suspense } from 'react'
import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import PalliativeRegistryClient from './PalliativeRegistryClient'
import { PalliativeRegistryService } from '@/lib/clinical/palliativeRegistryService'

export const metadata = {
  title: 'ทะเบียน Palliative Care | Dashboard-RCM โรงพยาบาลเถิน',
  description: 'ระบบบันทึกและติดตามทะเบียนผู้ป่วย Palliative Care โรงพยาบาลเถิน',
}

export default async function PalliativeRegistryPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  let initialData = null
  try {
    initialData = await PalliativeRegistryService.listRegistries({
      page: 1,
      limit: 50,
    })
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
      />
    </Suspense>
  )
}
