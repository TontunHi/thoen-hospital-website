import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import NewBookingForm from './NewBookingForm'
import './new-booking.css'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage() {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  // Fetch catalog data directly on the server
  const rooms = await queryMemberDb('SELECT * FROM meeting_rooms WHERE is_active = 1 ORDER BY name ASC')
  const equipment = await queryMemberDb('SELECT * FROM meeting_room_equipment ORDER BY name ASC')
  const food = await queryMemberDb('SELECT * FROM meeting_room_food ORDER BY name ASC')
  const foodPeriods = await queryMemberDb('SELECT * FROM meeting_room_food_periods ORDER BY name ASC')
  
  const settingsRows = await queryMemberDb('SELECT config_key, config_value FROM meeting_room_settings')
  const settings: Record<string, string> = {}
  settingsRows.forEach((row) => {
    settings[row.config_key] = row.config_value
  })

  const defaultFiscalYear = settings['default_fiscal_year'] || 'ปีงบประมาณ 2569'

  return (
    <div className="newBookingContainer">
      <div className="glowOrb glowOrb1"></div>
      <div className="glowOrb glowOrb2"></div>
      <div className="newBookingWrapper">
        <div className="newBookingHeader">
          <h1>จองห้องประชุมใหม่</h1>
          <p>กรอกข้อมูลรายละเอียดการขอจองใช้ห้องประชุม อุปกรณ์อำนวยความสะดวก และอาหาร/เครื่องดื่ม</p>
        </div>

        <NewBookingForm 
          rooms={rooms} 
          equipment={equipment} 
          food={food} 
          foodPeriods={foodPeriods}
          defaultFiscalYear={defaultFiscalYear} 
        />
      </div>
    </div>
  )
}
