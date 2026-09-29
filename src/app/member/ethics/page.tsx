import { getAuthenticatedMember } from '@/lib/memberAuth'
import EthicsAdminClient from './EthicsAdminClient'
import { prisma } from '@/lib/prisma'

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

  const years = await prisma.ethicsYear.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { year: 'desc' }
    ],
    include: {
      documents: {
        orderBy: [
          { displayOrder: 'asc' },
          { id: 'asc' }
        ]
      }
    }
  })

  const safeYears = years.map((y: any) => ({
    ...y,
    documents: y.documents.map((d: any) => ({
      ...d,
      fileSize: d.fileSize ? d.fileSize.toString() : null
    }))
  }))

  return <EthicsAdminClient username={member.username} initialYears={safeYears} />
}

