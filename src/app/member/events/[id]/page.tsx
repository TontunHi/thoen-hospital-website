import { redirect, notFound } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import EventDetailClient from './EventDetailClient'

export const metadata = {
  title: 'รายละเอียดกิจกรรมและ QR Code | โรงพยาบาลเถิน',
  description: 'รายละเอียดกิจกรรม เช็คอินผ่าน ThaID และรายชื่อผู้เข้าร่วม',
}

const eventService = new HospitalEventService()

type EventDetailTab = 'attendances' | 'registrations' | 'attachments'

function resolveInitialTab(tab?: string | string[]): EventDetailTab {
  const value = Array.isArray(tab) ? tab[0] : tab
  if (value === 'registrations' || value === 'attachments') {
    return value
  }
  return 'attendances'
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ tab?: string | string[] }>
}) {
  const member = await getAuthenticatedMember()
  if (!member) {
    redirect('/member/login')
  }

  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ])
  const initialTab = resolveInitialTab(resolvedSearchParams?.tab)
  const eventId = parseInt(id, 10)
  if (isNaN(eventId)) {
    notFound()
  }

  const event = await eventService.getEventById(eventId, member.id)
  if (!event) {
    notFound()
  }

  const canManage = Boolean(event.canManage || member.isAdmin)

  let availableMembers: any[] = []
  if (canManage) {
    try {
      availableMembers = await eventService.listAvailableMembersForPicker()
    } catch (err) {
      console.error('Error fetching members for attendee picker:', err)
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const checkinUrl = `${baseUrl.replace(/\/+$/, '')}/api/events/checkin/${event.qrToken}`

  return (
    <EventDetailClient
      event={event}
      checkinUrl={checkinUrl}
      initialTab={initialTab}
      currentUser={{
        id: member.id,
        username: member.username,
        name: member.name || member.username,
        department: member.department,
        position: member.position,
        role: member.role,
        isAdmin: member.isAdmin,
      }}
      availableMembers={availableMembers}
    />
  )
}
