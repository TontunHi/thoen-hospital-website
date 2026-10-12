'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Clock,
  Phone,
  MapPin,
  FileText,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  ShoppingBag,
  Layers,
  AlertTriangle,
  User,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react'
import './equipment-borrow.css'

interface BorrowDashboardStats {
  totalItems: number
  availableItems: number
  borrowedItems: number
  overdueRequests: number
}

interface CurrentUser {
  id: number
  username: string
  name: string
  role: string
  department?: string | null
  isAdmin: boolean
  canManageBorrow: boolean
}

interface CatalogItem {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  name: string
  code: string
  category: string
  subType?: string
  availableQty: number
  unit: string
  location?: string | null
  imageUrl?: string | null
}

interface BasketItem {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  name: string
  code: string
  quantity: number
  maxQty: number
  unit: string
}

interface BorrowItemDetail {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  itemName: string
  itemCode?: string | null
  quantity: number
  returnedQty: number
  status: string
  returnCondition?: string | null
  returnNotes?: string | null
  returnedAt?: string | null
}

interface BorrowRequestRecord {
  id: number
  requestNo: string
  requesterId: number
  requesterName: string
  requesterDept?: string | null
  purpose: string
  location?: string | null
  borrowDate: string
  expectedReturnDate?: string | null
  actualReturnDate?: string | null
  phone?: string | null
  notes?: string | null
  status: 'PENDING' | 'APPROVED' | 'PARTIAL_RETURNED' | 'RETURNED' | 'REJECTED' | 'CANCELLED'
  approvedByName?: string | null
  approvedAt?: string | null
  rejectReason?: string | null
  createdAt: string
  items: BorrowItemDetail[]
}

interface MaterialRecord {
  id: number
  name: string
  category: string
  materialType: 'REUSABLE' | 'CONSUMABLE'
  totalQty: number
  availableQty: number
  unit: string
  location?: string | null
  imageUrl?: string | null
  notes?: string | null
  isActive: boolean
}

interface LoanableAssetRecord {
  id: number
  articleNum: string
  name: string
  brand?: string | null
  category: string
  isLoanable: boolean
  status: string
  locationFullName?: string | null
}

interface EquipmentBorrowClientProps {
  initialStats: BorrowDashboardStats
  currentUser: CurrentUser
}

