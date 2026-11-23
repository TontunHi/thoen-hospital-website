import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import EventsClient from './EventsClient'

export const metadata = {
  title: 'ระบบกิจกรรมและสะสมคะแนน | โรงพยาบาลเถิน',
  description: 'ระบบกิจกรรมบุคลากรโรงพยาบาลเถิน การเช็คอินผ่าน ThaID และกระดานคะแนนการมีส่วนร่วม',
}

const eventService = new HospitalEventService()

export default async function MemberEventsPage() {
  const member = await getAuthenticatedMember()

  if (!member) {
    redirect('/member/login')
  }

  let initialEvents: any[] = []
  let userTotalPoints = 0
  let registeredEventsCount = 0

  try {
    const [eventsRes, stats] = await Promise.all([
      eventService.getEvents({
        memberId: member.id,
        limit: 30,
      }),
      eventService.getMemberEventParticipationStats(member.id),
    ])

    initialEvents = eventsRes.events || []
    userTotalPoints = stats.totalPoints
    registeredEventsCount = stats.registeredCount
  } catch (err) {
    console.error('Error fetching initial events:', err)
  }

  return (
    <EventsClient
      initialEvents={initialEvents}
      userStats={{
        totalPoints: userTotalPoints,
        registeredCount: registeredEventsCount,
      }}
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
