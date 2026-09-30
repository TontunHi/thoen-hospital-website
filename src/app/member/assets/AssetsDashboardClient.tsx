'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  ArrowLeft,
  Edit2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Monitor,
  HeartPulse,
  Wrench,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  Building,
  Loader2,
  Calendar,
  DollarSign
} from 'lucide-react'
import './assets.css'

interface AssetStats {
  totalAssets: number
  activeWarrantyCount: number
  expiredWarrantyCount: number
  itCount: number
  medicalCount: number
  generalCount: number
  inRepairCount: number
}

interface LocationItem {
  id: number
  room_name: string
  floor_id: number
  floor_name: string
  building_id: number
  building_name: string
  full_name: string
}

interface HospitalAssetItem {
  id: number
  articleNum: string
  fsnNum: string | null
  name: string
  brand: string | null
  model: string | null
  serialNo: string | null
  category: 'IT' | 'MEDICAL' | 'GENERAL'
  department: string | null
  locationId?: number | null
  locationFullName: string | null
  receivedDate: string | null
  warrantyStartDate: string | null
  warrantyEndDate: string | null
  expireDate: string | null
  price: number | null
  vendorName: string | null
  vendorContact: string | null
  contractNo: string | null
  status: 'ACTIVE' | 'IN_REPAIR' | 'STANDBY' | 'DISPOSED'
  notes: string | null
  createdAt: string
}

interface AssetsDashboardClientProps {
  initialStats: AssetStats
  currentUser: {
    username: string
    name: string
    role: string
  }
}