export default function EquipmentBorrowClient({
  initialStats,
  currentUser,
}: EquipmentBorrowClientProps) {
  // State: Tab & Stats
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-requests' | 'approvals' | 'inventory'>('catalog')
  const [approvalsSubTab, setApprovalsSubTab] = useState<'pending' | 'active'>('pending')
  const [stats, setStats] = useState<BorrowDashboardStats>(initialStats)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // State: Catalog
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('ALL')
  const [catalogType, setCatalogType] = useState<'ALL' | 'ASSET' | 'MATERIAL'>('ALL')

  // State: Basket & Borrow Modal
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false)
  const [borrowForm, setBorrowForm] = useState({
    purpose: '',
    location: '',
    borrowDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    phone: '',
    notes: '',
  })
  const [isSubmittingBorrow, setIsSubmittingBorrow] = useState(false)

  // State: My Requests
  const [myRequests, setMyRequests] = useState<BorrowRequestRecord[]>([])

  // State: Admin Approvals & Active Loans
  const [pendingRequests, setPendingRequests] = useState<BorrowRequestRecord[]>([])
  const [activeLoans, setActiveLoans] = useState<BorrowRequestRecord[]>([])
  const [approvalSearch, setApprovalSearch] = useState('')

  // State: Reject Modal
  const [rejectModalData, setRejectModalData] = useState<{ id: number; requestNo: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // State: Return Inspection Modal
  const [inspectModalData, setInspectModalData] = useState<BorrowRequestRecord | null>(null)
  const [returnItemsInput, setReturnItemsInput] = useState<
    Record<number, { returnedQty: number; condition: 'NORMAL' | 'DAMAGED' | 'LOST'; notes: string }>
  >({})

  // State: Inventory Management (Admin)
  const [materials, setMaterials] = useState<MaterialRecord[]>([])
  const [loanableAssets, setLoanableAssets] = useState<LoanableAssetRecord[]>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryType, setInventoryType] = useState<'materials' | 'assets'>('materials')
  const [materialModalMode, setMaterialModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingMaterial, setEditingMaterial] = useState<MaterialRecord | null>(null)
  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: 'GENERAL',
    materialType: 'REUSABLE' as 'REUSABLE' | 'CONSUMABLE',
    totalQty: 1,
    unit: 'ชิ้น',
    location: '',
    notes: '',
  })

  // Auto-dismiss alert
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMsg])

  // Fetch Dashboard Stats
  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/member/equipment-borrow/stats')
      const json = await res.json()
      if (json.success && json.data) {
        setStats(json.data)
      }
    } catch {
      // quiet fail
    }
  }, [])

  // Fetch Catalog
  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams()
      if (catalogSearch.trim()) params.append('search', catalogSearch.trim())
      if (catalogCategory !== 'ALL') params.append('category', catalogCategory)
      if (catalogType !== 'ALL') params.append('type', catalogType)

      const res = await fetch(`/api/member/equipment-borrow/catalog?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setCatalogItems(json.data || [])
      } else {
        setErrorMsg(json.error || 'ไม่สามารถโหลดรายการอุปกรณ์ได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย')
    } finally {
      setLoading(false)
    }
  }, [catalogSearch, catalogCategory, catalogType])

  // Fetch My Requests
  const fetchMyRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/member/equipment-borrow/requests?mode=my')
      const json = await res.json()
      if (json.success) {
        setMyRequests(json.items || [])
      }
    } catch {
      // quiet
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Pending Requests (Admin)
  const fetchPendingRequests = useCallback(async () => {
    if (!currentUser.canManageBorrow) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ mode: 'pending' })
      if (approvalSearch.trim()) params.append('search', approvalSearch.trim())
      const res = await fetch(`/api/member/equipment-borrow/requests?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setPendingRequests(json.items || [])
      }
    } catch {
      // quiet
    } finally {
      setLoading(false)
    }
  }, [currentUser.canManageBorrow, approvalSearch])

  // Fetch Active Loans (Admin)
  const fetchActiveLoans = useCallback(async () => {
    if (!currentUser.canManageBorrow) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ mode: 'active' })
      if (approvalSearch.trim()) params.append('search', approvalSearch.trim())
      const res = await fetch(`/api/member/equipment-borrow/requests?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setActiveLoans(json.items || [])
      }
    } catch {
      // quiet
    } finally {
      setLoading(false)
    }
  }, [currentUser.canManageBorrow, approvalSearch])

  // Fetch Materials & Assets for Inventory (Admin)
  const fetchInventory = useCallback(async () => {
    if (!currentUser.canManageBorrow) return
    setLoading(true)
    try {
      if (inventoryType === 'materials') {
        const params = new URLSearchParams()
        if (inventorySearch.trim()) params.append('search', inventorySearch.trim())
        const res = await fetch(`/api/member/equipment-borrow/materials?${params.toString()}`)
        const json = await res.json()
        if (json.success) {
          setMaterials(json.items || [])
        }
      } else {
        const params = new URLSearchParams({ isLoanable: 'false' }) // get all assets
        if (inventorySearch.trim()) params.append('search', inventorySearch.trim())
        const res = await fetch(`/api/member/equipment-borrow/assets?${params.toString()}`)
        const json = await res.json()
        if (json.success) {
          setLoanableAssets(json.items || [])
        }
      }
    } catch {
      // quiet
    } finally {
      setLoading(false)
    }
  }, [currentUser.canManageBorrow, inventoryType, inventorySearch])

  // Refresh data on Tab change
  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchCatalog()
    } else if (activeTab === 'my-requests') {
      fetchMyRequests()
    } else if (activeTab === 'approvals') {
      if (approvalsSubTab === 'pending') fetchPendingRequests()
      else fetchActiveLoans()
    } else if (activeTab === 'inventory') {
      fetchInventory()
    }
  }, [activeTab, approvalsSubTab, fetchCatalog, fetchMyRequests, fetchPendingRequests, fetchActiveLoans, fetchInventory])

  // Basket Handlers
  const handleAddToBasket = (item: CatalogItem) => {
    const existingIndex = basket.findIndex((b) => b.id === item.id && b.itemType === item.itemType)
    if (existingIndex >= 0) {
      if (basket[existingIndex].quantity < item.availableQty) {
        const updated = [...basket]
        updated[existingIndex].quantity += 1
        setBasket(updated)
        setSuccessMsg(`เพิ่มจำนวน ${item.name} ในตะกร้าแล้ว`)
      } else {
        setErrorMsg(`คุณเลือก ${item.name} ครบจำนวนที่มีในคลังแล้ว`)
      }
    } else {
      setBasket([
        ...basket,
        {
          id: item.id,
          itemType: item.itemType,
          name: item.name,
          code: item.code,
          quantity: 1,
          maxQty: item.availableQty,
          unit: item.unit,
        },
      ])
      setSuccessMsg(`เพิ่ม ${item.name} ลงในตะกร้าแล้ว`)
    }
  }

  const handleUpdateBasketQty = (index: number, delta: number) => {
    const updated = [...basket]
    const item = updated[index]
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      updated.splice(index, 1)
    } else if (newQty <= item.maxQty) {
      item.quantity = newQty
    }
    setBasket(updated)
  }

  const handleRemoveFromBasket = (index: number) => {
    const updated = [...basket]
    updated.splice(index, 1)
    setBasket(updated)
  }

  // Submit Borrow Request
  const handleSubmitBorrowRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (basket.length === 0) {
      setErrorMsg('กรุณาเลือกอุปกรณ์ในตะกร้าอย่างน้อย 1 รายการ')
      return
    }
    if (!borrowForm.purpose.trim()) {
      setErrorMsg('กรุณาระบุวัตถุประสงค์ในการยืม')
      return
    }

    setIsSubmittingBorrow(true)
    setErrorMsg(null)

    try {
      const payload = {
        purpose: borrowForm.purpose,
        location: borrowForm.location || null,
        borrowDate: borrowForm.borrowDate,
        expectedReturnDate: borrowForm.expectedReturnDate || null,
        phone: borrowForm.phone || null,
        notes: borrowForm.notes || null,
        items: basket.map((it) => ({
          itemType: it.itemType,
          assetId: it.itemType === 'ASSET' ? it.id : null,
          materialId: it.itemType === 'MATERIAL' ? it.id : null,
          itemName: it.name,
          itemCode: it.code,
          quantity: it.quantity,
        })),
      }

      const res = await fetch('/api/member/equipment-borrow/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.success) {
        setSuccessMsg(`ยื่นคำขอยืมรหัส ${json.data.requestNo} สำเร็จแล้ว! กรุณารอการอนุมัติ`)
        setBasket([])
        setIsBorrowModalOpen(false)
        setBorrowForm({
          purpose: '',
          location: '',
          borrowDate: new Date().toISOString().split('T')[0],
          expectedReturnDate: '',
          phone: '',
          notes: '',
        })
        refreshStats()
        setActiveTab('my-requests')
      } else {
        setErrorMsg(json.error || 'ไม่สามารถบันทึกคำขอยืมได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการส่งคำขอ')
    } finally {
      setIsSubmittingBorrow(false)
    }
  }

  // Admin Approve & Dispense
  const handleApproveRequest = async (requestId: number) => {
    if (!confirm('ยืนยันอนุมัติและจ่ายอุปกรณ์ตามคำขอนี้? ระบบจะตัดสต็อกคงเหลือทันที')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/member/equipment-borrow/requests/${requestId}/approve`, {
        method: 'POST',
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg('อนุมัติและส่งมอบอุปกรณ์เรียบร้อยแล้ว')
        fetchPendingRequests()
        refreshStats()
      } else {
        setErrorMsg(json.error || 'ไม่สามารถอนุมัติคำขอได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }

  // Admin Reject Request
  const handleRejectRequest = async () => {
    if (!rejectModalData) return
    if (!rejectReason.trim()) {
      setErrorMsg('กรุณาระบุเหตุผลการไม่อนุมัติ')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/member/equipment-borrow/requests/${rejectModalData.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg(`ปฏิเสธคำขอ ${rejectModalData.requestNo} เรียบร้อยแล้ว`)
        setRejectModalData(null)
        setRejectReason('')
        fetchPendingRequests()
        refreshStats()
      } else {
        setErrorMsg(json.error || 'ไม่สามารถปฏิเสธคำขอได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }

  // Admin Return Inspection
  const openReturnInspectionModal = (request: BorrowRequestRecord) => {
    setInspectModalData(request)
    const initialInputs: Record<
      number,
      { returnedQty: number; condition: 'NORMAL' | 'DAMAGED' | 'LOST'; notes: string }
    > = {}

    for (const item of request.items) {
      const remainingToReturn = item.quantity - item.returnedQty
      initialInputs[item.id] = {
        returnedQty: Math.max(0, remainingToReturn),
        condition: 'NORMAL',
        notes: '',
      }
    }
    setReturnItemsInput(initialInputs)
  }

  const handleConfirmReturn = async () => {
    if (!inspectModalData) return
    setLoading(true)

    const returnsPayload = Object.entries(returnItemsInput)
      .filter(([_, val]) => val.returnedQty > 0)
      .map(([idStr, val]) => ({
        itemId: parseInt(idStr, 10),
        returnedQty: val.returnedQty,
        condition: val.condition,
        notes: val.notes || null,
      }))

    if (returnsPayload.length === 0) {
      setErrorMsg('กรุณาระบุจำนวนที่ส่งคืนอย่างน้อย 1 รายการ')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/member/equipment-borrow/requests/${inspectModalData.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returns: returnsPayload }),
      })
      const json = await res.json()

      if (json.success) {
        setSuccessMsg('บันทึกการตรวจรับคืนและคืนสต็อกเรียบร้อยแล้ว')
        setInspectModalData(null)
        fetchActiveLoans()
        refreshStats()
      } else {
        setErrorMsg(json.error || 'ไม่สามารถบันทึกการตรวจรับคืนได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการตรวจรับคืน')
    } finally {
      setLoading(false)
    }
  }

  // Admin Toggle Asset Loanable
  const handleToggleAssetLoanable = async (assetId: number, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/member/equipment-borrow/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, isLoanable: !currentStatus }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg(`ปรับสถานะการอนุญาตให้ยืมสำเร็จ`)
        fetchInventory()
        refreshStats()
      } else {
        setErrorMsg(json.error || 'ไม่สามารถปรับสถานะครุภัณฑ์ได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
  }

  // Admin Save Material (Create / Edit)
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!materialForm.name.trim()) {
      setErrorMsg('กรุณาระบุชื่อวัสดุ')
      return
    }

    setLoading(true)
    try {
      if (materialModalMode === 'create') {
        const res = await fetch('/api/member/equipment-borrow/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(materialForm),
        })
        const json = await res.json()
        if (json.success) {
          setSuccessMsg('เพิ่มข้อมูลวัสดุใหม่สำเร็จ')
          setMaterialModalMode(null)
          fetchInventory()
          refreshStats()
        } else {
          setErrorMsg(json.error || 'ไม่สามารถเพิ่มวัสดุได้')
        }
      } else if (materialModalMode === 'edit' && editingMaterial) {
        const res = await fetch(`/api/member/equipment-borrow/materials/${editingMaterial.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(materialForm),
        })
        const json = await res.json()
        if (json.success) {
          setSuccessMsg('แก้ไขข้อมูลวัสดุสำเร็จ')
          setMaterialModalMode(null)
          fetchInventory()
          refreshStats()
        } else {
          setErrorMsg(json.error || 'ไม่สามารถแก้ไขวัสดุได้')
        }
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกวัสดุ')
    } finally {
      setLoading(false)
    }
  }

  // Admin Delete Material
  const handleDeleteMaterial = async (id: number, name: string) => {
    if (!confirm(`ต้องการลบวัสดุ "${name}" ใช่หรือไม่?`)) return
    try {
      const res = await fetch(`/api/member/equipment-borrow/materials/${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg('ลบข้อมูลวัสดุสำเร็จ')
        fetchInventory()
        refreshStats()
      } else {
        setErrorMsg(json.error || 'ไม่สามารถลบวัสดุได้')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการลบ')
    }
  }

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="statusBadge statusPending">⏳ รออนุมัติ</span>
      case 'APPROVED':
        return <span className="statusBadge statusApproved">📦 กำลังยืม</span>
      case 'PARTIAL_RETURNED':
        return <span className="statusBadge statusPartial">🔄 คืนบางส่วน</span>
      case 'RETURNED':
        return <span className="statusBadge statusReturned">✅ ส่งคืนครบแล้ว</span>
      case 'REJECTED':
        return <span className="statusBadge statusRejected">❌ ไม่อนุมัติ</span>
      default:
        return <span className="statusBadge">{status}</span>
    }
  }

  return (
    <div className="borrowPageContainer">
      {/* ── Header ── */}
      <header className="borrowHeader">
        <div className="borrowHeaderTitle">
          <Link href="/member" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontSize: '0.85rem', marginBottom: '0.35rem', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> กลับสู่ระบบสมาชิก
          </Link>
          <h1>
            <Package size={28} />
            ระบบยืม-คืนอุปกรณ์และพัสดุ
          </h1>
          <p>บริการยืม-คืนอุปกรณ์ ครุภัณฑ์ และเบิกจ่ายวัสดุสำหรับกิจกรรมและการปฏิบัติงาน โรงพยาบาลเถิน</p>
        </div>

        <div className="headerActions">
          <button
            onClick={() => setIsBorrowModalOpen(true)}
            className="primaryButton"
            aria-label="ขอยืมอุปกรณ์"
          >
            <Plus size={18} />
            ขอยืมอุปกรณ์
          </button>
        </div>
      </header>

      {/* ── Notifications ── */}
      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.9rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '0.9rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={20} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* ── 4 Stats Cards ── */}
      <section className="statsGrid" aria-label="สถิติระบบยืม-คืน">
        <div className="statCard">
          <div className="statIconBox statIconTotal">
            <Package size={26} />
          </div>
          <div className="statInfo">
            <h3>{stats.totalItems}</h3>
            <span>อุปกรณ์ทั้งหมดในคลัง</span>
          </div>
        </div>

        <div className="statCard">
          <div className="statIconBox statIconAvail">
            <CheckCircle2 size={26} />
          </div>
          <div className="statInfo">
            <h3>{stats.availableItems}</h3>
            <span>พร้อมให้ยืม</span>
          </div>
        </div>

        <div className="statCard">
          <div className="statIconBox statIconBorrowed">
            <Clock size={26} />
          </div>
          <div className="statInfo">
            <h3>{stats.borrowedItems}</h3>
            <span>กำลังถูกยืม</span>
          </div>
        </div>

        <div className="statCard">
          <div className="statIconBox statIconOverdue">
            <AlertTriangle size={26} />
          </div>
          <div className="statInfo">
            <h3>{stats.overdueRequests}</h3>
            <span>เกินกำหนดส่งคืน</span>
          </div>
        </div>
      </section>

      {/* ── Tabs Navigation ── */}
      <nav className="tabsBar" aria-label="เมนูระบบ">
        <button
          className={`tabItem ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <Layers size={18} />
          คลังอุปกรณ์พร้อมยืม
        </button>

        <button
          className={`tabItem ${activeTab === 'my-requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-requests')}
        >
          <User size={18} />
          คำขอของฉัน
          {myRequests.length > 0 && <span className="tabBadge">{myRequests.length}</span>}
        </button>

        {currentUser.canManageBorrow && (
          <>
            <button
              className={`tabItem ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => setActiveTab('approvals')}
            >
              <ShieldCheck size={18} />
              จัดการคำขอ & รับคืน
              {(stats.overdueRequests > 0 || pendingRequests.length > 0) && (
                <span className="tabBadge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {pendingRequests.length + stats.overdueRequests}
                </span>
              )}
            </button>

            <button
              className={`tabItem ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <SlidersHorizontal size={18} />
              จัดการข้อมูลคลัง
            </button>
          </>
        )}
      </nav>

      {/* ── TAB 1: Available Catalog ── */}
      {activeTab === 'catalog' && (
        <section>
          {/* Toolbar & Filters */}
          <div className="toolbarRow">
            <div className="searchBox">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="ค้นหาชื่ออุปกรณ์, รหัสครุภัณฑ์, สถานที่..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
              {catalogSearch && (
                <button onClick={() => setCatalogSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                className="filterSelect"
                value={catalogType}
                onChange={(e) => setCatalogType(e.target.value as any)}
              >
                <option value="ALL">ทุกประเภท (ครุภัณฑ์ & วัสดุ)</option>
                <option value="ASSET">เฉพาะ ครุภัณฑ์</option>
                <option value="MATERIAL">เฉพาะ วัสดุ</option>
              </select>

              <select
                className="filterSelect"
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
              >
                <option value="ALL">ทุกหมวดหมู่</option>
                <option value="IT">ไอที / คอมพิวเตอร์</option>
                <option value="ELECTRICAL">ไฟฟ้า / โสตทัศนูปกรณ์</option>
                <option value="MEDICAL">เครื่องมือแพทย์</option>
                <option value="GENERAL">ทั่วไป / อุปกรณ์สำนักงาน</option>
              </select>

              <button onClick={fetchCatalog} className="secondaryButton" title="รีเฟรชข้อมูล">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="emptyState">
              <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#10b981' }} />
              <p>กำลังโหลดข้อมูลอุปกรณ์พร้อมยืม...</p>
            </div>
          ) : catalogItems.length === 0 ? (
            <div className="emptyState">
              <FolderOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>ไม่พบรายการอุปกรณ์ที่พร้อมให้ยืมในขณะนี้</p>
            </div>
          ) : (
            <div className="catalogGrid">
              {catalogItems.map((item) => (
                <div key={`${item.itemType}-${item.id}`} className="catalogCard">
                  <div>
                    <div className="catalogCardTop">
                      <span
                        className={`categoryPill ${
                          item.itemType === 'ASSET'
                            ? 'pillAsset'
                            : item.subType === 'วัสดุสิ้นเปลือง'
                            ? 'pillConsumable'
                            : 'pillReusable'
                        }`}
                      >
                        {item.subType || (item.itemType === 'ASSET' ? 'ครุภัณฑ์' : 'วัสดุ')}
                      </span>
                      <span className="stockBadge stockAvail">
                        พร้อมยืม: {item.availableQty} {item.unit}
                      </span>
                    </div>

                    <h3 className="catalogCardTitle">{item.name}</h3>
                    <div className="catalogCardCode">รหัส: {item.code}</div>

                    <div className="catalogCardMeta">
                      {item.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={14} color="#64748b" />
                          <span>{item.location}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Layers size={14} color="#64748b" />
                        <span>หมวดหมู่: {item.category}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddToBasket(item)}
                    className="addToBasketBtn"
                    disabled={item.availableQty <= 0}
                  >
                    <Plus size={16} />
                    หยิบใส่รายการขอยืม
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── TAB 2: My Requests ── */}
      {activeTab === 'my-requests' && (
        <section>
          <div className="toolbarRow">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              ประวัติและสถานะคำขอยืมของฉัน ({myRequests.length})
            </h2>
            <button onClick={fetchMyRequests} className="secondaryButton">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรช
            </button>
          </div>

          <div className="tableContainer">
            {myRequests.length === 0 ? (
              <div className="emptyState">
                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>คุณยังไม่มีประวัติการยื่นคำขอยืมอุปกรณ์</p>
                <button onClick={() => setIsBorrowModalOpen(true)} className="primaryButton" style={{ marginTop: '1rem' }}>
                  <Plus size={16} /> ยื่นคำขอยืมตอนนี้
                </button>
              </div>
            ) : (
              <table className="styledTable">
                <thead>
                  <tr>
                    <th>เลขที่คำขอ</th>
                    <th>วัตถุประสงค์ / สถานที่</th>
                    <th>รายการอุปกรณ์ที่ยืม</th>
                    <th>วันที่เริ่มยืม</th>
                    <th>กำหนดส่งคืน</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((req) => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: 600, color: '#065f46' }}>{req.requestNo}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{req.purpose}</div>
                        {req.location && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <MapPin size={12} /> {req.location}
                          </div>
                        )}
                      </td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                          {req.items.map((it) => (
                            <li key={it.id}>
                              {it.itemName} × {it.quantity}
                              {it.returnedQty > 0 && <span style={{ color: '#16a34a', marginLeft: '0.25rem' }}>(คืนแล้ว {it.returnedQty})</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{new Date(req.borrowDate).toLocaleDateString('th-TH')}</td>
                      <td>
                        {req.expectedReturnDate ? (
                          <span style={{ color: new Date(req.expectedReturnDate) < new Date() && req.status !== 'RETURNED' ? '#dc2626' : 'inherit', fontWeight: new Date(req.expectedReturnDate) < new Date() && req.status !== 'RETURNED' ? 600 : 'normal' }}>
                            {new Date(req.expectedReturnDate).toLocaleDateString('th-TH')}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td>
                        {renderStatusBadge(req.status)}
                        {req.rejectReason && (
                          <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.25rem' }}>
                            เหตุผล: {req.rejectReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── TAB 3: Admin Approvals & Active Loans ── */}
      {activeTab === 'approvals' && currentUser.canManageBorrow && (
        <section>
          {/* Subtabs Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => setApprovalsSubTab('pending')}
              className={approvalsSubTab === 'pending' ? 'primaryButton' : 'secondaryButton'}
            >
              ⏳ รายการรออนุมัติ ({pendingRequests.length})
            </button>
            <button
              onClick={() => setApprovalsSubTab('active')}
              className={approvalsSubTab === 'active' ? 'primaryButton' : 'secondaryButton'}
            >
              📦 รายการกำลังยืม & ตรวจรับคืน ({activeLoans.length})
            </button>
          </div>

          <div className="toolbarRow">
            <div className="searchBox">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่คำขอ, ชื่อผู้ขอ, วัตถุประสงค์..."
                value={approvalSearch}
                onChange={(e) => setApprovalSearch(e.target.value)}
              />
            </div>
            <button
              onClick={approvalsSubTab === 'pending' ? fetchPendingRequests : fetchActiveLoans}
              className="secondaryButton"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรช
            </button>
          </div>

          <div className="tableContainer">
            {approvalsSubTab === 'pending' ? (
              pendingRequests.length === 0 ? (
                <div className="emptyState">
                  <CheckCircle2 size={48} style={{ margin: '0 auto 1rem', color: '#10b981', opacity: 0.6 }} />
                  <p>ไม่มีคำขอยืมที่รออนุมัติในขณะนี้</p>
                </div>
              ) : (
                <table className="styledTable">
                  <thead>
                    <tr>
                      <th>เลขที่คำขอ</th>
                      <th>ผู้ขอยืม / แผนก</th>
                      <th>รายการอุปกรณ์</th>
                      <th>วัตถุประสงค์ & สถานที่</th>
                      <th>วันที่ยืม - กำหนดคืน</th>
                      <th style={{ textAlign: 'right' }}>ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((req) => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 600, color: '#065f46' }}>{req.requestNo}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{req.requesterName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{req.requesterDept || '-'}</div>
                          {req.phone && (
                            <div style={{ fontSize: '0.8rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Phone size={12} /> {req.phone}
                            </div>
                          )}
                        </td>
                        <td>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                            {req.items.map((it) => (
                              <li key={it.id}>
                                {it.itemName} × {it.quantity}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{req.purpose}</div>
                          {req.location && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>📍 {req.location}</div>}
                        </td>
                        <td>
                          <div>เริ่ม: {new Date(req.borrowDate).toLocaleDateString('th-TH')}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            คืน: {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString('th-TH') : '-'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleApproveRequest(req.id)}
                              className="actionBtn actionBtnApprove"
                            >
                              <Check size={14} /> อนุมัติ & จ่ายของ
                            </button>
                            <button
                              onClick={() => setRejectModalData({ id: req.id, requestNo: req.requestNo })}
                              className="actionBtn actionBtnReject"
                            >
                              <X size={14} /> ปฏิเสธ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              activeLoans.length === 0 ? (
                <div className="emptyState">
                  <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>ไม่มีรายการอุปกรณ์ที่กำลังถูกยืมในขณะนี้</p>
                </div>
              ) : (
                <table className="styledTable">
                  <thead>
                    <tr>
                      <th>เลขที่คำขอ</th>
                      <th>ผู้ขอยืม</th>
                      <th>รายการอุปกรณ์ (ยืม/คืนแล้ว)</th>
                      <th>กำหนดส่งคืน</th>
                      <th>สถานะ</th>
                      <th style={{ textAlign: 'right' }}>ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLoans.map((req) => {
                      const isOverdue = req.expectedReturnDate && new Date(req.expectedReturnDate) < new Date()
                      return (
                        <tr key={req.id}>
                          <td style={{ fontWeight: 600, color: '#065f46' }}>{req.requestNo}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{req.requesterName}</div>
                            {req.phone && (
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                <Phone size={12} style={{ display: 'inline', marginRight: '0.2rem' }} />
                                {req.phone}
                              </div>
                            )}
                          </td>
                          <td>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                              {req.items.map((it) => (
                                <li key={it.id}>
                                  {it.itemName} : ยืม {it.quantity} (คืนแล้ว {it.returnedQty})
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            <div style={{ color: isOverdue ? '#dc2626' : 'inherit', fontWeight: isOverdue ? 600 : 'normal' }}>
                              {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString('th-TH') : '-'}
                            </div>
                            {isOverdue && <span className="statusBadge statusOverdue">เกินกำหนด!</span>}
                          </td>
                          <td>{renderStatusBadge(req.status)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => openReturnInspectionModal(req)}
                              className="actionBtn actionBtnReturn"
                            >
                              <RotateCcw size={14} /> ตรวจรับคืนของ
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>
        </section>
      )}

      {/* ── TAB 4: Inventory Management (Admin) ── */}
      {activeTab === 'inventory' && currentUser.canManageBorrow && (
        <section>
          {/* Subtab Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setInventoryType('materials')}
                className={inventoryType === 'materials' ? 'primaryButton' : 'secondaryButton'}
              >
                📦 คลังวัสดุ (Materials / Supplies)
              </button>
              <button
                onClick={() => setInventoryType('assets')}
                className={inventoryType === 'assets' ? 'primaryButton' : 'secondaryButton'}
              >
                🏷️ ครุภัณฑ์ที่อนุญาตให้ยืม (Hospital Assets)
              </button>
            </div>

            {inventoryType === 'materials' && (
              <button
                onClick={() => {
                  setEditingMaterial(null)
                  setMaterialForm({
                    name: '',
                    category: 'GENERAL',
                    materialType: 'REUSABLE',
                    totalQty: 1,
                    unit: 'ชิ้น',
                    location: '',
                    notes: '',
                  })
                  setMaterialModalMode('create')
                }}
                className="primaryButton"
              >
                <Plus size={16} /> เพิ่มวัสดุใหม่
              </button>
            )}
          </div>

          <div className="toolbarRow">
            <div className="searchBox">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder={inventoryType === 'materials' ? 'ค้นหาชื่อวัสดุ, ที่เก็บ...' : 'ค้นหาเลขครุภัณฑ์, ชื่อ...'}
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
              />
            </div>
            <button onClick={fetchInventory} className="secondaryButton">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรช
            </button>
          </div>

          <div className="tableContainer">
            {inventoryType === 'materials' ? (
              <table className="styledTable">
                <thead>
                  <tr>
                    <th>ชื่อวัสดุ</th>
                    <th>หมวดหมู่</th>
                    <th>ประเภทการใช้งาน</th>
                    <th>จำนวนรวม</th>
                    <th>พร้อมยืม</th>
                    <th>สถานที่จัดเก็บ</th>
                    <th>สถานะ</th>
                    <th style={{ textAlign: 'right' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>{m.category}</td>
                      <td>
                        <span className={`categoryPill ${m.materialType === 'REUSABLE' ? 'pillReusable' : 'pillConsumable'}`}>
                          {m.materialType === 'REUSABLE' ? 'ยืม-คืน' : 'สิ้นเปลือง (ตัดยอด)'}
                        </span>
                      </td>
                      <td>{m.totalQty} {m.unit}</td>
                      <td style={{ fontWeight: 600, color: m.availableQty > 0 ? '#16a34a' : '#dc2626' }}>
                        {m.availableQty} {m.unit}
                      </td>
                      <td>{m.location || '-'}</td>
                      <td>
                        {m.isActive ? (
                          <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>เปิดใช้งาน</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>ปิดใช้งาน</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => {
                              setEditingMaterial(m)
                              setMaterialForm({
                                name: m.name,
                                category: m.category,
                                materialType: m.materialType,
                                totalQty: m.totalQty,
                                unit: m.unit,
                                location: m.location || '',
                                notes: m.notes || '',
                              })
                              setMaterialModalMode('edit')
                            }}
                            className="secondaryButton"
                            style={{ padding: '0.4rem 0.6rem' }}
                            title="แก้ไข"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(m.id, m.name)}
                            className="secondaryButton"
                            style={{ padding: '0.4rem 0.6rem', color: '#b91c1c' }}
                            title="ลบ"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="styledTable">
                <thead>
                  <tr>
                    <th>เลขครุภัณฑ์</th>
                    <th>ชื่อครุภัณฑ์</th>
                    <th>ยี่ห้อ</th>
                    <th>หมวดหมู่</th>
                    <th>สถานที่ติดตั้ง</th>
                    <th>สถานะเปิดให้ยืม</th>
                    <th style={{ textAlign: 'right' }}>สวิตช์เปิด/ปิด</th>
                  </tr>
                </thead>
                <tbody>
                  {loanableAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td style={{ fontWeight: 600, color: '#0369a1' }}>{asset.articleNum}</td>
                      <td>{asset.name}</td>
                      <td>{asset.brand || '-'}</td>
                      <td>{asset.category}</td>
                      <td>{asset.locationFullName || '-'}</td>
                      <td>
                        {asset.isLoanable ? (
                          <span className="statusBadge statusReturned">เปิดให้ยืมแล้ว</span>
                        ) : (
                          <span className="statusBadge" style={{ background: '#f1f5f9', color: '#64748b' }}>ไม่ได้เปิดให้ยืม</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleAssetLoanable(asset.id, asset.isLoanable)}
                          className={asset.isLoanable ? 'actionBtn actionBtnReject' : 'actionBtn actionBtnApprove'}
                        >
                          {asset.isLoanable ? 'ปิดการให้ยืม' : 'เปิดให้ยืม'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── Floating Basket Trigger Pill ── */}
      {basket.length > 0 && !isBorrowModalOpen && (
        <button
          className="floatingBasketPill"
          onClick={() => setIsBorrowModalOpen(true)}
          aria-label="เปิดตะกร้าขอยืม"
        >
          <ShoppingBag size={20} />
          <span>รายการขอยืมในตะกร้า</span>
          <span className="basketCountBadge">{basket.reduce((sum, it) => sum + it.quantity, 0)}</span>
        </button>
      )}

      {/* ── MODAL: Request & Basket Modal ── */}
      {isBorrowModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent">
            <div className="modalHeader">
              <h2>📋 แบบฟอร์มขอยืมอุปกรณ์และวัสดุ</h2>
              <button onClick={() => setIsBorrowModalOpen(false)} className="modalCloseBtn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitBorrowRequest}>
              <div className="modalBody">
                {/* Basket Items List */}
                <div className="formGroup">
                  <label>📦 รายการอุปกรณ์ที่เลือกไว้ ({basket.length} ชนิด)</label>
                  {basket.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '0.75rem', color: '#94a3b8' }}>
                      ยังไม่มีอุปกรณ์ในตะกร้า (กรุณาเลือกจากแท็บ "คลังอุปกรณ์พร้อมยืม")
                    </div>
                  ) : (
                    <div className="basketItemsList">
                      {basket.map((item, idx) => (
                        <div key={`${item.itemType}-${item.id}`} className="basketItemRow">
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>รหัส: {item.code} ({item.unit})</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="qtyControl">
                              <button
                                type="button"
                                className="qtyBtn"
                                onClick={() => handleUpdateBasketQty(idx, -1)}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                className="qtyBtn"
                                onClick={() => handleUpdateBasketQty(idx, 1)}
                                disabled={item.quantity >= item.maxQty}
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveFromBasket(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.25rem' }}
                              title="ลบรายการนี้"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="formGroup">
                  <label>วัตถุประสงค์ในการยืมใช้งาน <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="formControl"
                    placeholder="เช่น เพื่อใช้ในงานสัมมนาผู้สูงอายุ, จัดอบรม CPR, ซ้อมแผนฉุกเฉิน..."
                    value={borrowForm.purpose}
                    onChange={(e) => setBorrowForm({ ...borrowForm, purpose: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>สถานที่นำไปใช้งาน</label>
                  <input
                    type="text"
                    className="formControl"
                    placeholder="เช่น ห้องประชุมใหญ่ ชั้น 2, ตึกอุบัติเหตุ, รพ.สต.บ้านเถิน..."
                    value={borrowForm.location}
                    onChange={(e) => setBorrowForm({ ...borrowForm, location: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="formGroup">
                    <label>วันที่เริ่มยืม <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="date"
                      required
                      className="formControl"
                      value={borrowForm.borrowDate}
                      onChange={(e) => setBorrowForm({ ...borrowForm, borrowDate: e.target.value })}
                    />
                  </div>

                  <div className="formGroup">
                    <label>วันที่คาดว่าจะส่งคืน</label>
                    <input
                      type="date"
                      className="formControl"
                      value={borrowForm.expectedReturnDate}
                      onChange={(e) => setBorrowForm({ ...borrowForm, expectedReturnDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>เบอร์โทรศัพท์ติดต่อภายใน / มือถือ</label>
                  <input
                    type="text"
                    className="formControl"
                    placeholder="เบอร์โทรหรือเบอร์ต่อภายใน เพื่อให้เจ้าหน้าที่ติดต่อส่งมอบ"
                    value={borrowForm.phone}
                    onChange={(e) => setBorrowForm({ ...borrowForm, phone: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                  <textarea
                    rows={2}
                    className="formControl"
                    placeholder="รายละเอียดเพิ่มเติมสำหรับการจัดเตรียม..."
                    value={borrowForm.notes}
                    onChange={(e) => setBorrowForm({ ...borrowForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  onClick={() => setIsBorrowModalOpen(false)}
                  className="secondaryButton"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBorrow || basket.length === 0}
                  className="primaryButton"
                >
                  {isSubmittingBorrow ? 'กำลังบันทึก...' : 'ยื่นใบขอยืมอุปกรณ์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Reject Reason Modal ── */}
      {rejectModalData && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '450px' }}>
            <div className="modalHeader">
              <h2>ระบุเหตุผลการไม่อนุมัติ ({rejectModalData.requestNo})</h2>
              <button onClick={() => setRejectModalData(null)} className="modalCloseBtn">
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div className="formGroup">
                <label>เหตุผลที่ไม่อนุมัติคำขอ</label>
                <textarea
                  rows={3}
                  className="formControl"
                  required
                  placeholder="เช่น อุปกรณ์ติดคิวใช้งานราชการอื่น, อุปกรณ์อยู่ระหว่างส่งซ่อมบำรุง..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modalFooter">
              <button onClick={() => setRejectModalData(null)} className="secondaryButton">
                ยกเลิก
              </button>
              <button onClick={handleRejectRequest} className="actionBtn actionBtnReject" style={{ padding: '0.65rem 1.25rem' }}>
                ยืนยันไม่อนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Return Inspection Modal ── */}
      {inspectModalData && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '750px' }}>
            <div className="modalHeader">
              <h2>🔄 ตรวจรับคืนอุปกรณ์ ({inspectModalData.requestNo})</h2>
              <button onClick={() => setInspectModalData(null)} className="modalCloseBtn">
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.75rem', fontSize: '0.9rem' }}>
                <div><strong>ผู้ยืม:</strong> {inspectModalData.requesterName} ({inspectModalData.requesterDept || '-'})</div>
                <div><strong>วัตถุประสงค์:</strong> {inspectModalData.purpose}</div>
              </div>

              <div className="formGroup">
                <label>บันทึกสภาพและการรับคืนทีละรายการ</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {inspectModalData.items.map((item) => {
                    const inputState = returnItemsInput[item.id] || { returnedQty: 0, condition: 'NORMAL', notes: '' }
                    const remaining = item.quantity - item.returnedQty

                    return (
                      <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600 }}>{item.itemName}</span>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            ยืมไป: {item.quantity} | คืนแล้ว: {item.returnedQty} | ค้างคืน: {remaining}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 2fr', gap: '0.75rem', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'block' }}>จำนวนที่ส่งคืนครั้งนี้</span>
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              className="formControl"
                              value={inputState.returnedQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, returnedQty: val },
                                })
                              }}
                            />
                          </div>

                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'block' }}>สภาพอุปกรณ์ตอนคืน</span>
                            <select
                              className="formControl"
                              value={inputState.condition}
                              onChange={(e) => {
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, condition: e.target.value as any },
                                })
                              }}
                            >
                              <option value="NORMAL">✅ ปกติ (คืนสต็อกคลัง)</option>
                              <option value="DAMAGED">⚠️ ชำรุด (ไม่คืนสต็อก)</option>
                              <option value="LOST">❌ สูญหาย (ไม่คืนสต็อก)</option>
                            </select>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'block' }}>หมายเหตุการตรวจรับ</span>
                            <input
                              type="text"
                              className="formControl"
                              placeholder="เช่น สายมีรอยถลอก, สภาพสมบูรณ์..."
                              value={inputState.notes}
                              onChange={(e) => {
                                setReturnItemsInput({
                                  ...returnItemsInput,
                                  [item.id]: { ...inputState, notes: e.target.value },
                                })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button onClick={() => setInspectModalData(null)} className="secondaryButton">
                ยกเลิก
              </button>
              <button onClick={handleConfirmReturn} className="primaryButton">
                บันทึกการตรวจรับคืน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add / Edit Material Modal (Admin) ── */}
      {materialModalMode && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '550px' }}>
            <div className="modalHeader">
              <h2>{materialModalMode === 'create' ? '➕ เพิ่มรายการวัสดุใหม่' : '✏️ แก้ไขข้อมูลวัสดุ'}</h2>
              <button onClick={() => setMaterialModalMode(null)} className="modalCloseBtn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>ชื่อวัสดุ <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="formControl"
                    placeholder="เช่น ปลั๊กพ่วง 5 เมตร 4 ช่อง, สายแปลง HDMI to Type-C..."
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="formGroup">
                    <label>ประเภทวัสดุ</label>
                    <select
                      className="formControl"
                      value={materialForm.materialType}
                      onChange={(e) => setMaterialForm({ ...materialForm, materialType: e.target.value as any })}
                    >
                      <option value="REUSABLE">ยืม-คืน (ใช้งานหมุนเวียน)</option>
                      <option value="CONSUMABLE">สิ้นเปลือง (เบิกใช้หมดไป)</option>
                    </select>
                  </div>

                  <div className="formGroup">
                    <label>หมวดหมู่วัสดุ</label>
                    <select
                      className="formControl"
                      value={materialForm.category}
                      onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                    >
                      <option value="GENERAL">ทั่วไป / สำนักงาน</option>
                      <option value="ELECTRICAL">ไฟฟ้า / โสตทัศนูปกรณ์</option>
                      <option value="IT">คอมพิวเตอร์ / ไอที</option>
                      <option value="MEDICAL">เครื่องมือแพทย์</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="formGroup">
                    <label>จำนวนรวมทั้งหมด</label>
                    <input
                      type="number"
                      min={0}
                      required
                      className="formControl"
                      value={materialForm.totalQty}
                      onChange={(e) => setMaterialForm({ ...materialForm, totalQty: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>

                  <div className="formGroup">
                    <label>หน่วยนับ</label>
                    <input
                      type="text"
                      required
                      className="formControl"
                      placeholder="เช่น ชิ้น, อัน, เส้น, กล่อง..."
                      value={materialForm.unit}
                      onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="formGroup">
                  <label>สถานที่จัดเก็บ / คลัง</label>
                  <input
                    type="text"
                    className="formControl"
                    placeholder="เช่น ตู้เก็บของ IT, คลังพัสดุกลาง, ห้องศูนย์คอมฯ..."
                    value={materialForm.location}
                    onChange={(e) => setMaterialForm({ ...materialForm, location: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>หมายเหตุ</label>
                  <textarea
                    rows={2}
                    className="formControl"
                    placeholder="รายละเอียดเพิ่มเติมหรือข้อควรระวัง..."
                    value={materialForm.notes}
                    onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modalFooter">
                <button type="button" onClick={() => setMaterialModalMode(null)} className="secondaryButton">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="primaryButton">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลวัสดุ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
