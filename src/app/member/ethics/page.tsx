import { getAuthenticatedMember } from '@/lib/memberAuth'
import EthicsAdminClient from './EthicsAdminClient'
import { EthicsDocumentService } from '@/lib/cms/EthicsDocumentService'

export const metadata = {
  title: 'จัดการเอกสารชมรมจริยธรรม | Thoen Hospital Member Portal',
  description: 'ระบบจัดการแผนการดำเนินงาน คำสั่ง และรายงานผลของชมรมจริยธรรม โรงพยาบาลเถิน',
}

export const dynamic = 'force-dynamic'

export default async function MemberEthicsPage() {
  const member = await getAuthenticatedMember({
    requiredPermission: 'manage_ethics',
    redirectTo: '/member',
  })

  const safeYears = await EthicsDocumentService.getYears()

  return <EthicsAdminClient username={member.username} initialYears={safeYears} />
}

