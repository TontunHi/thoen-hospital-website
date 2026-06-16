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

  // Stats states
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('')

  // Unique fiscal years extracted from bookings
  const uniqueFiscalYears = Array.from(new Set(bookings.map(b => b.fiscal_year)))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a)) // Sort descending

  // Set default selected fiscal year once bookings are loaded
  useEffect(() => {
    if (uniqueFiscalYears.length > 0 && !selectedFiscalYear) {
      setSelectedFiscalYear(uniqueFiscalYears[0])
    }
  }, [bookings, uniqueFiscalYears])

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

  // Helper to format a local Date object to a clean "YYYY-MM-DD" local string
  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Helper to check if a booking overlaps with a specific day (timezone-independent)
  const getBookingsForDate = (date: Date) => {
    const targetY = date.getFullYear()
    const targetM = date.getMonth()
    const targetD = date.getDate()
    const targetTime = new Date(targetY, targetM, targetD).getTime()
    
    return bookings.filter(booking => {
      // Safely extract YYYY-MM-DD substring in case dates are full ISO timestamps in DB
      const cleanStartDate = (booking.start_date || '').substring(0, 10)
      const cleanEndDate = (booking.end_date || '').substring(0, 10)
      
      const [sYear, sMonth, sDay] = cleanStartDate.split('-').map(Number)
      const [eYear, eMonth, eDay] = cleanEndDate.split('-').map(Number)
      
      if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) return false
      
      const startTime = new Date(sYear, sMonth - 1, sDay).getTime()
      const endTime = new Date(eYear, eMonth - 1, eDay).getTime()
      
      return targetTime >= startTime && targetTime <= endTime
    })
  }

  // Change Month handler using functional updates
  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const y = prev.getFullYear()
      const m = prev.getMonth()
      return new Date(y, m - 1, 1)
    })
  }

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const y = prev.getFullYear()
      const m = prev.getMonth()
      return new Date(y, m + 1, 1)
    })
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

  const approvedBookings = bookings.filter(b => b.status === 'APPROVED')
  const bookingsInSelectedYear = approvedBookings.filter(b => b.fiscal_year === selectedFiscalYear)

  // Total usages
  const totalUsages = bookingsInSelectedYear.length

  // Find most popular room
  const roomUsageCounts: Record<string, number> = {}
  bookingsInSelectedYear.forEach(b => {
    if (b.room_name) {
      roomUsageCounts[b.room_name] = (roomUsageCounts[b.room_name] || 0) + 1
    }
  })

  let popularRoomName = '-'
  let popularRoomCount = 0
  Object.entries(roomUsageCounts).forEach(([room, count]) => {
    if (count > popularRoomCount) {
      popularRoomCount = count
      popularRoomName = room
    }
  })

  // Get unique room names in all bookings for color coding
  const uniqueRoomNames = Array.from(new Set(bookings.map(b => b.room_name))).filter(Boolean).sort()
  const roomColors = ['#99f6e4', '#bfdbfe', '#e9d5ff', '#fbcfe8', '#fed7aa', '#fef08a', '#bbf7d0', '#c7d2fe']
  const getRoomColor = (roomName: string) => {
    const idx = uniqueRoomNames.indexOf(roomName)
    return roomColors[idx % roomColors.length] || '#e2e8f0'
  }

  // Monthly data array (0 to 11 represent Jan to Dec)
  const thaiMonthsAbbr = ['ม.ค.', 'ก.พ.', 'มี.ย.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

  const getBookingMonthIndex = (dateStr: string) => {
    if (!dateStr) return -1
    const parts = dateStr.split('-')
    if (parts.length < 2) return -1
    return parseInt(parts[1]) - 1 // 0-indexed month
  }

  // Group by month and room
  const monthlyData: Record<string, number>[] = Array.from({ length: 12 }, () => ({}))
  bookingsInSelectedYear.forEach(b => {
    const mIdx = getBookingMonthIndex(b.start_date)
    if (mIdx >= 0 && mIdx < 12 && b.room_name) {
      monthlyData[mIdx][b.room_name] = (monthlyData[mIdx][b.room_name] || 0) + 1
    }
  })

  // Find peak monthly booking count to scale chart heights (max total bookings in a month)
  const monthlyTotals = monthlyData.map(roomsCount => {
    return Object.values(roomsCount).reduce((sum, val) => sum + val, 0)
  })
  const peakMonthlyCount = Math.max(...monthlyTotals, 1) // prevent division by zero

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
                key={`day-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
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
                {formatThaiDate(getLocalDateString(selectedDate))}
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

      {/* 3. Usage Statistics Dashboard */}
      {selectedFiscalYear && (
        <div className="statsSection">
          <div className="statsHeaderContainer">
            <h3 className="statsHeading">สรุปสถิติการใช้งานห้องประชุม</h3>
            <div className="statsFilterGroup">
              <label htmlFor="stats_fiscal_year_select" className="statsFilterLabel">เลือกปีงบประมาณ</label>
              <select
                id="stats_fiscal_year_select"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                className="statsFilterSelect"
              >
                {uniqueFiscalYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="statsSummaryGrid">
            <div className="statsSummaryCard">
              <span className="statsCardLabel">จำนวนการใช้งานทั้งหมดในปีนี้</span>
              <span className="statsCardValue">{totalUsages} <span className="statsUnit">ครั้ง</span></span>
            </div>
          </div>

          {/* Color Legend */}
          <div className="chartLegend">
            {uniqueRoomNames.map(room => (
              <div key={room} className="legendItem">
                <span className="legendColorBox" style={{ backgroundColor: getRoomColor(room) }}></span>
                <span className="legendLabel">{room}</span>
              </div>
            ))}
          </div>

          {/* Stacked Bar Chart */}
          <div className="barChartContainer">
            <div className="chartYAxis">
              <span>{peakMonthlyCount}</span>
              <span>{Math.round(peakMonthlyCount / 2)}</span>
              <span>0</span>
            </div>

            <div className="chartArea">
              {monthlyData.map((monthRooms, mIdx) => {
                const totalInMonth = monthlyTotals[mIdx]
                const barHeightPct = (totalInMonth / peakMonthlyCount) * 100

                return (
                  <div key={mIdx} className="chartColumn">
                    <div className="barWrapper">
                      {totalInMonth > 0 ? (
                        <div 
                          className="barContainer" 
                          style={{ height: `${barHeightPct}%` }}
                        >
                          {Object.entries(monthRooms).map(([roomName, count]) => {
                            const segmentHeightPct = (count / totalInMonth) * 100
                            return (
                              <div
                                key={roomName}
                                className="barSegment"
                                style={{ 
                                  height: `${segmentHeightPct}%`, 
                                  backgroundColor: getRoomColor(roomName) 
                                }}
                              ></div>
                            )
                          })}
                          {/* Tooltip on hover */}
                          <div className="barTooltip">
                            <div className="tooltipMonth">{thaiMonthsAbbr[mIdx]} ({selectedFiscalYear})</div>
                            <div className="tooltipDivider"></div>
                            {Object.entries(monthRooms).map(([roomName, count]) => (
                              <div key={roomName} className="tooltipRow">
                                <span className="tooltipColorDot" style={{ backgroundColor: getRoomColor(roomName) }}></span>
                                <span className="tooltipRoomName">{roomName}:</span>
                                <span className="tooltipRoomCount">{count} ครั้ง</span>
                              </div>
                            ))}
                            <div className="tooltipDivider"></div>
                            <div className="tooltipRow total">
                              <span>รวม:</span>
                              <strong>{totalInMonth} ครั้ง</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="emptyBar" style={{ height: '0%' }}></div>
                      )}
                    </div>
                    <span className="chartMonthLabel">{thaiMonthsAbbr[mIdx]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
