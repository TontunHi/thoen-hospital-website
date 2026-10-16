import { getAuthenticatedMember, toClientMember } from '@/lib/memberAuth'
import { TaskInboxService } from '@/lib/taskInboxService'
import MemberDashboardClient from './MemberDashboardClient'
import './page.css'

export default async function MemberDashboardPage() {
  const member = await getAuthenticatedMember()

  const { pendingInboxCount, pendingRegistrationsCount } =
    await TaskInboxService.getMemberWorkSummary({
      memberId: member.id,
      role: member.role,
      position: member.position,
    })

  const isFinance = member.can('upload_salary')
  const isItaAuthorized = member.can('manage_ita')
  const isNewsAuthorized = member.can('manage_news')
  const isAllSalaryAuthorized = member.can('view_all_salary')
  const isRduAuthorized = member.can('manage_rdu')
  const isOutgoingDocAuthorized = member.can('manage_outgoing_doc')
  const isEthicsAuthorized = member.can('manage_ethics')
  const isLocationsAuthorized = member.can('manage_locations') || member.isAdmin
  const isAssetsAuthorized = member.can('manage_assets') || member.isAdmin

  return (
    <MemberDashboardClient
      member={toClientMember(member)}
      initials={member.initials}
      displayRole={member.displayRole}
      isTelegramLinked={member.isTelegramLinked}
      pendingInboxCount={pendingInboxCount}
      pendingRegistrationsCount={pendingRegistrationsCount}
      permissions={{
        hasInbox: member.hasAccess('feature_inbox'),
        hasRepair: member.hasAccess('feature_repair'),
        hasMediaRequest: member.hasAccess('feature_media_request'),
        hasSalary: member.hasAccess('feature_salary'),
        hasSignature: member.hasAccess('feature_signature'),
        hasEquipmentBorrow: member.hasAccess('feature_equipment_borrow'),
        hasEvents: member.hasAccess('feature_events'),
        isAssetsAuthorized,
        isNewsAuthorized,
        isItaAuthorized: isItaAuthorized && member.hasAccess('feature_ita'),
        isRduAuthorized: isRduAuthorized && member.hasAccess('feature_rdu'),
        isOutgoingDocAuthorized: isOutgoingDocAuthorized && member.hasAccess('feature_outgoing_doc'),
        isEthicsAuthorized: isEthicsAuthorized && member.hasAccess('feature_ethics'),
        isFinance,
        isAllSalaryAuthorized,
        isAdmin: member.role === 'admin',
        isLocationsAuthorized,
        isSubdistrict: member.role === 'subdistrict',
      }}
    />
  )
}
