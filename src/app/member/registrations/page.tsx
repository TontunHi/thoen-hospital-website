import { getAuthenticatedMember } from '@/lib/memberAuth'
import RegistrationsAdminClient from './RegistrationsAdminClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบตรวจสอบคำขอลงทะเบียนบุคลากร | โรงพยาบาลเถิน',
  description: 'ระบบจัดการและอนุมัติคำขอลงทะเบียนเข้าใช้งานระบบของบุคลากร โรงพยาบาลเถิน',
}

export default async function RegistrationsAdminPage() {
  await getAuthenticatedMember({
    requiredRole: 'admin',
    redirectTo: '/unauthorized',
  })

  return <RegistrationsAdminClient />
}
