'use client'

import { useState, useEffect } from 'react'

interface Booking {
  id: number
  topic: string
  target_group: string
  room_id: number
  room_name: string
  requester_name: string
  requester_dept: string
  start_time: string
  end_time: string
  start_date: string
  end_date: string
  details: string | null
  fiscal_year: string
  attendees_count: number
  objective: string
  contact_number: string
  equipment_json: string | null
  food_json: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
}

interface RoomBookingsClientProps {
  isAdmin: boolean
}

export default function RoomBookingsClient({ isAdmin }: RoomBookingsClientProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showDayListModal, setShowDayListModal] = useState(false)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/member/room-bookings')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถดึงข้อมูลการจองได้')
      setBookings(data.bookings || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Format Helpers
  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getThaiMonthYear = (date: Date) => {
    return date.toLocaleDateString('th-TH', {
      month: 'long',
      year: 'numeric'
    })
  }

  // Calendar calculations
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sun, 1 = Mon...
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const daysArray: (Date | null)[] = []
  
  // Add padding for previous month's empty days
  for (let i = 0; i < startDayOfWeek; i++) {
    daysArray.push(null)
  }

  // Add current month's days
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(new Date(year, month, d))
  }

  // Helper to check if a booking overlaps with a specific day
  const getBookingsForDate = (date: Date) => {
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    
    return bookings.filter(booking => {
      const start = new Date(booking.start_date)
      const startDateZero = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      
      const end = new Date(booking.end_date)
      const endDateZero = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
      
      return target >= startDateZero && target <= endDateZero
    })
  }

  // Change Month handler
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
    setShowDayListModal(true)
  }

  const parseEquipment = (jsonStr: string | null) => {
    if (!jsonStr) return []
    try {
      return JSON.parse(jsonStr)
    } catch {
      return []
    }
  }

  const parseFood = (jsonStr: string | null) => {
    if (!jsonStr) return []
    try {
      return JSON.parse(jsonStr)
    } catch {
      return []
    }
  }

  // Bookings of selected date
  const selectedDateBookings = selectedDate ? getBookingsForDate(selectedDate) : []

  if (loading) {
    return <div className="loadingState">⌛ กำลังโหลดข้อมูลปฏิทินการจองห้องประชุม...</div>
  }

  if (error) {
    return <div className="errorState">⚠️ เกิดข้อผิดพลาด: {error}</div>
  }

  return (
    <div className="bookingsClientLayout fullWidthLayout">
      <div className="calendarSection">
        <div className="calendarHeader">
          <button className="navBtn" onClick={handlePrevMonth}>◀</button>
          <h2 className="currentMonthLabel">{getThaiMonthYear(currentDate)}</h2>
          <button className="navBtn" onClick={handleNextMonth}>▶</button>
          <button className="todayBtn" onClick={handleToday}>วันนี้</button>
        </div>

        {/* Weekday headers */}
        <div className="weekdayHeader">
          <div>อา.</div>
          <div>จ.</div>
          <div>อ.</div>
          <div>พ.</div>
          <div>พฤ.</div>
          <div>ศ.</div>
          <div>ส.</div>
        </div>

        {/* Days grid */}
        <div className="daysGrid">
          {daysArray.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="calendarDay empty"></div>

            const dayBookings = getBookingsForDate(day)
            const isSelected = selectedDate && 
              day.getDate() === selectedDate.getDate() && 
              day.getMonth() === selectedDate.getMonth() && 
              day.getFullYear() === selectedDate.getFullYear()

            const isToday = () => {
              const today = new Date()
              return day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear()
            }

            return (
              <div
                key={`day-${day.getDate()}`}
                className={`calendarDay ${isSelected ? 'selected' : ''} ${isToday() ? 'today' : ''}`}
                onClick={() => {
                  setSelectedDate(day)
                  setShowDayListModal(true)
                }}
              >
                <span className="dayNumber">{day.getDate()}</span>
                <div className="dayBookingsList">
                  {dayBookings.slice(0, 2).map(b => (
                    <div
                      key={b.id}
                      className={`dayBookingBadge ${b.status.toLowerCase()}`}
                      title={`${b.start_time} - ${b.topic}`}
                    >
                      <span className="badgeDot"></span>
                      <span className="badgeTime">{b.start_time}</span>
                      <span className="badgeTopic">{b.topic}</span>
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <div className="moreIndicator">และอีก {dayBookings.length - 2} รายการ</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 1. Daily meetings list popup modal */}
      {showDayListModal && selectedDate && (
        <div className="modalOverlay" onClick={() => setShowDayListModal(false)}>
          <div className="modalContent dayListModal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>
                📅 รายการประชุมวันที่{' '}
                {formatThaiDate(selectedDate.toISOString().split('T')[0])}
              </h3>
              <button className="closeBtn" onClick={() => setShowDayListModal(false)}>×</button>
            </div>
            <div className="modalBody" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedDateBookings.length === 0 ? (
                <div className="noBookingsNotice">ไม่มีการประชุมในวันที่เลือก</div>
              ) : (
                <div className="selectedBookingsList">
                  {selectedDateBookings.map(b => (
                    <div
                      key={b.id}
                      className="bookingDetailCard"
                      onClick={() => {
                        setSelectedBooking(b)
                      }}
                    >
                      <div className="bookingCardHeader">
                        <span className={`statusLabel ${b.status.toLowerCase()}`}>
                          {b.status === 'APPROVED' ? 'อนุมัติแล้ว' : b.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอพิจารณา'}
                        </span>
                        <span className="bookingTime">🕒 {b.start_time} - {b.end_time} น.</span>
                      </div>
                      <h4 className="bookingTopic">{b.topic}</h4>
                      <div className="bookingMeta">
                        <div>🚪 ห้องประชุม: <strong>{b.room_name}</strong></div>
                        <div>👤 ผู้จอง: {b.requester_name} ({b.requester_dept})</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modalFooter">
              <button className="tabButton" onClick={() => setShowDayListModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Detailed Booking View Modal */}
      {selectedBooking && (() => {
        const sb = selectedBooking
        const equipment = parseEquipment(sb.equipment_json)
        const food = parseFood(sb.food_json)

        return (
          <div className="modalOverlay detailModalZ" onClick={() => setSelectedBooking(null)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <h3>รายละเอียดการจองห้องประชุม</h3>
                <button className="closeBtn" onClick={() => setSelectedBooking(null)}>×</button>
              </div>
              <div className="modalBody">
                <div className="detailGrid">
                  <div className="detailItem fullWidth">
                    <span className="detailLabel">หัวข้อการประชุม</span>
                    <span className="detailValue boldText">{sb.topic}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ห้องประชุม</span>
                    <span className="detailValue highlighted">{sb.room_name}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">สถานะ</span>
                    <span className={`statusBadge ${sb.status.toLowerCase()}`}>
                      {sb.status === 'APPROVED' ? '✅ อนุมัติแล้ว' : sb.status === 'REJECTED' ? '❌ ปฏิเสธ' : '⏳ รอพิจารณา'}
                    </span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">วันที่ใช้งาน</span>
                    <span className="detailValue">
                      {sb.start_date === sb.end_date 
                        ? formatThaiDate(sb.start_date) 
                        : `${formatThaiDate(sb.start_date)} - ${formatThaiDate(sb.end_date)}`}
                    </span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">เวลาใช้งาน</span>
                    <span className="detailValue">{sb.start_time} - {sb.end_time} น.</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">วัตถุประสงค์</span>
                    <span className="detailValue">{sb.objective}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">กลุ่มเป้าหมาย</span>
                    <span className="detailValue">{sb.target_group}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">จำนวนผู้เข้าร่วม</span>
                    <span className="detailValue">{sb.attendees_count} คน</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">เบอร์ติดต่อ</span>
                    <span className="detailValue">{sb.contact_number}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">ผู้จอง</span>
                    <span className="detailValue">{sb.requester_name}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">หน่วยงาน</span>
                    <span className="detailValue">{sb.requester_dept}</span>
                  </div>
                  <div className="detailItem fullWidth">
                    <span className="detailLabel">รายละเอียดเพิ่มเติม / หมายเหตุ</span>
                    <div className="detailValue textBlock">{sb.details || '-'}</div>
                  </div>

                  {equipment.length > 0 && (
                    <div className="detailItem fullWidth separator">
                      <span className="detailLabel">🛠️ อุปกรณ์ที่ขอใช้เพิ่มเติม</span>
                      <div className="nestedList">
                        {equipment.map((eq: any, idx: number) => (
                          <div key={idx} className="nestedListItem">
                            🔧 {eq.name} (จำนวน {eq.quantity} ชิ้น)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {food.length > 0 && (
                    <div className="detailItem fullWidth separator">
                      <span className="detailLabel">🍱 รายการอาหารและของว่าง</span>
                      <div className="nestedList">
                        {food.map((f: any, idx: number) => (
                          <div key={idx} className="nestedListItem">
                            🍽️ {f.name} (เสิร์ฟช่วงเวลา: {f.time_period}) - จำนวน {f.quantity} ชุด
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modalFooter">
                <button className="tabButton" onClick={() => setSelectedBooking(null)}>ปิด</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
