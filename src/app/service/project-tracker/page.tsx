import { redirect } from 'next/navigation'
import { logThrottledAudit } from '@/lib/audit'
import { checkPositionPermission, verifyMemberSession } from '@/lib/memberAuth'
import { projectTrackerService } from '@/lib/projects/projectTrackerService'
import type { ProjectListResult } from '@/lib/projects/projectTrackerTypes'
import ProjectTrackerClient from './ProjectTrackerClient'
import '../../../../opendesigner/build/css/tokens.css'
import './page.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบติดตามการส่งโครงการ | โรงพยาบาลเถิน',
  description:
    'Dashboard สรุปผลและทะเบียนคุมการส่งรายงานโครงการและงบประมาณ โรงพยาบาลเถิน',
}

export default async function ProjectTrackerPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  let initialData: ProjectListResult | null = null
  let initialError: string | null = null

  const canManagePromise =
    session.role === 'admin'
      ? Promise.resolve(true)
      : checkPositionPermission(session.username, 'manage_project_tracker')

  const dataPromise = projectTrackerService
    .listProjects()
    .then((res) => {
      initialData = res
      logThrottledAudit(
        'READ',
        'project_tracking_records',
        `Viewed project tracker SSR FY ${res.fiscalYear} (count: ${res.items.length})`,
        session
      ).catch(() => {})
    })
    .catch((err: unknown) => {
      initialError =
        err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลระบบติดตามโครงการได้'
    })

  const [canManage] = await Promise.all([canManagePromise, dataPromise])

  return (
    <ProjectTrackerClient
      userRole={session.role}
      canManage={canManage}
      initialData={initialData}
      initialError={initialError}
    />
  )
}
