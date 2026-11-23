'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  FolderOpen,
  Eye,
  Building2,
  Power,
} from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import './equipment-borrow.css'
import type {
  BorrowDashboardStats,
  CurrentUser,
  CatalogItem,
  BasketItem,
  BorrowItemDetail,
  BorrowRequestRecord,
  MaterialRecord,
  LoanableAssetRecord,
} from './components/equipmentBorrowTypes'
import { EquipmentBorrowModals } from './components/EquipmentBorrowModals'
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
  const [approvalsSubTab, setApprovalsSubTab] = useState<'pending' | 'active' | 'all'>('pending')
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

  // State: Admin Approvals, Active Loans, and All Requests History
  const [pendingRequests, setPendingRequests] = useState<BorrowRequestRecord[]>([])
  const [activeLoans, setActiveLoans] = useState<BorrowRequestRecord[]>([])
  const [allRequests, setAllRequests] = useState<BorrowRequestRecord[]>([])
  const [allRequestsStatusFilter, setAllRequestsStatusFilter] = useState('ALL')
  const [approvalSearch, setApprovalSearch] = useState('')
  const prevSubTabRef = useRef(approvalsSubTab)
  const prevSearchRef = useRef(approvalSearch)
  const prevFilterRef = useRef(allRequestsStatusFilter)
  const [viewDetailModalData, setViewDetailModalData] = useState<BorrowRequestRecord | null>(null)

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
    isActive: true,
  })

  // Auto-dismiss alert notifications
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3200)
      return () => clearTimeout(timer)
    }
  }, [successMsg])

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 3200)
      return () => clearTimeout(timer)
    }
  }, [errorMsg])

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
      const res = await fetch('/api/member/equipment-borrow/my-requests')
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
      const params = new URLSearchParams()
      if (approvalSearch.trim()) params.append('search', approvalSearch.trim())
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/member/equipment-borrow/pending-requests${queryString}`)
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
      const params = new URLSearchParams()
      if (approvalSearch.trim()) params.append('search', approvalSearch.trim())
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/member/equipment-borrow/active-loans${queryString}`)
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

  // Fetch All Requests History (Admin)
  const fetchAllRequests = useCallback(async () => {
    if (!currentUser.canManageBorrow) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (approvalSearch.trim()) params.append('search', approvalSearch.trim())
      if (allRequestsStatusFilter !== 'ALL') params.append('status', allRequestsStatusFilter)
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/member/equipment-borrow/history${queryString}`)
      const json = await res.json()
      if (json.success) {
        setAllRequests(json.items || [])
      }
    } catch {
      // quiet
    } finally {
      setLoading(false)
    }
  }, [currentUser.canManageBorrow, approvalSearch, allRequestsStatusFilter])

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
      // Parallel fetch all approval datasets so all subtab count badges are populated immediately
      prevSubTabRef.current = approvalsSubTab
      prevSearchRef.current = approvalSearch
      prevFilterRef.current = allRequestsStatusFilter
      Promise.all([fetchPendingRequests(), fetchActiveLoans(), fetchAllRequests()])
    } else if (activeTab === 'inventory') {
      fetchInventory()
    }
  }, [activeTab, approvalsSubTab, approvalSearch, allRequestsStatusFilter, fetchCatalog, fetchMyRequests, fetchPendingRequests, fetchActiveLoans, fetchAllRequests, fetchInventory])

  // Subtab-specific search or filter change in approvals
  useEffect(() => {
    if (activeTab === 'approvals') {
      const hasChanged =
        prevSubTabRef.current !== approvalsSubTab ||
        prevSearchRef.current !== approvalSearch ||
        prevFilterRef.current !== allRequestsStatusFilter

      if (hasChanged) {
        prevSubTabRef.current = approvalsSubTab
        prevSearchRef.current = approvalSearch
        prevFilterRef.current = allRequestsStatusFilter
        if (approvalsSubTab === 'pending') fetchPendingRequests()
        else if (approvalsSubTab === 'active') fetchActiveLoans()
        else fetchAllRequests()
      }
    }
  }, [activeTab, approvalsSubTab, approvalSearch, allRequestsStatusFilter, fetchPendingRequests, fetchActiveLoans, fetchAllRequests])

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
    if (!borrowForm.borrowDate) {
      setErrorMsg('กรุณาระบุวันที่เริ่มยืม')
      return
    }
    if (!borrowForm.expectedReturnDate) {
      setErrorMsg('กรุณาระบุวันที่คาดว่าจะส่งคืน')
      return
    }
    if (borrowForm.borrowDate && borrowForm.expectedReturnDate && borrowForm.expectedReturnDate < borrowForm.borrowDate) {
      setErrorMsg('วันที่คาดว่าจะส่งคืนต้องไม่ก่อนวันที่เริ่มยืม')
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

    const allItemsAlreadyReturned = inspectModalData.items.every(
      (it) => it.returnedQty >= it.quantity || it.status === 'CONSUMED'
    )

    if (returnsPayload.length === 0 && !allItemsAlreadyReturned) {
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

  // Admin Toggle Material Active/Inactive
  const handleToggleMaterialActive = async (id: number, currentActive: boolean, name: string) => {
    const nextState = !currentActive
    const actionText = nextState ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
    if (!confirm(`ต้องการ${actionText}วัสดุ "${name}" หรือไม่?`)) return
    try {
      const res = await fetch(`/api/member/equipment-borrow/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg(`${actionText}วัสดุสำเร็จ`)
        fetchInventory()
        refreshStats()
      } else {
        setErrorMsg(json.error || `ไม่สามารถ${actionText}วัสดุได้`)
      }
    } catch {
      setErrorMsg(`เกิดข้อผิดพลาดในการ${actionText}`)
    }
  }

  // Admin Delete Material
  const handleDeleteMaterial = async (id: number, name: string) => {
    if (!confirm(`ต้องการลบวัสดุ "${name}" ออกจากระบบถาวรหรือไม่?\n(ระบบจะลบข้อมูลวัสดุออกจากคลังอย่างถาวร)`)) return
    try {
      const res = await fetch(`/api/member/equipment-borrow/materials/${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg('ลบวัสดุออกจากระบบสำเร็จ')
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
        return (
          <span className="statusBadge statusPending">
            <Clock size={12} /> รออนุมัติ
          </span>
        )
      case 'APPROVED':
        return (
          <span className="statusBadge statusApproved">
            <Package size={12} /> กำลังยืม
          </span>
        )
      case 'PARTIAL_RETURNED':
        return (
          <span className="statusBadge statusPartial">
            <RotateCcw size={12} /> คืนบางส่วน
          </span>
        )
      case 'RETURNED':
        return (
          <span className="statusBadge statusReturned">
            <CheckCircle2 size={12} /> ส่งคืนครบแล้ว
          </span>
        )
      case 'REJECTED':
        return (
          <span className="statusBadge statusRejected">
            <X size={12} /> ไม่อนุมัติ
          </span>
        )
      default:
        return <span className="statusBadge">{status}</span>
    }
  }

  // Item Status Badge Helper
  const renderItemStatusBadge = (itemStatus: string, requestStatus?: string) => {
    if (requestStatus === 'REJECTED' || itemStatus === 'REJECTED') {
      return (
        <span className="statusBadge statusRejected">
          <X size={12} /> ไม่อนุมัติ
        </span>
      )
    }
    if (requestStatus === 'PENDING' || itemStatus === 'PENDING') {
      return (
        <span className="statusBadge statusPending">
          <Clock size={12} /> รออนุมัติ
        </span>
      )
    }
    if (itemStatus === 'RETURNED') {
      return (
        <span className="statusBadge statusReturned">
          <CheckCircle2 size={12} /> คืนแล้ว
        </span>
      )
    }
    if (itemStatus === 'CONSUMED') {
      return (
        <span className="statusBadge statusConsumed">
          <Check size={12} /> เบิกจ่ายแล้ว
        </span>
      )
    }
    return (
      <span className="statusBadge statusApproved">
        <Package size={12} /> กำลังยืม
      </span>
    )
  }

  return (
    <div className="borrowPageContainer">
      {/* ── Floating Notification Toasts (Anti-slop, Auto-dismissing) ── */}
      {(errorMsg || successMsg) && (
        <div className="borrowToastContainer" role="status" aria-live="polite">
          {errorMsg && (
            <div role="alert" className="borrowToast borrowToastError">
              <div className="borrowToastIcon">
                <AlertCircle size={18} />
              </div>
              <div className="borrowToastText">{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="borrowToastClose" aria-label="ปิดการแจ้งเตือน">
                <X size={15} />
              </button>
              <div className="borrowToastTimerBar borrowToastTimerBarError" />
            </div>
          )}

          {successMsg && (
            <div role="alert" className="borrowToast borrowToastSuccess">
              <div className="borrowToastIcon">
                <CheckCircle2 size={18} />
              </div>
              <div className="borrowToastText">{successMsg}</div>
              <button onClick={() => setSuccessMsg(null)} className="borrowToastClose" aria-label="ปิดการแจ้งเตือน">
                <X size={15} />
              </button>
              <div className="borrowToastTimerBar borrowToastTimerBarSuccess" />
            </div>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <header className="borrowHeader">
        <div className="borrowHeaderTitle">
          <Link href="/member" className="borrowBackLink">
            <ArrowLeft size={15} />
            <span>กลับสู่ระบบสมาชิก</span>
          </Link>
          <h1>
            ระบบยืม-คืนอุปกรณ์และพัสดุ
          </h1>
          <p>
            ระบบเบิกจ่ายและยืมคืนอุปกรณ์ เครื่องมือทางการแพทย์ โสตทัศนูปกรณ์ และวัสดุหมุนเวียน สำหรับเจ้าหน้าที่โรงพยาบาลเถิน
          </p>
        </div>

        <div className="headerActions">
          <button
            onClick={() => setIsBorrowModalOpen(true)}
            className="primaryButton"
            aria-label="ขอยืมอุปกรณ์"
          >
            <Plus size={16} />
            ขอยืมอุปกรณ์
          </button>
        </div>
      </header>

      {/* ── 4 Stats Cards (Modern Clinical Metric KPIs) ── */}
      <section className="statsGrid" aria-label="สถิติระบบยืม-คืน">
        <div className="statCard">
          <div className="statCardHeader">
            <span className="statCardLabel">อุปกรณ์ทั้งหมด</span>
            <span className="statCardIndicator statIndicatorTotal" />
          </div>
          <div className="statCardValue">{stats.totalItems}</div>
          <div className="statCardCaption">รายการในระบบคลัง</div>
        </div>

        <div className="statCard">
          <div className="statCardHeader">
            <span className="statCardLabel">พร้อมให้ยืม</span>
            <span className="statCardIndicator statIndicatorAvail" />
          </div>
          <div className="statCardValue statValueSuccess">{stats.availableItems}</div>
          <div className="statCardCaption">สามารถเบิก/ยืมได้ทันที</div>
        </div>

        <div className="statCard">
          <div className="statCardHeader">
            <span className="statCardLabel">กำลังถูกยืม</span>
            <span className="statCardIndicator statIndicatorBorrowed" />
          </div>
          <div className="statCardValue statValueInfo">{stats.borrowedItems}</div>
          <div className="statCardCaption">อยู่ระหว่างการใช้งาน</div>
        </div>

        <div className="statCard">
          <div className="statCardHeader">
            <span className="statCardLabel">เกินกำหนดส่งคืน</span>
            <span className="statCardIndicator statIndicatorOverdue" />
          </div>
          <div className={`statCardValue ${stats.overdueRequests > 0 ? 'statValueDanger' : ''}`}>
            {stats.overdueRequests}
          </div>
          <div className="statCardCaption">ต้องติดตามรับคืน</div>
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
                <span className="tabBadge tabBadgeUrgent">
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
                <button onClick={() => setCatalogSearch('')} className="borrowAlertClose" aria-label="ล้างคำค้นหา">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="filterSelectGroup">
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
                      <span className={`stockBadge ${item.availableQty > 0 ? 'stockAvail' : 'stockZero'}`}>
                        {item.availableQty > 0 ? `พร้อมยืม ${item.availableQty} ${item.unit}` : 'ถูกยืมหมดแล้ว'}
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
                    {item.availableQty > 0 ? 'หยิบใส่รายการขอยืม' : 'อยู่ระหว่างถูกยืม'}
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
          <div className="approvalsNavPills">
            <button
              type="button"
              onClick={() => setApprovalsSubTab('pending')}
              className={`approvalsNavPill ${approvalsSubTab === 'pending' ? 'active' : ''}`}
            >
              <Clock size={15} />
              <span>รายการรออนุมัติ</span>
              <span className={`pillCount ${pendingRequests.length > 0 ? 'pillCountUrgent' : ''}`}>
                {pendingRequests.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setApprovalsSubTab('active')}
              className={`approvalsNavPill ${approvalsSubTab === 'active' ? 'active' : ''}`}
            >
              <RotateCcw size={15} />
              <span>รายการกำลังยืม & ตรวจรับคืน</span>
              <span className={`pillCount ${activeLoans.length > 0 ? 'pillCountInfo' : ''}`}>
                {activeLoans.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setApprovalsSubTab('all')}
              className={`approvalsNavPill ${approvalsSubTab === 'all' ? 'active' : ''}`}
            >
              <FileText size={15} />
              <span>ประวัติทุกคำขอ</span>
              <span className="pillCount">{allRequests.length}</span>
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
            {approvalsSubTab === 'all' && (
              <select
                value={allRequestsStatusFilter}
                onChange={(e) => setAllRequestsStatusFilter(e.target.value)}
                className="selectInput"
                style={{ width: 'auto', minWidth: 160 }}
              >
                <option value="ALL">ทุกสถานะ</option>
                <option value="PENDING">รออนุมัติ</option>
                <option value="APPROVED">กำลังยืม</option>
                <option value="PARTIAL_RETURNED">คืนบางส่วน</option>
                <option value="RETURNED">ส่งคืนครบแล้ว</option>
                <option value="REJECTED">ไม่อนุมัติ</option>
              </select>
            )}
            <button
              onClick={approvalsSubTab === 'pending' ? fetchPendingRequests : approvalsSubTab === 'active' ? fetchActiveLoans : fetchAllRequests}
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
                          {req.location && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={12} /> {req.location}
                            </div>
                          )}
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
            ) : approvalsSubTab === 'active' ? (
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
            ) : (
              allRequests.length === 0 ? (
                <div className="emptyState">
                  <FileText size={48} style={{ margin: '0 auto 1rem', color: '#94a3b8', opacity: 0.6 }} />
                  <p>ไม่พบประวัติคำขอยืมตามเงื่อนไขที่เลือก</p>
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
                      <th>วันที่คืนจริง</th>
                      <th>สถานะ</th>
                      <th style={{ textAlign: 'right' }}>ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRequests.map((req) => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 600, color: '#065f46' }}>{req.requestNo}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{req.requesterName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{req.requesterDept || '-'}</div>
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
                          <div style={{ fontWeight: 500 }}>{req.purpose}</div>
                          {req.location && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={12} /> {req.location}
                            </div>
                          )}
                        </td>
                        <td>
                          <div>เริ่ม: {new Date(req.borrowDate).toLocaleDateString('th-TH')}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            คืน: {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString('th-TH') : '-'}
                          </div>
                        </td>
                        <td>
                          {req.actualReturnDate ? (
                            <span style={{ color: '#059669', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={13} /> {new Date(req.actualReturnDate).toLocaleDateString('th-TH')}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>-</span>
                          )}
                        </td>
                        <td>{renderStatusBadge(req.status)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => setViewDetailModalData(req)}
                            className="secondaryButton"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Eye size={14} /> ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    ))}
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
          <div className="inventorySubtabsRow">
            <div className="inventoryNavPills">
              <button
                type="button"
                onClick={() => setInventoryType('materials')}
                className={`inventoryNavPill ${inventoryType === 'materials' ? 'active' : ''}`}
              >
                <Package size={15} />
                <span>คลังพัสดุและวัสดุ (Materials)</span>
              </button>
              <button
                type="button"
                onClick={() => setInventoryType('assets')}
                className={`inventoryNavPill ${inventoryType === 'assets' ? 'active' : ''}`}
              >
                <Building2 size={15} />
                <span>ครุภัณฑ์พร้อมให้ยืม (Assets)</span>
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
                    isActive: true,
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
                        <button
                          type="button"
                          onClick={() => handleToggleMaterialActive(m.id, m.isActive, m.name)}
                          style={{
                            cursor: 'pointer',
                            background: m.isActive ? '#dcfce7' : '#f1f5f9',
                            color: m.isActive ? '#15803d' : '#64748b',
                            border: `1px solid ${m.isActive ? '#bbf7d0' : '#cbd5e1'}`,
                            borderRadius: '999px',
                            padding: '3px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                          title={m.isActive ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.isActive ? '#16a34a' : '#94a3b8' }} />
                          {m.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
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
                                isActive: m.isActive,
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
                            onClick={() => handleToggleMaterialActive(m.id, m.isActive, m.name)}
                            className="secondaryButton"
                            style={{ padding: '0.4rem 0.6rem', color: m.isActive ? '#b45309' : '#15803d' }}
                            title={m.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          >
                            <Power size={14} />
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
              <h2>แบบฟอร์มขอยืมอุปกรณ์และวัสดุ</h2>
              <button onClick={() => setIsBorrowModalOpen(false)} className="modalCloseBtn" aria-label="ปิดหน้าต่าง">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitBorrowRequest}>
              <div className="modalBody">
                {/* Basket Items List */}
                <div className="formGroup">
                  <label>รายการอุปกรณ์ที่เลือกไว้ ({basket.length} ชนิด)</label>
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
                    <label>วันที่คาดว่าจะส่งคืน <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="date"
                      required
                      min={borrowForm.borrowDate || undefined}
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

      <EquipmentBorrowModals
        currentUser={currentUser}
        loading={loading}
        renderStatusBadge={renderStatusBadge}
        renderItemStatusBadge={renderItemStatusBadge}
        rejectModalData={rejectModalData}
        setRejectModalData={setRejectModalData}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        handleRejectRequest={handleRejectRequest}
        inspectModalData={inspectModalData}
        setInspectModalData={setInspectModalData}
        returnItemsInput={returnItemsInput}
        setReturnItemsInput={setReturnItemsInput}
        handleConfirmReturn={handleConfirmReturn}
        materialModalMode={materialModalMode}
        setMaterialModalMode={setMaterialModalMode}
        materialForm={materialForm}
        setMaterialForm={setMaterialForm}
        handleSaveMaterial={handleSaveMaterial}
        viewDetailModalData={viewDetailModalData}
        setViewDetailModalData={setViewDetailModalData}
        openReturnInspectionModal={openReturnInspectionModal}
      />
    </div>
  )
}
