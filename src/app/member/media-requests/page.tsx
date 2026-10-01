import { getAuthenticatedMember } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import MediaRequestsListClient from './MediaRequestsListClient'
import './mediaRequests.css'

export const dynamic = 'force-dynamic'

export default async function MediaRequestsPage() {
  const member = await getAuthenticatedMember({
    requiredFeature: 'feature_media_request',
    redirectTo: '/unauthorized',
  })

  if (member.role === 'subdistrict') {
    redirect('/member')
  }

  const userPos = member.position || ''
  const isPrStaff = userPos.includes('นักประชาสัมพันธ์') || userPos.includes('ประชาสัมพันธ์')
  const canViewAll =
    member.isAdmin ||
    member.can('manage_inbox') ||
    member.can('manage_media_requests') ||
    member.can('view_all_work') ||
    isPrStaff ||
    userPos.includes('ดิจิทัลทางการแพทย์') ||
    userPos.includes('พัสดุ')

  let whereClauses: string[] = ["t.task_type = 'MEDIA_REQUEST'"]
  let queryParams: any[] = []

  if (!canViewAll) {
    whereClauses.push('t.requester_id = ?')
    queryParams.push(member.id)
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`

  const tasks = await queryMemberDb(
    `SELECT 
      t.id, t.task_no, t.task_type, t.title, t.description, t.urgency,
      t.requester_id, t.requester_name, t.requester_dept,
      t.status, t.current_step_no, t.current_assignee, t.\`current_role\`,
      t.custom_payload, t.created_at, t.updated_at,
      s.step_name as current_step_name
     FROM inbox_tasks t
     LEFT JOIN inbox_task_steps s ON t.id = s.task_id AND t.current_step_no = s.step_no
     ${whereSql}
     ORDER BY 
       CASE WHEN t.urgency = 'VERY_URGENT' THEN 1 WHEN t.urgency = 'URGENT' THEN 2 ELSE 3 END ASC,
       t.created_at DESC
     LIMIT 50`,
    queryParams
  )

  const parsedTasks = tasks.map((t: any) => ({
    ...t,
    custom_payload:
      typeof t.custom_payload === 'string'
        ? JSON.parse(t.custom_payload)
        : t.custom_payload,
  }))

  return (
    <div className="mediaRequestsPageContainer">
      <MediaRequestsListClient initialTasks={parsedTasks} canViewAll={canViewAll} />
    </div>
  )
}
