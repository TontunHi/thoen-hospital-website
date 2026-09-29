import { getAuthenticatedMember } from '@/lib/memberAuth'
import MembersAdminClient from './MembersAdminClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'แดชบอร์ดจัดการสมาชิก | โรงพยาบาลเถิน',
  description: 'ระบบจัดการสมาชิก สิทธิ์การใช้งาน และข้อมูลบัญชีเงินเดือนบุคลากร โรงพยาบาลเถิน',
}

export default async function MembersAdminPage() {
  await getAuthenticatedMember({
    requiredRole: 'admin',
    redirectTo: '/unauthorized',
  })

  return <MembersAdminClient />
}
