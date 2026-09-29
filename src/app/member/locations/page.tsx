import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import LocationsAdminClient from './LocationsAdminClient'
import './locations.css'

export const dynamic = 'force-dynamic'

export default async function HospitalLocationsAdminPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    redirect('/unauthorized')
  }

  return (
    <div className="locAdminContainer">
      <LocationsAdminClient sessionUser={session} />
    </div>
  )
}
