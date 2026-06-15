import { verifyMemberSession } from '@/lib/memberAuth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RoomBookingsClient from './RoomBookingsClient'
import './page.css'

export const dynamic = 'force-dynamic'

export default async function RoomBookingsPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const isAdmin = session.role === 'admin'

  return (
    <div className="bookingsContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="bookingsWrapper">
        <div className="bookingsHeader">
          <div>
            <h1>ระบบจองห้องประชุม</h1>
            <p>ตรวจสอบสถานะ ปฏิทิน และส่งคำขอขอใช้ห้องประชุมของโรงพยาบาลเถิน</p>
          </div>
          <div className="headerActions">
            <Link href="/member/room-bookings/new" className="btn btn-primary booking-btn">
              ➕ จองห้องประชุม
            </Link>
          </div>
        </div>

        <RoomBookingsClient isAdmin={isAdmin} />
      </div>
    </div>
  )
}
