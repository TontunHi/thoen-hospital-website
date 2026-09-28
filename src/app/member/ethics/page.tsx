import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import EthicsAdminClient from './EthicsAdminClient'

import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'จัดการเอกสารชมรมจริยธรรม | Thoen Hospital Member Portal',
  description: 'ระบบจัดการแผนการดำเนินงาน คำสั่ง และรายงานผลของชมรมจริยธรรม โรงพยาบาลเถิน',
}

export const dynamic = 'force-dynamic'

export default async function MemberEthicsPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const isAuthorized = await checkPositionPermission(session.username, 'manage_ethics')
  if (!isAuthorized) {
    redirect('/member')
  }

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

  return <EthicsAdminClient username={session.username} initialYears={safeYears} />
}

