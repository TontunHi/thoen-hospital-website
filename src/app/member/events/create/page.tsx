import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
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

  // Only admin can create events
  if (!member.isAdmin) {
    redirect('/member/events')
  }

  // Preload materials, loanable assets, and members for co-organizers
  let loanableMaterials: any[] = []
  let loanableAssets: any[] = []
  let hospitalMembers: any[] = []

  try {
    const [materials, assets, members] = await Promise.all([
      queryMemberDb(
        'SELECT id, name, category, available_qty AS availableQty, unit FROM hospital_materials WHERE is_active = 1 ORDER BY name ASC'
      ),
      queryMemberDb(
        'SELECT id, article_num AS articleNum, name, category FROM hospital_assets WHERE is_loanable = 1 AND status = "ACTIVE" ORDER BY name ASC'
      ),
      queryMemberDb(
        'SELECT id, name, department, position FROM members ORDER BY name ASC'
      ),
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
