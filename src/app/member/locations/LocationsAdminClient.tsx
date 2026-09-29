'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  Layers, 
  MapPin, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  Filter,
  Check,
  X,
  Edit2,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react'

interface LocationItem {
  id: number
  room_name: string
  floor_id: number
  floor_name: string
  building_id: number
  building_name: string
  full_name: string
  is_active: number | boolean
  updated_at: string
}

interface BuildingOption {
  building_id: number
  building_name: string
}

interface BuildingFloorOption {
  building_id: number
  building_name: string
  floor_id: number
  floor_name: string
}

export default function LocationsAdminClient({ sessionUser }: { sessionUser: any }) {
  const [items, setItems] = useState<LocationItem[]>([])
  const [buildings, setBuildings] = useState<BuildingOption[]>([])
  const [buildingFloors, setBuildingFloors] = useState<BuildingFloorOption[]>([])
  const [stats, setStats] = useState({ totalCount: 0, activeCount: 0, buildingCount: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  
  const [search, setSearch] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Quick inline edit room name state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRoomName, setEditRoomName] = useState('')

  // Modal State for Add & Full Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [saving, setSaving] = useState(false)
  const [isCustomBuilding, setIsCustomBuilding] = useState(false)
  const [isCustomFloor, setIsCustomFloor] = useState(false)
  const [formData, setFormData] = useState({
    id: 0,
    room_name: '',
    building_name: '',
    building_id: 0,
    floor_name: '',
    floor_id: 0,
    is_active: true,
  })

  // Delete Confirmation State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<LocationItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Compute available floors list for currently selected building
  const availableFloorsForBuilding = React.useMemo(() => {
    const defaultFloors = ['ชั้น 1', 'ชั้น 2', 'ชั้น 3', 'ชั้น 4', 'ชั้น 5', 'ชั้น 6', 'ชั้น โรงพยาบาล']
    if (!formData.building_id) return defaultFloors
    const matched = buildingFloors
      .filter(bf => bf.building_id === formData.building_id)
      .map(bf => bf.floor_name)
    const combined = Array.from(new Set([...matched, ...defaultFloors]))
    return combined.length > 0 ? combined : defaultFloors
  }, [formData.building_id, buildingFloors])

  const fetchLocations = async (targetPage = page) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(targetPage))
      params.set('limit', '30')
      if (search) params.set('search', search)
      if (buildingFilter) params.set('buildingId', buildingFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/locations?${params.toString()}`)
      const data = await res.json()
      if (data.success && data.data) {
        setItems(data.data.items || [])
        setBuildings(data.data.buildings || [])
        setBuildingFloors(data.data.buildingFloors || [])
        setStats(data.data.stats || { totalCount: 0, activeCount: 0, buildingCount: 0 })
        setTotal(data.data.total || 0)
        setTotalPages(data.data.totalPages || 1)
        setPage(data.data.page || 1)
      } else {
        setError(data.error || 'ไม่สามารถโหลดข้อมูลสถานที่ได้')
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations(1)
  }, [buildingFilter, statusFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchLocations(1)
  }



  const handleToggleActive = async (item: LocationItem) => {
    const newStatus = !item.is_active
    try {
      const res = await fetch('/api/admin/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setItems((prev) =>
          prev.map((loc) => (loc.id === item.id ? { ...loc, is_active: newStatus } : loc))
        )
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveInlineEdit = async (id: number) => {
    if (!editRoomName.trim()) return
    try {
      const res = await fetch('/api/admin/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, room_name: editRoomName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingId(null)
        await fetchLocations(page)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create')
    setIsCustomBuilding(false)
    setIsCustomFloor(false)
    const firstBuilding = buildings[0]
    const matchedFloor = buildingFloors.find(bf => bf.building_id === firstBuilding?.building_id)
    setFormData({
      id: 0,
      room_name: '',
      building_name: firstBuilding ? firstBuilding.building_name : '',
      building_id: firstBuilding ? firstBuilding.building_id : 0,
      floor_name: matchedFloor ? matchedFloor.floor_name : 'ชั้น 1',
      floor_id: matchedFloor ? matchedFloor.floor_id : 0,
      is_active: true,
    })
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (item: LocationItem) => {
    setModalMode('edit')
    const hasExistingBuilding = buildings.some(b => b.building_id === item.building_id)
    setIsCustomBuilding(!hasExistingBuilding)
    setIsCustomFloor(false)

    setFormData({
      id: item.id,
      room_name: item.room_name,
      building_name: item.building_name,
      building_id: item.building_id,
      floor_name: item.floor_name,
      floor_id: item.floor_id,
      is_active: Boolean(item.is_active),
    })
    setIsModalOpen(true)
  }

  // Submit Modal (Create or Edit)
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.room_name.trim()) {
      alert('กรุณาระบุชื่อห้อง / หน่วยงาน')
      return
    }
    if (!formData.building_name.trim()) {
      alert('กรุณาระบุหรือเลือกอาคาร / ตึก')
      return
    }
    if (!formData.floor_name.trim()) {
      alert('กรุณาระบุหรือเลือกชั้น')
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/admin/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_name: formData.room_name.trim(),
            building_name: formData.building_name.trim(),
            building_id: formData.building_id,
            floor_name: formData.floor_name.trim(),
            floor_id: formData.floor_id,
            is_active: formData.is_active,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setMessage('เพิ่มข้อมูลสถานที่เรียบร้อยแล้ว')
          setIsModalOpen(false)
          await fetchLocations(1)
        } else {
          alert(data.error || 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล')
        }
      } else {
        // Edit Mode
        const res = await fetch('/api/admin/locations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: formData.id,
            room_name: formData.room_name.trim(),
            building_name: formData.building_name.trim(),
            building_id: formData.building_id,
            floor_name: formData.floor_name.trim(),
            floor_id: formData.floor_id,
            is_active: formData.is_active,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setMessage('บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว')
          setIsModalOpen(false)
          await fetchLocations(page)
        } else {
          alert(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        }
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์')
    } finally {
      setSaving(false)
    }
  }

  // Handle Delete
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/locations?id=${deleteConfirmItem.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message)
        setDeleteConfirmItem(null)
        await fetchLocations(page)
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการลบข้อมูล')
      }
    } catch (err) {
      alert('ไม่สามารถลบข้อมูลได้')
    } finally {
      setDeleting(false)
    }
  }

  // Handle building select change inside modal
  const handleModalBuildingChange = (buildingIdStr: string) => {
    const bId = Number(buildingIdStr)
    const selectedB = buildings.find(b => b.building_id === bId)
    if (selectedB) {
      const matchedFloors = buildingFloors.filter(bf => bf.building_id === bId)
      const firstF = matchedFloors[0]
      setFormData(prev => ({
        ...prev,
        building_id: selectedB.building_id,
        building_name: selectedB.building_name,
        floor_id: firstF ? firstF.floor_id : 0,
        floor_name: firstF ? firstF.floor_name : 'ชั้น 1',
      }))
    }
  }

  return (
    <div className="locAdminWrapper">
      {/* ── Header ── */}
      <div className="locHeaderCard">
        <div className="locHeaderLeft">
          <div className="locIconBadge">
            <Building2 size={28} />
          </div>
          <div className="locTitleArea">
            <h1>จัดการสถานที่ ตึก-ชั้น-ห้อง (Hospital Locations)</h1>
            <p>ฐานข้อมูลสถานที่ภายในโรงพยาบาลเถินสำหรับใช้งานในระบบแจ้งซ่อมและกล่องงาน</p>
          </div>
        </div>

        <div className="locHeaderActions">
          <Link href="/member" className="backBtn">
            <ArrowLeft size={16} />
            กลับหน้าโปรไฟล์
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="addBtn"
          >
            <Plus size={16} />
            เพิ่มสถานที่ใหม่
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {message && (
        <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#065f46' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <XCircle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Stats Overview ── */}
      <div className="locStatsRow">
        <div className="locStatCard">
          <div className="locStatIcon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <MapPin size={22} />
          </div>
          <div>
            <div className="locStatNum">{stats.totalCount}</div>
            <div className="locStatText">ห้อง / สถานที่ทั้งหมด</div>
          </div>
        </div>

        <div className="locStatCard">
          <div className="locStatIcon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="locStatNum">{stats.activeCount}</div>
            <div className="locStatText">เปิดใช้งานในระบบ</div>
          </div>
        </div>

        <div className="locStatCard">
          <div className="locStatIcon" style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div className="locStatNum">{stats.buildingCount}</div>
            <div className="locStatText">อาคาร / ตึกทั้งหมด</div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="locFilterCard">
        <form onSubmit={handleSearchSubmit} className="locSearchWrap">
          <Search size={16} className="locSearchIcon" />
          <input
            type="text"
            className="locSearchInput"
            placeholder="ค้นหาชื่อห้อง, ตึก, ชั้น (เช่น OPD, บัตร, ผู้ป่วยนอก)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <select
          className="locSelect"
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
        >
          <option value="">ทุกอาคาร / ตึก ({buildings.length})</option>
          {buildings.map((b) => (
            <option key={b.building_id} value={b.building_id}>
              {b.building_name}
            </option>
          ))}
        </select>

        <select
          className="locSelect"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">ทุกสถานะการใช้งาน</option>
          <option value="active">เปิดใช้งาน (Active)</option>
          <option value="inactive">ปิดใช้งาน (Inactive)</option>
        </select>

        <button type="submit" onClick={() => fetchLocations(1)} className="backBtn" title="ค้นหา">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          ค้นหา
        </button>
      </div>

      {/* ── Locations Table Card ── */}
      <div className="locTableCard">
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={32} className="animate-spin text-emerald-600 mx-auto mb-2" />
            <p>กำลังค้นหาข้อมูลสถานที่...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <MapPin size={40} className="mx-auto text-gray-400 mb-2" />
            <p>ไม่พบข้อมูลสถานที่ที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="locTable">
              <thead>
                <tr>
                  <th style={{ width: '7%' }}>ID</th>
                  <th style={{ width: '20%' }}>อาคาร / ตึก</th>
                  <th style={{ width: '10%' }}>ชั้น</th>
                  <th style={{ width: '24%' }}>ชื่อห้อง / หน่วยงาน</th>
                  <th style={{ width: '18%' }}>ชื่อสถานที่เต็ม</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>สถานะ</th>
                  <th style={{ width: '11%', textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((loc) => {
                  const isActive = Boolean(loc.is_active)
                  const isInlineEditing = editingId === loc.id

                  return (
                    <tr key={loc.id} className="locRow">
                      <td style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.85rem' }}>
                        #{loc.id}
                      </td>
                      <td>
                        <span className="buildingTag">{loc.building_name}</span>
                      </td>
                      <td>
                        <span className="floorTag">{loc.floor_name}</span>
                      </td>
                      <td>
                        {isInlineEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="text"
                              value={editRoomName}
                              onChange={(e) => setEditRoomName(e.target.value)}
                              style={{ padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #059669', fontSize: '0.85rem', width: '150px' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(loc.id)}
                              style={{ border: 'none', background: '#059669', color: 'white', borderRadius: '0.25rem', padding: '0.25rem 0.4rem', cursor: 'pointer' }}
                              title="บันทึก"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              style={{ border: 'none', background: '#e2e8f0', color: '#475569', borderRadius: '0.25rem', padding: '0.25rem 0.4rem', cursor: 'pointer' }}
                              title="ยกเลิก"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <strong style={{ color: '#0f172a' }}>{loc.room_name}</strong>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(loc.id)
                                setEditRoomName(loc.room_name)
                              }}
                              style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                              title="แก้ไขชื่อห้องด่วน"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.825rem' }}>
                        {loc.full_name}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(loc)}
                          className={`toggleActiveBtn ${isActive ? 'active' : 'inactive'}`}
                          title={isActive ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 size={13} />
                              <span>เปิด</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={13} />
                              <span>ปิด</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(loc)}
                            className="actionIconBtn edit"
                            title="แก้ไขข้อมูลสถานที่ทั้งหมด"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmItem(loc)}
                            className="actionIconBtn delete"
                            title="ลบสถานที่"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="paginationRow">
          <div>
            แสดงหน้า {page} จาก {totalPages} (ทั้งหมด {total} รายการ)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="pageBtn"
              disabled={page <= 1}
              onClick={() => fetchLocations(page - 1)}
            >
              ย้อนกลับ
            </button>
            <button
              type="button"
              className="pageBtn"
              disabled={page >= totalPages}
              onClick={() => fetchLocations(page + 1)}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {isModalOpen && (
        <div className="locModalOverlay" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="locModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="locModalHeader">
              <div>
                <h3>
                  {modalMode === 'create' ? <Plus size={20} color="#2563eb" /> : <Edit2 size={20} color="#059669" />}
                  {modalMode === 'create' ? 'เพิ่มสถานที่ใหม่' : `แก้ไขข้อมูลสถานที่`}
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  {modalMode === 'create' ? 'กำหนดอาคาร ชั้น และชื่อห้อง เพื่อนำไปใช้ในระบบโรงพยาบาล' : `รหัสสถานที่ #${formData.id}`}
                </p>
              </div>
              <button
                type="button"
                className="locModalCloseBtn"
                onClick={() => !saving && setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="locModalBody">
                {/* 1. Building Section */}
                <div className="locFormGroup">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>อาคาร / ตึก <span style={{ color: '#dc2626' }}>*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextIsCustom = !isCustomBuilding
                        setIsCustomBuilding(nextIsCustom)
                        if (nextIsCustom) {
                          setFormData(prev => ({ ...prev, building_id: 0, building_name: '' }))
                        } else {
                          const firstB = buildings[0]
                          if (firstB) handleModalBuildingChange(String(firstB.building_id))
                        }
                      }}
                      style={{ border: 'none', background: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                      {isCustomBuilding ? '← เลือกจากรายชื่ออาคารที่มี' : '+ ระบุชื่ออาคารใหม่'}
                    </button>
                  </div>

                  {!isCustomBuilding ? (
                    <select
                      className="locModalSelect"
                      value={formData.building_id || ''}
                      onChange={(e) => handleModalBuildingChange(e.target.value)}
                    >
                      <option value="">-- เลือกอาคาร / ตึก ({buildings.length} แห่ง) --</option>
                      {buildings.map((b) => (
                        <option key={b.building_id} value={b.building_id}>
                          {b.building_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="locInput"
                      placeholder="พิมพ์ชื่ออาคารใหม่ (เช่น อาคาร 60 พรรษา, แฟลตพยาบาลใหม่)..."
                      value={formData.building_name}
                      onChange={(e) => setFormData({ ...formData, building_name: e.target.value, building_id: 0 })}
                      required
                      autoFocus
                    />
                  )}
                </div>

                {/* 2. Floor Section */}
                <div className="locFormGroup">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>ชั้น <span style={{ color: '#dc2626' }}>*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextIsCustom = !isCustomFloor
                        setIsCustomFloor(nextIsCustom)
                        if (nextIsCustom) {
                          setFormData(prev => ({ ...prev, floor_id: 0, floor_name: '' }))
                        } else {
                          const currentFloors = buildingFloors.filter(bf => bf.building_id === formData.building_id)
                          const firstF = currentFloors[0]
                          setFormData(prev => ({ ...prev, floor_name: firstF ? firstF.floor_name : 'ชั้น 1', floor_id: firstF ? firstF.floor_id : 0 }))
                        }
                      }}
                      style={{ border: 'none', background: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                      {isCustomFloor ? '← เลือกจากชั้นที่มี' : '+ ระบุชื่อชั้นเอง'}
                    </button>
                  </div>

                  {!isCustomFloor ? (
                    <select
                      className="locModalSelect"
                      value={formData.floor_name || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const matched = buildingFloors.find(bf => (formData.building_id ? bf.building_id === formData.building_id : true) && bf.floor_name === val)
                        setFormData({
                          ...formData,
                          floor_name: val,
                          floor_id: matched ? matched.floor_id : 0
                        })
                      }}
                    >
                      {/* Priority floors list */}
                      {availableFloorsForBuilding.map(f => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="locInput"
                      placeholder="เช่น ชั้นใต้ดิน, ชั้นลอย, ชั้นดาดฟ้า..."
                      value={formData.floor_name}
                      onChange={(e) => setFormData({ ...formData, floor_name: e.target.value, floor_id: 0 })}
                      required
                    />
                  )}
                </div>

                {/* 3. Room Name */}
                <div className="locFormGroup">
                  <label>ชื่อห้อง / หน่วยงาน <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    className="locInput"
                    placeholder="เช่น ห้องตรวจ 1, ห้องจ่ายยา, กลุ่มงานดิจิทัลฯ..."
                    value={formData.room_name}
                    onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.775rem', color: '#94a3b8' }}>ระบุชื่อห้องหรือจุดบริการให้กระชับและเข้าใจง่าย</span>
                </div>

                {/* 4. Live Preview Banner */}
                <div className="locPreviewBanner">
                  <div style={{ fontSize: '0.785rem', fontWeight: 600, color: '#047857', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={14} /> ตัวอย่างชื่อสถานที่เต็มที่จะแสดงในระบบ:
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    {formData.building_name || '...'} {formData.floor_name || '...'} ({formData.room_name || '...'})
                  </div>
                </div>

                {/* 5. Status Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>เปิดใช้งานในระบบ</div>
                    <div style={{ fontSize: '0.775rem', color: '#64748b' }}>อนุญาตให้บุคลากรเลือกสถานที่นี้ในแบบฟอร์มแจ้งซ่อม / กล่องงาน</div>
                  </div>
                  <label className="switchToggle">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span className="switchSlider"></span>
                  </label>
                </div>
              </div>

              <div className="locModalFooter">
                <button
                  type="button"
                  className="locCancelBtn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="locSaveBtn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      {modalMode === 'create' ? 'เพิ่มสถานที่' : 'บันทึกการแก้ไข'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmItem && (
        <div className="locModalOverlay" onClick={() => !deleting && setDeleteConfirmItem(null)}>
          <div className="locModalCard" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="locModalHeader" style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
              <h3 style={{ color: '#dc2626' }}>
                <AlertTriangle size={20} color="#dc2626" />
                ยืนยันการลบสถานที่
              </h3>
              <button
                type="button"
                className="locModalCloseBtn"
                onClick={() => !deleting && setDeleteConfirmItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="locModalBody">
              <p style={{ color: '#475569', fontSize: '0.925rem', lineHeight: 1.6, margin: 0 }}>
                คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่นี้ออกจากระบบ?
              </p>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>รหัส: #{deleteConfirmItem.id}</div>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{deleteConfirmItem.full_name}</strong>
              </div>
              <p style={{ color: '#ef4444', fontSize: '0.825rem', margin: '0.5rem 0 0 0' }}>
                * การลบข้อมูลนี้จะมีผลทันทีและไม่สามารถกู้คืนได้ (หากต้องการเพียงระงับชั่วคราว ให้เลือกปิดใช้งานแทน)
              </p>
            </div>

            <div className="locModalFooter">
              <button
                type="button"
                className="locCancelBtn"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deleting}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '0.6rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    ยืนยันลบ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
