'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Package,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Trash2,
  Check,
  RotateCcw,
  ShoppingBag,
  Layers,
  User,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { getErrorMessage } from '@/lib/http/apiResponse'
import './equipment-borrow.css'
import type {
  BorrowDashboardStats,
  CurrentUser,
  CatalogItem,
  BasketItem,
  BorrowRequestRecord,
  MaterialRecord,
  LoanableAssetRecord,
} from './components/equipmentBorrowTypes'
import { EquipmentBorrowModals } from './components/EquipmentBorrowModals'
import { EquipmentItemThumbnail } from './components/EquipmentItemThumbnail'
import { ItemImageLightboxModal, type PreviewableEquipmentItem } from './components/ItemImageLightboxModal'
import { EquipmentCatalogTab } from './components/EquipmentCatalogTab'
import { EquipmentMyRequestsTab } from './components/EquipmentMyRequestsTab'
import { EquipmentApprovalsTab } from './components/EquipmentApprovalsTab'
import { EquipmentInventoryTab } from './components/EquipmentInventoryTab'
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
    imageUrl: null as string | null,
    notes: '',
    isActive: true,
  })
  const [pendingMaterialImageFile, setPendingMaterialImageFile] = useState<File | null>(null)
  const [assetImageModalData, setAssetImageModalData] = useState<LoanableAssetRecord | null>(null)
  const [assetImageDraftUrl, setAssetImageDraftUrl] = useState<string | null>(null)
  const [pendingAssetImageFile, setPendingAssetImageFile] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [previewItem, setPreviewItem] = useState<PreviewableEquipmentItem | null>(null)

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
          imageUrl: item.imageUrl || null,
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
        setSuccessMsg(`ยื่นคำขอยืมรหัส ${json.data.requestNo} สำเร็จแล้ว กรุณารอการอนุมัติ`)
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

  // Upload Equipment Image Helper
  const uploadEquipmentImage = async (file: File, itemType: 'ASSET' | 'MATERIAL'): Promise<string> => {
    setIsUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('itemType', itemType)
      const res = await fetch('/api/member/equipment-borrow/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok || !json.success || !json.data?.url) {
        throw new Error(json.error || 'ไม่สามารถอัปโหลดรูปภาพได้')
      }
      return json.data.url as string
    } finally {
      setIsUploadingImage(false)
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
      let resolvedImageUrl = materialForm.imageUrl
      if (pendingMaterialImageFile) {
        resolvedImageUrl = await uploadEquipmentImage(pendingMaterialImageFile, 'MATERIAL')
      }
      const payload = { ...materialForm, imageUrl: resolvedImageUrl }

      if (materialModalMode === 'create') {
        const res = await fetch('/api/member/equipment-borrow/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.success) {
          setSuccessMsg('เพิ่มข้อมูลวัสดุใหม่สำเร็จ')
          setPendingMaterialImageFile(null)
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
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.success) {
          setSuccessMsg('แก้ไขข้อมูลวัสดุสำเร็จ')
          setPendingMaterialImageFile(null)
          setMaterialModalMode(null)
          fetchInventory()
          refreshStats()
        } else {
          setErrorMsg(json.error || 'ไม่สามารถแก้ไขวัสดุได้')
        }
      }
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึกวัสดุ'))
    } finally {
      setLoading(false)
    }
  }

  // Admin Save Asset Image
  const handleSaveAssetImage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assetImageModalData) return

    setLoading(true)
    try {
      let resolvedImageUrl = assetImageDraftUrl
      if (pendingAssetImageFile) {
        resolvedImageUrl = await uploadEquipmentImage(pendingAssetImageFile, 'ASSET')
      }

      const res = await fetch('/api/member/equipment-borrow/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: assetImageModalData.id,
          imageUrl: resolvedImageUrl,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMsg('บันทึกรูปภาพครุภัณฑ์สำเร็จ')
        setPendingAssetImageFile(null)
        setAssetImageModalData(null)
        fetchInventory()
      } else {
        setErrorMsg(json.error || 'ไม่สามารถบันทึกรูปภาพครุภัณฑ์ได้')
      }
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึกรูปภาพครุภัณฑ์'))
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
        <EquipmentCatalogTab
          catalogSearch={catalogSearch}
          onCatalogSearchChange={setCatalogSearch}
          catalogType={catalogType}
          onCatalogTypeChange={setCatalogType}
          catalogCategory={catalogCategory}
          onCatalogCategoryChange={setCatalogCategory}
          loading={loading}
          catalogItems={catalogItems}
          onRefresh={fetchCatalog}
          onPreviewItem={setPreviewItem}
          onAddToBasket={handleAddToBasket}
        />
      )}

      {/* ── TAB 2: My Requests ── */}
      {activeTab === 'my-requests' && (
        <EquipmentMyRequestsTab
          myRequests={myRequests}
          loading={loading}
          onRefresh={fetchMyRequests}
          onOpenBorrowModal={() => setIsBorrowModalOpen(true)}
          renderStatusBadge={renderStatusBadge}
        />
      )}

      {/* ── TAB 3: Admin Approvals & Active Loans ── */}
      {activeTab === 'approvals' && currentUser.canManageBorrow && (
        <EquipmentApprovalsTab
          approvalsSubTab={approvalsSubTab}
          onSubTabChange={setApprovalsSubTab}
          pendingRequests={pendingRequests}
          activeLoans={activeLoans}
          allRequests={allRequests}
          approvalSearch={approvalSearch}
          onApprovalSearchChange={setApprovalSearch}
          allRequestsStatusFilter={allRequestsStatusFilter}
          onAllRequestsStatusFilterChange={setAllRequestsStatusFilter}
          loading={loading}
          onRefreshPending={fetchPendingRequests}
          onRefreshActive={fetchActiveLoans}
          onRefreshAll={fetchAllRequests}
          onApproveRequest={handleApproveRequest}
          onOpenRejectModal={setRejectModalData}
          onOpenReturnInspectionModal={openReturnInspectionModal}
          onOpenViewDetailModal={setViewDetailModalData}
          renderStatusBadge={renderStatusBadge}
        />
      )}

      {/* ── TAB 4: Inventory Management (Admin) ── */}
      {activeTab === 'inventory' && currentUser.canManageBorrow && (
        <EquipmentInventoryTab
          inventoryType={inventoryType}
          onInventoryTypeChange={setInventoryType}
          inventorySearch={inventorySearch}
          onInventorySearchChange={setInventorySearch}
          loading={loading}
          materials={materials}
          loanableAssets={loanableAssets}
          onRefresh={fetchInventory}
          onOpenCreateMaterialModal={() => {
            setEditingMaterial(null)
            setPendingMaterialImageFile(null)
            setMaterialForm({
              name: '',
              category: 'GENERAL',
              materialType: 'REUSABLE',
              totalQty: 1,
              unit: 'ชิ้น',
              location: '',
              imageUrl: null,
              notes: '',
              isActive: true,
            })
            setMaterialModalMode('create')
          }}
          onOpenEditMaterialModal={(m) => {
            setEditingMaterial(m)
            setPendingMaterialImageFile(null)
            setMaterialForm({
              name: m.name,
              category: m.category,
              materialType: m.materialType,
              totalQty: m.totalQty,
              unit: m.unit,
              location: m.location || '',
              imageUrl: m.imageUrl || null,
              notes: m.notes || '',
              isActive: m.isActive,
            })
            setMaterialModalMode('edit')
          }}
          onPreviewItem={setPreviewItem}
          onToggleMaterialActive={handleToggleMaterialActive}
          onDeleteMaterial={handleDeleteMaterial}
          onOpenAssetImageModal={(asset) => {
            setAssetImageModalData(asset)
            setAssetImageDraftUrl(asset.imageUrl || null)
            setPendingAssetImageFile(null)
          }}
          onToggleAssetLoanable={handleToggleAssetLoanable}
        />
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
                    <div className="emptyBasketNotice">
                      ยังไม่มีอุปกรณ์ในตะกร้า (กรุณาเลือกจากแท็บ &quot;คลังอุปกรณ์พร้อมยืม&quot;)
                    </div>
                  ) : (
                    <div className="basketItemsList">
                      {basket.map((item, idx) => (
                        <div key={`${item.itemType}-${item.id}`} className="basketItemRow">
                          <div className="basketItemLead">
                            <EquipmentItemThumbnail
                              imageUrl={item.imageUrl}
                              name={item.name}
                              variant="thumb"
                            />
                            <div>
                              <div className="fontSemibold textPrimary">{item.name}</div>
                              <div className="basketItemCode">รหัส: {item.code} ({item.unit})</div>
                            </div>
                          </div>

                          <div className="basketItemControls">
                            <div className="qtyControl">
                              <button
                                type="button"
                                className="qtyBtn"
                                onClick={() => handleUpdateBasketQty(idx, -1)}
                              >
                                -
                              </button>
                              <span className="qtyValueDisplay">
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
                              className="basketRemoveBtn"
                              title="ลบรายการนี้"
                              aria-label={`ลบ ${item.name}`}
                            >
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="formGroup">
                  <label>วัตถุประสงค์ในการยืมใช้งาน <span className="requiredMark">*</span></label>
                  <input
                    type="text"
                    required
                    className="formControl"
                    placeholder="เช่น เพื่อใช้ในงานสัมมนาผู้สูงอายุ, จัดอบรม CPR, ซ้อมแผนฉุกเฉิน…"
                    value={borrowForm.purpose}
                    onChange={(e) => setBorrowForm({ ...borrowForm, purpose: e.target.value })}
                  />
                </div>

                <div className="formGroup">
                  <label>สถานที่นำไปใช้งาน</label>
                  <input
                    type="text"
                    className="formControl"
                    placeholder="เช่น ห้องประชุมใหญ่ ชั้น 2, ตึกอุบัติเหตุ, รพ.สต.บ้านเถิน…"
                    value={borrowForm.location}
                    onChange={(e) => setBorrowForm({ ...borrowForm, location: e.target.value })}
                  />
                </div>

                <div className="gridTwoCol">
                  <div className="formGroup">
                    <label>วันที่เริ่มยืม <span className="requiredMark">*</span></label>
                    <input
                      type="date"
                      required
                      className="formControl"
                      value={borrowForm.borrowDate}
                      onChange={(e) => setBorrowForm({ ...borrowForm, borrowDate: e.target.value })}
                    />
                  </div>

                  <div className="formGroup">
                    <label>วันที่คาดว่าจะส่งคืน <span className="requiredMark">*</span></label>
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
                    placeholder="รายละเอียดเพิ่มเติมสำหรับการจัดเตรียม…"
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
                  {isSubmittingBorrow ? 'กำลังบันทึก…' : 'ยื่นใบขอยืมอุปกรณ์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <EquipmentBorrowModals
        currentUser={currentUser}
        loading={loading}
        isUploadingImage={isUploadingImage}
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
        pendingMaterialImageFile={pendingMaterialImageFile}
        setPendingMaterialImageFile={setPendingMaterialImageFile}
        handleSaveMaterial={handleSaveMaterial}
        assetImageModalData={assetImageModalData}
        setAssetImageModalData={setAssetImageModalData}
        assetImageDraftUrl={assetImageDraftUrl}
        setAssetImageDraftUrl={setAssetImageDraftUrl}
        pendingAssetImageFile={pendingAssetImageFile}
        setPendingAssetImageFile={setPendingAssetImageFile}
        handleSaveAssetImage={handleSaveAssetImage}
        viewDetailModalData={viewDetailModalData}
        setViewDetailModalData={setViewDetailModalData}
        openReturnInspectionModal={openReturnInspectionModal}
      />

      <ItemImageLightboxModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onAddToBasket={
          previewItem && activeTab === 'catalog' && (previewItem.availableQty ?? 0) > 0
            ? () => {
                const match = catalogItems.find(
                  (c) => c.id === previewItem.id && c.itemType === previewItem.itemType
                )
                if (match) handleAddToBasket(match)
              }
            : undefined
        }
      />
    </div>
  )
}
