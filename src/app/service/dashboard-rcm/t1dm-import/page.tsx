import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import { logThrottledAudit } from '@/lib/audit'
import { RcmT1dmImportService } from '@/lib/clinical/rcmT1dmImportService'
import T1dmImportClient from './T1dmImportClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ทะเบียน T1DM/GDM/PDM (นำเข้าข้อมูล) | ระบบ RCM โรงพยาบาลเถิน',
  description:
    'ระบบนำเข้าและจัดการข้อมูลทะเบียนผู้ป่วยเบาหวานชนิดที่ 1 และเบาหวานขณะตั้งครรภ์ (T1DM/GDM/PDM) จากไฟล์ Excel สปสช.',
}

export default async function T1dmImportPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/t1dm-import')
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
        checkPositionPermission(session.username, [
          'import_rcm_data',
          'manage_rcm_import',
        ]),
        checkPositionPermission(session.username, 'manage_rcm_import'),
      ])

  if (!canView) {
    redirect('/service/dashboard-rcm')
  }

  logThrottledAudit('READ', 'RCM_T1DM_IMPORT', session.username).catch(() => {})

  let initialData = null
  let initialError: string | null = null

  try {
    initialData = await RcmT1dmImportService.getRegistryList({
      page: 1,
      pageSize: 50,
      sortBy: 'regdate',
      sortOrder: 'desc',
    })
  } catch (err: unknown) {
    console.error('SSR T1DM Registry Prefetch Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลทะเบียนเริ่มต้นได้ กรุณากดปุ่มรีเฟรชเพื่อลองใหม่'
  }

  return (
    <T1dmImportClient
      initialData={initialData}
      initialError={initialError}
      canImport={canImport}
      canManage={canManage}
    />
  )
}
