'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  Trash2, 
  Shield, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  PenTool,
  Wallet,
  BookOpen,
  Wrench,
  FileUp,
  Coins,
  Newspaper,
  Save,
  RefreshCw,
  UserCheck,
  Sliders,
  Users,
  Pill,
  FileSpreadsheet,
  Scale,
  MapPin,
  Inbox,
  Package,
  Palette,
  Monitor,
  HeartPulse,
  Building2,
  Search,
  Filter,
  Check,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  LayoutGrid,
  ListFilter
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

interface PermissionMapping {
  id: number
  permission_key: string
  position_name: string
}

type PermCategory = 'all' | 'repairs' | 'media' | 'facility' | 'finance' | 'governance'

interface PermissionMetaItem {
  key: string
  label: string
  shortLabel: string
  desc: string
  category: 'repairs' | 'media' | 'facility' | 'finance' | 'governance'
  categoryLabel: string
  icon: any
  color: string
  bg: string
  border: string
}

const PERMISSIONS_METADATA: Record<string, PermissionMetaItem> = {
  // Repairs & Workflow
  manage_inbox: {
    key: 'manage_inbox',
    label: 'ดูแลระบบกล่องงานและสายการอนุมัติ (manage_inbox)',
    shortLabel: 'ดูแลระบบกล่องงานกลาง',
    desc: 'ผู้ดูแลระบบกล่องงานกลาง ตรวจสอบและติดตามขั้นตอนงานและสถานะเอกสารทั้งหมด',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: Inbox,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },
  manage_repairs: {
    key: 'manage_repairs',
    label: 'ดูแลระบบแจ้งซ่อมและกล่องงานช่าง (manage_repairs)',
    shortLabel: 'ดูแลระบบงานซ่อมบำรุง',
    desc: 'ทีมหัวหน้าช่างและผู้ดูแลระบบงานซ่อมบำรุง ตรวจสอบและมอบหมายงานซ่อมทั้งหมด',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: Wrench,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe'
  },
  view_all_work: {
    key: 'view_all_work',
    label: 'ดูแลระบบ/ดูงานช่างทั้งหมด (view_all_work)',
    shortLabel: 'ดูงานช่างทั้งหมด',
    desc: 'สิทธิ์ดูและติดตามงานช่างทุกรายการในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: Wrench,
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe'
  },
  view_it_repairs: {
    key: 'view_it_repairs',
    label: 'ดูงานแจ้งซ่อมคอมพิวเตอร์และไอทีทั้งหมด (view_it_repairs)',
    shortLabel: 'ดูงานซ่อมคอมฯ/ไอที',
    desc: 'อนุญาตให้ดูและติดตามงานแจ้งซ่อมศูนย์คอมพิวเตอร์และสารสนเทศทั้งหมดในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: Monitor,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },
  view_general_repairs: {
    key: 'view_general_repairs',
    label: 'ดูงานแจ้งซ่อมบำรุงทั่วไปทั้งหมด (view_general_repairs)',
    shortLabel: 'ดูงานซ่อมช่างทั่วไป',
    desc: 'อนุญาตให้ดูและติดตามงานแจ้งซ่อมบำรุงทั่วไป/งานช่างทั้งหมดในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: Wrench,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  },
  view_medical_repairs: {
    key: 'view_medical_repairs',
    label: 'ดูงานแจ้งซ่อมเครื่องมือแพทย์ทั้งหมด (view_medical_repairs)',
    shortLabel: 'ดูงานซ่อมเครื่องมือแพทย์',
    desc: 'อนุญาตให้ดูและติดตามงานแจ้งซ่อมเครื่องมือทางการแพทย์ทั้งหมดในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: HeartPulse,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3'
  },
  view_department_tasks: {
    key: 'view_department_tasks',
    label: 'ดูงานทั้งหมดในหน่วยงานของตนเอง (view_department_tasks)',
    shortLabel: 'ดูงานในหน่วยงานของตนเอง',
    desc: 'อนุญาตให้ดูงานทุกประเภทที่สร้างโดยสมาชิกในกลุ่มงานหรือหน่วยงานเดียวกัน',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    icon: Building2,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },

  // Media & PR
  manage_media_requests: {
    key: 'manage_media_requests',
    label: 'ดูแลระบบขอสื่อประชาสัมพันธ์ (manage_media_requests)',
    shortLabel: 'ดูแลระบบขอสื่อประชาสัมพันธ์',
    desc: 'ทีมประชาสัมพันธ์หรือผู้รับผิดชอบงานสื่อ ดูแลคำขอผลิตสื่อ ตรวจสอบขั้นตอน และดูงานขอสื่อทั้งหมด',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    icon: Palette,
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4'
  },
  view_media_requests: {
    key: 'view_media_requests',
    label: 'ดูงานขอสื่อประชาสัมพันธ์ทั้งหมด (view_media_requests)',
    shortLabel: 'ดูงานขอสื่อทั้งหมด (Read-only)',
    desc: 'อนุญาตให้ดูและติดตามงานขอผลิตสื่อประชาสัมพันธ์ทั้งหมดในระบบ',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    icon: Palette,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe'
  },
  manage_news: {
    key: 'manage_news',
    label: 'จัดการและลงข่าวประชาสัมพันธ์ (manage_news)',
    shortLabel: 'จัดการข่าวประชาสัมพันธ์หน้าเว็บ',
    desc: 'ทีมประชาสัมพันธ์สามารถเขียน แก้ไข และเผยแพร่ข่าวสารหน้าเว็บไซต์',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    icon: Newspaper,
    color: '#f43f5e',
    bg: '#fff1f2',
    border: '#fecdd3'
  },

  // Facility & Assets
  manage_assets: {
    key: 'manage_assets',
    label: 'จัดการข้อมูลครุภัณฑ์และพัสดุ (manage_assets)',
    shortLabel: 'จัดการทะเบียนครุภัณฑ์',
    desc: 'เจ้าหน้าที่พัสดุและผู้ดูแลระบบครุภัณฑ์ สำหรับจัดการข้อมูล ค้นหา และตรวจสอบสถานะประกัน',
    category: 'facility',
    categoryLabel: 'งานพัสดุ & สถานที่',
    icon: Package,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },
  manage_locations: {
    key: 'manage_locations',
    label: 'จัดการข้อมูลสถานที่ ตึก-ชั้น-ห้อง (manage_locations)',
    shortLabel: 'จัดการสถานที่ ตึก-ชั้น-ห้อง',
    desc: 'เจ้าหน้าที่ผู้ดูแลระบบสถานที่ ตึก ชั้น และห้อง สำหรับระบบงานและระบบแจ้งซ่อม',
    category: 'facility',
    categoryLabel: 'งานพัสดุ & สถานที่',
    icon: MapPin,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },

  // Finance & HR
  upload_salary: {
    key: 'upload_salary',
    label: 'อัปโหลดเงินเดือน/ค่าตอบแทน (upload_salary)',
    shortLabel: 'อัปโหลดไฟล์สลิปเงินเดือน',
    desc: 'ฝ่ายการเงินสามารถอัปโหลดไฟล์สลิปเงินเดือนและข้อมูลค่าตอบแทนเข้าระบบ',
    category: 'finance',
    categoryLabel: 'งานการเงิน & บุคลากร',
    icon: FileUp,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },
  view_all_salary: {
    key: 'view_all_salary',
    label: 'ดูสลิปเงินเดือนบุคลากรทุกคน (view_all_salary)',
    shortLabel: 'ดูสลิปเงินเดือนบุคลากรทุกคน',
    desc: 'เจ้าหน้าที่ฝ่ายบุคคลหรือผู้บริหารที่ได้รับอนุญาตตรวจสอบข้อมูลเงินเดือนรวม',
    category: 'finance',
    categoryLabel: 'งานการเงิน & บุคลากร',
    icon: Coins,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  },

  // Governance & Admin
  manage_ita: {
    key: 'manage_ita',
    label: 'จัดการบทความและข้อมูล ITA (manage_ita)',
    shortLabel: 'จัดการบทความ & เอกสาร ITA',
    desc: 'ผู้รับผิดชอบประเมินคุณธรรมและความโปร่งใส (ITA) ในการเขียนและเผยแพร่ข้อมูล',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    icon: BookOpen,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe'
  },
  manage_rdu: {
    key: 'manage_rdu',
    label: 'จัดการข้อมูลและเอกสาร RDU (manage_rdu)',
    shortLabel: 'จัดการเอกสารใช้ยาสมเหตุผล (RDU)',
    desc: 'ผู้รับผิดชอบงานใช้ยาอย่างสมเหตุผล (RDU) จัดการโฟลเดอร์ปีและอัปโหลดไฟล์ PDF',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    icon: Pill,
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4'
  },
  manage_ethics: {
    key: 'manage_ethics',
    label: 'จัดการเอกสารชมรมจริยธรรม (manage_ethics)',
    shortLabel: 'จัดการเอกสารชมรมจริยธรรม',
    desc: 'คณะทำงานขับเคลื่อนชมรมจริยธรรมในการเพิ่มปีงบประมาณและอัปโหลดเอกสาร PDF',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    icon: Scale,
    color: '#4f46e5',
    bg: '#eef2ff',
    border: '#c7d2fe'
  },
  manage_outgoing_doc: {
    key: 'manage_outgoing_doc',
    label: 'จัดการหนังสือส่งออก Online (manage_outgoing_doc)',
    shortLabel: 'จัดการหนังสือส่งออก Online',
    desc: 'เจ้าหน้าที่งานสารบรรณ/ธุรการที่ได้รับมอบหมายให้จัดการลิงก์ Google Sheets หนังสือส่งออก',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    icon: FileSpreadsheet,
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0'
  }
}

const CATEGORY_TABS: { id: PermCategory; label: string; icon: any }[] = [
  { id: 'all', label: 'ทั้งหมด (All)', icon: Layers },
  { id: 'repairs', label: 'งานซ่อมบำรุง & ช่าง', icon: Wrench },
  { id: 'media', label: 'สื่อ & ประชาสัมพันธ์', icon: Palette },
  { id: 'facility', label: 'พัสดุ & สถานที่', icon: Package },
  { id: 'finance', label: 'การเงิน & บุคลากร', icon: Wallet },
  { id: 'governance', label: 'ธรรมาภิบาล & สารบรรณ', icon: BookOpen }
]

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  // Feature Toggles state
  const [featureInbox, setFeatureInbox] = useState(initialSettings['feature_inbox'] !== '0')
  const [featureSignature, setFeatureSignature] = useState(initialSettings['feature_signature'] !== '0')
  const [featureSalary, setFeatureSalary] = useState(initialSettings['feature_salary'] !== '0')
  const [featureIta, setFeatureIta] = useState(initialSettings['feature_ita'] !== '0')
  const [featureRdu, setFeatureRdu] = useState(initialSettings['feature_rdu'] !== '0')
  const [featureRepair, setFeatureRepair] = useState(initialSettings['feature_repair'] !== '0')
  const [featureMediaRequest, setFeatureMediaRequest] = useState(initialSettings['feature_media_request'] !== '0')
  
  const [initialFeatureState, setInitialFeatureState] = useState({
    featureInbox: initialSettings['feature_inbox'] !== '0',
    featureSignature: initialSettings['feature_signature'] !== '0',
    featureSalary: initialSettings['feature_salary'] !== '0',
    featureIta: initialSettings['feature_ita'] !== '0',
    featureRdu: initialSettings['feature_rdu'] !== '0',
    featureRepair: initialSettings['feature_repair'] !== '0',
    featureMediaRequest: initialSettings['feature_media_request'] !== '0',
  })

  const isFeaturesDirty = useMemo(() => {
    return (
      featureInbox !== initialFeatureState.featureInbox ||
      featureSignature !== initialFeatureState.featureSignature ||
      featureSalary !== initialFeatureState.featureSalary ||
      featureIta !== initialFeatureState.featureIta ||
      featureRdu !== initialFeatureState.featureRdu ||
      featureRepair !== initialFeatureState.featureRepair ||
      featureMediaRequest !== initialFeatureState.featureMediaRequest
    )
  }, [featureInbox, featureSignature, featureSalary, featureIta, featureRdu, featureRepair, featureMediaRequest, initialFeatureState])

  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'features' | 'positions'>('features')
  const [positionViewMode, setPositionViewMode] = useState<'byPermission' | 'byPosition'>('byPermission')
  const [selectedCategory, setSelectedCategory] = useState<PermCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Permissions Data
  const [permissions, setPermissions] = useState<PermissionMapping[]>([])
  const [availablePositions, setAvailablePositions] = useState<string[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)

  // Add Permission Form State
  const [newPosition, setNewPosition] = useState('')
  const [newPermKey, setNewPermKey] = useState('manage_repairs')
  const [customPosition, setCustomPosition] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [isAddingPerm, setIsAddingPerm] = useState(false)

  // Delete Target Dialog
  const [deletePermTarget, setDeletePermTarget] = useState<{ permKey: string; positionName: string } | null>(null)
  const [isDeletingPerm, setIsDeletingPerm] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const fetchPermissions = async () => {
    setLoadingPerms(true)
    try {
      const res = await fetch('/api/member/permissions')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPermissions(data.mappings || [])
          setAvailablePositions(data.availablePositions || [])
          if (data.availablePositions?.length > 0 && !newPosition) {
            setNewPosition(data.availablePositions[0])
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    } finally {
      setLoadingPerms(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [])

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSavingSettings(true)
    try {
      const payload = {
        feature_inbox: featureInbox ? '1' : '0',
        feature_signature: featureSignature ? '1' : '0',
        feature_salary: featureSalary ? '1' : '0',
        feature_ita: featureIta ? '1' : '0',
        feature_rdu: featureRdu ? '1' : '0',
        feature_repair: featureRepair ? '1' : '0',
        feature_media_request: featureMediaRequest ? '1' : '0'
      }
      const res = await fetch('/api/member/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
      
      setInitialFeatureState({
        featureInbox,
        featureSignature,
        featureSalary,
        featureIta,
        featureRdu,
        featureRepair,
        featureMediaRequest,
      })
      addToast('บันทึกการตั้งค่าสิทธิ์เข้าใช้งานระบบเรียบร้อยแล้ว', 'success')
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    const position = isCustomMode ? customPosition.trim() : newPosition
    if (!position) {
      addToast('กรุณาระบุหรือเลือกตำแหน่งงาน', 'error')
      return
    }

    setIsAddingPerm(true)
    try {
      const res = await fetch('/api/member/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_key: newPermKey,
          position_name: position
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      
      addToast(`มอบสิทธิ์ให้ตำแหน่ง "${position}" สำเร็จแล้ว`, 'success')
      if (isCustomMode) setCustomPosition('')
      fetchPermissions()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setIsAddingPerm(false)
    }
  }

  const handleConfirmDeletePermission = async () => {
    if (!deletePermTarget) return
    const { permKey, positionName } = deletePermTarget
    setIsDeletingPerm(true)

    try {
      const res = await fetch(`/api/member/permissions?permission_key=${encodeURIComponent(permKey)}&position_name=${encodeURIComponent(positionName)}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      addToast(`ลบสิทธิ์ของตำแหน่ง "${positionName}" เรียบร้อยแล้ว`, 'success')
      fetchPermissions()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setIsDeletingPerm(false)
      setDeletePermTarget(null)
    }
  }

  // Derived Data for Position-Centric Matrix View
  const positionsMap = useMemo(() => {
    const map = new Map<string, PermissionMapping[]>()
    
    // First include all available positions from DB
    availablePositions.forEach((pos) => {
      map.set(pos, [])
    })

    // Group mappings under positions
    permissions.forEach((perm) => {
      const existing = map.get(perm.position_name) || []
      existing.push(perm)
      map.set(perm.position_name, existing)
    })

    return map
  }, [permissions, availablePositions])

  // Filtered Permissions based on Search & Category
  const filteredPermissionKeys = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return Object.keys(PERMISSIONS_METADATA).filter((key) => {
      const meta = PERMISSIONS_METADATA[key]
      if (selectedCategory !== 'all' && meta.category !== selectedCategory) {
        return false
      }
      if (!q) return true

      const mappings = permissions.filter((p) => p.permission_key === key)
      const matchesPositions = mappings.some((m) => m.position_name.toLowerCase().includes(q))
      const matchesMeta =
        meta.label.toLowerCase().includes(q) ||
        meta.shortLabel.toLowerCase().includes(q) ||
        meta.desc.toLowerCase().includes(q) ||
        meta.key.toLowerCase().includes(q)

      return matchesMeta || matchesPositions
    })
  }, [selectedCategory, searchQuery, permissions])

  // Filtered Positions Map for By-Position View
  const filteredPositionsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const entries = Array.from(positionsMap.entries())
    
    return entries.filter(([posName, perms]) => {
      if (selectedCategory !== 'all') {
        const hasCategoryPerm = perms.some((p) => {
          const meta = PERMISSIONS_METADATA[p.permission_key]
          return meta && meta.category === selectedCategory
        })
        if (!hasCategoryPerm) return false
      }

      if (!q) return true
      const matchesPos = posName.toLowerCase().includes(q)
      const matchesPerm = perms.some((p) => {
        const meta = PERMISSIONS_METADATA[p.permission_key]
        return meta && (meta.label.toLowerCase().includes(q) || meta.key.toLowerCase().includes(q))
      })
      return matchesPos || matchesPerm
    })
  }, [positionsMap, selectedCategory, searchQuery])

  // Active module count
  const activeFeaturesCount = [
    featureInbox,
    featureSignature,
    featureSalary,
    featureRepair,
    featureMediaRequest,
    featureIta,
    featureRdu
  ].filter(Boolean).length

  // Unique assigned positions count
  const assignedPositionsCount = useMemo(() => {
    const set = new Set(permissions.map((p) => p.position_name))
    return set.size
  }, [permissions])

  return (
    <div className="settingsClientModern">
      {/* Overview Stat Cards */}
      <section className="overviewStatsGrid" aria-label="สรุปภาพรวมการตั้งค่า">
        <div className="statCard">
          <div className="statIconCircle statIconTeal">
            <SlidersHorizontal size={20} />
          </div>
          <div className="statInfo">
            <span className="statLabel">โมดูลระบบบริการ</span>
            <div className="statValueRow">
              <span className="statNumber">{activeFeaturesCount}</span>
              <span className="statTotal">/ 7 เปิดใช้งาน</span>
            </div>
          </div>
        </div>

        <div className="statCard">
          <div className="statIconCircle statIconBlue">
            <Users size={20} />
          </div>
          <div className="statInfo">
            <span className="statLabel">ตำแหน่งที่ได้รับสิทธิ์</span>
            <div className="statValueRow">
              <span className="statNumber">{assignedPositionsCount}</span>
              <span className="statTotal">ตำแหน่งงาน</span>
            </div>
          </div>
        </div>

        <div className="statCard">
          <div className="statIconCircle statIconPurple">
            <Layers size={20} />
          </div>
          <div className="statInfo">
            <span className="statLabel">กฎสิทธิ์ในระบบ</span>
            <div className="statValueRow">
              <span className="statNumber">{permissions.length}</span>
              <span className="statTotal">การจับคู่สิทธิ์</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tab Navigation */}
      <nav className="modernTabsContainer" aria-label="แถบเมนูการตั้งค่า">
        <div className="tabPillsGroup">
          <button
            type="button"
            className={`mainTabButton ${activeTab === 'features' ? 'isActive' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            <Sliders size={18} />
            <span>เปิด-ปิดระบบบริการทั่วไป</span>
            {isFeaturesDirty && <span className="tabUnsavedDot" title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" />}
          </button>

          <button
            type="button"
            className={`mainTabButton ${activeTab === 'positions' ? 'isActive' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            <UserCheck size={18} />
            <span>จัดการสิทธิ์ตามตำแหน่งงาน</span>
            <span className="tabCountBadge">{permissions.length}</span>
          </button>
        </div>
      </nav>

      {/* ======================================================== */}
      {/* TAB 1: FEATURE TOGGLES                                  */}
      {/* ======================================================== */}
      {activeTab === 'features' && (
        <div className="tabContentSection animate-fadeIn">
          {/* Section Banner */}
          <div className="sectionHeaderCard">
            <div className="sectionHeaderTitleGroup">
              <div className="sectionIconWrapper">
                <Sliders size={20} />
              </div>
              <div>
                <h2>สิทธิ์การเข้าใช้งานบริการของสมาชิกทั่วไป (Module Access Controls)</h2>
                <p>
                  เปิดหรือปิดการเข้าถึงฟังก์ชันต่างๆ บนเว็บไซต์สำหรับบุคลากรทั่วไป หากปิดการใช้งาน เมนูดังกล่าวจะถูกซ่อนและไม่อนุญาตให้เข้าถึง
                </p>
              </div>
            </div>

            {isFeaturesDirty && (
              <div className="unsavedAlertBanner">
                <Info size={16} />
                <span>มีการปรับเปลี่ยนสิทธิ์ที่ยังไม่ได้บันทึก</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveSettings}>
            {/* Group 1: Core Staff Services */}
            <div className="featureGroupContainer">
              <div className="groupTitleHeader">
                <Sparkles size={16} className="groupIcon" />
                <h3>บริการสำหรับบุคลากรภายในโรงพยาบาล (Staff Services)</h3>
              </div>

              <div className="featureCardsGrid">
                {/* 1. Unified Task Inbox */}
                <div className={`modernFeatureCard ${featureInbox ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                      <Inbox size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureInbox}
                        onChange={(e) => setFeatureInbox(e.target.checked)}
                        aria-label="เปิดปิดระบบกล่องงานกลาง"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>ระบบกล่องงานกลาง (Unified Inbox)</h4>
                      <span className={`badgeStatus ${featureInbox ? 'badgeOn' : 'badgeOff'}`}>
                        {featureInbox ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      ศูนย์รวมการติดตามงาน เอกสารที่ต้องลงนาม งานซ่อมบำรุง และคำขอบริการทุกประเภทของโรงพยาบาล
                    </p>
                  </div>
                </div>

                {/* 2. Digital Signature */}
                <div className={`modernFeatureCard ${featureSignature ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#f0fdf4', color: '#059669' }}>
                      <PenTool size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureSignature}
                        onChange={(e) => setFeatureSignature(e.target.checked)}
                        aria-label="เปิดปิดระบบจัดการลายเซ็นดิจิทัล"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>จัดการลายเซ็นดิจิทัล (Digital Signature)</h4>
                      <span className={`badgeStatus ${featureSignature ? 'badgeOn' : 'badgeOff'}`}>
                        {featureSignature ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      อนุญาตให้บุคลากรวาดหรืออัปโหลดลายเซ็นอิเล็กทรอนิกส์เพื่อใช้ในการลงนามเอกสารและตรวจรับงาน
                    </p>
                  </div>
                </div>

                {/* 3. Salary Pay Slips */}
                <div className={`modernFeatureCard ${featureSalary ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#fffbeb', color: '#d97706' }}>
                      <Wallet size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureSalary}
                        onChange={(e) => setFeatureSalary(e.target.checked)}
                        aria-label="เปิดปิดระบบตรวจสอบสลิปเงินเดือน"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>ตรวจสอบสลิปเงินเดือน & ค่าตอบแทน</h4>
                      <span className={`badgeStatus ${featureSalary ? 'badgeOn' : 'badgeOff'}`}>
                        {featureSalary ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      อนุญาตให้บุคลากรยืนยันตัวตนด้วยเลขบัตรประชาชนเพื่อเปิดดูและพิมพ์ใบแจ้งยอดเงินเดือนรายเดือน
                    </p>
                  </div>
                </div>

                {/* 4. Hospital Repairs */}
                <div className={`modernFeatureCard ${featureRepair ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                      <Wrench size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureRepair}
                        onChange={(e) => setFeatureRepair(e.target.checked)}
                        aria-label="เปิดปิดระบบแจ้งซ่อมบำรุง"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>ระบบแจ้งซ่อมบำรุงโรงพยาบาล</h4>
                      <span className={`badgeStatus ${featureRepair ? 'badgeOn' : 'badgeOff'}`}>
                        {featureRepair ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      อนุญาตให้บุคลากรยื่นคำขอแจ้งซ่อมงานช่าง งานคอมพิวเตอร์ และเครื่องมือแพทย์ พร้อมเชื่อมต่อ Telegram
                    </p>
                  </div>
                </div>

                {/* 5. Media & PR Requests */}
                <div className={`modernFeatureCard ${featureMediaRequest ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#f0fdfa', color: '#0d9488' }}>
                      <Palette size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureMediaRequest}
                        onChange={(e) => setFeatureMediaRequest(e.target.checked)}
                        aria-label="เปิดปิดระบบขอสื่อประชาสัมพันธ์"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>ระบบขอสื่อและประชาสัมพันธ์</h4>
                      <span className={`badgeStatus ${featureMediaRequest ? 'badgeOn' : 'badgeOff'}`}>
                        {featureMediaRequest ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      อนุญาตให้บุคลากรยื่นคำขอผลิตสื่อ โปสเตอร์ แผ่นพับ Artwork และวิดีโอประชาสัมพันธ์ของโรงพยาบาล
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: Public Info & Content Management */}
            <div className="featureGroupContainer">
              <div className="groupTitleHeader">
                <BookOpen size={16} className="groupIcon" />
                <h3>ข้อมูลสาธารณะและเอกสารองค์กร (Public Info & Governance)</h3>
              </div>

              <div className="featureCardsGrid">
                {/* 6. ITA Management */}
                <div className={`modernFeatureCard ${featureIta ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                      <BookOpen size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureIta}
                        onChange={(e) => setFeatureIta(e.target.checked)}
                        aria-label="เปิดปิดระบบจัดการบทความ ITA"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>ระบบจัดการบทความ & เอกสาร ITA</h4>
                      <span className={`badgeStatus ${featureIta ? 'badgeOn' : 'badgeOff'}`}>
                        {featureIta ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      อนุญาตให้อ่านบทความและเปิดสิทธิ์ให้ผู้รับผิดชอบเข้าจัดการเอกสารประเมิน ITA
                    </p>
                  </div>
                </div>

                {/* 7. RDU Management */}
                <div className={`modernFeatureCard ${featureRdu ? 'featureActive' : 'featureInactive'}`}>
                  <div className="featureHeaderRow">
                    <div className="featureIcon" style={{ background: '#f0fdfa', color: '#0d9488' }}>
                      <Pill size={22} />
                    </div>
                    <label className="toggleSwitch">
                      <input
                        type="checkbox"
                        checked={featureRdu}
                        onChange={(e) => setFeatureRdu(e.target.checked)}
                        aria-label="เปิดปิดระบบจัดการเอกสาร RDU"
                      />
                      <span className="toggleSlider"></span>
                    </label>
                  </div>
                  <div className="featureBody">
                    <div className="featureTitleWrap">
                      <h4>ระบบจัดการเอกสาร RDU (การใช้ยาสมเหตุผล)</h4>
                      <span className={`badgeStatus ${featureRdu ? 'badgeOn' : 'badgeOff'}`}>
                        {featureRdu ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                      </span>
                    </div>
                    <p>
                      อนุญาตให้เข้าใช้งานระบบจัดทำโฟลเดอร์ปีงบประมาณและอัปโหลดเอกสารเผยแพร่ RDU
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Save Bar */}
            <div className={`stickySaveActionBar ${isFeaturesDirty ? 'isDirtyVisible' : ''}`}>
              <div className="saveBarContent">
                <div className="saveBarLeft">
                  <div className="saveIndicatorDot"></div>
                  <span>
                    {isFeaturesDirty 
                      ? 'มีการเปลี่ยนแปลงการตั้งค่าโมดูลที่ยังไม่ได้บันทึก' 
                      : 'การตั้งค่าทั้งหมดเป็นปัจจุบันแล้ว'}
                  </span>
                </div>
                <button
                  type="submit"
                  className="btnSaveSettings"
                  disabled={isSavingSettings || !isFeaturesDirty}
                >
                  {isSavingSettings ? (
                    <>
                      <RefreshCw size={18} className="spinAnimation" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>บันทึกการตั้งค่าระบบ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: POSITION PERMISSIONS MANAGER                     */}
      {/* ======================================================== */}
      {activeTab === 'positions' && (
        <div className="tabContentSection animate-fadeIn">
          {/* Fast Add Permission Box */}
          <div className="smartAddPermCard">
            <div className="addCardHeader">
              <div className="addCardHeaderLeft">
                <div className="addIconBadge">
                  <Plus size={18} />
                </div>
                <div>
                  <h3>เพิ่มสิทธิ์การใช้งานให้ตำแหน่งงาน (Grant Permission)</h3>
                  <p>เลือกสิทธิ์และระบุตำแหน่งงานที่ต้องการมอบหมาย ระบบจะเชื่อมโยงสิทธิ์ให้อัตโนมัติ</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddPermission} className="addPermFormGrid">
              {/* Field 1: Permission Key */}
              <div className="formFieldGroup">
                <label htmlFor="permKeySelect">1. เลือกสิทธิ์การใช้งาน</label>
                <select
                  id="permKeySelect"
                  value={newPermKey}
                  onChange={(e) => setNewPermKey(e.target.value)}
                  className="modernSelectInput"
                >
                  <optgroup label="🛠️ งานซ่อมบำรุง & กล่องงาน">
                    <option value="manage_inbox">ดูแลระบบกล่องงานและสายการอนุมัติ (manage_inbox)</option>
                    <option value="manage_repairs">ดูแลระบบแจ้งซ่อมและกล่องงานช่าง (manage_repairs)</option>
                    <option value="view_all_work">ดูแลระบบ/ดูงานช่างทั้งหมด (view_all_work)</option>
                    <option value="view_it_repairs">ดูงานแจ้งซ่อมคอมพิวเตอร์และไอทีทั้งหมด (view_it_repairs)</option>
                    <option value="view_general_repairs">ดูงานแจ้งซ่อมบำรุงทั่วไปทั้งหมด (view_general_repairs)</option>
                    <option value="view_medical_repairs">ดูงานแจ้งซ่อมเครื่องมือแพทย์ทั้งหมด (view_medical_repairs)</option>
                    <option value="view_department_tasks">ดูงานทั้งหมดในหน่วยงานของตนเอง (view_department_tasks)</option>
                  </optgroup>
                  <optgroup label="🎨 งานสื่อ & ประชาสัมพันธ์">
                    <option value="manage_media_requests">ดูแลระบบขอสื่อประชาสัมพันธ์ (manage_media_requests)</option>
                    <option value="view_media_requests">ดูงานขอสื่อประชาสัมพันธ์ทั้งหมด (view_media_requests)</option>
                    <option value="manage_news">จัดการและลงข่าวประชาสัมพันธ์ (manage_news)</option>
                  </optgroup>
                  <optgroup label="📦 งานพัสดุ & สถานที่">
                    <option value="manage_assets">จัดการข้อมูลครุภัณฑ์และพัสดุ (manage_assets)</option>
                    <option value="manage_locations">จัดการข้อมูลสถานที่ ตึก-ชั้น-ห้อง (manage_locations)</option>
                  </optgroup>
                  <optgroup label="💰 งานการเงิน & บุคลากร">
                    <option value="upload_salary">อัปโหลดเงินเดือน/ค่าตอบแทน (upload_salary)</option>
                    <option value="view_all_salary">ดูสลิปเงินเดือนบุคลากรทุกคน (view_all_salary)</option>
                  </optgroup>
                  <optgroup label="📋 งานธรรมาภิบาล & สารบรรณ">
                    <option value="manage_ita">จัดการข้อมูลและบทความ ITA (manage_ita)</option>
                    <option value="manage_rdu">จัดการข้อมูลและเอกสาร RDU (manage_rdu)</option>
                    <option value="manage_ethics">จัดการเอกสารชมรมจริยธรรม (manage_ethics)</option>
                    <option value="manage_outgoing_doc">จัดการหนังสือส่งออก Online (manage_outgoing_doc)</option>
                  </optgroup>
                </select>
              </div>

              {/* Field 2: Target Position */}
              <div className="formFieldGroup">
                <div className="fieldLabelHeader">
                  <label htmlFor="targetPosition">2. ตำแหน่งงานบุคลากร</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="btnToggleCustomPos"
                  >
                    {isCustomMode ? '← เลือกจากระบบ' : '✍️ พิมพ์ตำแหน่งเอง'}
                  </button>
                </div>

                {isCustomMode ? (
                  <input
                    id="targetPosition"
                    type="text"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    placeholder="เช่น นักวิชาการคอมพิวเตอร์, หัวหน้ากลุ่มงาน"
                    className="modernTextInput"
                    required
                  />
                ) : (
                  <select
                    id="targetPosition"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="modernSelectInput"
                  >
                    {availablePositions.length === 0 ? (
                      <option value="">-- ไม่พบตำแหน่งในฐานข้อมูล ให้กดพิมพ์เอง --</option>
                    ) : (
                      availablePositions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Submit Button */}
              <div className="formSubmitGroup">
                <button
                  type="submit"
                  className="btnSubmitPermission"
                  disabled={isAddingPerm}
                >
                  {isAddingPerm ? (
                    <RefreshCw size={16} className="spinAnimation" />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>มอบสิทธิ์นี้</span>
                </button>
              </div>
            </form>
          </div>

          {/* Filtering & View Switcher Bar */}
          <div className="filterAndSearchToolbar">
            {/* Search Input */}
            <div className="searchBoxWrapper">
              <Search size={16} className="searchIcon" />
              <input
                type="text"
                placeholder="ค้นหาชื่อตำแหน่งงาน, รหัสสิทธิ์ หรือคำอธิบาย..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="searchInput"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="clearSearchBtn"
                  aria-label="ล้างการค้นหา"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="viewModeToggleGroup">
              <button
                type="button"
                className={`viewModeBtn ${positionViewMode === 'byPermission' ? 'isActive' : ''}`}
                onClick={() => setPositionViewMode('byPermission')}
                title="แสดงผลตามกลุ่มสิทธิ์"
              >
                <LayoutGrid size={15} />
                <span>ตามสิทธิ์ ({filteredPermissionKeys.length})</span>
              </button>

              <button
                type="button"
                className={`viewModeBtn ${positionViewMode === 'byPosition' ? 'isActive' : ''}`}
                onClick={() => setPositionViewMode('byPosition')}
                title="แสดงผลตามตำแหน่งงาน"
              >
                <ListFilter size={15} />
                <span>ตามตำแหน่ง ({filteredPositionsList.length})</span>
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="categoryFilterChips">
            {CATEGORY_TABS.map((cat) => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`categoryChip ${selectedCategory === cat.id ? 'chipActive' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* ======================================================== */}
          {/* VIEW MODE 1: BY PERMISSION CARDS                         */}
          {/* ======================================================== */}
          {positionViewMode === 'byPermission' && (
            <div className="permissionsGroupGrid">
              {loadingPerms ? (
                <div className="modernLoadingCard">
                  <RefreshCw size={28} className="spinAnimation text-teal-600" />
                  <p>กำลังโหลดรายการสิทธิ์ตามตำแหน่งงาน...</p>
                </div>
              ) : filteredPermissionKeys.length === 0 ? (
                <div className="modernEmptyStateCard">
                  <div className="emptyIconCircle">
                    <Filter size={32} />
                  </div>
                  <h4>ไม่พบรายการสิทธิ์ที่ตรงกับเงื่อนไขการค้นหา</h4>
                  <p>ลองปรับคำค้นหา หรือเลือกหมวดหมู่อื่นดูใหม่อีกครั้ง</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                    }}
                    className="btnResetFilter"
                  >
                    รีเซ็ตตัวกรองทั้งหมด
                  </button>
                </div>
              ) : (
                filteredPermissionKeys.map((key) => {
                  const meta = PERMISSIONS_METADATA[key]
                  if (!meta) return null
                  const Icon = meta.icon
                  const assignedMappings = permissions.filter((p) => p.permission_key === key)

                  return (
                    <div key={key} className="permissionCardItem">
                      <div className="cardHeaderRow">
                        <div className="cardHeaderLeft">
                          <div
                            className="permBadgeIcon"
                            style={{
                              color: meta.color,
                              background: meta.bg,
                              border: `1px solid ${meta.border}`
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="permTitleRow">
                              <h4 className="permTitle">{meta.shortLabel}</h4>
                              <code className="permKeyCode">{meta.key}</code>
                            </div>
                            <p className="permDescription">{meta.desc}</p>
                          </div>
                        </div>

                        <div className="cardHeaderRight">
                          <span className={`assignedCountChip ${assignedMappings.length > 0 ? 'hasAssigned' : 'noAssigned'}`}>
                            {assignedMappings.length} ตำแหน่ง
                          </span>
                        </div>
                      </div>

                      <div className="cardBodyRow">
                        {assignedMappings.length === 0 ? (
                          <div className="unassignedAlert">
                            <Info size={14} />
                            <span>ยังไม่มีการมอบหมายตำแหน่งงานใดๆ ในสิทธิ์นี้</span>
                          </div>
                        ) : (
                          <div className="tagsContainer">
                            {assignedMappings.map((mapping) => (
                              <div key={mapping.id} className="modernPositionTag">
                                <span className="positionText">{mapping.position_name}</span>
                                <button
                                  type="button"
                                  onClick={() => setDeletePermTarget({ permKey: mapping.permission_key, positionName: mapping.position_name })}
                                  className="btnRemoveTag"
                                  title={`ลบสิทธิ์ "${meta.shortLabel}" ออกจากตำแหน่ง "${mapping.position_name}"`}
                                  aria-label={`ลบสิทธิ์ ${mapping.position_name}`}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW MODE 2: BY POSITION PROFILE CARDS                   */}
          {/* ======================================================== */}
          {positionViewMode === 'byPosition' && (
            <div className="positionsMatrixGrid">
              {loadingPerms ? (
                <div className="modernLoadingCard">
                  <RefreshCw size={28} className="spinAnimation text-teal-600" />
                  <p>กำลังโหลดข้อมูลตำแหน่งงาน...</p>
                </div>
              ) : filteredPositionsList.length === 0 ? (
                <div className="modernEmptyStateCard">
                  <div className="emptyIconCircle">
                    <Users size={32} />
                  </div>
                  <h4>ไม่พบตำแหน่งงานที่ตรงกับเงื่อนไขการค้นหา</h4>
                  <p>ลองปรับคำค้นหา หรือเลือกหมวดหมู่อื่นดูใหม่อีกครั้ง</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                    }}
                    className="btnResetFilter"
                  >
                    รีเซ็ตตัวกรองทั้งหมด
                  </button>
                </div>
              ) : (
                filteredPositionsList.map(([positionName, perms]) => (
                  <div key={positionName} className="positionProfileCard">
                    <div className="positionProfileHeader">
                      <div className="profileHeaderLeft">
                        <div className="profileIconCircle">
                          <UserCheck size={18} />
                        </div>
                        <div>
                          <h4 className="positionHeading">{positionName}</h4>
                          <span className="positionSubtitle">
                            ได้รับมอบหมาย {perms.length} สิทธิ์ในระบบ
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewPosition(positionName)
                          setIsCustomMode(false)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="btnQuickAddForPos"
                        title="เพิ่มสิทธิ์ใหม่ให้ตำแหน่งนี้"
                      >
                        <Plus size={14} />
                        <span>เพิ่มสิทธิ์</span>
                      </button>
                    </div>

                    <div className="positionProfileBody">
                      {perms.length === 0 ? (
                        <div className="emptyPermsForPos">
                          <span>ตำแหน่งนี้มีเฉพาะสิทธิ์สมาชิกทั่วไป (ไม่มีสิทธิ์พิเศษ)</span>
                        </div>
                      ) : (
                        <div className="permsChipsList">
                          {perms.map((p) => {
                            const meta = PERMISSIONS_METADATA[p.permission_key]
                            const Icon = meta?.icon || Shield
                            return (
                              <div key={p.id} className="permBadgeChip">
                                <div className="permChipLeft">
                                  <Icon size={14} style={{ color: meta?.color || '#0d9488' }} />
                                  <span className="permChipName">{meta?.shortLabel || p.permission_key}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDeletePermTarget({ permKey: p.permission_key, positionName })}
                                  className="btnDeletePermFromPos"
                                  title={`ลบสิทธิ์ ${meta?.shortLabel || p.permission_key}`}
                                  aria-label={`ลบสิทธิ์ ${meta?.shortLabel || p.permission_key}`}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Permission Removal */}
      <ConfirmDialog
        isOpen={deletePermTarget !== null}
        title="ยืนยันการลบสิทธิ์การใช้งาน"
        description={`คุณต้องการลบสิทธิ์ "${PERMISSIONS_METADATA[deletePermTarget?.permKey || '']?.shortLabel || deletePermTarget?.permKey}" ของตำแหน่ง "${deletePermTarget?.positionName}" ออกจากระบบหรือไม่?`}
        confirmText="ลบสิทธิ์นี้"
        cancelText="ยกเลิก"
        type="danger"
        loading={isDeletingPerm}
        onConfirm={handleConfirmDeletePermission}
        onCancel={() => setDeletePermTarget(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
