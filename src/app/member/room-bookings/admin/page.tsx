import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import RoomBookingsAdminClient from './RoomBookingsAdminClient'
import './admin-room.css'

export const dynamic = 'force-dynamic'

export default async function RoomBookingsAdminPage() {
  const session = await verifyMemberSession()

  // Strict Admin Check
  if (!session) {
    redirect('/member/login')
  }

  if (session.role !== 'admin') {
    redirect('/unauthorized')
  }

  // Fetch catalogs
  const rooms = await queryMemberDb('SELECT * FROM meeting_rooms ORDER BY name ASC')
  const equipment = await queryMemberDb('SELECT * FROM meeting_room_equipment ORDER BY name ASC')
  const food = await queryMemberDb('SELECT * FROM meeting_room_food ORDER BY name ASC')
  const foodPeriods = await queryMemberDb('SELECT * FROM meeting_room_food_periods ORDER BY name ASC')
  
  const settingsRows = await queryMemberDb('SELECT config_key, config_value FROM meeting_room_settings')
  const settings: Record<string, string> = {}
  settingsRows.forEach((row) => {
    settings[row.config_key] = row.config_value
  })

  // Fetch all bookings for approval listing
  const bookings = await queryMemberDb(`
    SELECT b.*, 
           DATE_FORMAT(b.start_date, '%Y-%m-%d') as start_date,
           DATE_FORMAT(b.end_date, '%Y-%m-%d') as end_date,
           r.name as room_name, 
           m.name as requester_name, 
           m.department as requester_dept
    FROM meeting_room_bookings b
    LEFT JOIN meeting_rooms r ON b.room_id = r.id
    LEFT JOIN members m ON b.requester_id = m.id
    ORDER BY b.created_at DESC
  `)

  return (
    <div className="adminRoomContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="adminRoomWrapper">
        <div className="adminRoomHeader">
          <h1>ระบบจัดการห้องประชุม (สำหรับ Admin)</h1>
          <p>อนุมัติการจอง ตั้งค่าปีงบประมาณ และจัดการฐานข้อมูลห้องประชุม อุปกรณ์ และอาหาร</p>
        </div>

        <RoomBookingsAdminClient 
          initialBookings={bookings}
          initialRooms={rooms}
          initialEquipment={equipment}
          initialFood={food}
          initialFoodPeriods={foodPeriods}
          initialSettings={settings}
        />
      </div>
    </div>
  )
}
