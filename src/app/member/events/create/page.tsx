import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import CreateEventClient from './CreateEventClient'

export const metadata = {
  title: 'สร้างกิจกรรมใหม่ | โรงพยาบาลเถิน',
  description: 'แบบฟอร์มสร้างกิจกรรม กำหนดผู้รับผิดชอบ และยืมวัสดุ/ครุภัณฑ์สำหรับกิจกรรม',
}

const eventService = new HospitalEventService()

export default async function CreateEventPage() {
  const member = await getAuthenticatedMember()

  if (!member) {
    redirect('/member/login')
  }

  if (!member.isAdmin) {
    redirect('/member/events')
  }

  let loanableMaterials: any[] = []
  let loanableAssets: any[] = []
  let hospitalMembers: any[] = []

  try {
    const preload = await eventService.getEventCreationPreloadData(member.id)
    loanableMaterials = preload.loanableMaterials
    loanableAssets = preload.loanableAssets
    hospitalMembers = preload.hospitalMembers
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
