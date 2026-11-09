'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Stethoscope,
  Users,
  BedDouble,
  Activity,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  ArrowLeft,
  TrendingUp,
  HeartHandshake,
  HeartPulse,
  ShieldCheck,
  Baby,
  Droplet,
  Droplets,
  TestTube2,
  Heart,
  Sparkles,
  Pill,
  Leaf,
  PhoneCall,
  Home,
  Search,
  Accessibility,
  Footprints,
} from 'lucide-react'

export interface NavSubItem {
  href: string
  label: string
  badge: string
  children?: NavSubItem[]
}

export interface NavItem {
  href: string
  label: string
  badge: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  children?: NavSubItem[]
}

export interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

export const RCM_NAV_GROUPS: NavGroup[] = [
  {
    id: 'opd-dental',
    title: '2.1 ผู้ป่วยนอก & ทันตกรรม',
    items: [
      {
        href: '/service/dashboard-rcm/sss-dental',
        label: 'ประกันสังคมทำฟัน',
        badge: '2.1.1.1',
        icon: Stethoscope,
      },
      {
        href: '/service/dashboard-rcm/opd-doctor',
        label: 'OPD ตามสิทธิ์',
        badge: '2.1.1.2',
        icon: Users,
      },
      {
        href: '/service/dashboard-rcm/opd',
        label: 'สรุปผู้ป่วยนอก (OPD)',
        badge: '2.1.1.3',
        icon: Activity,
      },
    ],
  },
  {
    id: 'ipd',
    title: '2.2 บริการผู้ป่วยใน',
    items: [
      {
        href: '/service/dashboard-rcm/ipd',
        label: 'สรุปผู้ป่วยใน (IPD)',
        badge: '2.1.2.1',
        icon: BedDouble,
      },
    ],
  },
  {
    id: 'rep-funds',
    title: '3.1 ข้อมูลการชดเชยค่าบริการ (REP)',
    items: [
      {
        href: '/service/dashboard-rcm/rep-funds',
        label: 'ข้อมูล Rep แต่ละกองทุน',
        badge: '3.1.1',
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 'finance',
    title: '5.2 การเงิน & รายรับ',
    items: [
      {
        href: '/service/dashboard-rcm/invoice-summary',
        label: 'สรุปรายรับจาก Invoice',
        badge: '5.2.2.1',
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 'palliative-care',
    title: 'Palliative Care',
    items: [
      {
        href: '/service/dashboard-rcm/palliative-care/pc-1',
        label: 'End Of Life',
        badge: 'PC.1',
        icon: HeartHandshake,
      },
      {
        href: '/service/dashboard-rcm/palliative-care/pc-3',
        label: 'ตามกลุ่มโรค',
        badge: 'PC.3',
        icon: HeartHandshake,
      },
      {
        href: '/service/dashboard-rcm/palliative-care/registry',
        label: 'ทะเบียน Palliative Care',
        badge: 'ทะเบียน',
        icon: HeartPulse,
      },
      {
        href: '/service/dashboard-rcm/palliative-care/ltc-registry',
        label: 'ทะเบียน Long Term Care (LTC)',
        badge: 'LTC',
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: 'funds',
    title: 'กองทุน',
    items: [
      {
        href: '/service/dashboard-rcm/funds/ccs',
        label: 'คัดกรองมะเร็งปากมดลูก (CCS)',
        badge: 'CCS',
        icon: ShieldCheck,
        children: [
          {
            href: '/service/dashboard-rcm/funds/ccs/2',
            label: 'รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก',
            badge: '1.2',
          },
          {
            href: '/service/dashboard-rcm/funds/ccs/10',
            label: 'บริการ 1B005',
            badge: '1.10',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/anc',
        label: 'บริการฝากครรภ์ (ANC)',
        badge: 'ANC',
        icon: Baby,
        children: [
          {
            href: '/service/dashboard-rcm/funds/anc/3',
            label: 'US - ตรวจช่องปาก - ขัดฟัน',
            badge: '2.3',
          },
          {
            href: '/service/dashboard-rcm/funds/anc/4',
            label: 'บริการ 30011',
            badge: '2.4',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/thalassemia',
        label: 'ธาลัสซีเมียในหญิงตั้งครรภ์',
        badge: 'THAL',
        icon: Droplet,
        children: [
          {
            href: '/service/dashboard-rcm/funds/thalassemia/1',
            label: 'คัดกรองธาลัสซีเมีย',
            badge: '3.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/postpartum',
        label: 'การตรวจหลังคลอด',
        badge: 'PNC',
        icon: HeartPulse,
        children: [
          {
            href: '/service/dashboard-rcm/funds/postpartum/2',
            label: 'การตรวจหลังคลอด ADP',
            badge: '7.2',
          },
          {
            href: '/service/dashboard-rcm/funds/postpartum/3',
            label: 'การจ่ายยา Triforine ADP',
            badge: '7.3',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/pregnancy-test',
        label: 'การทดสอบการตั้งครรภ์',
        badge: '8.1',
        icon: TestTube2,
        children: [
          {
            href: '/service/dashboard-rcm/funds/pregnancy-test/1',
            label: 'การทดสอบการตั้งครรภ์',
            badge: '8.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/family-planning',
        label: 'วางแผนครอบครัว & คุมกำเนิด (FP)',
        badge: 'FP',
        icon: Heart,
        children: [
          {
            href: '/service/dashboard-rcm/funds/family-planning/1',
            label: 'วางแผนครอบครัวและการป้องกันการตั้งครรภ์',
            badge: '9.1',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/2',
            label: 'บริการใส่ห่วงอนามัย',
            badge: '9.2',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-3-1-1',
            label: 'รายการฝังยาคุม',
            badge: '9.3.1.1',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-3-1-2',
            label: 'รายการถอดยาคุม',
            badge: '9.3.1.2',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-3-2',
            label: 'บริการคุมกำเนิดกึ่งถาวร (หญิงอายุ ≥ 20 ปี)',
            badge: '9.3.2',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-4',
            label: 'ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม',
            badge: '9.4',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-5',
            label: 'ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว',
            badge: '9.5',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-6',
            label: 'ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน',
            badge: '9.6',
          },
          {
            href: '/service/dashboard-rcm/funds/family-planning/9-7',
            label: 'ยาฉีดคุมกำเนิด',
            badge: '9.7',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/telemed-drug',
        label: 'ระบบ Telemedicine & Drug',
        badge: '11',
        icon: PhoneCall,
        children: [
          {
            href: '/service/dashboard-rcm/funds/telemed-drug/postal-drug',
            label: 'ส่งยาไปรษณีย์ Drug',
            badge: '11.52',
          },
          {
            href: '/service/dashboard-rcm/funds/telemed-drug/telemed',
            label: 'บริการ Telemed',
            badge: '11.53',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/oral-cancer',
        label: 'คัดกรองมะเร็งช่องปาก (40 ปี+)',
        badge: '12',
        icon: Sparkles,
        children: [
          {
            href: '/service/dashboard-rcm/funds/oral-cancer/1',
            label: 'คัดกรองรอยโรคมะเร็งช่องปาก',
            badge: '12.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/health-screening',
        label: 'คัดกรองสุขภาพกาย/จิต (ADP)',
        badge: '14',
        icon: Activity,
        children: [
          {
            href: '/service/dashboard-rcm/funds/health-screening/14-5',
            label: 'Fasting Plasma Glucose (12003)',
            badge: '14.5',
          },
          {
            href: '/service/dashboard-rcm/funds/health-screening/14-6',
            label: 'Total Cholesterol / HDL (12004)',
            badge: '14.6',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/anemia-screening',
        label: 'บริการคัดกรองโลหิตจาง (13-24 ปี)',
        badge: '17',
        icon: Droplets,
        children: [
          {
            href: '/service/dashboard-rcm/funds/anemia-screening/17-1',
            label: 'บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP',
            badge: '17.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/iron-supplements',
        label: 'บริการยาเม็ดเสริมธาตุเหล็ก (13-45 ปี)',
        badge: '18',
        icon: Pill,
        children: [
          {
            href: '/service/dashboard-rcm/funds/iron-supplements/18-2',
            label: 'รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)',
            badge: '18.2',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/fluoride-varnish',
        label: 'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง)',
        badge: '20',
        icon: Sparkles,
        children: [
          {
            href: '/service/dashboard-rcm/funds/fluoride-varnish/20-1',
            label: 'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-29 ปี ADP (15001)',
            badge: '20.1',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/colorectal-cancer',
        label: 'คัดกรองมะเร็งลำไส้ใหญ่ (Fit test)',
        badge: '21',
        icon: TestTube2,
        children: [
          {
            href: '/service/dashboard-rcm/funds/colorectal-cancer/21-2',
            label: 'รายชื่อผู้รับบริการ ADP (90005)',
            badge: '21.2',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/viral-hepatitis',
        label: 'ตรวจคัดกรองไวรัสตับอักเสบ (B & C)',
        badge: '23',
        icon: TestTube2,
        children: [
          {
            href: '/service/dashboard-rcm/funds/viral-hepatitis/23-1',
            label: 'บริการตรวจคัดกรองไวรัสตับอักเสบ B',
            badge: '23.1',
          },
          {
            href: '/service/dashboard-rcm/funds/viral-hepatitis/23-2',
            label: 'บริการตรวจคัดกรองไวรัสตับอักเสบ C',
            badge: '23.2',
          },
          {
            href: '/service/dashboard-rcm/funds/viral-hepatitis/23-4',
            label: 'ตรวจยืนยันไวรัสตับ C HCV RNA (36333)',
            badge: '23.4',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/thalassemia-fund',
        label: 'กองทุน Thalassemia',
        badge: 'THAL',
        icon: Droplet,
        children: [
          {
            href: '/service/dashboard-rcm/funds/thalassemia-fund/opd',
            label: 'ผู้ป่วยนอก Thalassemia',
            badge: '1',
          },
          {
            href: '/service/dashboard-rcm/funds/thalassemia-fund/ipd',
            label: 'ผู้ป่วยใน Thalassemia',
            badge: '2',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/t1dm-gdm-pdm',
        label: 'กองทุน T1DM/GDM/PDM',
        badge: 'DM',
        icon: HeartPulse,
        children: [
          {
            href: '/service/dashboard-rcm/funds/t1dm-gdm-pdm/2',
            label: 'รายชื่อผู้รับบริการ',
            badge: '2',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/thai-traditional-medicine',
        label: 'บริการแพทย์แผนไทย และการแพทย์ทางเลือก',
        badge: 'แผนไทย',
        icon: Leaf,
        children: [
          {
            href: '/service/dashboard-rcm/funds/thai-traditional-medicine/3',
            label: 'รายชื่อผู้รับบริการแพทย์แผนไทยรวม',
            badge: '3',
          },
          {
            href: '/service/dashboard-rcm/funds/thai-traditional-medicine/11',
            label: 'รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ',
            badge: '11',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/amed-homeward',
        label: 'ระบบ AMed และ Home Ward',
        badge: 'AMED',
        icon: Home,
        children: [
          {
            href: '/service/dashboard-rcm/funds/amed-homeward/homeward',
            label: 'รายงาน HOMEWARD',
            badge: 'HW',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/adp-search',
        label: 'ค้นจากรหัส ADP',
        badge: 'ADP',
        icon: Search,
        children: [
          {
            href: '/service/dashboard-rcm/funds/adp-search/adpcode',
            label: 'ค้นหาจากรหัส ADPCODE',
            badge: 'ADPCODE',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/clopidogrel',
        label: 'กองทุนยา Clopidogrel',
        badge: 'CLOP',
        icon: Pill,
        children: [
          {
            href: '/service/dashboard-rcm/funds/clopidogrel/usage',
            label: 'รายชื่อการใช้ยา Clopidogrel',
            badge: 'ยา',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/streptokinase',
        label: 'กองทุนยา Streptokinase',
        badge: 'STK',
        icon: HeartPulse,
        children: [
          {
            href: '/service/dashboard-rcm/funds/streptokinase/recipients',
            label: 'รายชื่อรับยา Streptokinase',
            badge: 'ยา',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/instrument',
        label: 'กองทุนอวัยวะเทียมและอุปกรณ์',
        badge: 'รายชื่อ',
        icon: Activity,
        children: [
          {
            href: '/service/dashboard-rcm/funds/instrument',
            label: 'รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์',
            badge: 'รายชื่อ',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/dental-implant',
        label: 'กองทุนรากฟันเทียม',
        badge: 'รากฟัน',
        icon: Sparkles,
        children: [
          {
            href: '/service/dashboard-rcm/funds/dental-implant/densur',
            label: 'รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR',
            badge: 'DENSUR',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/cancer',
        label: 'กองทุนมะเร็ง',
        badge: 'CANCER',
        icon: Activity,
        children: [
          {
            href: '/service/dashboard-rcm/funds/cancer/adp',
            label: 'รายชื่อผู้ป่วย จาก ADP (CANCER)',
            badge: 'ADP',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/walkin',
        label: 'กองทุน Walkin',
        badge: 'WALKIN',
        icon: Footprints,
        children: [
          {
            href: '/service/dashboard-rcm/funds/walkin/adp',
            label: 'รายชื่อผู้รับบริการจาก ADP (WALKIN)',
            badge: 'WALKIN',
          },
        ],
      },
      {
        href: '/service/dashboard-rcm/funds/rehabilitation',
        label: 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์',
        badge: '11.47',
        icon: Accessibility,
        children: [
          {
            href: '/service/dashboard-rcm/funds/rehabilitation/services',
            label: 'รายการการให้บริการฟื้นฟูสมรรถภาพ',
            badge: 'ฟื้นฟู',
            children: [
              {
                href: '/service/dashboard-rcm/funds/rehabilitation/services/disability-services',
                label: 'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability',
                badge: 'รายชื่อ',
              },
            ],
          },
          {
            href: '/service/dashboard-rcm/funds/rehabilitation/imc',
            label: 'รายงานบริการผู้ป่วย IMC',
            badge: 'IMC',
            children: [
              {
                href: '/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients',
                label: 'รายชื่อผู้รับบริการตามเกณฑ์ IMC',
                badge: 'รายชื่อ',
              },
            ],
          },
        ],
      },
    ],
  },
]

function isPathMatch(pathname: string | null, targetHref: string): boolean {
  if (!pathname) return false
  return pathname === targetHref || pathname.startsWith(targetHref + '/')
}

interface DashboardRcmShellProps {
  children: React.ReactNode
  userRole?: string
}

const DEFAULT_SIDEBAR_WIDTH = 260
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 480

export default function DashboardRcmShell({
  children,
}: DashboardRcmShellProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const sidebarWidthRef = useRef<number>(DEFAULT_SIDEBAR_WIDTH)
  const isResizingRef = useRef<boolean>(false)

  // เริ่มต้น: ซ่อนให้หมดทุกกลุ่ม (Default collapsed/hidden ตามมาตรฐาน UI สะอาด สบายตา)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    label: string
    top: number
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Flatten all navigable endpoints for real-time search indexing
  const allSearchableItems = useMemo(() => {
    const list: Array<{
      href: string
      label: string
      badge: string
      groupTitle: string
      parentLabel?: string
      icon: React.ComponentType<{ size?: number; className?: string }>
    }> = []

    RCM_NAV_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        if (!item.children || item.children.length === 0) {
          list.push({
            href: item.href,
            label: item.label,
            badge: item.badge,
            groupTitle: group.title,
            icon: item.icon,
          })
        } else {
          item.children.forEach((sub) => {
            if (!sub.children || sub.children.length === 0) {
              list.push({
                href: sub.href,
                label: sub.label,
                badge: sub.badge,
                groupTitle: group.title,
                parentLabel: item.label,
                icon: item.icon,
              })
            } else {
              sub.children.forEach((subSub) => {
                list.push({
                  href: subSub.href,
                  label: subSub.label,
                  badge: subSub.badge,
                  groupTitle: group.title,
                  parentLabel: `${item.label} › ${sub.label}`,
                  icon: item.icon,
                })
              })
            }
          })
        }
      })
    })

    return list
  }, [])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return allSearchableItems.filter((entry) => {
      const labelMatch = entry.label.toLowerCase().includes(query)
      const badgeMatch = entry.badge ? entry.badge.toLowerCase().includes(query) : false
      const groupMatch = entry.groupTitle.toLowerCase().includes(query)
      const parentMatch = entry.parentLabel ? entry.parentLabel.toLowerCase().includes(query) : false
      return labelMatch || badgeMatch || groupMatch || parentMatch
    })
  }, [searchQuery, allSearchableItems])

  // Global keyboard shortcut (Ctrl+K / Cmd+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isCollapsed) {
          setIsCollapsed(false)
          try {
            localStorage.setItem('rcm_sidebar_collapsed', 'false')
          } catch {
            // ignore
          }
        }
        setTimeout(() => searchInputRef.current?.focus(), 100)
      } else if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCollapsed, searchQuery])

  const handleMouseEnterTooltip = (label: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    setHoveredTooltip({ label, top: rect.top })
  }

  const handleMouseLeaveTooltip = () => {
    setHoveredTooltip(null)
  }

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isCollapsed) return
    isResizingRef.current = true
    setIsResizing(true)
  }

  const resetWidth = () => {
    if (isCollapsed) return
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
    sidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH
    try {
      localStorage.setItem('rcm_sidebar_width', String(DEFAULT_SIDEBAR_WIDTH))
    } catch {
      // Ignore localStorage write errors
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(e.clientX, MAX_SIDEBAR_WIDTH))
      setSidebarWidth(newWidth)
      sidebarWidthRef.current = newWidth
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        setIsResizing(false)
        try {
          localStorage.setItem('rcm_sidebar_width', String(sidebarWidthRef.current))
        } catch {
          // Ignore localStorage write errors
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Hydrate collapsed & expanded group/submenu states & custom width from localStorage
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem('rcm_sidebar_collapsed')
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === 'true')
      }

      const savedWidth = localStorage.getItem('rcm_sidebar_width')
      if (savedWidth) {
        const parsedWidth = parseInt(savedWidth, 10)
        if (!isNaN(parsedWidth) && parsedWidth >= MIN_SIDEBAR_WIDTH && parsedWidth <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(parsedWidth)
          sidebarWidthRef.current = parsedWidth
        }
      }

      const savedGroups = localStorage.getItem('rcm_sidebar_expanded_groups')
      if (savedGroups) {
        const parsed = JSON.parse(savedGroups) as Record<string, boolean>
        if (parsed && typeof parsed === 'object') {
          setExpandedGroups(parsed)
        }
      }

      const savedMenus = localStorage.getItem('rcm_sidebar_expanded_menus')
      if (savedMenus) {
        const parsedMenus = JSON.parse(savedMenus) as Record<string, boolean>
        if (parsedMenus && typeof parsedMenus === 'object') {
          setExpandedMenus(parsedMenus)
        }
      }
    } catch {
      // Ignore localStorage read errors in private browsing
    }
  }, [])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('rcm_sidebar_collapsed', String(next))
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = {
        ...prev,
        [groupId]: !Boolean(prev[groupId]),
      }
      try {
        localStorage.setItem('rcm_sidebar_expanded_groups', JSON.stringify(next))
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }

  const toggleSubmenu = (href: string) => {
    setExpandedMenus((prev) => {
      const next = {
        ...prev,
        [href]: !Boolean(prev[href]),
      }
      try {
        localStorage.setItem('rcm_sidebar_expanded_menus', JSON.stringify(next))
      } catch {
        // Ignore localStorage write errors
      }
      return next
    })
  }

  // Find active group, item, and sub-item for breadcrumbs
  const activeGroup = RCM_NAV_GROUPS.find((g) =>
    g.items.some(
      (item) =>
        isPathMatch(pathname, item.href) ||
        (item.children &&
          item.children.some(
            (c) =>
              isPathMatch(pathname, c.href) ||
              Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
          ))
    )
  )
  const activeItem = activeGroup?.items.find(
    (item) =>
      isPathMatch(pathname, item.href) ||
      (item.children &&
        item.children.some(
          (c) =>
            isPathMatch(pathname, c.href) ||
            Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
        ))
  )
  const activeSubItem = activeItem?.children?.find(
    (c) =>
      isPathMatch(pathname, c.href) ||
      Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
  )
  const activeSubSubItem = activeSubItem?.children?.find((cc) => isPathMatch(pathname, cc.href))

  return (
    <div
      className={`rcm-layout-shell ${isCollapsed ? 'is-collapsed' : ''} ${
        isResizing ? 'is-resizing' : ''
      }`}
    >
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="rcm-sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`rcm-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        } ${isResizing ? 'is-resizing' : ''}`}
        style={!isCollapsed ? { width: `${sidebarWidth}px` } : undefined}
        aria-label="Dashboard RCM Navigation"
      >
        {/* Sidebar Header */}
        <div className="rcm-sidebar-header">
          <div className="rcm-sidebar-brand">
            <div className="rcm-brand-icon">
              <TrendingUp size={20} />
            </div>
            {!isCollapsed && (
              <div className="rcm-brand-text">
                <span className="rcm-brand-title">Dashboard-RCM</span>
                <span className="rcm-brand-sub">โรงพยาบาลเถิน</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="rcm-collapse-toggle desktop-only"
            onClick={toggleCollapse}
            title={isCollapsed ? 'ขยายเมนูด้านข้าง' : 'ย่อเมนูด้านข้าง'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            className="rcm-mobile-close mobile-only"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Search Bar */}
        {!isCollapsed && (
          <div className="rcm-search-box">
            <div className="rcm-search-input-wrapper">
              <Search size={14} className="rcm-search-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู (OPD, กองทุน, ยา, รหัส)..."
                className="rcm-search-input"
                aria-label="ค้นหาเมนูใน RCM Dashboard"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rcm-search-clear-btn"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="rcm-search-kbd">Ctrl K</span>
              )}
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="rcm-collapsed-search-trigger">
            <button
              type="button"
              onClick={() => {
                setIsCollapsed(false)
                try {
                  localStorage.setItem('rcm_sidebar_collapsed', 'false')
                } catch {
                  // ignore
                }
                setTimeout(() => searchInputRef.current?.focus(), 120)
              }}
              className="rcm-collapsed-search-btn"
              title="ค้นหาเมนู (Ctrl+K)"
              aria-label="ค้นหาเมนู"
            >
              <Search size={16} />
            </button>
          </div>
        )}

        {/* Navigation Categories */}
        <nav className="rcm-sidebar-nav">
          {searchQuery.trim().length > 0 ? (
            <div className="rcm-search-results">
              <div className="rcm-search-results-header">
                <span className="rcm-search-count">ผลการค้นหา ({searchResults.length})</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rcm-search-reset-link"
                >
                  ล้างคำค้น
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="rcm-search-empty">
                  <p className="rcm-search-empty-text">ไม่พบเมนูที่ตรงกับ &ldquo;{searchQuery}&rdquo;</p>
                  <span className="rcm-search-empty-sub">
                    ลองค้นหาด้วยชื่อบริการ กองทุน หรือรหัส ADP เช่น OPD, 1B005, ฟลูออไรด์
                  </span>
                </div>
              ) : (
                <ul className="rcm-search-list">
                  {searchResults.map((result) => {
                    const Icon = result.icon
                    const isResultActive = isPathMatch(pathname, result.href)
                    return (
                      <li key={result.href} className="rcm-search-item">
                        <Link
                          href={result.href}
                          onClick={() => {
                            setIsMobileOpen(false)
                            setSearchQuery('')
                          }}
                          className={`rcm-search-link ${isResultActive ? 'active' : ''}`}
                        >
                          <div className="rcm-search-icon-cell">
                            <Icon size={16} />
                          </div>
                          <div className="rcm-search-meta">
                            <div className="rcm-search-trail">
                              <span>{result.groupTitle}</span>
                              {result.parentLabel && (
                                <>
                                  <span className="rcm-search-trail-sep">›</span>
                                  <span>{result.parentLabel}</span>
                                </>
                              )}
                            </div>
                            <div className="rcm-search-title-row">
                              <span className="rcm-search-title">{result.label}</span>
                              {result.badge && (
                                <span className="rcm-nav-subbadge">{result.badge}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            RCM_NAV_GROUPS.map((group) => {
              const isGroupExpanded = Boolean(expandedGroups[group.id])
              const isGroupActive = group.items.some(
                (item) =>
                  isPathMatch(pathname, item.href) ||
                  Boolean(
                    item.children?.some(
                      (c) =>
                        isPathMatch(pathname, c.href) ||
                        Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
                    )
                  )
              )

              return (
                <div
                  key={group.id}
                  className={`rcm-nav-group ${
                    !isCollapsed && !isGroupExpanded ? 'is-group-collapsed' : ''
                  }`}
                >
                  {!isCollapsed && (
                    <button
                      type="button"
                      className={`rcm-nav-group-toggle ${
                        isGroupActive && !isGroupExpanded ? 'has-active' : ''
                      }`}
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={isGroupExpanded}
                      aria-controls={`rcm-group-${group.id}`}
                    >
                      <span className="rcm-nav-group-title-text">{group.title}</span>
                      <span className="rcm-nav-group-chevron" aria-hidden="true">
                        {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </button>
                  )}
                  {isCollapsed && <div className="rcm-nav-divider" />}
                  {(isCollapsed || isGroupExpanded) && (
                    <ul id={`rcm-group-${group.id}`} className="rcm-nav-list">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const hasChildren = Boolean(item.children && item.children.length > 0)
                        const isBranchActive =
                          isPathMatch(pathname, item.href) ||
                          Boolean(
                            item.children?.some(
                              (c) =>
                                isPathMatch(pathname, c.href) ||
                                Boolean(c.children?.some((cc) => isPathMatch(pathname, cc.href)))
                            )
                          )
                        const isExpanded = Boolean(expandedMenus[item.href])

                        if (hasChildren && item.children) {
                          const firstChildHref =
                            item.children[0].children?.[0]?.href ?? item.children[0].href

                          if (isCollapsed) {
                            return (
                              <li
                                key={item.href}
                                className="rcm-nav-list-item"
                                onMouseEnter={(e) =>
                                  handleMouseEnterTooltip(item.label, e.currentTarget)
                                }
                                onMouseLeave={handleMouseLeaveTooltip}
                              >
                                <Link
                                  href={firstChildHref}
                                  onClick={() => setIsMobileOpen(false)}
                                  className={`rcm-nav-link ${isBranchActive ? 'active' : ''}`}
                                >
                                  <div className="rcm-nav-icon-wrapper">
                                    <Icon size={18} />
                                  </div>
                                </Link>
                              </li>
                            )
                          }

                          return (
                            <li key={item.href} className="rcm-nav-list-item">
                              <button
                                type="button"
                                onClick={() => toggleSubmenu(item.href)}
                                aria-expanded={isExpanded}
                                className={`rcm-nav-link rcm-nav-parent-btn ${
                                  isBranchActive ? 'branch-active' : ''
                                }`}
                              >
                                <div className="rcm-nav-icon-wrapper">
                                  <Icon size={18} />
                                </div>
                                <div className="rcm-nav-label-wrapper">
                                  <span className="rcm-nav-label">{item.label}</span>
                                  <span className="rcm-nav-chevron">
                                    {isExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
                                  </span>
                                </div>
                              </button>
                              {isExpanded && (
                                <ul className="rcm-nav-sublist">
                                  {item.children.map((sub) => {
                                    const hasSubChildren = Boolean(
                                      sub.children && sub.children.length > 0
                                    )
                                    const isSubBranchActive =
                                      isPathMatch(pathname, sub.href) ||
                                      Boolean(
                                        sub.children?.some((cc) => isPathMatch(pathname, cc.href))
                                      )
                                    const isSubExpanded = Boolean(expandedMenus[sub.href])

                                    if (hasSubChildren && sub.children) {
                                      return (
                                        <li key={sub.href} className="rcm-nav-subgroup-item">
                                          <button
                                            type="button"
                                            onClick={() => toggleSubmenu(sub.href)}
                                            aria-expanded={isSubExpanded}
                                            className={`rcm-nav-sublink rcm-nav-subparent-btn ${
                                              isSubBranchActive ? 'branch-active' : ''
                                            }`}
                                          >
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                minWidth: 0,
                                                flex: 1,
                                              }}
                                            >
                                              <span className="rcm-nav-subbadge">{sub.badge}</span>
                                              <span className="rcm-nav-sublabel">{sub.label}</span>
                                            </div>
                                            <span className="rcm-nav-subchevron">
                                              {isSubExpanded ? (
                                                <ChevronDown size={13} />
                                              ) : (
                                                <ChevronRight size={13} />
                                              )}
                                            </span>
                                          </button>
                                          {isSubExpanded && (
                                            <ul className="rcm-nav-subsublist">
                                              {sub.children.map((subSub) => {
                                                const isSubSubActive = isPathMatch(
                                                  pathname,
                                                  subSub.href
                                                )
                                                return (
                                                  <li key={subSub.href}>
                                                    <Link
                                                      href={subSub.href}
                                                      onClick={() => setIsMobileOpen(false)}
                                                      className={`rcm-nav-subsublink ${
                                                        isSubSubActive ? 'active' : ''
                                                      }`}
                                                    >
                                                      <span className="rcm-nav-subsubbadge">
                                                        {subSub.badge}
                                                      </span>
                                                      <span className="rcm-nav-subsublabel">
                                                        {subSub.label}
                                                      </span>
                                                    </Link>
                                                  </li>
                                                )
                                              })}
                                            </ul>
                                          )}
                                        </li>
                                      )
                                    }

                                    const isSubActive = isPathMatch(pathname, sub.href)
                                    return (
                                      <li key={sub.href}>
                                        <Link
                                          href={sub.href}
                                          onClick={() => setIsMobileOpen(false)}
                                          className={`rcm-nav-sublink ${
                                            isSubActive ? 'active' : ''
                                          }`}
                                        >
                                          <span className="rcm-nav-subbadge">{sub.badge}</span>
                                          <span className="rcm-nav-sublabel">{sub.label}</span>
                                        </Link>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </li>
                          )
                        }

                        return (
                          <li
                            key={item.href}
                            className="rcm-nav-list-item"
                            onMouseEnter={(e) => {
                              if (isCollapsed)
                                handleMouseEnterTooltip(item.label, e.currentTarget)
                            }}
                            onMouseLeave={() => {
                              if (isCollapsed) handleMouseLeaveTooltip()
                            }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setIsMobileOpen(false)}
                              className={`rcm-nav-link ${isBranchActive ? 'active' : ''}`}
                            >
                              <div className="rcm-nav-icon-wrapper">
                                <Icon size={18} />
                              </div>
                              {!isCollapsed && (
                                <div className="rcm-nav-label-wrapper">
                                  <span className="rcm-nav-label">{item.label}</span>
                                  <span className="rcm-nav-badge">{item.badge}</span>
                                </div>
                              )}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="rcm-sidebar-footer">
          <Link
            href="/service"
            className="rcm-sidebar-back-link"
            title="กลับสู่หน้าบริการหลัก"
          >
            <ArrowLeft size={16} />
            {!isCollapsed && <span>กลับหน้าบริการ</span>}
          </Link>
        </div>

        {/* Floating Tooltip when Collapsed (Clean & Short) */}
        {isCollapsed && hoveredTooltip && (
          <div
            className="rcm-collapsed-tooltip"
            style={{
              top: hoveredTooltip.top + 8,
              left: 76,
            }}
          >
            <span>{hoveredTooltip.label}</span>
          </div>
        )}

        {/* Drag Resize Handle (Desktop Only) */}
        {!isCollapsed && (
          <div
            className={`rcm-resize-handle ${isResizing ? 'is-active' : ''}`}
            onMouseDown={startResizing}
            onDoubleClick={resetWidth}
            title="ลากเพื่อปรับขนาด (ดับเบิ้ลคลิกเพื่อรีเซ็ต 260px)"
            aria-label="Resize sidebar"
            role="separator"
            aria-orientation="vertical"
          />
        )}
      </aside>

      {/* Main Content Area */}
      <div className="rcm-main-wrapper">
        {/* Top Control Bar */}
        <header className="rcm-topbar">
          <div className="rcm-topbar-left">
            <button
              type="button"
              className="rcm-hamburger-btn mobile-only"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <nav className="rcm-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/service" className="rcm-crumb-link">
                บริการ
              </Link>
              <span className="rcm-crumb-sep">/</span>
              <span className="rcm-crumb-current">Dashboard-RCM</span>
              {activeGroup && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className="rcm-crumb-subtle">{activeGroup.title}</span>
                </>
              )}
              {activeItem && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className={activeSubItem ? 'rcm-crumb-subtle' : 'rcm-crumb-active'}>
                    {activeItem.label}
                  </span>
                </>
              )}
              {activeSubItem && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className={activeSubSubItem ? 'rcm-crumb-subtle' : 'rcm-crumb-active'}>
                    {activeSubSubItem
                      ? activeSubItem.label
                      : activeSubItem.badge && !activeSubItem.label.startsWith(activeSubItem.badge)
                      ? `${activeSubItem.badge} ${activeSubItem.label}`
                      : activeSubItem.label}
                  </span>
                </>
              )}
              {activeSubSubItem && (
                <>
                  <span className="rcm-crumb-sep">/</span>
                  <span className="rcm-crumb-active">
                    {activeSubSubItem.label}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="rcm-topbar-right">
            <Link
              href="/service"
              className="rcm-topbar-return-btn desktop-only"
              title="กลับหน้าบริการหลัก"
            >
              ← หน้าบริการ
            </Link>
          </div>
        </header>

        {/* Page Main Content */}
        <div className="rcm-main-body rcm-main-content">{children}</div>
      </div>
    </div>
  )
}
