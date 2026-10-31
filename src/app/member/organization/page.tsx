import { getAuthenticatedMember, toClientMember } from '@/lib/memberAuth'
import OrganizationAdminClient from './OrganizationAdminClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'จัดการแผนผังและสมาชิกกลุ่มงาน | โรงพยาบาลเถิน',
  description: 'ระบบจัดการแผนผังโครงสร้างกลุ่มงาน หน่วยงานย่อย และรายชื่อบุคลากร โรงพยาบาลเถิน',
}

export default async function OrganizationAdminPage() {
  const member = await getAuthenticatedMember({
    requiredRole: 'admin',
    redirectTo: '/unauthorized',
  })

  return <OrganizationAdminClient currentAdmin={toClientMember(member)} />
}
