'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Copy,
  Check,
  Filter,
  DollarSign,
  Calendar,
  Layers,
  MapPin,
  Tag
} from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'
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
  const [category, setCategory] = useState<'ALL' | 'IT' | 'MEDICAL' | 'GENERAL'>('ALL')
  const [warrantyStatus, setWarrantyStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL')
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'IN_REPAIR' | 'STANDBY' | 'DISPOSED'>('ALL')
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

  // Clipboard copy state
  const [copiedArticleNum, setCopiedArticleNum] = useState<string | null>(null)

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<HospitalAssetItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HospitalAssetItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedArticleNum(text)
      addToast(`คัดลอก ${label} เรียบร้อยแล้ว`, 'success')
      setTimeout(() => {
        setCopiedArticleNum((prev) => (prev === text ? null : prev))
      }, 2000)
    } catch {
      addToast('ไม่สามารถคัดลอกข้อความได้', 'error')
    }
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
        addToast('ไม่สามารถดึงข้อมูลครุภัณฑ์ได้', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error')
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
  const buildingOptions = useMemo(() => {
    const map = new Map<number, string>()
    locationsList.forEach((loc) => {
      if (loc.building_id && loc.building_name) {
        map.set(loc.building_id, loc.building_name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [locationsList])

  // Floors for Selected Building
  const floorOptions = useMemo(() => {
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
  const roomOptions = useMemo(() => {
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
        addToast(json.message || 'ซิงค์ข้อมูลจาก GTW สำเร็จ', 'success')
        fetchAssets()
        fetchStats()
      } else {
        addToast(json.error || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error')
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
      addToast('กรุณากรอกเลขครุภัณฑ์และชื่อครุภัณฑ์', 'error')
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
        addToast(json.message || 'บันทึกข้อมูลครุภัณฑ์เรียบร้อยแล้ว', 'success')
        setIsFormModalOpen(false)
        fetchAssets()
        fetchStats()
      } else {
        addToast(json.error || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error')
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
        addToast(json.message || 'ลบข้อมูลครุภัณฑ์เรียบร้อยแล้ว', 'success')
        setDeleteTarget(null)
        fetchAssets()
        fetchStats()
      } else {
        addToast(json.error || 'เกิดข้อผิดพลาดในการลบ', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error')
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

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-'
    return Number(price).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' บาท'
  }

  const hasActiveFilters = Boolean(
    search || category !== 'ALL' || warrantyStatus !== 'ALL' || status !== 'ALL'
  )

  const handleResetFilters = () => {
    setSearch('')
    setCategory('ALL')
    setWarrantyStatus('ALL')
    setStatus('ALL')
    setPage(1)
  }

  return (
    <div className="assetAdminContainer">
      <div className="assetAdminWrapper">
        {/* Header Card */}
        <header className="assetHeaderCard">
          <div className="assetHeaderTop">
            <Link href="/member" className="assetBackBtn">
              <ArrowLeft size={16} />
              <span>กลับสู่ศูนย์ควบคุมสมาชิก</span>
            </Link>

            <div className="assetHeaderBadges">
              <div className="assetSystemBadge" title="ระบบจัดการทะเบียนครุภัณฑ์และตรวจรับพัสดุ">
                <span className="assetLiveDot" aria-hidden="true"></span>
                <span>ระบบจัดการข้อมูลครุภัณฑ์ • โรงพยาบาลเถิน</span>
              </div>
            </div>
          </div>

          <div className="assetHeaderMain">
            <div className="assetHeaderLeft">
              <div className="assetIconBadge" aria-hidden="true">
                <Package size={24} />
              </div>
              <div className="assetTitleArea">
                <div className="assetTitleRow">
                  <h1>ระบบจัดการข้อมูลครุภัณฑ์</h1>
                </div>
                <p>
                  ทะเบียนและตรวจสอบสถานะครุภัณฑ์โรงพยาบาลเถิน ตรวจสอบระยะเวลารับประกัน 
                  สถานที่ติดตั้ง โครงสร้างอาคาร และเชื่อมโยงประวัติงานซ่อมบำรุง
                </p>
              </div>
            </div>

            <div className="assetHeaderActions">
              <button
                type="button"
                className="assetSyncBtn"
                onClick={handleSyncGtw}
                disabled={syncing || loading}
                title="ดึงข้อมูลครุภัณฑ์ล่าสุดจากฐานข้อมูลระบบ GTW"
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'กำลังซิงค์ GTW...' : 'ซิงค์ข้อมูลจาก GTW'}</span>
              </button>

              <button
                type="button"
                className="assetPrimaryBtn"
                onClick={handleOpenCreateModal}
              >
                <Plus size={16} />
                <span>เพิ่มครุภัณฑ์ใหม่</span>
              </button>
            </div>
          </div>
        </header>

        {/* Stats KPI Dashboard Grid */}
        <section className="assetStatsGrid" aria-label="สถิติครุภัณฑ์โรงพยาบาล">
          {/* Card 1: Total */}
          <div className="assetStatCard">
            <div className="assetStatCardHeader">
              <div className="assetStatIconWrapper statIconTotal" aria-hidden="true">
                <Package size={18} />
              </div>
              <span className="assetStatBadge">ทะเบียนทั้งหมด</span>
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">ครุภัณฑ์ทั้งหมด (Total Assets)</span>
              <span className="assetStatValue">{stats.totalAssets.toLocaleString()}</span>
              <span className="assetStatSubtext">
                IT: {stats.itCount} • แพทย์: {stats.medicalCount} • ทั่วไป: {stats.generalCount}
              </span>
            </div>
          </div>

          {/* Card 2: Active Warranty */}
          <div className="assetStatCard">
            <div className="assetStatCardHeader">
              <div className="assetStatIconWrapper statIconWarranty" aria-hidden="true">
                <ShieldCheck size={18} />
              </div>
              <span className="assetStatBadge assetStatBadgeSuccess">พร้อมเคลมประกัน</span>
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">อยู่ในระยะรับประกัน (In Warranty)</span>
              <span className="assetStatValue" style={{ color: '#047857' }}>
                {stats.activeWarrantyCount.toLocaleString()}
              </span>
              <span className="assetStatSubtext">
                {stats.expiredWarrantyCount.toLocaleString()} รายการหมดระยะประกันแล้ว
              </span>
            </div>
          </div>

          {/* Card 3: IT Assets */}
          <div className="assetStatCard">
            <div className="assetStatCardHeader">
              <div className="assetStatIconWrapper statIconIt" aria-hidden="true">
                <Monitor size={18} />
              </div>
              <span className="assetStatBadge">คอมพิวเตอร์ & IT</span>
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">อุปกรณ์ IT & เครือข่าย (IT Assets)</span>
              <span className="assetStatValue">{stats.itCount.toLocaleString()}</span>
              <span className="assetStatSubtext">
                คอมพิวเตอร์, เซิร์ฟเวอร์, ปริ้นเตอร์ และสวิตช์
              </span>
            </div>
          </div>

          {/* Card 4: Medical Equipment */}
          <div className="assetStatCard">
            <div className="assetStatCardHeader">
              <div className="assetStatIconWrapper statIconMedical" aria-hidden="true">
                <HeartPulse size={18} />
              </div>
              <span className="assetStatBadge">เครื่องมือแพทย์</span>
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">เครื่องมือแพทย์ (Medical)</span>
              <span className="assetStatValue">{stats.medicalCount.toLocaleString()}</span>
              <span className="assetStatSubtext">
                อุปกรณ์การแพทย์ช่วยชีวิตและตรวจรักษา
              </span>
            </div>
          </div>

          {/* Card 5: In Repair */}
          <div className="assetStatCard">
            <div className="assetStatCardHeader">
              <div className="assetStatIconWrapper statIconRepair" aria-hidden="true">
                <Wrench size={18} />
              </div>
              <span className="assetStatBadge assetStatBadgeAmber">ส่งซ่อมบำรุง</span>
            </div>
            <div className="assetStatContent">
              <span className="assetStatLabel">อยู่ระหว่างส่งซ่อม (In Repair)</span>
              <span className="assetStatValue" style={{ color: '#b45309' }}>
                {stats.inRepairCount.toLocaleString()}
              </span>
              <span className="assetStatSubtext">
                ประสานงานช่างและรอตรวจรับคืนงานซ่อม
              </span>
            </div>
          </div>
        </section>

        {/* Filter Card & Segmented Category Pills */}
        <section className="assetFilterCard" aria-label="ตัวกรองและค้นหาครุภัณฑ์">
          {/* Segmented Category Tabs */}
          <div className="assetCategoryTabsRow">
            <span className="assetCategoryTabsLabel">
              <Filter size={14} />
              <span>หมวดหมู่ครุภัณฑ์:</span>
            </span>
            <div className="assetCategoryTabsList" role="tablist" aria-label="เลือกหมวดหมู่ครุภัณฑ์">
              {[
                { id: 'ALL', label: 'ทั้งหมด', count: stats.totalAssets },
                { id: 'IT', label: 'คอมพิวเตอร์ & IT', count: stats.itCount },
                { id: 'MEDICAL', label: 'เครื่องมือแพทย์', count: stats.medicalCount },
                { id: 'GENERAL', label: 'ครุภัณฑ์ทั่วไป', count: stats.generalCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={category === tab.id}
                  className={`assetCategoryTab ${category === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setCategory(tab.id as any)
                    setPage(1)
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="assetCategoryTabCount">{tab.count.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filter Toolbar */}
          <div className="assetFilterToolbar">
            {/* Search Input */}
            <div className="assetSearchWrapper">
              <Search size={16} className="assetSearchIcon" />
              <input
                type="text"
                className="assetSearchInput"
                placeholder="ค้นหาเลขครุภัณฑ์, ชื่อรายการ, ยี่ห้อ, รุ่น, S/N, แผนก หรือสถานที่..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
              {search && (
                <button
                  type="button"
                  className="assetClearSearchBtn"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  title="ล้างคำค้นหา"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Warranty Status Filter */}
            <select
              className="assetSelect"
              value={warrantyStatus}
              onChange={(e) => {
                setWarrantyStatus(e.target.value as any)
                setPage(1)
              }}
              aria-label="กรองสถานะการรับประกัน"
            >
              <option value="ALL">สถานะประกันทั้งหมด</option>
              <option value="ACTIVE">อยู่ในระยะประกัน (Active)</option>
              <option value="EXPIRED">หมดระยะประกันแล้ว (Expired)</option>
            </select>

            {/* Asset Condition Status Filter */}
            <select
              className="assetSelect"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any)
                setPage(1)
              }}
              aria-label="กรองสถานะการใช้งานเครื่อง"
            >
              <option value="ALL">สถานะเครื่องทั้งหมด</option>
              <option value="ACTIVE">พร้อมใช้งาน (Active)</option>
              <option value="IN_REPAIR">กำลังส่งซ่อม (In Repair)</option>
              <option value="STANDBY">เครื่องสำรอง (Standby)</option>
              <option value="DISPOSED">แทงจำหน่าย (Disposed)</option>
            </select>

            {/* Sort Options */}
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
              aria-label="เรียงลำดับรายการครุภัณฑ์"
            >
              <option value="receivedDate_desc">เรียงจาก: ตรวจรับล่าสุด (ใหม่ → เก่า)</option>
              <option value="receivedDate_asc">เรียงจาก: ตรวจรับ (เก่า → ใหม่)</option>
              <option value="createdAt_desc">เรียงจาก: นำเข้าสู่ระบบล่าสุด</option>
              <option value="warrantyEndDate_asc">เรียงจาก: ประกันใกล้หมดอายุ</option>
              <option value="price_desc">เรียงจาก: ราคาสูง → ต่ำ</option>
              <option value="articleNum_asc">เรียงจาก: เลขครุภัณฑ์ (ก-ฮ / 0-9)</option>
            </select>
          </div>

          {/* Active filter summary row */}
          {hasActiveFilters && (
            <div className="assetFilterStatusRow">
              <div className="assetActiveFilters">
                <span className="assetFilterStatusNote">ตัวกรองที่ใช้งาน:</span>
                {search && (
                  <span className="assetFilterTag">
                    คำค้น: &ldquo;{search}&rdquo;
                    <button type="button" onClick={() => setSearch('')} aria-label="ลบตัวกรองคำค้นหา">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {category !== 'ALL' && (
                  <span className="assetFilterTag">
                    หมวด: {category}
                    <button type="button" onClick={() => setCategory('ALL')} aria-label="ลบตัวกรองหมวดหมู่">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {warrantyStatus !== 'ALL' && (
                  <span className="assetFilterTag">
                    ประกัน: {warrantyStatus === 'ACTIVE' ? 'ในประกัน' : 'หมดประกัน'}
                    <button type="button" onClick={() => setWarrantyStatus('ALL')} aria-label="ลบตัวกรองประกัน">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {status !== 'ALL' && (
                  <span className="assetFilterTag">
                    สถานะ: {status}
                    <button type="button" onClick={() => setStatus('ALL')} aria-label="ลบตัวกรองสถานะ">
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>

              <button type="button" className="assetResetFilterBtn" onClick={handleResetFilters}>
                <RefreshCw size={13} />
                <span>ล้างตัวกรองทั้งหมด</span>
              </button>
            </div>
          )}
        </section>

        {/* Data Table & Responsive List Container */}
        <section className="assetTableCard" aria-label="ตารางข้อมูลทะเบียนครุภัณฑ์">
          <div className="assetTableTopBar">
            <div className="assetTableTitle">
              <h3>รายการทะเบียนครุภัณฑ์ ({totalCount.toLocaleString()} รายการ)</h3>
              <span className="assetTableSubtitle">
                แสดงผลหน้าละ 20 รายการ • จัดการสถานะประกันและสถานที่ติดตั้ง
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: '#15856a' }} />
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>กำลังโหลดข้อมูลครุภัณฑ์...</p>
            </div>
          ) : assets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <Package size={40} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
              <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem', fontSize: '1.05rem' }}>
                ไม่พบข้อมูลครุภัณฑ์
              </p>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 auto', maxWidth: '420px' }}>
                {hasActiveFilters
                  ? 'ไม่มีรายการที่ตรงกับเงื่อนไขการค้นหา ลองปรับตัวกรองหรือล้างการค้นหา'
                  : 'ยังไม่มีข้อมูลครุภัณฑ์ในระบบ กดปุ่ม "ซิงค์ข้อมูลจาก GTW" หรือ "เพิ่มครุภัณฑ์ใหม่" เพื่อเริ่มต้น'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="assetResetFilterBtn"
                  style={{ marginTop: '1rem', display: 'inline-flex' }}
                  onClick={handleResetFilters}
                >
                  <RefreshCw size={14} />
                  <span>ล้างตัวกรองเพื่อดูทั้งหมด</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= 861px) */}
              <div className="desktopTableContainer">
                <div className="tableWrapper">
                  <table className="assetTable">
                    <thead>
                      <tr>
                        <th scope="col" className="col-asset-num">เลขครุภัณฑ์ / FSN</th>
                        <th scope="col" className="col-asset-name">ชื่อรายการ / รุ่น</th>
                        <th scope="col" className="col-asset-category">หมวดหมู่</th>
                        <th scope="col" className="col-asset-location">แผนก / สถานที่ติดตั้ง</th>
                        <th scope="col" className="col-asset-warranty">สถานะประกัน</th>
                        <th scope="col" className="col-asset-date">วันตรวจรับ / ราคา</th>
                        <th scope="col" className="col-asset-status">สถานะเครื่อง</th>
                        <th scope="col" className="col-asset-actions">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((item) => {
                        const underWarranty = isUnderWarranty(item)
                        const isCopied = copiedArticleNum === item.articleNum

                        return (
                          <tr key={item.id} className="assetRow">
                            <td className="col-asset-num">
                              <div className="assetNumCell">
                                <span className="assetNumCode" title={item.articleNum}>
                                  {item.articleNum}
                                </span>
                                <button
                                  type="button"
                                  className="assetCopyBtn"
                                  onClick={() => copyToClipboard(item.articleNum, `เลขครุภัณฑ์ ${item.articleNum}`)}
                                  title="คัดลอกเลขครุภัณฑ์"
                                  aria-label="คัดลอกเลขครุภัณฑ์"
                                >
                                  {isCopied ? (
                                    <Check size={13} className="assetCopySuccess" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              </div>
                              {item.fsnNum && (
                                <span className="assetFsnSub">FSN: {item.fsnNum}</span>
                              )}
                            </td>

                            <td className="col-asset-name">
                              <div className="assetNameCell">
                                <span className="assetNamePrimary" title={item.name}>
                                  {item.name}
                                </span>
                                {(item.brand || item.model || item.serialNo) && (
                                  <span className="assetMetaSub">
                                    {[item.brand, item.model, item.serialNo ? `S/N: ${item.serialNo}` : null]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="col-asset-category">
                              {item.category === 'IT' && (
                                <span className="badge badgeCategoryIt">IT & Network</span>
                              )}
                              {item.category === 'MEDICAL' && (
                                <span className="badge badgeCategoryMedical">เครื่องมือแพทย์</span>
                              )}
                              {item.category === 'GENERAL' && (
                                <span className="badge badgeCategoryGeneral">ครุภัณฑ์ทั่วไป</span>
                              )}
                            </td>

                            <td className="col-asset-location">
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                                {item.department || '-'}
                              </div>
                              {item.locationFullName && (
                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                                  <MapPin size={11} />
                                  <span>{item.locationFullName}</span>
                                </div>
                              )}
                            </td>

                            <td className="col-asset-warranty">
                              {underWarranty ? (
                                <span className="badge badgeWarrantyActive">
                                  <ShieldCheck size={12} />
                                  <span>ในประกัน ({formatThaiDate(item.warrantyEndDate || item.expireDate)})</span>
                                </span>
                              ) : (
                                <span className="badge badgeWarrantyExpired">
                                  <ShieldAlert size={12} />
                                  <span>หมดประกันแล้ว</span>
                                </span>
                              )}
                            </td>

                            <td className="col-asset-date">
                              <div style={{ fontSize: '0.8125rem', color: '#0f172a', fontWeight: 500 }}>
                                {formatThaiDate(item.receivedDate)}
                              </div>
                              {item.price !== null && item.price !== undefined && (
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatPrice(item.price)}
                                </div>
                              )}
                            </td>

                            <td className="col-asset-status">
                              {item.status === 'ACTIVE' && (
                                <span className="badge badgeStatusActive">
                                  <span className="badgeStatusDot" aria-hidden="true"></span>
                                  <span>พร้อมใช้งาน</span>
                                </span>
                              )}
                              {item.status === 'IN_REPAIR' && (
                                <span className="badge badgeStatusRepair">
                                  <span className="badgeStatusDot" aria-hidden="true"></span>
                                  <span>กำลังส่งซ่อม</span>
                                </span>
                              )}
                              {item.status === 'STANDBY' && (
                                <span className="badge badgeStatusStandby">
                                  <span className="badgeStatusDot" aria-hidden="true"></span>
                                  <span>เครื่องสำรอง</span>
                                </span>
                              )}
                              {item.status === 'DISPOSED' && (
                                <span className="badge badgeStatusDisposed">
                                  <span className="badgeStatusDot" aria-hidden="true"></span>
                                  <span>แทงจำหน่าย</span>
                                </span>
                              )}
                            </td>

                            <td className="col-asset-actions">
                              <div className="actionBtnGroup">
                                <button
                                  type="button"
                                  className="actionIconBtn edit"
                                  onClick={() => handleOpenEditModal(item)}
                                  title="แก้ไขข้อมูลครุภัณฑ์"
                                  aria-label={`แก้ไขครุภัณฑ์ ${item.name}`}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="actionIconBtn delete"
                                  onClick={() => setDeleteTarget(item)}
                                  title="ลบข้อมูลครุภัณฑ์"
                                  aria-label={`ลบครุภัณฑ์ ${item.name}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile / Tablet Responsive Cards View (<= 860px) */}
              <div className="mobileCardsContainer">
                {assets.map((item) => {
                  const underWarranty = isUnderWarranty(item)
                  const isCopied = copiedArticleNum === item.articleNum

                  return (
                    <div key={item.id} className="mobileAssetCard">
                      <div className="mobileAssetTop">
                        <div className="mobileAssetNumWrap">
                          <div className="assetNumCell">
                            <span className="assetNumCode">{item.articleNum}</span>
                            <button
                              type="button"
                              className="assetCopyBtn"
                              onClick={() => copyToClipboard(item.articleNum, `เลขครุภัณฑ์ ${item.articleNum}`)}
                              title="คัดลอกเลขครุภัณฑ์"
                            >
                              {isCopied ? <Check size={12} className="assetCopySuccess" /> : <Copy size={12} />}
                            </button>
                          </div>
                          {item.fsnNum && <span className="assetFsnSub">FSN: {item.fsnNum}</span>}
                        </div>

                        <div className="mobileAssetBadges">
                          {item.category === 'IT' && <span className="badge badgeCategoryIt">IT</span>}
                          {item.category === 'MEDICAL' && <span className="badge badgeCategoryMedical">แพทย์</span>}
                          {item.category === 'GENERAL' && <span className="badge badgeCategoryGeneral">ทั่วไป</span>}

                          {item.status === 'ACTIVE' && (
                            <span className="badge badgeStatusActive">
                              <span className="badgeStatusDot"></span>
                              <span>พร้อมใช้</span>
                            </span>
                          )}
                          {item.status === 'IN_REPAIR' && (
                            <span className="badge badgeStatusRepair">
                              <span className="badgeStatusDot"></span>
                              <span>ส่งซ่อม</span>
                            </span>
                          )}
                          {item.status === 'STANDBY' && (
                            <span className="badge badgeStatusStandby">
                              <span className="badgeStatusDot"></span>
                              <span>สำรอง</span>
                            </span>
                          )}
                          {item.status === 'DISPOSED' && (
                            <span className="badge badgeStatusDisposed">
                              <span className="badgeStatusDot"></span>
                              <span>จำหน่าย</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mobileAssetBody">
                        <div className="mobileAssetName">{item.name}</div>
                        {(item.brand || item.model || item.serialNo) && (
                          <div className="assetMetaSub">
                            {[item.brand, item.model, item.serialNo ? `S/N: ${item.serialNo}` : null]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        )}

                        <div className="mobileAssetMetaGrid">
                          <div className="mobileAssetMetaItem">
                            <span className="mobileAssetMetaLabel">แผนก:</span>
                            <span className="mobileAssetMetaValue">{item.department || '-'}</span>
                          </div>
                          <div className="mobileAssetMetaItem">
                            <span className="mobileAssetMetaLabel">ตรวจรับ:</span>
                            <span className="mobileAssetMetaValue">{formatThaiDate(item.receivedDate)}</span>
                          </div>
                          {item.locationFullName && (
                            <div className="mobileAssetMetaItem fullWidth">
                              <span className="mobileAssetMetaLabel">ที่ตั้ง:</span>
                              <span className="mobileAssetMetaValue">{item.locationFullName}</span>
                            </div>
                          )}
                          <div className="mobileAssetMetaItem fullWidth">
                            <span className="mobileAssetMetaLabel">ประกัน:</span>
                            {underWarranty ? (
                              <span className="badge badgeWarrantyActive" style={{ padding: '0.15rem 0.45rem' }}>
                                <ShieldCheck size={11} />
                                <span>ในประกัน ({formatThaiDate(item.warrantyEndDate || item.expireDate)})</span>
                              </span>
                            ) : (
                              <span className="badge badgeWarrantyExpired" style={{ padding: '0.15rem 0.45rem' }}>
                                <ShieldAlert size={11} />
                                <span>หมดประกัน</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mobileAssetFooter">
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                          {item.price ? formatPrice(item.price) : ''}
                        </span>
                        <div className="mobileAssetActions">
                          <button
                            type="button"
                            className="mobileBtnEdit"
                            onClick={() => handleOpenEditModal(item)}
                          >
                            <Edit2 size={13} />
                            <span>แก้ไข</span>
                          </button>
                          <button
                            type="button"
                            className="mobileBtnDelete"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 size={13} />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {totalCount > 0 && (
                <div className="assetPagination">
                  <div className="assetPaginationInfo">
                    แสดงผล <span>{(page - 1) * 20 + 1} - {Math.min(page * 20, totalCount)}</span> จากทั้งหมด <span>{totalCount.toLocaleString()}</span> รายการ
                  </div>

                  <div className="paginationBtnGroup">
                    <button
                      type="button"
                      className="paginationBtn paginationBtnSquare"
                      onClick={() => setPage(1)}
                      disabled={page <= 1 || loading}
                      title="หน้าแรก"
                      aria-label="หน้าแรก"
                    >
                      «
                    </button>
                    <button
                      type="button"
                      className="paginationBtn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                    >
                      <ChevronLeft size={15} />
                      <span>ก่อนหน้า</span>
                    </button>

                    <div className="paginationPageIndicator">
                      หน้า <strong>{page}</strong> จาก <strong>{totalPages || 1}</strong>
                    </div>

                    <button
                      type="button"
                      className="paginationBtn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                    >
                      <span>ถัดไป</span>
                      <ChevronRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="paginationBtn paginationBtnSquare"
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages || loading}
                      title="หน้าสุดท้าย"
                      aria-label="หน้าสุดท้าย"
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Create / Edit Modal Dialog */}
        {isFormModalOpen && (
          <div className="modalBackdrop" onClick={() => !isSubmitting && setIsFormModalOpen(false)} role="dialog" aria-modal="true">
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div className="modalHeaderLeft">
                  <div className="modalHeaderIcon" aria-hidden="true">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3>{editingAsset ? 'แก้ไขข้อมูลครุภัณฑ์' : 'เพิ่มทะเบียนครุภัณฑ์ใหม่'}</h3>
                    <span className="modalHeaderSub">
                      {editingAsset ? `รหัสครุภัณฑ์ ID #${editingAsset.id}` : 'กรอกรายละเอียดพัสดุและจัดเก็บข้อมูล'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="modalCloseBtn"
                  onClick={() => !isSubmitting && setIsFormModalOpen(false)}
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="modalForm">
                <div className="modalBody">
                  {/* Section 1: Basic Information */}
                  <div className="formSection">
                    <div className="formSectionHeader">
                      <Tag size={14} />
                      <span>1. ข้อมูลระบุตัวตนครุภัณฑ์ (Identity)</span>
                    </div>

                    <div className="formGrid2">
                      <div className="formGroup">
                        <label htmlFor="field-articleNum">เลขครุภัณฑ์ *</label>
                        <input
                          id="field-articleNum"
                          type="text"
                          className="formInput"
                          placeholder="เช่น 7440-013-0007/154/69"
                          value={formData.articleNum}
                          onChange={(e) => setFormData({ ...formData, articleNum: e.target.value })}
                          required
                        />
                      </div>
                      <div className="formGroup">
                        <label htmlFor="field-fsnNum">รหัสกลุ่ม FSN</label>
                        <input
                          id="field-fsnNum"
                          type="text"
                          className="formInput"
                          placeholder="เช่น 7440-013-0007"
                          value={formData.fsnNum}
                          onChange={(e) => setFormData({ ...formData, fsnNum: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="formGroup">
                      <label htmlFor="field-name">ชื่อรายการครุภัณฑ์ *</label>
                      <input
                        id="field-name"
                        type="text"
                        className="formInput"
                        placeholder="เช่น คอมพิวเตอร์ประมวลผลแบบที่ 2 หรือ เครื่องวัดความดันโลหิต"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="formGrid3">
                      <div className="formGroup">
                        <label htmlFor="field-brand">ยี่ห้อ (Brand)</label>
                        <input
                          id="field-brand"
                          type="text"
                          className="formInput"
                          placeholder="เช่น HP, Dell, Philips"
                          value={formData.brand}
                          onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        />
                      </div>
                      <div className="formGroup">
                        <label htmlFor="field-model">รุ่น (Model)</label>
                        <input
                          id="field-model"
                          type="text"
                          className="formInput"
                          placeholder="เช่น ProDesk 400 G7"
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        />
                      </div>
                      <div className="formGroup">
                        <label htmlFor="field-serialNo">Serial Number (S/N)</label>
                        <input
                          id="field-serialNo"
                          type="text"
                          className="formInput"
                          placeholder="หมายเลขเครื่อง S/N"
                          value={formData.serialNo}
                          onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="formGroup">
                      <label htmlFor="field-category">หมวดหมู่งาน</label>
                      <select
                        id="field-category"
                        className="formSelect"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      >
                        <option value="GENERAL">ครุภัณฑ์ทั่วไป / สำนักงาน (General)</option>
                        <option value="IT">คอมพิวเตอร์ & สารสนเทศ (IT & Network)</option>
                        <option value="MEDICAL">เครื่องมือแพทย์ (Medical Equipment)</option>
                      </select>
                    </div>
                  </div>

                  {/* Section 2: Location & Custodian */}
                  <div className="formSection">
                    <div className="formSectionHeader">
                      <Building size={14} />
                      <span>2. สถานที่ติดตั้งและหน่วยงานครอบครอง (Location)</span>
                    </div>

                    <div className="formGroup">
                      <label htmlFor="field-department">แผนก / หน่วยงานที่ครอบครอง</label>
                      <input
                        id="field-department"
                        type="text"
                        className="formInput"
                        placeholder="เช่น งานเทคโนโลยีสารสนเทศ, ห้องฉุกเฉิน, งานพัสดุ"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      />
                    </div>

                    <div className="formGroup">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <label style={{ margin: 0 }}>โครงสร้างสถานที่ติดตั้ง</label>
                        <button
                          type="button"
                          className="locationToggleBtn"
                          onClick={() => {
                            const next = !isCustomLocation
                            setIsCustomLocation(next)
                            if (next) {
                              setSelectedBuildingId('')
                              setSelectedFloorId('')
                              setSelectedRoomId('')
                            }
                          }}
                        >
                          {isCustomLocation ? 'เลือกจากโครงสร้างอาคาร (ตึก/ชั้น/ห้อง)' : 'สลับพิมพ์ระบุเอง'}
                        </button>
                      </div>

                      {!isCustomLocation ? (
                        <div className="locationSelectGrid">
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
                            aria-label="เลือกอาคาร"
                          >
                            <option value="">-- เลือกตึก / อาคาร --</option>
                            {buildingOptions.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>

                          <select
                            className="formSelect"
                            value={selectedFloorId}
                            disabled={!selectedBuildingId}
                            onChange={(e) => {
                              const fId = e.target.value
                              setSelectedFloorId(fId)
                              setSelectedRoomId('')
                            }}
                            aria-label="เลือกชั้น"
                          >
                            <option value="">-- เลือกชั้น --</option>
                            {floorOptions.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>

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
                            aria-label="เลือกห้องหรือจุดติดตั้ง"
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
                            สถานที่ที่เลือก: <strong>{formData.locationFullName}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 3: Acquisition & Warranty */}
                  <div className="formSection">
                    <div className="formSectionHeader">
                      <ShieldCheck size={14} />
                      <span>3. การตรวจรับ การรับประกัน และราคา (Warranty & Cost)</span>
                    </div>

                    <div className="formGrid2">
                      <div className="formGroup">
                        <label htmlFor="field-receivedDate">วันที่ตรวจรับพัสดุ</label>
                        <input
                          id="field-receivedDate"
                          type="date"
                          className="formInput"
                          value={formData.receivedDate}
                          onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                        />
                      </div>
                      <div className="formGroup">
                        <label htmlFor="field-warrantyEndDate">วันสิ้นสุดการรับประกัน (Warranty End)</label>
                        <input
                          id="field-warrantyEndDate"
                          type="date"
                          className="formInput"
                          value={formData.warrantyEndDate}
                          onChange={(e) => setFormData({ ...formData, warrantyEndDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="formGrid2">
                      <div className="formGroup">
                        <label htmlFor="field-price">ราคาจัดซื้อ (บาท)</label>
                        <input
                          id="field-price"
                          type="number"
                          step="0.01"
                          className="formInput"
                          placeholder="0.00"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        />
                      </div>
                      <div className="formGroup">
                        <label htmlFor="field-status">สถานะเครื่อง</label>
                        <select
                          id="field-status"
                          className="formSelect"
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        >
                          <option value="ACTIVE">พร้อมใช้งานปกติ (Active)</option>
                          <option value="IN_REPAIR">กำลังส่งซ่อม (In Repair)</option>
                          <option value="STANDBY">เครื่องสำรอง (Standby)</option>
                          <option value="DISPOSED">แทงจำหน่าย (Disposed)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Vendor & Additional Info */}
                  <div className="formSection">
                    <div className="formSectionHeader">
                      <DollarSign size={14} />
                      <span>4. ข้อมูลคู่ค้าและหมายเหตุ (Vendor & Contract)</span>
                    </div>

                    <div className="formGrid2">
                      <div className="formGroup">
                        <label htmlFor="field-vendorName">บริษัทผู้จำหน่าย / คู่สัญญา</label>
                        <input
                          id="field-vendorName"
                          type="text"
                          className="formInput"
                          placeholder="ชื่อบริษัทหรือร้านค้าคู่สัญญา"
                          value={formData.vendorName}
                          onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        />
                      </div>
                      <div className="formGroup">
                        <label htmlFor="field-vendorContact">เบอร์ติดต่อช่าง / เคลมประกัน</label>
                        <input
                          id="field-vendorContact"
                          type="text"
                          className="formInput"
                          placeholder="เช่น 02-xxx-xxxx หรือ 08x-xxx-xxxx"
                          value={formData.vendorContact}
                          onChange={(e) => setFormData({ ...formData, vendorContact: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="formGroup">
                      <label htmlFor="field-contractNo">เลขที่สัญญา / ใบสั่งซื้อ (PO)</label>
                      <input
                        id="field-contractNo"
                        type="text"
                        className="formInput"
                        placeholder="เช่น สัญญาเลขที่ 45/2569"
                        value={formData.contractNo}
                        onChange={(e) => setFormData({ ...formData, contractNo: e.target.value })}
                      />
                    </div>

                    <div className="formGroup">
                      <label htmlFor="field-notes">หมายเหตุเพิ่มเติม</label>
                      <textarea
                        id="field-notes"
                        className="formTextarea"
                        placeholder="บันทึกข้อสังเกต อาการชำรุด หรือข้อมูลอ้างอิงเพิ่มเติม..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
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
                    {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                    <span>{editingAsset ? 'บันทึกการแก้ไข' : 'บันทึกครุภัณฑ์'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal Dialog */}
        {deleteTarget && (
          <div
            className="modalBackdrop"
            onClick={() => !isDeleting && setDeleteTarget(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modalContent" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div className="modalHeaderLeft">
                  <div className="modalHeaderIcon" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}>
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 style={{ color: '#dc2626' }}>ยืนยันการลบครุภัณฑ์</h3>
                    <span className="modalHeaderSub">รายการ ID #{deleteTarget.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="modalCloseBtn"
                  onClick={() => !isDeleting && setDeleteTarget(null)}
                  aria-label="ปิดหน้าต่างยืนยัน"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modalBody" style={{ gap: '0.75rem' }}>
                <p style={{ color: '#334155', fontSize: '0.925rem', margin: 0, lineHeight: 1.5 }}>
                  คุณต้องการลบข้อมูลครุภัณฑ์ <strong>&ldquo;{deleteTarget.name}&rdquo;</strong> (เลขครุภัณฑ์:{' '}
                  <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{deleteTarget.articleNum}</code>) ใช่หรือไม่?
                </p>
                <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>
                  การกระทำนี้จะลบข้อมูลออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้
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
                  className="modalDeleteBtn"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 size={15} className="animate-spin" />}
                  <span>ยืนยันลบข้อมูล</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    </div>
  )
}
