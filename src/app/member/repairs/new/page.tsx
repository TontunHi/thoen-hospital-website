import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import RepairFormClient from './RepairFormClient'

export const dynamic = 'force-dynamic'

export default async function NewRepairPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  // Fetch current user details
  const members = await queryMemberDb(
    'SELECT id, username, name, department, position, email FROM members WHERE username = ? LIMIT 1',
    [session.username]
  )
  const currentMember = members[0] || {
    id: 0,
    username: session.username,
    name: session.username,
    department: '',
    position: '',
  }

  // Fetch initial locations for dropdown/search
  const initialLocations = await queryMemberDb(
    `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name 
     FROM hospital_locations 
     WHERE is_active = 1 
     ORDER BY building_name ASC, floor_id ASC, room_name ASC 
     LIMIT 50`
  )

  // Fetch technicians list (all members for technician selection)
  const technicians = await queryMemberDb(
    'SELECT id, name, position, department FROM members ORDER BY name ASC'
  )

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '2rem 1rem 5rem',
    }}>
      <RepairFormClient 
        currentUser={currentMember}
        initialLocations={initialLocations}
        technicians={technicians}
      />
    </div>
  )
}
