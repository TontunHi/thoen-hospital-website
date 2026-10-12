import { redirect, notFound } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import EventDetailClient from './EventDetailClient'

export const metadata = {
  title: 'รายละเอียดกิจกรรมและ QR Code | โรงพยาบาลเถิน',
  description: 'รายละเอียดกิจกรรม เช็คอินผ่าน ThaID และรายชื่อผู้เข้าร่วม',
}

const eventService = new HospitalEventService()

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const member = await getAuthenticatedMember()
  if (!member) {
    redirect('/member/login')
  }

  const { id } = await params
  const eventId = parseInt(id, 10)
  if (isNaN(eventId)) {
    notFound()
  }

  const event = await eventService.getEventById(eventId, member.id)
  if (!event) {
    notFound()
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const checkinUrl = `${baseUrl.replace(/\/+$/, '')}/api/events/checkin/${event.qrToken}`

  return (
    <EventDetailClient
      event={event}
      checkinUrl={checkinUrl}
      currentUser={{
        id: member.id,
        username: member.username,
        name: member.name || member.username,
        department: member.department,
        position: member.position,
        role: member.role,
        isAdmin: member.isAdmin,
      }}
    />
  )
}
