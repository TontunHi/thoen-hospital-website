'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

interface Room {
  id: number
  name: string
  is_active: number
}

interface Equipment {
  id: number
  name: string
  quantity: number
}

interface Food {
  id: number
  name: string
  category?: string
  time_period: string
  quantity: number
}

interface AdminProps {
  initialBookings: Booking[]
  initialRooms: Room[]
  initialEquipment: Equipment[]
  initialFood: Food[]
  initialFoodPeriods: { id: number; name: string }[]
  initialSettings: Record<string, string>
}

export default function RoomBookingsAdminClient({
  initialBookings,
  initialRooms,
  initialEquipment,
  initialFood,
  initialFoodPeriods,
  initialSettings
}: AdminProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'bookings' | 'rooms' | 'equipment' | 'food' | 'foodPeriods' | 'settings'>('bookings')

  // States
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment)
  const [food, setFood] = useState<Food[]>(initialFood)
  const [foodPeriods, setFoodPeriods] = useState<{ id: number; name: string }[]>(initialFoodPeriods)
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings)

  // Message notifications
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam && ['bookings', 'rooms', 'equipment', 'food', 'foodPeriods', 'settings'].includes(tabParam)) {
        setActiveTab(tabParam as any)
      }
    }
  }, [])

  // Detail modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  // Form states for creating/editing items
  const [roomName, setRoomName] = useState('')
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)

  const [eqName, setEqName] = useState('')
  const [eqQty, setEqQty] = useState('')
  const [editingEqId, setEditingEqId] = useState<number | null>(null)

  const [foodName, setFoodName] = useState('')
  const [editingFoodId, setEditingFoodId] = useState<number | null>(null)

  const [foodPeriodName, setFoodPeriodName] = useState('')
  const [editingFoodPeriodId, setEditingFoodPeriodId] = useState<number | null>(null)

  const [defaultFiscalYear, setDefaultFiscalYear] = useState(settings['default_fiscal_year'] || 'ปีงบประมาณ 2569')

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  // --- Booking Approvals ---
  const handleAction = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/member/room-bookings/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการทำรายการ')
      notify(data.message)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleDeleteBooking = async (id: number) => {
    if (!confirm('คุณต้องการลบรายการจองห้องประชุมนี้ใช่หรือไม่?')) return
    try {
      const res = await fetch(`/api/member/room-bookings/admin/actions?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการลบรายการ')
      notify(data.message)
      setBookings(prev => prev.filter(b => b.id !== id))
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // --- Rooms Management ---
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName.trim()) return

    try {
      const isEditing = editingRoomId !== null
      const url = '/api/member/room-bookings/rooms'
      const method = isEditing ? 'PUT' : 'POST'
      const body = isEditing 
        ? { id: editingRoomId, name: roomName, is_active: 1 }
        : { name: roomName, is_active: 1 }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      notify(data.message)
      setRoomName('')
      setEditingRoomId(null)
      
      const freshRes = await fetch('/api/member/room-bookings/rooms')
      const freshData = await freshRes.json()
      if (freshData.success) setRooms(freshData.rooms)
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleToggleRoomActive = async (room: Room) => {
    try {
      const res = await fetch('/api/member/room-bookings/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: room.id,
          name: room.name,
          is_active: room.is_active === 1 ? 0 : 1
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, is_active: r.is_active === 1 ? 0 : 1 } : r))
      notify('อัปเดตสถานะห้องประชุมเรียบร้อยแล้ว')
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleDeleteRoom = async (id: number) => {
    if (!confirm('คุณต้องการลบห้องประชุมนี้ใช่หรือไม่? การลบนี้จะลบรายการจองที่เชื่อมโยงอยู่ด้วยทั้งหมด')) return
    try {
      const res = await fetch(`/api/member/room-bookings/rooms?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      
      notify(data.message)
      setRooms(prev => prev.filter(r => r.id !== id))
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // --- Equipment Management ---
  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eqName.trim()) return

    try {
      const isEditing = editingEqId !== null
      const url = '/api/member/room-bookings/equipment'
      const method = isEditing ? 'PUT' : 'POST'
      const body = isEditing 
        ? { id: editingEqId, name: eqName, quantity: 1 }
        : { name: eqName, quantity: 1 }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      notify(data.message)
      setEqName('')
      setEqQty('')
      setEditingEqId(null)

      const freshRes = await fetch('/api/member/room-bookings/equipment')
      const freshData = await freshRes.json()
      if (freshData.success) setEquipment(freshData.equipment)
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleDeleteEquipment = async (id: number) => {
    if (!confirm('ต้องการลบรายการอุปกรณ์นี้ใช่หรือไม่?')) return
    try {
      const res = await fetch(`/api/member/room-bookings/equipment?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      notify(data.message)
      setEquipment(prev => prev.filter(e => e.id !== id))
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // --- Food Management ---
  const handleSaveFood = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foodName.trim()) return

    try {
      const isEditing = editingFoodId !== null
      const url = '/api/member/room-bookings/food'
      const method = isEditing ? 'PUT' : 'POST'
      const body = isEditing 
        ? { id: editingFoodId, name: foodName }
        : { name: foodName }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      notify(data.message)
      setFoodName('')
      setEditingFoodId(null)

      const freshRes = await fetch('/api/member/room-bookings/food')
      const freshData = await freshRes.json()
      if (freshData.success) setFood(freshData.food)
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleDeleteFood = async (id: number) => {
    if (!confirm('ต้องการลบรายการอาหารนี้ใช่หรือไม่?')) return
    try {
      const res = await fetch(`/api/member/room-bookings/food?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      notify(data.message)
      setFood(prev => prev.filter(f => f.id !== id))
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // --- Food Periods Management ---
  const handleSaveFoodPeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foodPeriodName.trim()) return

    try {
      const isEditing = editingFoodPeriodId !== null
      const url = '/api/member/room-bookings/food-periods'
      const method = isEditing ? 'PUT' : 'POST'
      const body = isEditing 
        ? { id: editingFoodPeriodId, name: foodPeriodName }
        : { name: foodPeriodName }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      notify(data.message)
      setFoodPeriodName('')
      setEditingFoodPeriodId(null)

      const freshRes = await fetch('/api/member/room-bookings/food-periods')
      const freshData = await freshRes.json()
      if (freshData.success) setFoodPeriods(freshData.periods)
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleDeleteFoodPeriod = async (id: number) => {
    if (!confirm('ต้องการลบช่วงเวลาอาหารนี้ใช่หรือไม่?')) return
    try {
      const res = await fetch(`/api/member/room-bookings/food-periods?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      notify(data.message)
      setFoodPeriods(prev => prev.filter(p => p.id !== id))
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        default_fiscal_year: defaultFiscalYear
      }
      const res = await fetch('/api/member/room-bookings/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      setSettings(prev => ({
        ...prev,
        ...payload
      }))
      notify(data.message)
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const pendingCount = bookings.filter(b => b.status === 'PENDING').length

  // Fiscal Year filter state
  const [selectedFiscalYearFilter, setSelectedFiscalYearFilter] = useState<string>('ALL')

  const uniqueFiscalYears = Array.from(new Set(bookings.map(b => b.fiscal_year))).filter(Boolean).sort()

  const filteredBookings = bookings.filter(b => {
    if (selectedFiscalYearFilter === 'ALL') return true
    return b.fiscal_year === selectedFiscalYearFilter
  })

  const totalInYear = filteredBookings.length
  const approvedInYear = filteredBookings.filter(b => b.status === 'APPROVED').length
  const pendingInYear = filteredBookings.filter(b => b.status === 'PENDING').length
  const rejectedInYear = filteredBookings.filter(b => b.status === 'REJECTED').length

  // Helper to parse food_json safely
  const parseFoodExtras = (foodJsonStr: string | null) => {
    if (!foodJsonStr) return { items: [], periods: [] }
    try {
      const data = JSON.parse(foodJsonStr)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return { items: data.items || [], periods: data.periods || [] }
      }
      if (Array.isArray(data)) {
        return { items: data, periods: [] }
      }
    } catch (e) {
      // ignore
    }
    return { items: [], periods: [] }
  }

  const parseEquipmentExtras = (eqJsonStr: string | null) => {
    if (!eqJsonStr) return []
    try {
      return JSON.parse(eqJsonStr)
    } catch (e) {
      return []
    }
  }

  return (
    <div className="adminRoomClient">
      {message && (
        <div className={`notificationAlert ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="adminTabs">
        <button className={activeTab === 'bookings' ? 'active' : ''} onClick={() => setActiveTab('bookings')}>
          คำขอจอง
          {pendingCount > 0 && <span className="tabBadge">{pendingCount}</span>}
        </button>
        <button className={activeTab === 'rooms' ? 'active' : ''} onClick={() => setActiveTab('rooms')}>
          ห้องประชุม
        </button>
        <button className={activeTab === 'equipment' ? 'active' : ''} onClick={() => setActiveTab('equipment')}>
          อุปกรณ์
        </button>
        <button className={activeTab === 'food' ? 'active' : ''} onClick={() => setActiveTab('food')}>
          อาหาร / ของว่าง
        </button>
        <button className={activeTab === 'foodPeriods' ? 'active' : ''} onClick={() => setActiveTab('foodPeriods')}>
          ช่วงเวลาอาหาร
        </button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
          ตั้งค่า
        </button>
      </div>

      <div className="adminTabContent">
        {/* ═══════════════════════════════════════════
            BOOKINGS TAB - Card-based layout
            ═══════════════════════════════════════════ */}
        {activeTab === 'bookings' && (
          <div className="card">
            <div className="bookingsHeaderContainer">
              <h2 className="adminSectionHeading">รายการคำขอจองห้องประชุมทั้งหมด</h2>
              
              <div className="filterToolbar">
                <div className="filterGroup">
                  <label htmlFor="fiscal_year_filter" className="filterLabel">เลือกปีงบประมาณ</label>
                  <select 
                    id="fiscal_year_filter" 
                    value={selectedFiscalYearFilter} 
                    onChange={(e) => setSelectedFiscalYearFilter(e.target.value)}
                    className="filterSelect"
                  >
                    <option value="ALL">แสดงทั้งหมด</option>
                    {uniqueFiscalYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Summary cards for counts */}
            <div className="bookingsSummaryBar">
              <div className="summaryCard total">
                <span className="summaryLabel">รายการคำขอทั้งหมด</span>
                <span className="summaryValue">{totalInYear}</span>
              </div>
              <div className="summaryCard pending">
                <span className="summaryLabel">รอพิจารณา</span>
                <span className="summaryValue">{pendingInYear}</span>
              </div>
              <div className="summaryCard approved">
                <span className="summaryLabel">อนุมัติแล้ว</span>
                <span className="summaryValue">{approvedInYear}</span>
              </div>
              <div className="summaryCard rejected">
                <span className="summaryLabel">ปฏิเสธแล้ว</span>
                <span className="summaryValue">{rejectedInYear}</span>
              </div>
            </div>

            {filteredBookings.length > 0 ? (
              <div className="bookingCardList">
                {filteredBookings.map(b => {
                  const eqItems = parseEquipmentExtras(b.equipment_json)
                  const { items: foodItems, periods: foodPeriodsData } = parseFoodExtras(b.food_json)
                  const hasExtras = eqItems.length > 0 || foodItems.length > 0 || foodPeriodsData.length > 0

                  return (
                    <div key={b.id} className={`bookingCard ${b.status.toLowerCase()}`}>
                      {/* Top Bar: Title & Badge */}
                      <div className="bookingCardHeader">
                        <div className="titleAndStatus">
                          <span className={`bookingStatusBadge ${b.status.toLowerCase()}`}>
                            {b.status === 'APPROVED' ? 'อนุมัติแล้ว' : b.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอพิจารณา'}
                          </span>
                          <h4 className="bookingCardTitle">{b.topic}</h4>
                        </div>
                        
                        <div className="bookingCardActionsTop">
                          <button className="btn-detail" onClick={() => setSelectedBooking(b)}>ดูรายละเอียด</button>
                          {b.status === 'PENDING' && (
                            <>
                              <button className="btn-success" onClick={() => handleAction(b.id, 'APPROVED')}>อนุมัติ</button>
                              <button className="btn-danger" onClick={() => handleAction(b.id, 'REJECTED')}>ปฏิเสธ</button>
                            </>
                          )}
                          <button className="btn-delete" onClick={() => handleDeleteBooking(b.id)}>ลบ</button>
                        </div>
                      </div>

                      <div className="bookingDivider"></div>

                      {/* Content Grid: 3 Clean Columns */}
                      <div className="bookingColumns">
                        {/* Col 1: Meeting Info */}
                        <div className="bookingCol">
                          <h5 className="colHeading">ข้อมูลการใช้งานห้อง</h5>
                          <div className="colField">
                            <span className="fieldLabel">ห้องประชุม:</span>
                            <span className="fieldVal highlight">{b.room_name}</span>
                          </div>
                          <div className="colField">
                            <span className="fieldLabel">วันที่ใช้งาน:</span>
                            <span className="fieldVal">{b.start_date === b.end_date ? formatDate(b.start_date) : `${formatDate(b.start_date)} - ${formatDate(b.end_date)}`}</span>
                          </div>
                          <div className="colField">
                            <span className="fieldLabel">เวลาใช้งาน:</span>
                            <span className="fieldVal">{b.start_time} - {b.end_time} น.</span>
                          </div>
                          <div className="colField">
                            <span className="fieldLabel">ผู้เข้าร่วม:</span>
                            <span className="fieldVal">{b.attendees_count} คน</span>
                          </div>
                        </div>

                        {/* Col 2: Objective & Requester */}
                        <div className="bookingCol">
                          <h5 className="colHeading">วัตถุประสงค์และผู้ขอจอง</h5>
                          <div className="colField">
                            <span className="fieldLabel">วัตถุประสงค์:</span>
                            <span className="fieldVal">{b.objective}</span>
                          </div>
                          <div className="colField">
                            <span className="fieldLabel">กลุ่มเป้าหมาย:</span>
                            <span className="fieldVal">{b.target_group}</span>
                          </div>
                          <div className="colField">
                            <span className="fieldLabel">ผู้จอง:</span>
                            <span className="fieldVal">{b.requester_name} ({b.requester_dept})</span>
                          </div>
                          <div className="colField">
                            <span className="fieldLabel">ปีงบประมาณ:</span>
                            <span className="fieldVal strong">{b.fiscal_year}</span>
                          </div>
                        </div>

                        {/* Col 3: Extras (Equipment/Catering) */}
                        <div className="bookingCol">
                          <h5 className="colHeading">บริการและอุปกรณ์ที่ขอเพิ่ม</h5>
                          {hasExtras ? (
                            <div className="colExtrasContainer">
                              {eqItems.length > 0 && (
                                <div className="extrasSubGroup">
                                  <span className="extrasSubTitle">อุปกรณ์:</span>
                                  <div className="extrasList">
                                    {eqItems.map((eq: any, i: number) => (
                                      <span key={`eq-${i}`} className="cleanExtraItem">
                                        {eq.name} {eq.quantity ? `(${eq.quantity} ชิ้น)` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {foodItems.length > 0 && (
                                <div className="extrasSubGroup">
                                  <span className="extrasSubTitle">อาหาร / ของว่าง:</span>
                                  <div className="extrasList">
                                    {foodItems.map((fd: any, i: number) => (
                                      <span key={`fd-${i}`} className="cleanExtraItem">
                                        {fd.name} {fd.quantity ? `(${fd.quantity} ชิ้น)` : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {foodPeriodsData.length > 0 && (
                                <div className="extrasSubGroup">
                                  <span className="extrasSubTitle">ช่วงเวลาเสิร์ฟ:</span>
                                  <div className="extrasList">
                                    {foodPeriodsData.map((p: any, i: number) => (
                                      <span key={`p-${i}`} className="cleanExtraItem">{p.name}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="noExtrasText">ไม่มีการขออุปกรณ์หรือบริการเพิ่มเติม</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="emptyBookings">
                <span>ไม่พบรายการคำขอจองห้องประชุมในปีงบประมาณนี้</span>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            ROOMS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'rooms' && (
          <div className="managementGrid">
            <div className="card formCard">
              <h3 className="adminSectionHeading">
                {editingRoomId ? 'แก้ไขห้องประชุม' : 'เพิ่มห้องประชุมใหม่'}
              </h3>
              <form onSubmit={handleSaveRoom}>
                <div className="formField">
                  <label htmlFor="room_name_input">ชื่อห้องประชุม</label>
                  <input 
                    type="text" 
                    id="room_name_input"
                    placeholder="เช่น ห้องประชุมทองกวาวชั้น 2" 
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                  />
                </div>
                <div className="formActions" style={{ marginTop: '16px' }}>
                  {editingRoomId && (
                    <button type="button" className="btn btn-outline" onClick={() => { setEditingRoomId(null); setRoomName(''); }}>ยกเลิก</button>
                  )}
                  <button type="submit" className="btn btn-primary">บันทึก</button>
                </div>
              </form>
            </div>

            <div className="card listCard">
              <h3 className="adminSectionHeading">
                รายการห้องประชุม
                <span className="countBadge">{rooms.length} ห้อง</span>
              </h3>
              <div className="itemListGrid">
                {rooms.length > 0 ? rooms.map(room => (
                  <div key={room.id} className="itemRow">
                    <div className="itemRowName">
                      {room.name}
                    </div>
                    <button 
                      className={`toggleStatusBtn ${room.is_active === 1 ? 'active' : ''}`}
                      onClick={() => handleToggleRoomActive(room)}
                    >
                      {room.is_active === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                    <div className="itemRowActions">
                      <button className="btn-edit" onClick={() => { setEditingRoomId(room.id); setRoomName(room.name); }}>แก้ไข</button>
                      <button className="btn-delete" onClick={() => handleDeleteRoom(room.id)}>ลบ</button>
                    </div>
                  </div>
                )) : (
                  <div className="emptyList">ยังไม่มีห้องประชุมในระบบ</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            EQUIPMENT TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'equipment' && (
          <div className="managementGrid">
            <div className="card formCard">
              <h3 className="adminSectionHeading">
                {editingEqId ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}
              </h3>
              <form onSubmit={handleSaveEquipment}>
                <div className="formField">
                  <label htmlFor="eq_name_input">ชื่ออุปกรณ์</label>
                  <input 
                    type="text" 
                    id="eq_name_input"
                    placeholder="เช่น โปรเจคเตอร์, ไมโครโฟนไร้สาย" 
                    value={eqName}
                    onChange={(e) => setEqName(e.target.value)}
                    required
                  />
                </div>
                <div className="formActions" style={{ marginTop: '16px' }}>
                  {editingEqId && (
                    <button type="button" className="btn btn-outline" onClick={() => { setEditingEqId(null); setEqName(''); }}>ยกเลิก</button>
                  )}
                  <button type="submit" className="btn btn-primary">บันทึก</button>
                </div>
              </form>
            </div>

            <div className="card listCard">
              <h3 className="adminSectionHeading">
                รายการอุปกรณ์อำนวยความสะดวก
                <span className="countBadge">{equipment.length} รายการ</span>
              </h3>
              <div className="itemListGrid">
                {equipment.length > 0 ? equipment.map(eq => (
                  <div key={eq.id} className="itemRow">
                    <div className="itemRowName">
                      {eq.name}
                    </div>
                    <div className="itemRowActions">
                      <button className="btn-edit" onClick={() => { setEditingEqId(eq.id); setEqName(eq.name); }}>แก้ไข</button>
                      <button className="btn-delete" onClick={() => handleDeleteEquipment(eq.id)}>ลบ</button>
                    </div>
                  </div>
                )) : (
                  <div className="emptyList">ยังไม่มีอุปกรณ์ในระบบ</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            FOOD CATALOG TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'food' && (
          <div className="managementGrid">
            <div className="card formCard">
              <h3 className="adminSectionHeading">
                {editingFoodId ? 'แก้ไขอาหาร/ของว่าง' : 'เพิ่มอาหาร/ของว่างใหม่'}
              </h3>
              <form onSubmit={handleSaveFood}>
                <div className="formField">
                  <label htmlFor="food_name_input">ชื่อรายการอาหาร/เครื่องดื่ม</label>
                  <input 
                    type="text" 
                    id="food_name_input"
                    placeholder="เช่น ข้าวกล่องกระเพราไก่ไข่ดาว, กาแฟร้อนพร้อมของว่าง" 
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    required
                  />
                </div>
                <div className="formActions" style={{ marginTop: '16px' }}>
                  {editingFoodId && (
                    <button type="button" className="btn btn-outline" onClick={() => { setEditingFoodId(null); setFoodName(''); }}>ยกเลิก</button>
                  )}
                  <button type="submit" className="btn btn-primary">บันทึก</button>
                </div>
              </form>
            </div>

            <div className="card listCard">
              <h3 className="adminSectionHeading">
                รายการอาหาร / ของว่างบริการผู้ประชุม
                <span className="countBadge">{food.length} รายการ</span>
              </h3>
              <div className="itemListGrid">
                {food.length > 0 ? food.map(fd => (
                  <div key={fd.id} className="itemRow">
                    <div className="itemRowName">
                      {fd.name}
                    </div>
                    <div className="itemRowActions">
                      <button className="btn-edit" onClick={() => { setEditingFoodId(fd.id); setFoodName(fd.name); }}>แก้ไข</button>
                      <button className="btn-delete" onClick={() => handleDeleteFood(fd.id)}>ลบ</button>
                    </div>
                  </div>
                )) : (
                  <div className="emptyList">ยังไม่มีรายการอาหารในระบบ</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            FOOD PERIODS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'foodPeriods' && (
          <div className="managementGrid">
            <div className="card formCard">
              <h3 className="adminSectionHeading">
                {editingFoodPeriodId ? 'แก้ไขช่วงเวลาอาหาร' : 'เพิ่มช่วงเวลาอาหารใหม่'}
              </h3>
              <form onSubmit={handleSaveFoodPeriod}>
                <div className="formField">
                  <label htmlFor="food_period_name_input">ชื่อช่วงเวลาอาหาร</label>
                  <input 
                    type="text" 
                    id="food_period_name_input"
                    placeholder="เช่น เบรคเช้า 10:00, มื้อกลางวัน 12:00, เบรคบ่าย 14:30" 
                    value={foodPeriodName}
                    onChange={(e) => setFoodPeriodName(e.target.value)}
                    required
                  />
                </div>
                <div className="formActions" style={{ marginTop: '16px' }}>
                  {editingFoodPeriodId && (
                    <button type="button" className="btn btn-outline" onClick={() => { setEditingFoodPeriodId(null); setFoodPeriodName(''); }}>ยกเลิก</button>
                  )}
                  <button type="submit" className="btn btn-primary">บันทึก</button>
                </div>
              </form>
            </div>

            <div className="card listCard">
              <h3 className="adminSectionHeading">
                ช่วงเวลาสำหรับจัดเสิร์ฟอาหาร/ของว่าง
                <span className="countBadge">{foodPeriods.length} ช่วงเวลา</span>
              </h3>
              <div className="itemListGrid">
                {foodPeriods.length > 0 ? foodPeriods.map(period => (
                  <div key={period.id} className="itemRow">
                    <div className="itemRowName">
                      {period.name}
                    </div>
                    <div className="itemRowActions">
                      <button className="btn-edit" onClick={() => { setEditingFoodPeriodId(period.id); setFoodPeriodName(period.name); }}>แก้ไข</button>
                      <button className="btn-delete" onClick={() => handleDeleteFoodPeriod(period.id)}>ลบ</button>
                    </div>
                  </div>
                )) : (
                  <div className="emptyList">ยังไม่มีช่วงเวลาอาหารในระบบ</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SETTINGS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="card settingsCard">
            <h3 className="adminSectionHeading">
              การตั้งค่าระบบเริ่มต้น
            </h3>
            <form onSubmit={handleSaveSettings}>
              <div className="formField">
                <label htmlFor="fiscal_year_setting">ปีงบประมาณตั้งต้น (สำหรับแสดงในฟอร์มจอง)</label>
                <input 
                  type="text" 
                  id="fiscal_year_setting" 
                  value={defaultFiscalYear}
                  onChange={(e) => setDefaultFiscalYear(e.target.value)}
                  placeholder="เช่น ปีงบประมาณ 2569"
                  required
                />
              </div>
              <div className="formActions" style={{ marginTop: '18px' }}>
                <button type="submit" className="btn btn-primary">บันทึกการตั้งค่า</button>
              </div>
            </form>
          </div>
        )}
      </div>
      {/* ═══════════════════════════════════════════
          DETAIL MODAL
          ═══════════════════════════════════════════ */}
      {selectedBooking && (() => {
        const sb = selectedBooking
        const eqItems = parseEquipmentExtras(sb.equipment_json)
        const { items: foodItems, periods: foodPeriodsData } = parseFoodExtras(sb.food_json)

        return (
          <div className="detailModalOverlay" onClick={() => setSelectedBooking(null)}>
            <div className="detailModalContent" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="detailModalHeader">
                <div>
                  <h2 className="detailModalTitle">{sb.topic}</h2>
                  <span className={`bookingStatusBadge ${sb.status.toLowerCase()}`}>
                    {sb.status === 'APPROVED' ? 'อนุมัติแล้ว' : sb.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอพิจารณา'}
                  </span>
                </div>
                <button className="detailModalClose" onClick={() => setSelectedBooking(null)}>✕</button>
              </div>

              {/* Modal Body */}
              <div className="detailModalBody">
                <div className="detailGrid">
                  <div className="detailGroup">
                    <span className="detailLabel">ห้องประชุม</span>
                    <span className="detailValue highlight">{sb.room_name}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">วันที่จอง</span>
                    <span className="detailValue">{sb.start_date === sb.end_date ? formatDate(sb.start_date) : `${formatDate(sb.start_date)} — ${formatDate(sb.end_date)}`}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">เวลาใช้งาน</span>
                    <span className="detailValue">{sb.start_time} - {sb.end_time} น.</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">ปีงบประมาณ</span>
                    <span className="detailValue">{sb.fiscal_year}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">กลุ่มเป้าหมาย</span>
                    <span className="detailValue">{sb.target_group}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">จำนวนผู้เข้าร่วม</span>
                    <span className="detailValue">{sb.attendees_count} คน</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">วัตถุประสงค์</span>
                    <span className="detailValue">{sb.objective}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">ผู้จอง</span>
                    <span className="detailValue">{sb.requester_name}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">หน่วยงาน</span>
                    <span className="detailValue">{sb.requester_dept}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">เบอร์ติดต่อ</span>
                    <span className="detailValue">{sb.contact_number}</span>
                  </div>
                  <div className="detailGroup">
                    <span className="detailLabel">วันที่ส่งคำขอ</span>
                    <span className="detailValue">{formatDate(sb.created_at)}</span>
                  </div>
                </div>

                {/* Details / Remarks */}
                {sb.details && (
                  <div className="detailSection">
                    <h4 className="detailSectionTitle">รายละเอียดเพิ่มเติม / หมายเหตุ</h4>
                    <p className="detailText">{sb.details}</p>
                  </div>
                )}

                {/* Equipment */}
                {eqItems.length > 0 && (
                  <div className="detailSection">
                    <h4 className="detailSectionTitle">อุปกรณ์ที่ต้องการ</h4>
                    <div className="detailTagList">
                      {eqItems.map((eq: any, i: number) => (
                        <span key={i} className="extraTag eq">
                          {eq.name} {eq.quantity ? `(${eq.quantity} ชิ้น)` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Food */}
                {foodItems.length > 0 && (
                  <div className="detailSection">
                    <h4 className="detailSectionTitle">รายการอาหาร / ของว่าง</h4>
                    <div className="detailTagList">
                      {foodItems.map((fd: any, i: number) => (
                        <span key={i} className="extraTag food">
                          {fd.name} {fd.quantity ? `(${fd.quantity} ชิ้น)` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Periods */}
                {foodPeriodsData.length > 0 && (
                  <div className="detailSection">
                    <h4 className="detailSectionTitle">ช่วงเวลาจัดเสิร์ฟ</h4>
                    <div className="detailTagList">
                      {foodPeriodsData.map((p: any, i: number) => (
                        <span key={i} className="extraTag period">{p.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="detailModalFooter">
                {sb.status === 'PENDING' && (
                  <>
                    <button className="btn-success" onClick={() => { handleAction(sb.id, 'APPROVED'); setSelectedBooking(null); }}>อนุมัติ</button>
                    <button className="btn-danger" onClick={() => { handleAction(sb.id, 'REJECTED'); setSelectedBooking(null); }}>ปฏิเสธ</button>
                  </>
                )}
                <button className="btn-delete" onClick={() => { handleDeleteBooking(sb.id); setSelectedBooking(null); }}>ลบ</button>
                <button className="detailModalCloseBtn" onClick={() => setSelectedBooking(null)}>ปิดหน้าต่าง</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
