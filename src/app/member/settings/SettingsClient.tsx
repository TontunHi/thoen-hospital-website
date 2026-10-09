'use client'

import { useState, useEffect, useMemo } from 'react'
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
  ListFilter,
  UserCog,
  CheckSquare,
  Square,
  Lock,
  BadgeCheck,
  User,
  Eye,
  RotateCcw
} from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/ui/Toast'

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

export interface MemberItem {
  id: number
  username: string
  name: string
  department: string
  position: string
  role: string
  permissions: string[]
}

export type PermCategory = 'all' | 'repairs' | 'media' | 'facility' | 'finance' | 'governance'
export type PermRoleType = 'view' | 'edit' | 'approve' | 'manage'

export interface PermissionMetaItem {
  key: string
  label: string
  shortLabel: string
  desc: string
  category: 'repairs' | 'media' | 'facility' | 'finance' | 'governance'
  categoryLabel: string
  roleType: PermRoleType
  icon: any
  color: string
  bg: string
  border: string
  isApproveOnly?: boolean
}

export const PERMISSIONS_METADATA: Record<string, PermissionMetaItem> = {
  // Repairs & Workflow
  view_all_work: {
    key: 'view_all_work',
    label: 'ดูแลระบบ/ดูงานช่างทั้งหมด (view_all_work)',
    shortLabel: 'ดูงานทั้งหมด',
    desc: 'สิทธิ์ดูและติดตามงานช่างทุกประเภทในระบบแบบอ่านอย่างเดียว',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'view',
    icon: Wrench,
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe'
  },
  view_it_repairs: {
    key: 'view_it_repairs',
    label: 'ดูงานแจ้งซ่อมคอมพิวเตอร์และไอทีทั้งหมด (view_it_repairs)',
    shortLabel: 'ดูงานไอที',
    desc: 'อนุญาตให้ดูและติดตามงานแจ้งซ่อมศูนย์คอมพิวเตอร์และสารสนเทศทั้งหมดในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'view',
    icon: Monitor,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },
  view_general_repairs: {
    key: 'view_general_repairs',
    label: 'ดูงานแจ้งซ่อมบำรุงทั่วไปทั้งหมด (view_general_repairs)',
    shortLabel: 'ดูงานช่างทั่วไป',
    desc: 'อนุญาตให้ดูและติดตามงานแจ้งซ่อมบำรุงทั่วไป/งานช่างทั้งหมดในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'view',
    icon: Wrench,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  },
  view_medical_repairs: {
    key: 'view_medical_repairs',
    label: 'ดูงานแจ้งซ่อมเครื่องมือแพทย์ทั้งหมด (view_medical_repairs)',
    shortLabel: 'ดูงานเครื่องมือแพทย์',
    desc: 'อนุญาตให้ดูและติดตามงานแจ้งซ่อมเครื่องมือทางการแพทย์ทั้งหมดในระบบ',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'view',
    icon: HeartPulse,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3'
  },
  view_department_tasks: {
    key: 'view_department_tasks',
    label: 'ดูงานทั้งหมดในหน่วยงานของตนเอง (view_department_tasks)',
    shortLabel: 'ดูงานในหน่วยงาน',
    desc: 'อนุญาตให้ดูงานทุกประเภทที่สร้างโดยสมาชิกในกลุ่มงานหรือหน่วยงานเดียวกัน',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'view',
    icon: Building2,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },
  take_repairs_general: {
    key: 'take_repairs_general',
    label: 'รับงานซ่อมบำรุงทั่วไป/ช่างซ่อม (take_repairs_general)',
    shortLabel: 'ช่างทั่วไป (รับงาน)',
    desc: 'ช่างซ่อมบำรุงทั่วไป สามารถกดรับงาน ดำเนินการซ่อม และบันทึกผลการซ่อมงานช่าง',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'edit',
    icon: Wrench,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  },
  take_repairs_medical: {
    key: 'take_repairs_medical',
    label: 'รับงานซ่อมเครื่องมือแพทย์ (take_repairs_medical)',
    shortLabel: 'ช่างแพทย์ (รับงาน)',
    desc: 'ช่างและผู้รับผิดชอบเครื่องมือแพทย์ สามารถกดรับงาน ดำเนินการซ่อม และบันทึกผลการซ่อม',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'edit',
    icon: HeartPulse,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3'
  },
  approve_repairs: {
    key: 'approve_repairs',
    label: 'อนุมัติ/ตรวจรับงานแจ้งซ่อมบำรุง (approve_repairs)',
    shortLabel: 'อนุมัติงานซ่อม',
    desc: 'สิทธิ์สำหรับผู้บริหารหรือหัวหน้างานในการอนุมัติและตรวจรับงานซ่อม (ไม่มีสิทธิ์แก้ไขข้อมูลงาน)',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'approve',
    icon: CheckCircle2,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
    isApproveOnly: true
  },
  manage_repairs: {
    key: 'manage_repairs',
    label: 'ดูแลระบบแจ้งซ่อมและกล่องงานช่าง (manage_repairs)',
    shortLabel: 'หัวหน้าช่าง/ดูแลซ่อม',
    desc: 'ทีมหัวหน้าช่างและผู้ดูแลระบบงานซ่อมบำรุง ตรวจสอบ มอบหมาย และจัดการงานซ่อมทั้งหมด',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'manage',
    icon: Wrench,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe'
  },
  manage_inbox: {
    key: 'manage_inbox',
    label: 'ดูแลระบบกล่องงานและสายการอนุมัติ (manage_inbox)',
    shortLabel: 'ดูแลกล่องงานกลาง',
    desc: 'ผู้ดูแลระบบกล่องงานกลาง ตรวจสอบและติดตามขั้นตอนงานและสถานะเอกสารทั้งหมด',
    category: 'repairs',
    categoryLabel: 'งานซ่อมบำรุง & กล่องงาน',
    roleType: 'manage',
    icon: Inbox,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },

  // Media & PR
  view_media_requests: {
    key: 'view_media_requests',
    label: 'ดูงานขอสื่อประชาสัมพันธ์ทั้งหมด (view_media_requests)',
    shortLabel: 'ดูคำขอสื่อทั้งหมด',
    desc: 'อนุญาตให้ดูและติดตามงานขอผลิตสื่อประชาสัมพันธ์ทั้งหมดในระบบ',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    roleType: 'view',
    icon: Palette,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe'
  },
  produce_media: {
    key: 'produce_media',
    label: 'รับผิดชอบผลิตสื่อ/กราฟิก/วิดีโอ (produce_media)',
    shortLabel: 'ผลิตสื่อ/กราฟิก (รับงาน)',
    desc: 'ทีมผลิตสื่อ สามารถกดรับงาน ออกแบบ ผลิตสื่อกราฟิก/วิดีโอ และส่งมอบงาน',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    roleType: 'edit',
    icon: Palette,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe'
  },
  manage_news: {
    key: 'manage_news',
    label: 'จัดการและลงข่าวประชาสัมพันธ์ (manage_news)',
    shortLabel: 'จัดการข่าวสารหน้าเว็บ',
    desc: 'ทีมประชาสัมพันธ์สามารถเขียน แก้ไข และเผยแพร่ข่าวสารหน้าเว็บไซต์',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    roleType: 'edit',
    icon: Newspaper,
    color: '#f43f5e',
    bg: '#fff1f2',
    border: '#fecdd3'
  },
  approve_media: {
    key: 'approve_media',
    label: 'อนุมัติคำขอผลิตสื่อประชาสัมพันธ์ (approve_media)',
    shortLabel: 'อนุมัติคำขอสื่อ',
    desc: 'สิทธิ์สำหรับผู้บริหารหรือหัวหน้างานในการอนุมัติคำขอผลิตสื่อ (ไม่มีสิทธิ์แก้ไขคำขอ)',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    roleType: 'approve',
    icon: CheckCircle2,
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
    isApproveOnly: true
  },
  manage_media_requests: {
    key: 'manage_media_requests',
    label: 'ดูแลระบบขอสื่อประชาสัมพันธ์ (manage_media_requests)',
    shortLabel: 'หัวหน้างานสื่อ/ดูแลระบบ',
    desc: 'ทีมประชาสัมพันธ์หรือผู้รับผิดชอบงานสื่อ ดูแลคำขอผลิตสื่อ ตรวจสอบขั้นตอน และมอบหมายงาน',
    category: 'media',
    categoryLabel: 'งานสื่อ & ประชาสัมพันธ์',
    roleType: 'manage',
    icon: Palette,
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4'
  },

  // Facility & Assets
  manage_locations: {
    key: 'manage_locations',
    label: 'จัดการข้อมูลสถานที่ ตึก-ชั้น-ห้อง (manage_locations)',
    shortLabel: 'จัดการสถานที่ ตึก-ชั้น',
    desc: 'เจ้าหน้าที่ผู้ดูแลระบบสถานที่ ตึก ชั้น และห้อง สำหรับระบบงานและระบบแจ้งซ่อม',
    category: 'facility',
    categoryLabel: 'งานพัสดุ & สถานที่',
    roleType: 'edit',
    icon: MapPin,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },
  manage_assets: {
    key: 'manage_assets',
    label: 'จัดการข้อมูลครุภัณฑ์และพัสดุ (manage_assets)',
    shortLabel: 'จัดการทะเบียนครุภัณฑ์',
    desc: 'เจ้าหน้าที่พัสดุและผู้ดูแลระบบครุภัณฑ์ สำหรับจัดการข้อมูล ค้นหา และตรวจสอบสถานะประกัน',
    category: 'facility',
    categoryLabel: 'งานพัสดุ & สถานที่',
    roleType: 'manage',
    icon: Package,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },

  // Finance & HR
  view_all_salary: {
    key: 'view_all_salary',
    label: 'ดูสลิปเงินเดือนบุคลากรทุกคน (view_all_salary)',
    shortLabel: 'ดูสลิปเงินเดือนทุกคน',
    desc: 'เจ้าหน้าที่ฝ่ายบุคคลหรือผู้บริหารที่ได้รับอนุญาตตรวจสอบข้อมูลเงินเดือนรวม',
    category: 'finance',
    categoryLabel: 'งานการเงิน & บุคลากร',
    roleType: 'view',
    icon: Coins,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  },
  upload_salary: {
    key: 'upload_salary',
    label: 'อัปโหลดเงินเดือน/ค่าตอบแทน (upload_salary)',
    shortLabel: 'อัปโหลดสลิปเงินเดือน',
    desc: 'ฝ่ายการเงินสามารถอัปโหลดไฟล์สลิปเงินเดือนและข้อมูลค่าตอบแทนเข้าระบบ',
    category: 'finance',
    categoryLabel: 'งานการเงิน & บุคลากร',
    roleType: 'edit',
    icon: FileUp,
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0'
  },

  // Governance & Admin
  manage_rdu: {
    key: 'manage_rdu',
    label: 'จัดการข้อมูลและเอกสาร RDU (manage_rdu)',
    shortLabel: 'จัดการเอกสาร RDU',
    desc: 'ผู้รับผิดชอบงานใช้ยาอย่างสมเหตุผล (RDU) จัดการโฟลเดอร์ปีและอัปโหลดไฟล์ PDF',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    roleType: 'edit',
    icon: Pill,
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4'
  },
  manage_ethics: {
    key: 'manage_ethics',
    label: 'จัดการเอกสารชมรมจริยธรรม (manage_ethics)',
    shortLabel: 'จัดการชมรมจริยธรรม',
    desc: 'คณะทำงานขับเคลื่อนชมรมจริยธรรมในการเพิ่มปีงบประมาณและอัปโหลดเอกสาร PDF',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    roleType: 'edit',
    icon: Scale,
    color: '#4f46e5',
    bg: '#eef2ff',
    border: '#c7d2fe'
  },
  manage_outgoing_doc: {
    key: 'manage_outgoing_doc',
    label: 'จัดการหนังสือส่งออก Online (manage_outgoing_doc)',
    shortLabel: 'จัดการหนังสือส่งออก',
    desc: 'เจ้าหน้าที่งานสารบรรณ/ธุรการที่ได้รับมอบหมายให้จัดการลิงก์ Google Sheets หนังสือส่งออก',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    roleType: 'edit',
    icon: FileSpreadsheet,
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0'
  },
  manage_ita: {
    key: 'manage_ita',
    label: 'จัดการบทความและข้อมูล ITA (manage_ita)',
    shortLabel: 'จัดการบทความ & ITA',
    desc: 'ผู้รับผิดชอบประเมินคุณธรรมและความโปร่งใส (ITA) ในการเขียนและเผยแพร่ข้อมูล',
    category: 'governance',
    categoryLabel: 'งานธรรมาภิบาล & สารบรรณ',
    roleType: 'manage',
    icon: BookOpen,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe'
  }
}

