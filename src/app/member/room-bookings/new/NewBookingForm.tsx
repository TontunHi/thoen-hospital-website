'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Room {
  id: number
  name: string
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

interface NewBookingFormProps {
  rooms: Room[]
  equipment: Equipment[]
  food: Food[]
  foodPeriods: { id: number; name: string }[]
  defaultFiscalYear: string
}

export default function NewBookingForm({ rooms, equipment, food, foodPeriods, defaultFiscalYear }: NewBookingFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [topic, setTopic] = useState('')
  const [targetGroup, setTargetGroup] = useState('')
  const [roomId, setRoomId] = useState(rooms[0]?.id || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('08:30')
  const [endTime, setEndTime] = useState('16:30')
  const [details, setDetails] = useState('')
  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear)
  const [attendeesCount, setAttendeesCount] = useState('')
  const [objective, setObjective] = useState('ประชุม')
  const [otherObjective, setOtherObjective] = useState('')
  const [contactNumber, setContactNumber] = useState('')

  // Equipment picker state
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([])
  const [equipmentQuantities, setEquipmentQuantities] = useState<Record<number, number>>({})
  const [currentSelectEq, setCurrentSelectEq] = useState<string>('')

  // Food picker state
  const [selectedFoodIds, setSelectedFoodIds] = useState<number[]>([])
  const [foodQuantities, setFoodQuantities] = useState<Record<number, number>>({})
  const [currentSelectFood, setCurrentSelectFood] = useState<string>('')

  // Food periods picker state
  const [selectedFoodPeriodIds, setSelectedFoodPeriodIds] = useState<number[]>([])
  const [currentSelectPeriod, setCurrentSelectPeriod] = useState<string>('')

  // Tab state for additional services
  const [extrasTab, setExtrasTab] = useState<'equipment' | 'food'>('equipment')

  // Equipment handlers
  const handleAddEquipment = () => {
    if (!currentSelectEq) return
    const id = parseInt(currentSelectEq)
    if (!selectedEquipmentIds.includes(id)) {
      setSelectedEquipmentIds([...selectedEquipmentIds, id])
      setEquipmentQuantities(prev => ({ ...prev, [id]: 1 }))
    }
    setCurrentSelectEq('')
  }

  const handleRemoveEquipment = (id: number) => {
    setSelectedEquipmentIds(selectedEquipmentIds.filter((eqId) => eqId !== id))
    setEquipmentQuantities(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const handleUpdateEquipmentQty = (id: number, qty: number) => {
    if (qty < 1) return
    setEquipmentQuantities(prev => ({ ...prev, [id]: qty }))
  }

  // Food handlers
  const handleAddFood = () => {
    if (!currentSelectFood) return
    const id = parseInt(currentSelectFood)
    if (!selectedFoodIds.includes(id)) {
      setSelectedFoodIds([...selectedFoodIds, id])
      setFoodQuantities(prev => ({ ...prev, [id]: 1 }))
    }
    setCurrentSelectFood('')
  }

  const handleRemoveFood = (id: number) => {
    setSelectedFoodIds(selectedFoodIds.filter((fId) => fId !== id))
    setFoodQuantities(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const handleUpdateFoodQty = (id: number, qty: number) => {
    if (qty < 1) return
    setFoodQuantities(prev => ({ ...prev, [id]: qty }))
  }

  // Food period handlers
  const handleAddPeriod = () => {
    if (!currentSelectPeriod) return
    const id = parseInt(currentSelectPeriod)
    if (!selectedFoodPeriodIds.includes(id)) {
      setSelectedFoodPeriodIds([...selectedFoodPeriodIds, id])
    }
    setCurrentSelectPeriod('')
  }

  const handleRemovePeriod = (id: number) => {
    setSelectedFoodPeriodIds(selectedFoodPeriodIds.filter((pId) => pId !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const finalObjective = objective === 'อื่นๆ' ? `อื่นๆ (${otherObjective})` : objective

    const equipment_json = selectedEquipmentIds
      .map((id) => {
        const item = equipment.find((e) => e.id === id)
        const qty = equipmentQuantities[id] || 1
        if (item) return { id, name: item.name, quantity: qty }
        return null
      })
      .filter(Boolean)

    const foodItems = selectedFoodIds
      .map((id) => {
        const item = food.find((f) => f.id === id)
        const qty = foodQuantities[id] || 1
        if (item) return { id, name: item.name, quantity: qty }
        return null
      })
      .filter(Boolean)

    const foodPeriodsSelected = selectedFoodPeriodIds
      .map((id) => {
        const item = foodPeriods.find((p) => p.id === id)
        if (item) return { id, name: item.name }
        return null
      })
      .filter(Boolean)

    const food_json = {
      items: foodItems,
      periods: foodPeriodsSelected
    }

    try {
      const res = await fetch('/api/member/room-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          target_group: targetGroup,
          room_id: parseInt(roomId as string),
          start_date: startDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
          details,
          fiscal_year: fiscalYear,
          attendees_count: parseInt(attendeesCount) || 0,
          objective: finalObjective,
          contact_number: contactNumber,
          equipment_json,
          food_json
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการจองห้องประชุม')
      }

      router.push('/member/room-bookings')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter available items (exclude already-selected ones from dropdown)
  const availableEquipment = equipment.filter((e) => !selectedEquipmentIds.includes(e.id))
  const availableFood = food.filter((f) => !selectedFoodIds.includes(f.id))
  const availablePeriods = foodPeriods.filter((p) => !selectedFoodPeriodIds.includes(p.id))

  return (
    <form className="bookingForm card" onSubmit={handleSubmit}>
      {error && <div className="errorAlert">⚠️ {error}</div>}

      {/* ─── Section 1: Meeting Info ─── */}
      <div className="formSection">
        <h3>
          <span className="sectionIcon teal">📋</span>
          ข้อมูลการประชุม
        </h3>
        <div className="formGrid">
          <div className="formField col-2">
            <label htmlFor="topic">เรื่องการประชุม <span className="required">*</span></label>
            <input
              type="text"
              id="topic"
              placeholder="กรอกเรื่อง/หัวข้อที่จะประชุม"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </div>

          <div className="formField col-2">
            <label htmlFor="target_group">กลุ่มบุคคลเป้าหมาย <span className="required">*</span></label>
            <input
              type="text"
              id="target_group"
              placeholder="เช่น อสม., คณะทำงานพัฒนาคุณภาพ รพ., บุคลากรทางการแพทย์"
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="room_id">ต้องการใช้ห้อง <span className="required">*</span></label>
            <select
              id="room_id"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </div>

          <div className="formField">
            <label htmlFor="fiscal_year">ปีงบประมาณ <span className="required">*</span></label>
            <input
              type="text"
              id="fiscal_year"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="attendees_count">จำนวนผู้เข้าประชุม (คน) <span className="required">*</span></label>
            <input
              type="number"
              id="attendees_count"
              placeholder="ระบุจำนวนผู้เข้าร่วม"
              value={attendeesCount}
              onChange={(e) => setAttendeesCount(e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="contact_number">เบอร์ติดต่อภายใน/มือถือ <span className="required">*</span></label>
            <input
              type="text"
              id="contact_number"
              placeholder="ระบุเบอร์ติดต่อด่วน"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="objective">วัตถุประสงค์การขอใช้ <span className="required">*</span></label>
            <select
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              required
            >
              <option value="ประชุม">ประชุม</option>
              <option value="อบรม">อบรม</option>
              <option value="สัมมนา">สัมมนา</option>
              <option value="อื่นๆ">อื่นๆ (ระบุด้านล่าง)</option>
            </select>
          </div>

          {objective === 'อื่นๆ' && (
            <div className="formField">
              <label htmlFor="other_objective">ระบุวัตถุประสงค์อื่นๆ <span className="required">*</span></label>
              <input
                type="text"
                id="other_objective"
                placeholder="ระบุวัตถุประสงค์เพิ่มเติม"
                value={otherObjective}
                onChange={(e) => setOtherObjective(e.target.value)}
                required
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Section 2: Date & Time ─── */}
      <div className="formSection">
        <h3>
          <span className="sectionIcon blue">⏰</span>
          วันและเวลาการจอง
        </h3>
        <div className="formGrid">
          <div className="formField">
            <label htmlFor="start_date">ตั้งแต่วันที่ <span className="required">*</span></label>
            <input
              type="date"
              id="start_date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="end_date">ถึงวันที่ <span className="required">*</span></label>
            <input
              type="date"
              id="end_date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="start_time">เวลาเริ่มต้น <span className="required">*</span></label>
            <input
              type="time"
              id="start_time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="end_time">เวลาสิ้นสุด <span className="required">*</span></label>
            <input
              type="time"
              id="end_time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* ─── Tabbed Section: Additional Services & Extras ─── */}
      <div className="formSection extrasSection">
        <h3>
          <span className="sectionIcon orange">✨</span>
          บริการและอุปกรณ์เพิ่มเติม (เลือกเพิ่มเติม)
        </h3>
        
        <div className="extrasTabBar" style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', gap: '8px' }}>
          <button
            type="button"
            className={`extrasTabBtn ${extrasTab === 'equipment' ? 'active' : ''}`}
            onClick={() => setExtrasTab('equipment')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: extrasTab === 'equipment' ? '3px solid #0d9488' : '3px solid transparent',
              color: extrasTab === 'equipment' ? '#0d9488' : '#64748b',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.92rem',
              transition: 'all 0.2s',
              outline: 'none'
            }}
          >
            🛠️ อุปกรณ์โสตทัศนูปกรณ์
            {selectedEquipmentIds.length > 0 && (
              <span className="tabCounter" style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                {selectedEquipmentIds.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`extrasTabBtn ${extrasTab === 'food' ? 'active' : ''}`}
            onClick={() => setExtrasTab('food')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: extrasTab === 'food' ? '3px solid #0d9488' : '3px solid transparent',
              color: extrasTab === 'food' ? '#0d9488' : '#64748b',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.92rem',
              transition: 'all 0.2s',
              outline: 'none'
            }}
          >
            🍱 อาหาร / ของว่าง และช่วงเวลาจัดเสิร์ฟ
            {(selectedFoodIds.length > 0 || selectedFoodPeriodIds.length > 0) && (
              <span className="tabCounter" style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                {selectedFoodIds.length + selectedFoodPeriodIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Equipment */}
        {extrasTab === 'equipment' && (
          <div className="tabContent" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
            {equipment.length > 0 ? (
              <div className="pickerSection">
                <p className="pickerDescription">เลือกอุปกรณ์โสตทัศนูปกรณ์ที่ต้องการใช้งานเพิ่มเติม แล้วกด "เพิ่ม"</p>
                <div className="pickerSelector">
                  <select
                    value={currentSelectEq}
                    onChange={(e) => setCurrentSelectEq(e.target.value)}
                    id="eq_picker_select"
                  >
                    <option value="">-- เลือกอุปกรณ์ --</option>
                    {availableEquipment.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="pickerAddBtn"
                    onClick={handleAddEquipment}
                    disabled={!currentSelectEq}
                  >
                    ＋ เพิ่ม
                  </button>
                </div>

                <div className="pickerList">
                  {selectedEquipmentIds.length > 0 ? (
                    selectedEquipmentIds.map((id) => {
                      const item = equipment.find((e) => e.id === id)
                      if (!item) return null
                      const qty = equipmentQuantities[id] || 1
                      return (
                        <div key={id} className="pickerItem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div className="pickerItemName" style={{ flex: 1 }}>
                            <span className="pickerItemIcon eq">🔧</span>
                            {item.name}
                          </div>
                          <div className="quantitySelector" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateEquipmentQty(id, qty - 1)}
                              disabled={qty <= 1}
                              style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: qty <= 1 ? 'not-allowed' : 'pointer' }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1
                                handleUpdateEquipmentQty(id, val < 1 ? 1 : val)
                              }}
                              style={{ width: '50px', textAlign: 'center', padding: '2px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                              min="1"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateEquipmentQty(id, qty + 1)}
                              style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer' }}
                            >
                              +
                            </button>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>ชิ้น</span>
                          </div>
                          <button
                            type="button"
                            className="pickerRemoveBtn"
                            onClick={() => handleRemoveEquipment(id)}
                            title="ลบรายการ"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div className="pickerEmpty">📦 ยังไม่ได้เลือกอุปกรณ์โสตทัศนูปกรณ์ใดๆ</div>
                  )}
                </div>
              </div>
            ) : (
              <p className="noCatalogText">ไม่มีรายการอุปกรณ์ให้เลือกเพิ่มเติมในระบบ</p>
            )}
          </div>
        )}

        {/* Tab 2: Food & Snack + Serving Periods (Combined in same tab) */}
        {extrasTab === 'food' && (
          <div className="tabContent foodPeriodGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'fadeSlideIn 0.3s ease' }}>
            {/* Food selection */}
            <div className="foodSubsection">
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>🍱 รายการอาหาร / ของว่าง</h4>
              {food.length > 0 ? (
                <div className="pickerSection">
                  <p className="pickerDescription">เลือกรายการอาหารหรือของว่างที่ต้องการ แล้วกด "เพิ่ม"</p>
                  <div className="pickerSelector">
                    <select
                      value={currentSelectFood}
                      onChange={(e) => setCurrentSelectFood(e.target.value)}
                      id="food_picker_select"
                    >
                      <option value="">-- เลือกรายการอาหาร / ของว่าง --</option>
                      {availableFood.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="pickerAddBtn"
                      onClick={handleAddFood}
                      disabled={!currentSelectFood}
                    >
                      ＋ เพิ่ม
                    </button>
                  </div>

                  <div className="pickerList">
                    {selectedFoodIds.length > 0 ? (
                      selectedFoodIds.map((id) => {
                        const item = food.find((f) => f.id === id)
                        if (!item) return null
                        const qty = foodQuantities[id] || 1
                        return (
                          <div key={id} className="pickerItem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="pickerItemName" style={{ flex: 1 }}>
                              <span className="pickerItemIcon food">🍽️</span>
                              {item.name}
                            </div>
                            <div className="quantitySelector" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateFoodQty(id, qty - 1)}
                                disabled={qty <= 1}
                                style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: qty <= 1 ? 'not-allowed' : 'pointer' }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={qty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1
                                  handleUpdateFoodQty(id, val < 1 ? 1 : val)
                                }}
                                style={{ width: '50px', textAlign: 'center', padding: '2px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                min="1"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFoodQty(id, qty + 1)}
                                style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer' }}
                              >
                                +
                              </button>
                              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>ชิ้น</span>
                            </div>
                            <button
                              type="button"
                              className="pickerRemoveBtn"
                              onClick={() => handleRemoveFood(id)}
                              title="ลบรายการ"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="pickerEmpty">🍱 ยังไม่ได้เลือกรายการอาหารใดๆ</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="noCatalogText">ไม่มีรายการอาหาร / ของว่างในระบบ</p>
              )}
            </div>

            {/* Serving periods selection */}
            <div className="periodSubsection">
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>🕐 ช่วงเวลาที่ต้องการให้จัดเสิร์ฟ</h4>
              {foodPeriods.length > 0 ? (
                <div className="pickerSection">
                  <p className="pickerDescription">เลือกช่วงเวลาที่ต้องการให้จัดเสิร์ฟ แล้วกด "เพิ่ม"</p>
                  <div className="pickerSelector">
                    <select
                      value={currentSelectPeriod}
                      onChange={(e) => setCurrentSelectPeriod(e.target.value)}
                      id="period_picker_select"
                    >
                      <option value="">-- เลือกช่วงเวลา --</option>
                      {availablePeriods.map((period) => (
                        <option key={period.id} value={period.id}>{period.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="pickerAddBtn"
                      onClick={handleAddPeriod}
                      disabled={!currentSelectPeriod}
                    >
                      ＋ เพิ่ม
                    </button>
                  </div>

                  <div className="pickerList">
                    {selectedFoodPeriodIds.length > 0 ? (
                      selectedFoodPeriodIds.map((id) => {
                        const period = foodPeriods.find((p) => p.id === id)
                        if (!period) return null
                        return (
                          <div key={id} className="pickerItem">
                            <div className="pickerItemName">
                              <span className="pickerItemIcon period">⏰</span>
                              {period.name}
                            </div>
                            <button
                              type="button"
                              className="pickerRemoveBtn"
                              onClick={() => handleRemovePeriod(id)}
                              title="ลบรายการ"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="pickerEmpty">🕐 ยังไม่ได้เลือกช่วงเวลาใดๆ</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="noCatalogText">ไม่มีรายการช่วงเวลาอาหารในระบบ</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 6: Additional Details ─── */}
      <div className="formSection">
        <h3>
          <span className="sectionIcon teal">📝</span>
          รายละเอียดเพิ่มเติม / หมายเหตุ
        </h3>
        <div className="formField col-2">
          <textarea
            id="details"
            rows={4}
            placeholder="ข้อมูลหรือข้อกำหนดอื่นๆ เพิ่มเติมเกี่ยวกับการจัดห้องประชุม"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Form Actions ─── */}
      <div className="formActions">
        <Link href="/member/room-bookings" className="btn btn-outline">
          ยกเลิก
        </Link>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : '💾 ยืนยันการส่งคำขอจอง'}
        </button>
      </div>
    </form>
  )
}
