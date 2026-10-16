import { getAuthenticatedMember } from '@/lib/memberAuth'
import { KpiTrackerClient } from './KpiTrackerClient'

export const metadata = {
  title: 'ระบบติดตามตัวชี้วัด (KPI Tracking) | โรงพยาบาลเถิน',
  description: 'ระบบกำกับและติดตามตัวชี้วัดคุณภาพ THIP / HA / ยุทธศาสตร์ โรงพยาบาลเถิน',
}

export default async function KpiTrackerPage() {
  const member = await getAuthenticatedMember()

  const currentUser = {
    id: member.id,
    username: member.username,
    name: member.name || member.username,
    role: member.role,
    department: member.department || null,
    isAdmin: member.isAdmin,
    permissions: Array.from(member.permissions),
  }

  return <KpiTrackerClient currentUser={currentUser} />
}
