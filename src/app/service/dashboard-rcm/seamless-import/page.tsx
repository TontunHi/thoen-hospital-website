import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { logThrottledAudit } from '@/lib/audit'
import { RcmSeamlessImportService } from '@/lib/clinical/rcmSeamlessImportService'
import SeamlessImportClient from './SeamlessImportClient'

export default async function SeamlessImportPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/seamless-import')
  }

  const allowed =
    session.role === 'admin' ||
    (await checkPositionPermission(session.username, [
      'view_rcm_import',
      'import_rcm_data',
      'manage_rcm_import',
    ]))

  if (!allowed) {
    redirect('/service/dashboard-rcm')
  }

  logThrottledAudit('READ', 'RCM_SEAMLESS_IMPORT', session.username).catch(() => {})

  let initialStats = null
  let initialError: string | null = null

  try {
    initialStats = await RcmSeamlessImportService.getSeamlessDatabaseStats()
  } catch (err: unknown) {
    console.error('SSR Seamless Stats Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลสถิติเริ่มต้นได้ กรุณารีเฟรชหน้านี้ใหม่'
  }

  return (
    <SeamlessImportClient
      initialStats={initialStats}
      initialError={initialError}
      userRole={session.role}
      username={session.username}
    />
  )
}