export const CATEGORIES_CONFIG: {
  id: PermCategory
  label: string
  shortTitle: string
  icon: any
}[] = [
  { id: 'repairs', label: 'งานแจ้งซ่อมบำรุง & กล่องงาน', shortTitle: 'งานซ่อมบำรุง', icon: Wrench },
  { id: 'media', label: 'สื่อ & ประชาสัมพันธ์', shortTitle: 'สื่อ & ประชาสัมพันธ์', icon: Palette },
  { id: 'facility', label: 'พัสดุ & สถานที่', shortTitle: 'พัสดุ & สถานที่', icon: Package },
  { id: 'governance', label: 'ธรรมาภิบาล & สารบรรณ', shortTitle: 'ธรรมาภิบาล & สารบรรณ', icon: BookOpen },
  { id: 'finance', label: 'การเงิน & บุคลากร', shortTitle: 'การเงิน & บุคลากร', icon: Wallet },
  { id: 'all', label: 'ภาพรวมทุกสิทธิ์ (All)', shortTitle: 'ภาพรวมทั้งหมด', icon: LayoutGrid }
]

export const ROLE_ARCHETYPES: {
  role: PermRoleType
  label: string
  icon: any
  desc: string
}[] = [
  { role: 'view', label: '👁️ View (ดูข้อมูล)', icon: Eye, desc: 'สิทธิ์ดูและติดตามข้อมูลในระบบ (Read-only)' },
  { role: 'edit', label: '🔧 Edit/Do (ปฏิบัติงาน)', icon: Wrench, desc: 'สิทธิ์รับงาน ดำเนินการ หรือบันทึกข้อมูล' },
  { role: 'approve', label: '✍️ Approve (อนุมัติ)', icon: CheckCircle2, desc: 'สิทธิ์อนุมัติ/ตรวจรับงาน (Approve-Only)' },
  { role: 'manage', label: '👑 Manage (ผู้ดูแล)', icon: Shield, desc: 'สิทธิ์ระดับผู้ดูแลระบบหรือหัวหน้างาน' }
]

