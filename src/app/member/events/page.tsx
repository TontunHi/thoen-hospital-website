import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { HospitalEventService } from '@/lib/events/hospitalEventService'
import { queryMemberDb } from '@/lib/memberDb'
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

  // Fetch initial events and user's score on server side
  let initialEvents: any[] = []
  let userTotalPoints = 0
  let registeredEventsCount = 0

  try {
    const [eventsRes, pointsRows, regRows] = await Promise.all([
      eventService.getEvents({
        memberId: member.id,
        limit: 30,
      }),
      queryMemberDb('SELECT COUNT(*) AS count FROM event_attendances WHERE member_id = ?', [member.id]),
      queryMemberDb('SELECT COUNT(*) AS count FROM event_registrations WHERE member_id = ?', [member.id]),
    ])

    initialEvents = eventsRes.events || []
    userTotalPoints = Number(pointsRows[0]?.count ?? 0)
    registeredEventsCount = Number(regRows[0]?.count ?? 0)
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
