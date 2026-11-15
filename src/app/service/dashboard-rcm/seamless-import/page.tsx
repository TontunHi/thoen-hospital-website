import type { Metadata } from 'next'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { logThrottledAudit } from '@/lib/audit'
import {
  RcmSeamlessImportService,
  type SeamlessDatabaseStats,
  type SeamlessLedgerResult,
  type SeamlessImportedFileDetail,
  type SeamlessDenyCode,
} from '@/lib/clinical/rcmSeamlessImportService'
import SeamlessImportClient from './SeamlessImportClient'

export const metadata: Metadata = {
  title: 'นำเข้าข้อมูล Seamless (NHSO / E-Claim) | โรงพยาบาลเถิน',
  description: 'ระบบนำเข้า ตรวจสอบ และบริหารข้อมูลชดเชย Seamless จาก สปสช.',
}

export const dynamic = 'force-dynamic'

export default async function SeamlessImportPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/seamless-import')
  }

  const isAdmin = session.role === 'admin'
  const [canView, canImport, canManage] = isAdmin
    ? [true, true, true]
    : await Promise.all([
        checkPositionPermission(session.username, [
          'view_rcm_import',
          'import_rcm_data',
          'manage_rcm_import',
        ]),
        checkPositionPermission(session.username, ['import_rcm_data', 'manage_rcm_import']),
        checkPositionPermission(session.username, 'manage_rcm_import'),
      ])

  if (!canView) {
    redirect('/service/dashboard-rcm')
  }

  logThrottledAudit('READ', 'RCM_SEAMLESS_IMPORT', session.username).catch(() => {})

  let initialStats: SeamlessDatabaseStats | null = null
  let initialLedger: SeamlessLedgerResult | null = null
  let initialImportedFiles: SeamlessImportedFileDetail[] = []
  let initialDenyCodes: SeamlessDenyCode[] = []
  let initialError: string | null = null

  try {
    const [statsRes, ledgerRes, filesRes, denyCodesRes] = await Promise.all([
      RcmSeamlessImportService.getSeamlessDatabaseStats(),
      RcmSeamlessImportService.getSeamlessLedger({ page: 1, pageSize: 50 }),
      RcmSeamlessImportService.getSeamlessImportedFiles(),
      RcmSeamlessImportService.getSeamlessDenyCodes(),
    ])
    initialStats = statsRes
    initialLedger = ledgerRes
    initialImportedFiles = filesRes
    initialDenyCodes = denyCodesRes
  } catch (err: unknown) {
    console.error('SSR Seamless Prefetch Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลสถิติเริ่มต้นได้ กรุณารีเฟรชหน้านี้ใหม่'
  }

  return (
    <SeamlessImportClient
      initialStats={initialStats}
      initialLedger={initialLedger}
      initialImportedFiles={initialImportedFiles}
      initialDenyCodes={initialDenyCodes}
      initialError={initialError}
      userRole={session.role}
      username={session.username}
      canImport={canImport}
      canManage={canManage}
    />
  )
}