const AVATAR_COLORS = [
  { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
  { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' }
]

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function maskIdentifier(val?: string | null): string {
  if (!val) return ''
  const clean = val.trim()
  if (clean.length <= 4) return '****'
  if (/^\d{13}$/.test(clean)) {
    return `x-xxxx-xxxx${clean[9]}-${clean.slice(10, 12)}-${clean[12]}`
  }
  return `x-xxxx-xxxxx-${clean.slice(-4)}`
}

function arePermArraysEqual(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((val, idx) => val === sortedB[idx])
}

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
    featureMediaRequest: initialSettings['feature_media_request'] !== '0'
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
  const [activeTab, setActiveTab] = useState<'features' | 'members'>('members')
  const [selectedCategory, setSelectedCategory] = useState<PermCategory>('repairs')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [hasPermissionsOnly, setHasPermissionsOnly] = useState(false)

  // Member Permissions Data
  const [members, setMembers] = useState<MemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Staged Permissions Dirty State (memberId -> string[])
  const [stagedPermissions, setStagedPermissions] = useState<Record<number, string[]>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // Modal State for Editing Individual Member Permissions
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [isSavingPerms, setIsSavingPerms] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const fetchMembers = async () => {
    setLoadingMembers(true)
    try {
      const res = await fetch('/api/member/permissions/members')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.members) {
          setMembers(data.data.members)
        }
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
      addToast('ไม่สามารถโหลดข้อมูลบุคลากรได้', 'error')
    } finally {
      setLoadingMembers(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  // Unique departments list for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>()
    members.forEach((m) => {
      if (m.department && m.department.trim().length > 0) {
        set.add(m.department.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'))
  }, [members])

  // Effective permissions helper (incorporates staged uncommitted changes)
  const getEffectivePermissions = (member: MemberItem): string[] => {
    if (stagedPermissions[member.id] !== undefined) {
      return stagedPermissions[member.id]
    }
    return member.permissions || []
  }

  const isMemberDirty = (member: MemberItem): boolean => {
    return stagedPermissions[member.id] !== undefined
  }

  // Fast inline checkbox toggle
  const toggleMemberPermission = (member: MemberItem, permKey: string) => {
    const currentPerms = getEffectivePermissions(member)
    const nextPerms = currentPerms.includes(permKey)
      ? currentPerms.filter((k) => k !== permKey)
      : [...currentPerms, permKey]

    const originalPerms = member.permissions || []
    const isNowOriginal = arePermArraysEqual(originalPerms, nextPerms)

    setStagedPermissions((prev) => {
      const next = { ...prev }
      if (isNowOriginal) {
        delete next[member.id]
      } else {
        next[member.id] = nextPerms
      }
      return next
    })
  }

  // Reset a single member's staged changes
  const resetMemberPermissions = (memberId: number) => {
    setStagedPermissions((prev) => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
  }

  // Discard all staged changes
  const handleDiscardAllStaged = () => {
    setStagedPermissions({})
    addToast('ยกเลิกการเปลี่ยนแปลงที่ยังไม่ได้บันทึกทั้งหมดแล้ว', 'info')
  }

  // Batch Save all staged changes
  const handleSaveBatchPermissions = async () => {
    const dirtyIds = Object.keys(stagedPermissions)
    if (dirtyIds.length === 0) return

    setIsSavingBatch(true)
    try {
      const updates = dirtyIds.map((idStr) => {
        const mId = parseInt(idStr, 10)
        return {
          memberId: mId,
          permissions: stagedPermissions[mId]
        }
      })

      const res = await fetch('/api/member/permissions/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์แบบกลุ่ม')
      }

      // Apply changes to local members state
      setMembers((prev) =>
        prev.map((m) => {
          if (stagedPermissions[m.id] !== undefined) {
            return { ...m, permissions: stagedPermissions[m.id] }
          }
          return m
        })
      )

      const updatedCount = updates.length
      setStagedPermissions({})
      addToast(`บันทึกการปรับปรุงสิทธิ์บุคลากร ${updatedCount} คนเรียบร้อยแล้ว`, 'success')
    } catch (err: any) {
      console.error('Batch save failed:', err)
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์แบบกลุ่ม', 'error')
    } finally {
      setIsSavingBatch(false)
    }
  }

  // Bulk Actions on currently visible / filtered members
  const handleBulkGrantRole = (role: PermRoleType) => {
    if (selectedCategory === 'all') return
    const targetPermKeys = Object.values(PERMISSIONS_METADATA)
      .filter((p) => p.category === selectedCategory && p.roleType === role)
      .map((p) => p.key)

    if (targetPermKeys.length === 0) return

    let stagedCount = 0
    setStagedPermissions((prev) => {
      const next = { ...prev }
      filteredMembers.forEach((member) => {
        const currentPerms = getEffectivePermissions(member)
        const combined = Array.from(new Set([...currentPerms, ...targetPermKeys]))
        const originalPerms = member.permissions || []
        if (arePermArraysEqual(originalPerms, combined)) {
          delete next[member.id]
        } else {
          next[member.id] = combined
          stagedCount++
        }
      })
      return next
    })

    const roleName = ROLE_ARCHETYPES.find((r) => r.role === role)?.label || role
    addToast(`เลือกสิทธิ์ ${roleName} ให้กับบุคลากร ${filteredMembers.length} คนที่แสดง (รอยืนยันบันทึก)`, 'info')
  }

  const handleBulkClearCurrentModule = () => {
    const keysToRemove = selectedCategory === 'all'
      ? new Set(Object.keys(PERMISSIONS_METADATA))
      : new Set(
          Object.values(PERMISSIONS_METADATA)
            .filter((p) => p.category === selectedCategory)
            .map((p) => p.key)
        )

    setStagedPermissions((prev) => {
      const next = { ...prev }
      filteredMembers.forEach((member) => {
        const currentPerms = getEffectivePermissions(member)
        const filtered = currentPerms.filter((k) => !keysToRemove.has(k))
        const originalPerms = member.permissions || []
        if (arePermArraysEqual(originalPerms, filtered)) {
          delete next[member.id]
        } else {
          next[member.id] = filtered
        }
      })
      return next
    })

    const modName = CATEGORIES_CONFIG.find((c) => c.id === selectedCategory)?.shortTitle || 'โมดูลนี้'
    addToast(`ล้างสิทธิ์ใน ${modName} ของบุคลากร ${filteredMembers.length} คนที่แสดง (รอยืนยันบันทึก)`, 'info')
  }

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
        featureMediaRequest
      })
      addToast('บันทึกการตั้งค่าสิทธิ์เข้าใช้งานระบบเรียบร้อยแล้ว', 'success')
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Edit Permissions Modal Handlers (Fine-grained single member editor)
  const handleOpenEditModal = (member: MemberItem) => {
    setEditingMember(member)
    setSelectedPerms([...getEffectivePermissions(member)])
  }

  const handleCloseEditModal = () => {
    if (isSavingPerms) return
    setEditingMember(null)
    setSelectedPerms([])
  }

  const handleTogglePerm = (permKey: string) => {
    setSelectedPerms((prev) => 
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    )
  }

  const handleSelectCategoryAll = (category: PermCategory) => {
    const categoryKeys = Object.keys(PERMISSIONS_METADATA).filter(
      (k) => PERMISSIONS_METADATA[k].category === category
    )
    setSelectedPerms((prev) => Array.from(new Set([...prev, ...categoryKeys])))
  }

  const handleClearCategory = (category: PermCategory) => {
    const categoryKeys = new Set(
      Object.keys(PERMISSIONS_METADATA).filter(
        (k) => PERMISSIONS_METADATA[k].category === category
      )
    )
    setSelectedPerms((prev) => prev.filter((k) => !categoryKeys.has(k)))
  }

  const handleClearAll = () => {
    setSelectedPerms([])
  }

  const handleSaveMemberPermissions = async () => {
    if (!editingMember) return
    setIsSavingPerms(true)
    try {
      const res = await fetch('/api/member/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingMember.id,
          permissions: selectedPerms
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์')
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id ? { ...m, permissions: selectedPerms } : m
        )
      )
      // Clear staged state if any for this member
      setStagedPermissions((prev) => {
        const next = { ...prev }
        delete next[editingMember.id]
        return next
      })

      addToast(`บันทึกสิทธิ์ของ "${editingMember.name || editingMember.username}" เรียบร้อยแล้ว`, 'success')
      handleCloseEditModal()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์', 'error')
    } finally {
      setIsSavingPerms(false)
    }
  }

  // Filtered members calculation
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return members.filter((member) => {
      const effectivePerms = getEffectivePermissions(member)

      // 1. Department filter
      if (selectedDepartment !== 'all') {
        if ((member.department || '').trim() !== selectedDepartment) {
          return false
        }
      }

      // 2. Has permissions filter
      if (hasPermissionsOnly) {
        if (selectedCategory === 'all') {
          if (effectivePerms.length === 0) return false
        } else {
          const hasModulePerm = effectivePerms.some((permKey) => {
            const meta = PERMISSIONS_METADATA[permKey]
            return meta && meta.category === selectedCategory
          })
          if (!hasModulePerm) return false
        }
      }

      // 3. Search query
      if (!q) return true

      const nameMatch = (member.name || '').toLowerCase().includes(q)
      const usernameMatch = (member.username || '').toLowerCase().includes(q)
      const deptMatch = (member.department || '').toLowerCase().includes(q)
      const posMatch = (member.position || '').toLowerCase().includes(q)
      const permMatch = effectivePerms.some((permKey) => {
        const meta = PERMISSIONS_METADATA[permKey]
        return (
          permKey.toLowerCase().includes(q) ||
          (meta && (
            meta.label.toLowerCase().includes(q) ||
            meta.shortLabel.toLowerCase().includes(q) ||
            meta.desc.toLowerCase().includes(q)
          ))
        )
      })

      return nameMatch || usernameMatch || deptMatch || posMatch || permMatch
    })
  }, [members, stagedPermissions, searchQuery, selectedDepartment, hasPermissionsOnly, selectedCategory])

  // Count active modules in feature toggle tab
  const activeFeaturesCount = [
    featureInbox,
    featureSignature,
    featureSalary,
    featureRepair,
    featureMediaRequest,
    featureIta,
    featureRdu
  ].filter(Boolean).length

  // Staged dirty members count
  const stagedDirtyCount = Object.keys(stagedPermissions).length

  // Members with special permissions count (incorporating staged permissions)
  const specialPermMembersCount = useMemo(() => {
    return members.filter((m) => {
      const perms = getEffectivePermissions(m)
      return perms.length > 0
    }).length
  }, [members, stagedPermissions])

  // Total assigned permissions count across all members
  const totalAssignedPermissions = useMemo(() => {
    return members.reduce((acc, m) => {
      const perms = getEffectivePermissions(m)
      return acc + perms.length
    }, 0)
  }, [members, stagedPermissions])

  // Permissions in currently selected category grouped by role
  const categoryPermsByRole = useMemo(() => {
    if (selectedCategory === 'all') return {} as Record<PermRoleType, PermissionMetaItem[]>
    const grouped: Record<PermRoleType, PermissionMetaItem[]> = {
      view: [],
      edit: [],
      approve: [],
      manage: []
    }
    Object.values(PERMISSIONS_METADATA).forEach((p) => {
      if (p.category === selectedCategory) {
        grouped[p.roleType].push(p)
      }
    })
    return grouped
  }, [selectedCategory])

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
            <UserCheck size={20} />
          </div>
          <div className="statInfo">
            <span className="statLabel">บุคลากรที่ได้รับสิทธิ์พิเศษ</span>
            <div className="statValueRow">
              <span className="statNumber">{specialPermMembersCount}</span>
              <span className="statTotal">/ {members.length} คน</span>
            </div>
          </div>
        </div>

        <div className="statCard">
          <div className="statIconCircle statIconPurple">
            <Shield size={20} />
          </div>
          <div className="statInfo">
            <span className="statLabel">กฎสิทธิ์ที่มอบหมายทั้งหมด</span>
            <div className="statValueRow">
              <span className="statNumber">{totalAssignedPermissions}</span>
              <span className="statTotal">รายการสิทธิ์</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Tab Navigation */}
      <nav className="modernTabsContainer" aria-label="แถบเมนูการตั้งค่า">
        <div className="tabPillsGroup">
          <button
            type="button"
            className={`mainTabButton ${activeTab === 'members' ? 'isActive' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <UserCog size={18} />
            <span>กำหนดสิทธิ์บุคลากร (Permission Matrix)</span>
            <span className="tabCountBadge">{specialPermMembersCount} คน</span>
            {stagedDirtyCount > 0 && (
              <span className="tabUnsavedDot" title={`มีการแก้ไข ${stagedDirtyCount} คนที่ยังไม่ได้บันทึก`} />
            )}
          </button>

          <button
            type="button"
            className={`mainTabButton ${activeTab === 'features' ? 'isActive' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            <Sliders size={18} />
            <span>เปิด-ปิดระบบบริการทั่วไป</span>
            {isFeaturesDirty && <span className="tabUnsavedDot" title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" />}
          </button>
        </div>
      </nav>

      {/* ======================================================== */}
      {/* TAB 1: MEMBER PERMISSIONS MATRIX (Primary View)         */}
      {/* ======================================================== */}
      {activeTab === 'members' && (
        <div className="tabContentSection animate-fadeIn">
          {/* Section Info Banner */}
          <div className="sectionHeaderCard">
            <div className="sectionHeaderTitleGroup">
              <div className="sectionIconWrapper">
                <UserCog size={20} />
              </div>
              <div>
                <h2>ตารางกำหนดสิทธิ์รายโมดูล (Module-Centric Permission Matrix)</h2>
                <p>
                  เลือกโมดูลงานที่ต้องการจัดการ จากนั้นทำเครื่องหมายในช่องสิทธิ์ที่ต้องการมอบหมายให้แก่บุคลากร แล้วกดบันทึกการเปลี่ยนแปลงทั้งหมดพร้อมกัน
                </p>
              </div>
            </div>

            {stagedDirtyCount > 0 && (
              <div className="unsavedAlertBanner">
                <AlertCircle size={16} />
                <span>มีการปรับสิทธิ์ {stagedDirtyCount} คน (ยังไม่ได้บันทึก)</span>
              </div>
            )}
          </div>

          {/* Module Selector Tabs */}
          <div className="moduleSelectorContainer" role="tablist" aria-label="เลือกโมดูลสิทธิ์">
            <div className="moduleSelectorTabs">
              {CATEGORIES_CONFIG.map((cat) => {
                const Icon = cat.icon
                const isSelected = selectedCategory === cat.id
                
                // Count how many members have permissions in this category
                const membersWithCategoryPermCount = members.filter((m) => {
                  const pList = getEffectivePermissions(m)
                  if (cat.id === 'all') return pList.length > 0
                  return pList.some((k) => PERMISSIONS_METADATA[k]?.category === cat.id)
                }).length

                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`moduleTabPill ${isSelected ? 'moduleTabActive' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <Icon size={16} className="moduleTabIcon" />
                    <span className="moduleTabTitle">{cat.label}</span>
                    <span className="moduleTabBadge">
                      {membersWithCategoryPermCount} คน
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search, Filters & Department Toolbar */}
          <div className="memberPermissionsToolbar">
            <div className="toolbarTopRow">
              {/* Search Box */}
              <div className="searchBoxWrapper">
                <Search size={16} className="searchIcon" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อบุคลากร, เลขบัตรประชาชน, กลุ่มงาน, ตำแหน่ง หรือชื่อสิทธิ์..."
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

              {/* Department Dropdown Filter */}
              <div className="departmentDropdownWrapper">
                <Building2 size={16} className="deptDropdownIcon" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="deptSelectInput"
                  aria-label="กรองตามกลุ่มงาน"
                >
                  <option value="all">ทุกกลุ่มงาน/ฝ่าย (ทั้งหมด)</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Has Permissions Only Filter */}
              <label className={`hasPermFilterToggle ${hasPermissionsOnly ? 'filterActive' : ''}`}>
                <input
                  type="checkbox"
                  checked={hasPermissionsOnly}
                  onChange={(e) => setHasPermissionsOnly(e.target.checked)}
                />
                <Shield size={15} />
                <span>
                  {selectedCategory === 'all' 
                    ? 'เฉพาะผู้มีสิทธิ์พิเศษ' 
                    : 'เฉพาะผู้มีสิทธิ์ในโมดูลนี้'}
                </span>
                {specialPermMembersCount > 0 && (
                  <span className="filterCountPill">{specialPermMembersCount}</span>
                )}
              </label>
            </div>

            {/* Bulk Department Tools Row */}
            <div className="bulkActionsBar">
              <div className="bulkActionsLeft">
                <span className="bulkActionsLabel">
                  <Sparkles size={14} />
                  <span>จัดการแบบกลุ่ม ({filteredMembers.length} คนที่แสดง):</span>
                </span>

                {selectedCategory !== 'all' && (
                  <>
                    {categoryPermsByRole.view && categoryPermsByRole.view.length > 0 && (
                      <button
                        type="button"
                        className="btnBulkAction"
                        onClick={() => handleBulkGrantRole('view')}
                        title="มอบหมายสิทธิ์ View ทั้งหมดให้กับบุคลากรที่แสดง"
                      >
                        <CheckSquare size={13} />
                        <span>เลือก View ทั้งหมด</span>
                      </button>
                    )}

                    {categoryPermsByRole.edit && categoryPermsByRole.edit.length > 0 && (
                      <button
                        type="button"
                        className="btnBulkAction"
                        onClick={() => handleBulkGrantRole('edit')}
                        title="มอบหมายสิทธิ์ Edit/Do ทั้งหมดให้กับบุคลากรที่แสดง"
                      >
                        <CheckSquare size={13} />
                        <span>เลือก Edit ทั้งหมด</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btnBulkAction btnBulkClear"
                      onClick={handleBulkClearCurrentModule}
                      title="ล้างสิทธิ์ในโมดูลนี้ของบุคลากรที่แสดง"
                    >
                      <Square size={13} />
                      <span>ล้างสิทธิ์ในโมดูลนี้</span>
                    </button>
                  </>
                )}

                {selectedCategory === 'all' && (
                  <button
                    type="button"
                    className="btnBulkAction btnBulkClear"
                    onClick={handleBulkClearCurrentModule}
                    title="ล้างสิทธิ์ทั้งหมดของบุคลากรที่แสดง"
                  >
                    <Square size={13} />
                    <span>ล้างสิทธิ์ทั้งหมดที่แสดง</span>
                  </button>
                )}
              </div>

              <div className="membersCountSummary">
                <span>
                  แสดง <strong>{filteredMembers.length}</strong> จาก <strong>{members.length}</strong> คน
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Table View */}
          <div className="matrixTableContainer">
            {loadingMembers ? (
              <div className="modernLoadingCard">
                <RefreshCw size={28} className="spinAnimation text-teal-600" />
                <p>กำลังโหลดรายชื่อบุคลากรและสิทธิ์การใช้งาน...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="modernEmptyStateCard">
                <div className="emptyIconCircle">
                  <Filter size={32} />
                </div>
                <h4>ไม่พบบุคลากรที่ตรงกับเงื่อนไขการค้นหา</h4>
                <p>ลองปรับเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองเพื่อแสดงบุคลากรทั้งหมด</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedDepartment('all')
                    setHasPermissionsOnly(false)
                  }}
                  className="btnResetFilter"
                >
                  รีเซ็ตตัวกรองทั้งหมด
                </button>
              </div>
            ) : (
              <div className="matrixTableResponsiveWrapper">
                <table className="matrixTable">
                  <thead>
                    <tr>
                      <th className="matrixTh matrixHeaderStaffCol">
                        <div className="thTitleWrap">
                          <Users size={16} />
                          <span>บุคลากร (Staff Member)</span>
                        </div>
                      </th>

                      {selectedCategory !== 'all' ? (
                        ROLE_ARCHETYPES.map((archetype) => (
                          <th key={archetype.role} className="matrixTh matrixHeaderPermCol">
                            <div className="thTitleWrap" title={archetype.desc}>
                              <span>{archetype.label}</span>
                            </div>
                          </th>
                        ))
                      ) : (
                        CATEGORIES_CONFIG.filter((c) => c.id !== 'all').map((cat) => {
                          const CatIcon = cat.icon
                          return (
                            <th key={cat.id} className="matrixTh matrixHeaderPermCol">
                              <div className="thTitleWrap">
                                <CatIcon size={14} />
                                <span>{cat.shortTitle}</span>
                              </div>
                            </th>
                          )
                        })
                      )}

                      <th className="matrixTh matrixHeaderActionsCol">
                        <div className="thTitleWrap">
                          <span>สิทธิ์รวม / การจัดการ</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const avatarColor = getAvatarColor(member.id)
                      const initials = member.name
                        ? member.name.trim().charAt(0)
                        : member.username.charAt(0).toUpperCase()
                      
                      const effectivePerms = getEffectivePermissions(member)
                      const isDirty = isMemberDirty(member)

                      return (
                        <tr
                          key={member.id}
                          className={`matrixRow ${isDirty ? 'matrixRowDirty' : ''}`}
                        >
                          {/* Column 1: Staff Info */}
                          <td className="matrixTd matrixStaffCell">
                            <div className="staffAvatarCircle"
                              style={{
                                backgroundColor: avatarColor.bg,
                                color: avatarColor.text,
                                borderColor: avatarColor.border
                              }}
                            >
                              <span>{initials}</span>
                            </div>

                            <div className="staffDetailsWrap">
                              <div className="staffNameLine">
                                <span className="staffName" title={member.name || member.username}>
                                  {member.name || member.username}
                                </span>
                                {member.role === 'admin' ? (
                                  <span className="roleBadge adminRoleBadge">Admin</span>
                                ) : null}
                                {isDirty && (
                                  <span className="unsavedMemberBadge" title="มีการปรับเปลี่ยนสิทธิ์ที่ยังไม่ได้บันทึก">
                                    แก้ไขแล้ว
                                  </span>
                                )}
                              </div>

                              <div className="staffDeptLine">
                                <span className="staffDept" title="กลุ่มงาน">
                                  <Building2 size={12} />
                                  {member.department || 'ไม่ระบุกลุ่มงาน'}
                                </span>
                                {member.position && (
                                  <span className="staffPosition" title="ตำแหน่ง">
                                    • {member.position}
                                  </span>
                                )}
                              </div>

                              <div className="staffIdLine">
                                <span className="staffMaskedId">
                                  เลขบัตร: {maskIdentifier(member.username)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Column Groups: Module Role Archetypes or All Modules */}
                          {selectedCategory !== 'all' ? (
                            ROLE_ARCHETYPES.map((archetype) => {
                              const permsInCell = Object.values(PERMISSIONS_METADATA).filter(
                                (p) => p.category === selectedCategory && p.roleType === archetype.role
                              )

                              if (permsInCell.length === 0) {
                                return (
                                  <td key={archetype.role} className="matrixTd matrixCenterCell">
                                    <span className="matrixEmptyCell">—</span>
                                  </td>
                                )
                              }

                              return (
                                <td key={archetype.role} className="matrixTd">
                                  <div className="matrixPermPillsGroup">
                                    {permsInCell.map((perm) => {
                                      const isChecked = effectivePerms.includes(perm.key)
                                      const isOriginal = (member.permissions || []).includes(perm.key)
                                      const isStagedChange = isChecked !== isOriginal

                                      return (
                                        <label
                                          key={perm.key}
                                          className={`matrixPermPill ${isChecked ? 'pillChecked' : ''} ${perm.isApproveOnly ? 'pillApproveOnly' : ''} ${perm.roleType === 'manage' ? 'pillManage' : ''} ${isStagedChange ? 'pillStagedDirty' : ''}`}
                                          title={`${perm.label}\n${perm.desc}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleMemberPermission(member, perm.key)}
                                            className="matrixCheckboxInput"
                                          />
                                          <span className="pillLabel">{perm.shortLabel}</span>
                                          {perm.isApproveOnly && (
                                            <span className="pillMiniTag pillTagApprove">Approve</span>
                                          )}
                                          {perm.roleType === 'manage' && (
                                            <span className="pillMiniTag pillTagManage">Manage</span>
                                          )}
                                          {isStagedChange && (
                                            <span className="pillDirtyDot" title="ยังไม่ได้บันทึก" />
                                          )}
                                        </label>
                                      )
                                    })}
                                  </div>
                                </td>
                              )
                            })
                          ) : (
                            CATEGORIES_CONFIG.filter((c) => c.id !== 'all').map((cat) => {
                              const activePermsInCat = effectivePerms
                                .map((k) => PERMISSIONS_METADATA[k])
                                .filter((p): p is PermissionMetaItem => Boolean(p && p.category === cat.id))

                              if (activePermsInCat.length === 0) {
                                return (
                                  <td key={cat.id} className="matrixTd matrixCenterCell">
                                    <span className="matrixEmptyCell">—</span>
                                  </td>
                                )
                              }

                              return (
                                <td key={cat.id} className="matrixTd">
                                  <div className="matrixSummaryTags">
                                    {activePermsInCat.map((p) => (
                                      <span
                                        key={p.key}
                                        className={`matrixSummaryTag ${p.isApproveOnly ? 'summaryApprove' : ''}`}
                                        style={{
                                          backgroundColor: p.bg,
                                          color: p.color,
                                          borderColor: p.border
                                        }}
                                        title={p.label}
                                      >
                                        {p.shortLabel}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              )
                            })
                          )}

                          {/* Column: Actions & Details */}
                          <td className="matrixTd matrixActionsCell">
                            <div className="matrixActionGroup">
                              <span className={`totalPermsBadge ${effectivePerms.length > 0 ? 'badgeHasPerms' : 'badgeZeroPerms'}`}>
                                {effectivePerms.length} สิทธิ์
                              </span>

                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(member)}
                                className="btnRowModalEdit"
                                title={`เปิดหน้าต่างแก้ไขสิทธิ์ของ ${member.name || member.username}`}
                              >
                                <UserCog size={13} />
                                <span>แก้ไขละเอียด</span>
                              </button>

                              {isDirty && (
                                <button
                                  type="button"
                                  onClick={() => resetMemberPermissions(member.id)}
                                  className="btnRowResetDirty"
                                  title="คืนค่าเดิมของบุคลากรท่านนี้"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky Batch Save Bar (Floats when staged changes exist) */}
          {stagedDirtyCount > 0 && (
            <div className="stickyBatchActionBar animate-fadeIn" role="region" aria-label="แถบบันทึกการเปลี่ยนแปลงสิทธิ์">
              <div className="batchBarContent">
                <div className="batchBarLeft">
                  <div className="batchIndicatorPulse"></div>
                  <div className="batchBarText">
                    <strong>มีการปรับปรุงสิทธิ์ {stagedDirtyCount} คน</strong>
                    <span>ยังไม่ได้บันทึกลงฐานข้อมูล</span>
                  </div>
                </div>

                <div className="batchBarRight">
                  <button
                    type="button"
                    className="btnBatchDiscard"
                    onClick={handleDiscardAllStaged}
                    disabled={isSavingBatch}
                  >
                    <RotateCcw size={15} />
                    <span>ยกเลิกการเปลี่ยนแปลง</span>
                  </button>

                  <button
                    type="button"
                    className="btnBatchSave"
                    onClick={handleSaveBatchPermissions}
                    disabled={isSavingBatch}
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw size={16} className="spinAnimation" />
                        <span>กำลังบันทึกข้อมูล ({stagedDirtyCount} คน)...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>บันทึกการเปลี่ยนแปลงทั้งหมด ({stagedDirtyCount} คน)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: FEATURE TOGGLES                                  */}
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
      {/* EDIT PERMISSIONS MODAL DIALOG                            */}
      {/* ======================================================== */}
      {editingMember && (
        <div className="permModalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalMemberTitle">
          <div className="permModalContainer">
            {/* Modal Header */}
            <div className="permModalHeader">
              <div className="modalHeaderLeft">
                <div
                  className="modalAvatarCircle"
                  style={{
                    backgroundColor: getAvatarColor(editingMember.id).bg,
                    color: getAvatarColor(editingMember.id).text,
                    borderColor: getAvatarColor(editingMember.id).border
                  }}
                >
                  <span>
                    {editingMember.name
                      ? editingMember.name.trim().charAt(0)
                      : editingMember.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 id="modalMemberTitle" className="modalTitle">
                    กำหนดสิทธิ์รายบุคคล: {editingMember.name || editingMember.username}
                  </h3>
                  <div className="modalMemberMeta">
                    <span>กลุ่มงาน: {editingMember.department || 'ไม่ระบุกลุ่มงาน'}</span>
                    {editingMember.position && <span>• ตำแหน่ง: {editingMember.position}</span>}
                    <span>• เลขบัตร: {maskIdentifier(editingMember.username)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseEditModal}
                className="btnModalClose"
                aria-label="ปิดหน้าต่าง"
                disabled={isSavingPerms}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Categorized Checkbox Sections */}
            <div className="permModalBody">
              <div className="modalInstructionBanner">
                <Info size={16} />
                <span>
                  ทำเครื่องหมายในช่องสิทธิ์ที่ต้องการมอบหมายให้แก่บุคลากรท่านนี้ สิทธิ์ที่ถูกเลือกจะมีผลทันทีหลังจากกดบันทึก
                </span>
              </div>

              {/* Categorized Permission Groups */}
              {CATEGORIES_CONFIG.filter((c) => c.id !== 'all').map((category) => {
                const CategoryIcon = category.icon
                const permsInCategory = Object.keys(PERMISSIONS_METADATA)
                  .filter((k) => PERMISSIONS_METADATA[k].category === category.id)
                  .map((k) => PERMISSIONS_METADATA[k])
                
                const selectedCountInCategory = permsInCategory.filter((p) =>
                  selectedPerms.includes(p.key)
                ).length

                return (
                  <div key={category.id} className="modalCategoryGroup">
                    <div className="categoryGroupHeader">
                      <div className="categoryHeaderTitle">
                        <div className="categoryIconWrap">
                          <CategoryIcon size={16} />
                        </div>
                        <h4>{category.label}</h4>
                        <span className={`categorySelectedCount ${selectedCountInCategory > 0 ? 'hasSelected' : ''}`}>
                          เลือก {selectedCountInCategory} / {permsInCategory.length}
                        </span>
                      </div>

                      <div className="categoryQuickActions">
                        <button
                          type="button"
                          onClick={() => handleSelectCategoryAll(category.id)}
                          className="btnCategoryAction"
                          title={`เลือกสิทธิ์ทั้งหมดใน${category.label}`}
                        >
                          <CheckSquare size={13} />
                          <span>เลือกทั้งหมด</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearCategory(category.id)}
                          className="btnCategoryAction btnCategoryClear"
                          title={`ล้างสิทธิ์ใน${category.label}`}
                        >
                          <Square size={13} />
                          <span>ล้างหมวดนี้</span>
                        </button>
                      </div>
                    </div>

                    <div className="categoryCheckboxesGrid">
                      {permsInCategory.map((perm) => {
                        const isChecked = selectedPerms.includes(perm.key)
                        const PermIcon = perm.icon

                        return (
                          <label
                            key={perm.key}
                            className={`permCheckboxCard ${isChecked ? 'permChecked' : ''} ${perm.isApproveOnly ? 'isApproveOnlyCard' : ''}`}
                          >
                            <div className="checkboxInputCol">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePerm(perm.key)}
                                className="customCheckboxInput"
                              />
                            </div>

                            <div className="permCardDetails">
                              <div className="permCardTitleRow">
                                <PermIcon size={16} style={{ color: perm.color }} className="permItemIcon" />
                                <span className="permItemTitle">{perm.shortLabel}</span>
                                <code className="permKeyBadge">{perm.key}</code>
                              </div>

                              <p className="permItemDesc">{perm.desc}</p>

                              {perm.isApproveOnly && (
                                <div className="approveOnlyWarningBanner">
                                  <Lock size={12} />
                                  <span>อนุมัติอย่างเดียว (Approve-Only) — ไม่สามารถแก้ไขข้อมูลงานได้</span>
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Modal Footer */}
            <div className="permModalFooter">
              <div className="modalFooterLeft">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btnClearAllMemberPerms"
                  disabled={isSavingPerms || selectedPerms.length === 0}
                  title="ล้างสิทธิ์ทั้งหมดของสมาชิกท่านนี้"
                >
                  <Trash2 size={15} />
                  <span>ล้างสิทธิ์ทั้งหมด ({selectedPerms.length})</span>
                </button>
              </div>

              <div className="modalFooterRight">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="btnModalCancel"
                  disabled={isSavingPerms}
                >
                  ยกเลิก
                </button>

                <button
                  type="button"
                  onClick={handleSaveMemberPermissions}
                  className="btnModalSave"
                  disabled={isSavingPerms}
                >
                  {isSavingPerms ? (
                    <>
                      <RefreshCw size={16} className="spinAnimation" />
                      <span>กำลังบันทึกสิทธิ์...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>บันทึกการเปลี่ยนแปลง ({selectedPerms.length} สิทธิ์)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
