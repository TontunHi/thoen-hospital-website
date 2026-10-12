import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { prisma } from '@/lib/prisma'
import CreateEventClient from './CreateEventClient'

export const metadata = {
  title: 'สร้างกิจกรรมใหม่ | โรงพยาบาลเถิน',
  description: 'แบบฟอร์มสร้างกิจกรรม กำหนดผู้รับผิดชอบ และยืมวัสดุ/ครุภัณฑ์สำหรับกิจกรรม',
}

export default async function CreateEventPage() {
  const member = await getAuthenticatedMember()

  if (!member) {
    redirect('/member/login')
  }

  // Preload materials, loanable assets, and members for co-organizers
  let loanableMaterials: any[] = []
  let loanableAssets: any[] = []
  let hospitalMembers: any[] = []

  try {
    const [materials, assets, members] = await Promise.all([
      prisma.hospitalMaterial.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category: true, availableQty: true, unit: true },
        orderBy: { name: 'asc' },
      }),
      prisma.hospitalAsset.findMany({
        where: { isLoanable: true, status: 'ACTIVE' },
        select: { id: true, articleNum: true, name: true, category: true },
        orderBy: { name: 'asc' },
      }),
      prisma.member.findMany({
        select: { id: true, name: true, department: true, position: true },
        orderBy: { name: 'asc' },
      }),
    ])

    loanableMaterials = materials
    loanableAssets = assets
    hospitalMembers = members.filter((m: any) => m.name && m.id !== member.id)
  } catch (err) {
    console.error('Error preloading event creation data:', err)
  }

  return (
    <CreateEventClient
      currentUser={{
        id: member.id,
        name: member.name || member.username,
        department: member.department,
        position: member.position,
      }}
      loanableMaterials={loanableMaterials}
      loanableAssets={loanableAssets}
      availableMembers={hospitalMembers}
    />
  )
}