export default function AssetsDashboardClient({
  initialStats,
  currentUser,
}: AssetsDashboardClientProps) {
  const [stats, setStats] = useState<AssetStats>(initialStats)
  const [assets, setAssets] = useState<HospitalAssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [warrantyStatus, setWarrantyStatus] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [sortBy, setSortBy] = useState('receivedDate')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Location Hierarchy State
  const [locationsList, setLocationsList] = useState<LocationItem[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  const [selectedFloorId, setSelectedFloorId] = useState<string>('')
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [isCustomLocation, setIsCustomLocation] = useState(false)

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<HospitalAssetItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HospitalAssetItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Notification Toast
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showNotify = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // Form State
  const [formData, setFormData] = useState({
    articleNum: '',
    fsnNum: '',
    name: '',
    brand: '',
    model: '',
    serialNo: '',
    category: 'GENERAL' as 'IT' | 'MEDICAL' | 'GENERAL',
    department: '',
    locationId: null as number | null,
    locationFullName: '',
    receivedDate: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    expireDate: '',
    price: '',
    vendorName: '',
    vendorContact: '',
    contractNo: '',
    status: 'ACTIVE' as 'ACTIVE' | 'IN_REPAIR' | 'STANDBY' | 'DISPOSED',
    notes: '',
  })

  // Fetch Assets List
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        category,
        warrantyStatus,
        status,
        sortBy,
        sortOrder,
      })
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/member/assets?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setAssets(json.data || [])
        setTotalPages(json.pagination?.totalPages || 1)
        setTotalCount(json.pagination?.total || 0)
      } else {
        showNotify('ไม่สามารถดึงข้อมูลครุภัณฑ์ได้', 'error')
      }
    } catch (err: any) {
      showNotify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, category, warrantyStatus, status, search, sortBy, sortOrder])

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/member/assets/stats')
      if (res.ok) {
        const json = await res.json()
        if (json.data) setStats(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  // Fetch Locations on Mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations?limit=500')
        if (res.ok) {
          const json = await res.json()
          if (json.data) setLocationsList(json.data)
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err)
      }
    }
    fetchLocations()
  }, [])

  // Unique Buildings
  const buildingOptions = React.useMemo(() => {
    const map = new Map<number, string>()
    locationsList.forEach((loc) => {
      if (loc.building_id && loc.building_name) {
        map.set(loc.building_id, loc.building_name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [locationsList])

  // Floors for Selected Building
  const floorOptions = React.useMemo(() => {
    if (!selectedBuildingId) return []
    const bId = Number(selectedBuildingId)
    const map = new Map<number, string>()
    locationsList
      .filter((loc) => loc.building_id === bId)
      .forEach((loc) => {
        if (loc.floor_id !== undefined && loc.floor_name) {
          map.set(loc.floor_id, loc.floor_name)
        }
      })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [locationsList, selectedBuildingId])

  // Rooms for Selected Building & Floor
  const roomOptions = React.useMemo(() => {
    if (!selectedBuildingId) return []
    const bId = Number(selectedBuildingId)
    return locationsList.filter((loc) => {
      if (loc.building_id !== bId) return false
      if (selectedFloorId && loc.floor_id !== Number(selectedFloorId)) return false
      return true
    })
  }, [locationsList, selectedBuildingId, selectedFloorId])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // Handle Sync GTW
  const handleSyncGtw = async () => {
    if (!window.confirm('ต้องการซิงค์ข้อมูลครุภัณฑ์จากระบบ GTW ใช่หรือไม่?')) return
    setSyncing(true)
    try {
      const res = await fetch('/api/member/assets/sync-gtw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (res.ok) {
        showNotify(json.message || 'ซิงค์ข้อมูลสำเร็จ')
        fetchAssets()
        fetchStats()
      } else {
        showNotify(json.error || 'เกิดข้อผิดพลาดในการซิงค์', 'error')
      }
    } catch (err: any) {
      showNotify(err.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Open Create/Edit Modal
  const handleOpenCreateModal = () => {
    setEditingAsset(null)
    setSelectedBuildingId('')
    setSelectedFloorId('')
    setSelectedRoomId('')
    setIsCustomLocation(false)
    setFormData({
      articleNum: '',
      fsnNum: '',
      name: '',
      brand: '',
      model: '',
      serialNo: '',
      category: 'GENERAL',
      department: '',
      locationId: null,
      locationFullName: '',
      receivedDate: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
      expireDate: '',
      price: '',
      vendorName: '',
      vendorContact: '',
      contractNo: '',
      status: 'ACTIVE',
      notes: '',
    })
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (asset: HospitalAssetItem) => {
    setEditingAsset(asset)
    setFormData({
      articleNum: asset.articleNum || '',
      fsnNum: asset.fsnNum || '',
      name: asset.name || '',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNo: asset.serialNo || '',
      category: asset.category || 'GENERAL',
      department: asset.department || '',
      locationId: asset.locationId || null,
      locationFullName: asset.locationFullName || '',
      receivedDate: asset.receivedDate ? asset.receivedDate.split('T')[0] : '',
      warrantyStartDate: asset.warrantyStartDate ? asset.warrantyStartDate.split('T')[0] : '',
      warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.split('T')[0] : '',
      expireDate: asset.expireDate ? asset.expireDate.split('T')[0] : '',
      price: asset.price ? String(asset.price) : '',
      vendorName: asset.vendorName || '',
      vendorContact: asset.vendorContact || '',
      contractNo: asset.contractNo || '',
      status: asset.status || 'ACTIVE',
      notes: asset.notes || '',
    })

    // Match location from locationsList
    if (asset.locationId) {
      const loc = locationsList.find((l) => l.id === asset.locationId)
      if (loc) {
        setSelectedBuildingId(String(loc.building_id))
        setSelectedFloorId(String(loc.floor_id))
        setSelectedRoomId(String(loc.id))
        setIsCustomLocation(false)
        setIsFormModalOpen(true)
        return
      }
    }

    if (asset.locationFullName) {
      const matched = locationsList.find(
        (l) => l.full_name === asset.locationFullName || l.room_name === asset.locationFullName
      )
      if (matched) {
        setSelectedBuildingId(String(matched.building_id))
        setSelectedFloorId(String(matched.floor_id))
        setSelectedRoomId(String(matched.id))
        setIsCustomLocation(false)
      } else {
        setSelectedBuildingId('')
        setSelectedFloorId('')
        setSelectedRoomId('')
        setIsCustomLocation(true)
      }
    } else {
      setSelectedBuildingId('')
      setSelectedFloorId('')
      setSelectedRoomId('')
      setIsCustomLocation(false)
    }

    setIsFormModalOpen(true)
  }

  // Submit Create / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.articleNum.trim() || !formData.name.trim()) {
      showNotify('กรุณากรอกเลขครุภัณฑ์และชื่อครุภัณฑ์', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingAsset ? `/api/member/assets/${editingAsset.id}` : '/api/member/assets'
      const method = editingAsset ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const json = await res.json()
      if (res.ok) {
        showNotify(json.message || 'บันทึกข้อมูลเรียบร้อยแล้ว')
        setIsFormModalOpen(false)
        fetchAssets()
        fetchStats()
      } else {
        showNotify(json.error || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
      }
    } catch (err: any) {
      showNotify(err.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/member/assets/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok) {
        showNotify(json.message || 'ลบข้อมูลเรียบร้อยแล้ว')
        setDeleteTarget(null)
        fetchAssets()
        fetchStats()
      } else {
        showNotify(json.error || 'เกิดข้อผิดพลาดในการลบ', 'error')
      }
    } catch (err: any) {
      showNotify(err.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Helper Check Warranty Status
  const isUnderWarranty = (asset: HospitalAssetItem) => {
    const now = new Date()
    if (asset.warrantyEndDate) {
      return new Date(asset.warrantyEndDate) >= now
    }
    if (asset.expireDate) {
      return new Date(asset.expireDate) >= now
    }
    return false
  }

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="assetAdminContainer">
      <div className="assetAdminWrapper">
        {/* Toast Notification */}
        {notification && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 100,
              background: notification.type === 'success' ? '#059669' : '#dc2626',
              color: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Header */}
        <div className="assetHeaderCard">
          <div className="assetHeaderLeft">
            <div className="assetIconBadge">
              <Package size={28} />
            </div>
            <div className="assetTitleArea">
              <h1>ระบบจัดการข้อมูลครุภัณฑ์</h1>
              <p>ทะเบียนครุภัณฑ์โรงพยาบาลเถิน ตรวจสอบสถานะการรับประกัน และเชื่อมโยงระบบแจ้งซ่อม</p>
            </div>
          </div>
          <div className="assetHeaderActions">
            <button
              className="assetSyncBtn"
              onClick={handleSyncGtw}
              disabled={syncing}
              title="ดึงข้อมูลล่าสุดจากฐานข้อมูล GTW"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'กำลังซิงค์ GTW...' : 'ซิงค์ข้อมูลจาก GTW'}</span>
            </button>
            <button className="assetPrimaryBtn" onClick={handleOpenCreateModal}>
              <Plus size={16} />
              <span>เพิ่มครุภัณฑ์</span>
            </button>
            <Link href="/member" className="assetBackBtn">
              <ArrowLeft size={16} />
              <span>กลับหน้าสมาชิก</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="assetStatsGrid">
          <div className="assetStatCard">
            <div className="assetStatIcon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <Package size={24} />
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">ครุภัณฑ์ทั้งหมด</span>
              <span className="assetStatValue">{stats.totalAssets.toLocaleString()} ชิ้น</span>
            </div>
          </div>

          <div className="assetStatCard">
            <div className="assetStatIcon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <ShieldCheck size={24} />
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">อยู่ในระยะประกัน</span>
              <span className="assetStatValue" style={{ color: '#059669' }}>
                {stats.activeWarrantyCount.toLocaleString()} ชิ้น
              </span>
            </div>
          </div>

          <div className="assetStatCard">
            <div className="assetStatIcon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <Monitor size={24} />
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">คอมพิวเตอร์ & IT</span>
              <span className="assetStatValue">{stats.itCount.toLocaleString()} ชิ้น</span>
            </div>
          </div>

          <div className="assetStatCard">
            <div className="assetStatIcon" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <HeartPulse size={24} />
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">เครื่องมือแพทย์</span>
              <span className="assetStatValue">{stats.medicalCount.toLocaleString()} ชิ้น</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="assetFilterCard">
          <div className="assetFilterRow">
            <div className="assetSearchWrapper">
              <Search size={18} className="assetSearchIcon" />
              <input
                type="text"
                className="assetSearchInput"
                placeholder="ค้นหาเลขครุภัณฑ์, ชื่อรายการ, รุ่น, S/N หรือแผนก..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            <select
              className="assetSelect"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">ทุกหมวดหมู่</option>
              <option value="IT">คอมพิวเตอร์ & IT</option>
              <option value="MEDICAL">เครื่องมือแพทย์</option>
              <option value="GENERAL">ครุภัณฑ์ทั่วไป/สำนักงาน</option>
            </select>

            <select
              className="assetSelect"
              value={warrantyStatus}
              onChange={(e) => {
                setWarrantyStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">สถานะประกันทั้งหมด</option>
              <option value="ACTIVE">อยู่ในระยะประกัน (Active)</option>
              <option value="EXPIRED">หมดประกันแล้ว</option>
            </select>

            <select
              className="assetSelect"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">สถานะเครื่องทั้งหมด</option>
              <option value="ACTIVE">ใช้งานปกติ (Active)</option>
              <option value="IN_REPAIR">กำลังส่งซ่อม (In Repair)</option>
              <option value="STANDBY">เครื่องสำรอง (Standby)</option>
              <option value="DISPOSED">แทงจำหน่าย (Disposed)</option>
            </select>

            <select
              className="assetSelect"
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'receivedDate_desc') {
                  setSortBy('receivedDate')
                  setSortOrder('desc')
                } else if (val === 'receivedDate_asc') {
                  setSortBy('receivedDate')
                  setSortOrder('asc')
                } else if (val === 'createdAt_desc') {
                  setSortBy('createdAt')
                  setSortOrder('desc')
                } else if (val === 'warrantyEndDate_asc') {
                  setSortBy('warrantyEndDate')
                  setSortOrder('asc')
                } else if (val === 'price_desc') {
                  setSortBy('price')
                  setSortOrder('desc')
                } else if (val === 'articleNum_asc') {
                  setSortBy('articleNum')
                  setSortOrder('asc')
                }
                setPage(1)
              }}
            >
              <option value="receivedDate_desc">เรียงจาก: วันตรวจรับพัสดุ (ใหม่ ➔ เก่า)</option>
              <option value="receivedDate_asc">เรียงจาก: วันตรวจรับพัสดุ (เก่า ➔ ใหม่)</option>
              <option value="createdAt_desc">เรียงจาก: วันที่นำเข้าระบบล่าสุด (ID ล่าสุด)</option>
              <option value="warrantyEndDate_asc">เรียงจาก: วันประกันใกล้หมดอายุ</option>
              <option value="price_desc">เรียงจาก: ราคาสูง ➔ ต่ำ</option>
              <option value="articleNum_asc">เรียงตาม: เลขครุภัณฑ์ (0-9 / ก-ฮ)</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="assetTableCard">
          <div className="assetTableContainer">
            <table className="assetTable">
              <thead>
                <tr>
                  <th>เลขครุภัณฑ์ / FSN</th>
                  <th>ชื่อรายการ / รุ่น</th>
                  <th>หมวดหมู่</th>
                  <th>แผนก / ที่ตั้ง</th>
                  <th>สถานะประกัน</th>
                  <th>วันที่ตรวจรับ</th>
                  <th>สถานะเครื่อง</th>
                  <th style={{ textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#0284c7' }} />
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>กำลังโหลดข้อมูลครุภัณฑ์...</p>
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Package size={40} style={{ margin: '0 auto 0.5rem', color: '#94a3b8' }} />
                      <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 0.25rem' }}>ไม่พบข้อมูลครุภัณฑ์</p>
                      <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        ลองเปลี่ยนคำค้นหา หรือกดปุ่ม <strong>"ซิงค์ข้อมูลจาก GTW"</strong> เพื่อนำเข้าข้อมูล
                      </p>
                    </td>
                  </tr>
                ) : (
                  assets.map((item) => {
                    const underWarranty = isUnderWarranty(item)
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="assetNumCell">
                            <span>{item.articleNum}</span>
                            {item.fsnNum && <span className="assetFsnSub">FSN: {item.fsnNum}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="assetNameCell">{item.name}</div>
                          {(item.brand || item.model || item.serialNo) && (
                            <div className="assetModelSub">
                              {[item.brand, item.model, item.serialNo ? `S/N: ${item.serialNo}` : null]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                          )}
                        </td>
                        <td>
                          {item.category === 'IT' && <span className="badge badgeCategoryIt">IT & Network</span>}
                          {item.category === 'MEDICAL' && <span className="badge badgeCategoryMedical">เครื่องมือแพทย์</span>}
                          {item.category === 'GENERAL' && <span className="badge badgeCategoryGeneral">ครุภัณฑ์ทั่วไป</span>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.department || '-'}</div>
                          {item.locationFullName && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.locationFullName}</div>
                          )}
                        </td>
                        <td>
                          {underWarranty ? (
                            <span className="badge badgeWarrantyActive">
                              <ShieldCheck size={12} />
                              <span>ในประกัน ({formatThaiDate(item.warrantyEndDate || item.expireDate)})</span>
                            </span>
                          ) : (
                            <span className="badge badgeWarrantyExpired">
                              <span>หมดประกัน</span>
                            </span>
                          )}
                        </td>
                        <td>{formatThaiDate(item.receivedDate)}</td>
                        <td>
                          {item.status === 'ACTIVE' && <span className="badge badgeStatusActive">พร้อมใช้งาน</span>}
                          {item.status === 'IN_REPAIR' && <span className="badge badgeStatusRepair">กำลังซ่อม</span>}
                          {item.status === 'STANDBY' && <span className="badge badgeCategoryGeneral">สำรอง</span>}
                          {item.status === 'DISPOSED' && <span className="badge badgeStatusDisposed">แทงจำหน่าย</span>}
                        </td>
                        <td>
                          <div className="actionBtnGroup" style={{ justifyContent: 'center' }}>
                            <button
                              className="actionIconBtn edit"
                              onClick={() => handleOpenEditModal(item)}
                              title="แก้ไขข้อมูลครุภัณฑ์"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="actionIconBtn delete"
                              onClick={() => setDeleteTarget(item)}
                              title="ลบข้อมูลครุภัณฑ์"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && assets.length > 0 && (
            <div className="assetPagination">
              <span>
                แสดงรายการที่ {(page - 1) * 20 + 1} - {Math.min(page * 20, totalCount)} จากทั้งหมด {totalCount.toLocaleString()} รายการ
              </span>
              <div className="paginationBtnGroup">
                <button
                  className="paginationBtn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} />
                  <span>ก่อนหน้า</span>
                </button>
                <span style={{ margin: '0 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                  หน้า {page} / {totalPages}
                </span>
                <button
                  className="paginationBtn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Create / Edit */}
        {isFormModalOpen && (
          <div className="modalBackdrop" onClick={() => !isSubmitting && setIsFormModalOpen(false)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <h3>{editingAsset ? 'แก้ไขข้อมูลครุภัณฑ์' : 'เพิ่มข้อมูลครุภัณฑ์ใหม่'}</h3>
                <button
                  className="modalCloseBtn"
                  onClick={() => !isSubmitting && setIsFormModalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmitForm} className="modalForm">
                <div className="modalBody">
                  <div className="formGrid2">
                    <div className="formGroup">
                      <label>เลขครุภัณฑ์ *</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="เช่น 7440-013-0007/154/69"
                        value={formData.articleNum}
                        onChange={(e) => setFormData({ ...formData, articleNum: e.target.value })}
                        required
                      />
                    </div>
                    <div className="formGroup">
                      <label>รหัสกลุ่ม FSN</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="เช่น 7440-013-0007"
                        value={formData.fsnNum}
                        onChange={(e) => setFormData({ ...formData, fsnNum: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>ชื่อครุภัณฑ์ *</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น คอมพิวเตอร์ประมวลผลแบบที่ 2"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGrid2">
                    <div className="formGroup">
                      <label>ยี่ห้อ (Brand)</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="เช่น HP, Dell, Epson"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>รุ่น (Model)</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="เช่น ProDesk 400 G7"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="formGrid2">
                    <div className="formGroup">
                      <label>Serial Number (S/N)</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="หมายเลขเครื่องจากผู้ผลิต"
                        value={formData.serialNo}
                        onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>หมวดหมู่งาน</label>
                      <select
                        className="formSelect"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      >
                        <option value="GENERAL">ครุภัณฑ์ทั่วไป / สำนักงาน</option>
                        <option value="IT">คอมพิวเตอร์ & IT</option>
                        <option value="MEDICAL">เครื่องมือแพทย์</option>
                      </select>
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>แผนก / หน่วยงานที่ครอบครอง</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น งานเทคโนโลยีสารสนเทศ, ห้องฉุกเฉิน, งานพัสดุ"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>

                  {/* Location Selector (Building -> Floor -> Room) */}
                  <div className="formGroup" style={{ marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a', fontWeight: 600 }}>
                        <Building size={16} color="#0284c7" />
                        <span>สถานที่ติดตั้ง (ตึก ➔ ชั้น ➔ ห้อง)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isCustomLocation
                          setIsCustomLocation(next)
                          if (next) {
                            setSelectedBuildingId('')
                            setSelectedFloorId('')
                            setSelectedRoomId('')
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {isCustomLocation ? '← เลือกจากรายการ ตึก/ชั้น/ห้อง' : '✏️ พิมพ์ระบุเอง'}
                      </button>
                    </div>

                    {!isCustomLocation ? (
                      <div className="locationSelectGrid">
                        {/* 1. Building */}
                        <select
                          className="formSelect"
                          value={selectedBuildingId}
                          onChange={(e) => {
                            const bId = e.target.value
                            setSelectedBuildingId(bId)
                            setSelectedFloorId('')
                            setSelectedRoomId('')
                            if (!bId) {
                              setFormData((prev) => ({ ...prev, locationId: null, locationFullName: '' }))
                            }
                          }}
                        >
                          <option value="">-- เลือกตึก / อาคาร --</option>
                          {buildingOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>

                        {/* 2. Floor */}
                        <select
                          className="formSelect"
                          value={selectedFloorId}
                          disabled={!selectedBuildingId}
                          onChange={(e) => {
                            const fId = e.target.value
                            setSelectedFloorId(fId)
                            setSelectedRoomId('')
                          }}
                        >
                          <option value="">-- เลือกชั้น --</option>
                          {floorOptions.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        {/* 3. Room */}
                        <select
                          className="formSelect"
                          value={selectedRoomId}
                          disabled={!selectedBuildingId}
                          onChange={(e) => {
                            const rId = e.target.value
                            setSelectedRoomId(rId)
                            if (rId) {
                              const loc = locationsList.find((l) => String(l.id) === rId)
                              if (loc) {
                                setFormData((prev) => ({
                                  ...prev,
                                  locationId: loc.id,
                                  locationFullName: loc.full_name,
                                }))
                              }
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                locationId: null,
                                locationFullName: '',
                              }))
                            }
                          }}
                        >
                          <option value="">-- เลือกห้อง / จุดติดตั้ง --</option>
                          {roomOptions.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.room_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="formInput"
                        placeholder="เช่น อาคารผู้ป่วยนอก ชั้น 2 (ห้องศูนย์คอม) หรือ จุดติดตั้งพิเศษ"
                        value={formData.locationFullName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            locationId: null,
                            locationFullName: e.target.value,
                          }))
                        }
                      />
                    )}

                    {formData.locationFullName && (
                      <div className="locationPreview">
                        <CheckCircle2 size={14} />
                        <span>
                          สถานที่ระบุ: <strong>{formData.locationFullName}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="formGrid2">
                    <div className="formGroup">
                      <label>วันที่ตรวจรับ</label>
                      <input
                        type="date"
                        className="formInput"
                        value={formData.receivedDate}
                        onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>วันหมดประกัน (Warranty End)</label>
                      <input
                        type="date"
                        className="formInput"
                        value={formData.warrantyEndDate}
                        onChange={(e) => setFormData({ ...formData, warrantyEndDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="formGrid2">
                    <div className="formGroup">
                      <label>ราคาจัดซื้อ (บาท)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="formInput"
                        placeholder="0.00"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>สถานะเครื่อง</label>
                      <select
                        className="formSelect"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="ACTIVE">พร้อมใช้งาน (Active)</option>
                        <option value="IN_REPAIR">กำลังส่งซ่อม (In Repair)</option>
                        <option value="STANDBY">เครื่องสำรอง (Standby)</option>
                        <option value="DISPOSED">แทงจำหน่าย (Disposed)</option>
                      </select>
                    </div>
                  </div>

                  <div className="formGrid2">
                    <div className="formGroup">
                      <label>บริษัทผู้ขาย / ผู้จำหน่าย</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="ชื่อบริษัทหรือร้านค้า"
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>เบอร์โทรติดต่อช่างศูนย์ / เคลม</label>
                      <input
                        type="text"
                        className="formInput"
                        placeholder="เช่น 02-xxx-xxxx หรือ 08x-xxx-xxxx"
                        value={formData.vendorContact}
                        onChange={(e) => setFormData({ ...formData, vendorContact: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="formGroup">
                    <label>หมายเหตุเพิ่มเติม</label>
                    <textarea
                      className="formTextarea"
                      placeholder="บันทึกข้อมูลเพิ่มเติมหรือข้อสังเกต..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modalFooter">
                  <button
                    type="button"
                    className="modalCancelBtn"
                    onClick={() => setIsFormModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    ยกเลิก
                  </button>
                  <button type="submit" className="modalSubmitBtn" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                    <span>{editingAsset ? 'บันทึกการแก้ไข' : 'เพิ่มครุภัณฑ์'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteTarget && (
          <div className="modalBackdrop" onClick={() => !isDeleting && setDeleteTarget(null)}>
            <div className="modalContent" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} />
                  <span>ยืนยันการลบครุภัณฑ์</span>
                </h3>
                <button
                  className="modalCloseBtn"
                  onClick={() => !isDeleting && setDeleteTarget(null)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modalBody">
                <p style={{ color: '#334155', fontSize: '0.95rem', margin: 0, wordBreak: 'break-word' }}>
                  คุณต้องการลบข้อมูลครุภัณฑ์ <strong>"{deleteTarget.name}"</strong> (เลขครุภัณฑ์:{' '}
                  <code style={{ wordBreak: 'break-all' }}>{deleteTarget.articleNum}</code>) ใช่หรือไม่?
                </p>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                  การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>
              <div className="modalFooter">
                <button
                  type="button"
                  className="modalCancelBtn"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.6rem',
                    border: 'none',
                    background: '#dc2626',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {isDeleting && <Loader2 size={16} className="animate-spin" />}
                  <span>ลบข้อมูล</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
