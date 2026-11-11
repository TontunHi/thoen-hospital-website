'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import ExcelJS from 'exceljs'
import {
  ArrowLeft,
  Search,
  X,
  RefreshCw,
  Home,
  Globe,
  FileSpreadsheet,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Users,
  Building2,
} from 'lucide-react'
import {
  MOK_CATEGORIES,
  MokCategoryMeta,
  MokPatientRecord,
  CatchmentType,
} from '@/lib/clinical/mokService'
import { formatThaiDate } from '@/lib/formatters'
import './page.css'

interface Props {
  user: {
    username: string
    name?: string | null
    role?: string | null
  }
}

type SortColumn =
  | 'index'
  | 'cid'
  | 'hn'
  | 'ptname'
  | 'age'
  | 'moopart'
  | 'tambon_name'
  | 'vstdate'
  | 'regdate'
  | 'lastvisit'
type SortDirection = 'asc' | 'desc'
type CategoryGroup = 'all' | 'chronic' | 'special' | 'audit'

/**
 * Format 13-digit Thai National Citizen ID for readable display
 */
function formatCid(cid?: string | null): string {
  if (!cid) return '—'
  const clean = cid.replace(/\D/g, '')
  if (clean.length === 13) {
    return `${clean[0]}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean[12]}`
  }
  return cid
}

export default function MokClient({ user: _user }: Props) {
  // Persistence with localStorage (initialized to defaults to prevent SSR hydration mismatch)
  const [selectedCatchment, setSelectedCatchment] = useState<CatchmentType>('in_catchment')
  const [pageSize, setPageSize] = useState<number>(25)
  const [hasRestoredPrefs, setHasRestoredPrefs] = useState<boolean>(false)
  const isMountedRef = useRef<boolean>(false)

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('asthma')
  const [selectedGroup, setSelectedGroup] = useState<CategoryGroup>('all')
  const [records, setRecords] = useState<MokPatientRecord[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTambon, setSelectedTambon] = useState<string>('')
  const [selectedMoo, setSelectedMoo] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('moopart')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Client-side In-Memory Cache (0ms instant category switching)
  const clientCacheRef = useRef<Record<string, MokPatientRecord[]>>({})

  // 1. Restore preferences from localStorage on mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const savedCatchment = localStorage.getItem('mok_catchment')
      if (savedCatchment === 'in_catchment' || savedCatchment === 'out_catchment') {
        setSelectedCatchment(savedCatchment)
      }
      const savedPageSize = Number(localStorage.getItem('mok_pageSize'))
      if ([25, 50, 100].includes(savedPageSize)) {
        setPageSize(savedPageSize)
      }
    } catch {}
    setHasRestoredPrefs(true)
    isMountedRef.current = true
  }, [])

  // 2. Save preferences to localStorage only after mounted and when changed
  useEffect(() => {
    if (!isMountedRef.current) return
    try {
      localStorage.setItem('mok_catchment', selectedCatchment)
    } catch {}
  }, [selectedCatchment])

  useEffect(() => {
    if (!isMountedRef.current) return
    try {
      localStorage.setItem('mok_pageSize', String(pageSize))
    } catch {}
  }, [pageSize])

  // Current category metadata
  const currentCategory = useMemo(() => {
    return MOK_CATEGORIES.find((c) => c.id === selectedCategoryId) || MOK_CATEGORIES[0]
  }, [selectedCategoryId])

  // Sync group filter with selected category
  useEffect(() => {
    if (currentCategory) {
      if (selectedGroup !== 'all' && currentCategory.group !== selectedGroup) {
        setSelectedGroup(currentCategory.group)
      }
    }
  }, [currentCategory, selectedGroup])

  // Fetch summary counts for dropdown
  const fetchSummaryCounts = useCallback(
    async (manual = false) => {
      try {
        const url = `/api/service/mok?mode=summary&catchment=${selectedCatchment}${
          manual ? '&refresh=true' : ''
        }`
        const res = await fetch(url, { cache: 'no-store' })
        const json = await res.json()
        if (json.success && json.counts) {
          setCategoryCounts(json.counts)
        }
      } catch (err) {
        console.error('Failed to fetch MOK summary counts:', err)
      }
    },
    [selectedCatchment]
  )

  useEffect(() => {
    if (!hasRestoredPrefs) return
    fetchSummaryCounts()
  }, [hasRestoredPrefs, fetchSummaryCounts])

  // Fetch records with Client-side In-Memory Cache
  const fetchRecords = useCallback(
    async (manual = false) => {
      const cacheKey = `${selectedCategoryId}_${selectedCatchment}`

      // Check client memory cache first for instant 0ms response
      if (!manual && clientCacheRef.current[cacheKey]) {
        setRecords(clientCacheRef.current[cacheKey])
        setLoading(false)
        return
      }

      if (manual) setIsRefreshing(true)
      setLoading(true)

      try {
        const url = `/api/service/mok?category=${selectedCategoryId}&catchment=${selectedCatchment}${
          manual ? '&refresh=true' : ''
        }`
        const res = await fetch(url, { cache: 'no-store' })
        const json = await res.json()

        if (json.success && Array.isArray(json.data)) {
          setRecords(json.data)
          // Cache in client memory
          clientCacheRef.current[cacheKey] = json.data

          // Also update count for this category
          setCategoryCounts((prev) => ({
            ...prev,
            [selectedCategoryId]: json.data.length,
          }))
        } else {
          setRecords([])
        }
      } catch (err) {
        console.error('Failed to fetch MOK records:', err)
        setRecords([])
      } finally {
        setLoading(false)
        if (manual) {
          setTimeout(() => setIsRefreshing(false), 500)
        }
      }
    },
    [selectedCategoryId, selectedCatchment]
  )

  useEffect(() => {
    if (!hasRestoredPrefs) return
    setCurrentPage(1)
    setSearchQuery('')
    setSelectedTambon('')
    setSelectedMoo('')
    fetchRecords()
  }, [hasRestoredPrefs, fetchRecords])

  // Extract unique Tambon and Moo lists for dropdown filtering
  const tambonOptions = useMemo(() => {
    const countsMap = new Map<string, number>()
    records.forEach((r) => {
      if (r.tambon_name) {
        const t = r.tambon_name.trim()
        countsMap.set(t, (countsMap.get(t) || 0) + 1)
      }
    })
    return Array.from(countsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  const mooOptions = useMemo(() => {
    const set = new Set<string>()
    records.forEach((r) => {
      if (r.moopart && r.moopart !== '0' && r.moopart !== '00') {
        set.add(String(parseInt(r.moopart, 10) || r.moopart))
      }
    })
    return Array.from(set).sort((a, b) => Number(a) - Number(b))
  }, [records])

  // Filter & Sort records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = records.filter((r) => {
      // Tambon filter
      if (selectedTambon && r.tambon_name !== selectedTambon) {
        return false
      }
      // Moo filter
      if (selectedMoo) {
        const mooNum = String(parseInt(r.moopart || '', 10) || r.moopart || '')
        if (mooNum !== selectedMoo) return false
      }
      // Text search
      if (!q) return true

      return (
        (r.hn && r.hn.toLowerCase().includes(q)) ||
        (r.cid && r.cid.toLowerCase().includes(q)) ||
        (r.ptname && r.ptname.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q)) ||
        (r.occupation_name && r.occupation_name.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        (r.an && r.an.toLowerCase().includes(q))
      )
    })

    // Interactive Sorting
    return filtered.sort((a, b) => {
      const valA = a[sortColumn as keyof MokPatientRecord]
      const valB = b[sortColumn as keyof MokPatientRecord]

      if (sortColumn === 'moopart') {
        const numA = parseInt(a.moopart || '0', 10) || 0
        const numB = parseInt(b.moopart || '0', 10) || 0
        if (numA !== numB) return sortDirection === 'asc' ? numA - numB : numB - numA

        const addrA = parseInt(a.addrpart || '0', 10) || 0
        const addrB = parseInt(b.addrpart || '0', 10) || 0
        return sortDirection === 'asc' ? addrA - addrB : addrB - addrA
      }

      if (sortColumn === 'age' || sortColumn === 'lastvisit') {
        const numA = Number(valA) || 0
        const numB = Number(valB) || 0
        return sortDirection === 'asc' ? numA - numB : numB - numA
      }

      const strA = String(valA || '')
      const strB = String(valB || '')
      const cmp = strA.localeCompare(strB, 'th')
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [records, searchQuery, selectedTambon, selectedMoo, sortColumn, sortDirection])

  // Handle column header click to toggle sorting
  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  // Render sorting indicator icon
  const renderSortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) {
      return <ArrowUpDown size={12} className="sortIcon" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} className="sortIcon active" />
    ) : (
      <ArrowDown size={12} className="sortIcon active" />
    )
  }

  // Pagination calculation
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // Windowed visible page numbers (max 5 pages, strictly unique)
  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + 4)
    if (end - start < 4) {
      start = Math.max(1, end - 4)
    }
    const pages: number[] = []
    for (let p = start; p <= end; p++) {
      pages.push(p)
    }
    return pages
  }, [currentPage, totalPages])

  // Export to Excel function using ExcelJS
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) return

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Thoen Hospital MOK System'
    workbook.created = new Date()

    const catchmentLabel = selectedCatchment === 'in_catchment' ? 'ในเขตรับผิดชอบ' : 'นอกเขต'
    const worksheet = workbook.addWorksheet(currentCategory.shortTitle.substring(0, 30))

    // Headers depending on category
    let columnsConfig: { header: string; key: string; width: number }[] = [
      { header: 'ลำดับ', key: 'index', width: 8 },
      { header: 'เลขบัตรประชาชน (CID)', key: 'cid', width: 20 },
      { header: 'HN', key: 'hn', width: 12 },
      { header: 'ชื่อ - นามสกุล', key: 'ptname', width: 26 },
      { header: 'อายุ (ปี)', key: 'age', width: 10 },
      { header: 'ที่อยู่', key: 'address', width: 35 },
      { header: 'หมู่', key: 'moopart', width: 8 },
      { header: 'ตำบล', key: 'tambon_name', width: 16 },
    ]

    if (selectedCategoryId === 'type_area_mismatch') {
      columnsConfig.push(
        { header: 'TypeArea ห้องบัตร', key: 'type_area_patient', width: 18 },
        { header: 'TypeArea ส่งเสริม', key: 'type_area_person', width: 18 },
        { header: 'ปรับปรุงล่าสุด', key: 'last_update', width: 18 },
        { header: 'สิทธิการรักษา', key: 'pttypename', width: 24 }
      )
    } else if (selectedCategoryId.startsWith('ckd')) {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'Stage ไต', key: 'cn', width: 12 },
        { header: 'หมายเหตุ', key: 'cn2', width: 22 }
      )
    } else if (['asthma', 'copd'].includes(selectedCategoryId)) {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'หมายเหตุ (1)', key: 'cn', width: 16 },
        { header: 'หมายเหตุ (2)', key: 'cn2', width: 22 }
      )
    } else if (['ca', 'palliative', 'stroke'].includes(selectedCategoryId)) {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'ส่งต่อไปยัง', key: 'send_to_pcu_name', width: 24 },
        { header: 'วันที่ส่งต่อ', key: 'send_to_pcu_date', width: 18 },
        { header: 'สถานะสมาชิกคลินิก', key: 'clinic_member_status_name', width: 20 }
      )
    } else if (selectedCategoryId === 'copd_readmit') {
      columnsConfig = [
        { header: 'ลำดับ', key: 'index', width: 8 },
        { header: 'เลขบัตรประชาชน (CID)', key: 'cid', width: 20 },
        { header: 'HN', key: 'hn', width: 12 },
        { header: 'AN', key: 'an', width: 12 },
        { header: 'ชื่อ - นามสกุล', key: 'ptname', width: 26 },
        { header: 'อายุ (ปี)', key: 'age', width: 10 },
        { header: 'วันที่ Admit', key: 'regdate', width: 18 },
        { header: 'วันที่จำหน่าย', key: 'dchdate', width: 18 },
        { header: 'วัน Re-admit (<=28)', key: 'lastvisit', width: 18 },
        { header: 'รหัสโรคหลัก', key: 'pdx', width: 14 },
        { header: 'ชื่อโรคหลัก', key: 'pdxname', width: 30 },
        { header: 'ที่อยู่', key: 'address', width: 35 },
      ]
    } else if (
      ['tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(selectedCategoryId)
    ) {
      columnsConfig.push({ header: 'วันที่ตรวจ/Diag', key: 'vstdate', width: 18 })
    } else if (selectedCategoryId === 'child_delayed_dev') {
      columnsConfig.push(
        { header: 'อายุวันตรวจ (ปี)', key: 'age_y', width: 16 },
        { header: 'อายุวันตรวจ (เดือน)', key: 'age_m', width: 18 },
        { header: 'วันที่ตรวจพัฒนาการ', key: 'vstdate', width: 20 }
      )
    } else {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'หมายเหตุ', key: 'cn', width: 24 }
      )
    }

    worksheet.columns = columnsConfig

    // Header styling - Brand green
    const headerRow = worksheet.getRow(1)
    headerRow.font = { name: 'Sarabun', bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D7446' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // Data rows
    filteredRecords.forEach((item, idx) => {
      const rowData: Record<string, unknown> = {
        index: idx + 1,
        cid: item.cid || '-',
        hn: item.hn || '-',
        ptname: item.ptname || '-',
        age: item.age ?? '-',
        address: item.address || '-',
        moopart: item.moopart || '-',
        tambon_name: item.tambon_name || '-',
        occupation_name: item.occupation_name || '-',
        note: item.note || '-',
        cn: item.cn || '-',
        cn2: item.cn2 || '-',
        vstdate: formatThaiDate(item.vstdate),
        regdate: formatThaiDate(item.regdate),
        dchdate: formatThaiDate(item.dchdate),
        an: item.an || '-',
        lastvisit: item.lastvisit ?? '-',
        pdx: item.pdx || '-',
        pdxname: item.pdxname || '-',
        send_to_pcu_name: item.send_to_pcu_name || '-',
        send_to_pcu_date: formatThaiDate(item.send_to_pcu_date),
        clinic_member_status_name: item.clinic_member_status_name || '-',
        type_area_patient: item.type_area_patient || '-',
        type_area_person: item.type_area_person || '-',
        last_update: formatThaiDate(item.last_update),
        pttypename: item.pttypename || '-',
        age_y: item.age_y ?? '-',
        age_m: item.age_m ?? '-',
      }
      worksheet.addRow(rowData)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MOK_${currentCategory.shortTitle}_${catchmentLabel}_${
      new Date().toISOString().split('T')[0]
    }.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Groups of categories
  const chronicCategories = useMemo(
    () => MOK_CATEGORIES.filter((c) => c.group === 'chronic'),
    []
  )
  const specialCategories = useMemo(
    () => MOK_CATEGORIES.filter((c) => c.group === 'special'),
    []
  )
  const auditCategories = useMemo(
    () => MOK_CATEGORIES.filter((c) => c.group === 'audit'),
    []
  )

  // Switch category group helper
  const handleGroupSelect = (group: CategoryGroup) => {
    setSelectedGroup(group)
    if (group === 'chronic') {
      if (currentCategory.group !== 'chronic') {
        setSelectedCategoryId(chronicCategories[0].id)
      }
    } else if (group === 'special') {
      if (currentCategory.group !== 'special') {
        setSelectedCategoryId(specialCategories[0].id)
      }
    } else if (group === 'audit') {
      if (currentCategory.group !== 'audit') {
        setSelectedCategoryId(auditCategories[0].id)
      }
    }
  }

  // Helper for option label with count
  const renderOptionLabel = (cat: MokCategoryMeta) => {
    const count = categoryCounts[cat.id]
    if (count != null && count > 0) {
      return `${cat.title} (${count.toLocaleString()} ราย)`
    }
    return cat.title
  }

  // Check if filters are active
  const hasActiveFilters = Boolean(searchQuery.trim() || selectedTambon || selectedMoo)

  const resetFilters = () => {
    setSearchQuery('')
    setSelectedTambon('')
    setSelectedMoo('')
    setCurrentPage(1)
  }

  return (
    <div className="mokPage">
      <div className="mokContainer">
        {/* 1. Back Navigation Link */}
        <Link href="/service" className="mokBackLink">
          <ArrowLeft size={16} />
          <span>กลับหน้ารวมบริการ</span>
        </Link>

        {/* 2. Top Header Card */}
        <div className="mokHeaderCard">
          <div className="mokHeaderTop">
            <div className="mokTitleWrapper">
              <div className="mokCodeBadge">
                <HeartPulse size={22} />
              </div>
              <div className="mokTitleSection">
                <h1>หมออนามัยครอบครัว (มอค.)</h1>
                <p className="mokSubtitle">
                  ระบบสืบค้นและติดตามทะเบียนผู้ป่วยกลุ่มเสี่ยงและโรคเรื้อรัง โรงพยาบาลเถิน
                </p>
              </div>
            </div>

            {/* Catchment Segmented Toggle */}
            <div className="catchmentToggleWrapper" role="group" aria-label="ขอบเขตพื้นที่">
              <button
                type="button"
                className={`catchmentBtn ${selectedCatchment === 'in_catchment' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCatchment('in_catchment')
                  clientCacheRef.current = {}
                }}
              >
                <Home size={15} />
                <span>ในเขตรับผิดชอบ (Type 1, 3)</span>
              </button>
              <button
                type="button"
                className={`catchmentBtn ${selectedCatchment === 'out_catchment' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCatchment('out_catchment')
                  clientCacheRef.current = {}
                }}
              >
                <Globe size={15} />
                <span>นอกเขต อ.เถิน (Type 4)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Category Selector Section */}
        <div className="mokCategorySection">
          {/* Quick Group Switcher Pills */}
          <div className="mokGroupPills" role="tablist" aria-label="กลุ่มคลินิก">
            <button
              type="button"
              role="tab"
              aria-selected={selectedGroup === 'all'}
              className={`groupPill ${selectedGroup === 'all' ? 'active' : ''}`}
              onClick={() => handleGroupSelect('all')}
            >
              <span>ทั้งหมด</span>
              <span className="groupPillCount">(17)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedGroup === 'chronic'}
              className={`groupPill ${selectedGroup === 'chronic' ? 'active' : ''}`}
              onClick={() => handleGroupSelect('chronic')}
            >
              <span>คลินิกโรคเรื้อรัง</span>
              <span className="groupPillCount">(9)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedGroup === 'special'}
              className={`groupPill ${selectedGroup === 'special' ? 'active' : ''}`}
              onClick={() => handleGroupSelect('special')}
            >
              <span>เฝ้าระวังและการดูแลเฉพาะ</span>
              <span className="groupPillCount">(7)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedGroup === 'audit'}
              className={`groupPill ${selectedGroup === 'audit' ? 'active' : ''}`}
              onClick={() => handleGroupSelect('audit')}
            >
              <span>ตรวจสอบคุณภาพข้อมูล</span>
              <span className="groupPillCount">(1)</span>
            </button>
          </div>

          {/* Select & Meta Card Row */}
          <div className="mokCategoryRow">
            <div className="categorySelectWrapper">
              <label htmlFor="mokCategorySelect" className="categorySelectLabel">
                <Layers size={16} style={{ color: 'var(--mok-accent)' }} />
                <span>เลือกคลินิก / ทะเบียน:</span>
              </label>
              <div className="categorySelectFieldWrapper">
                <select
                  id="mokCategorySelect"
                  className="mokCategorySelect"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  {(selectedGroup === 'all' || selectedGroup === 'chronic') && (
                    <optgroup label="คลินิกโรคเรื้อรังหลัก (9 หมวด)">
                      {chronicCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {renderOptionLabel(cat)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(selectedGroup === 'all' || selectedGroup === 'special') && (
                    <optgroup label="กลุ่มเฝ้าระวังและการดูแลเฉพาะ (7 หมวด)">
                      {specialCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {renderOptionLabel(cat)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(selectedGroup === 'all' || selectedGroup === 'audit') && (
                    <optgroup label="ตรวจสอบคุณภาพข้อมูล (1 หมวด)">
                      {auditCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {renderOptionLabel(cat)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="categoryMetaCard">
              <div className="categoryMetaInfo">
                <div className="categoryMetaHeader">
                  <span className="categoryMetaTitle">{currentCategory.title}</span>
                  {currentCategory.clinicCode && (
                    <span className="categoryCodeTag">รหัส {currentCategory.clinicCode}</span>
                  )}
                </div>
                <span className="categoryMetaDesc">{currentCategory.description}</span>
              </div>
              <div className="categoryMetaCounts">
                <span className="countLabel">ผู้ป่วยในทะเบียน</span>
                <span className="countValue">
                  {filteredRecords.length.toLocaleString()}{' '}
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>ราย</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Toolbar & Filter Bar */}
        <div className="mokToolbar">
          <div className="toolbarMainRow">
            <div className="toolbarLeft">
              {/* Unified Search Box */}
              <div className="searchBox">
                <Search size={15} className="searchIcon" />
                <input
                  type="text"
                  className="searchInput"
                  placeholder="ค้นหา CID, HN, ชื่อ-สกุล, ที่อยู่, อาชีพ..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="searchClearBtn"
                    onClick={() => {
                      setSearchQuery('')
                      setCurrentPage(1)
                    }}
                    title="ล้างข้อความค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter by Tambon */}
              {tambonOptions.length > 0 && (
                <select
                  className="filterSelect"
                  value={selectedTambon}
                  onChange={(e) => {
                    setSelectedTambon(e.target.value)
                    setCurrentPage(1)
                  }}
                  aria-label="เลือกตำบล"
                >
                  <option value="">ทุกตำบล ({tambonOptions.length})</option>
                  {tambonOptions.map((t) => (
                    <option key={t.name} value={t.name}>
                      ต.{t.name} ({t.count})
                    </option>
                  ))}
                </select>
              )}

              {/* Filter by Moo */}
              {mooOptions.length > 0 && (
                <select
                  className="filterSelect"
                  value={selectedMoo}
                  onChange={(e) => {
                    setSelectedMoo(e.target.value)
                    setCurrentPage(1)
                  }}
                  aria-label="เลือกหมู่"
                >
                  <option value="">ทุกหมู่</option>
                  {mooOptions.map((m) => (
                    <option key={m} value={m}>
                      หมู่ {m}
                    </option>
                  ))}
                </select>
              )}

              {/* Page Size Selector */}
              <select
                className="filterSelect"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                aria-label="จำนวนรายการต่อหน้า"
              >
                <option value="25">25 รายการ / หน้า</option>
                <option value="50">50 รายการ / หน้า</option>
                <option value="100">100 รายการ / หน้า</option>
              </select>
            </div>

            <div className="toolbarRight">
              <button
                type="button"
                className="btnSecondary"
                onClick={() => {
                  const cacheKey = `${selectedCategoryId}_${selectedCatchment}`
                  delete clientCacheRef.current[cacheKey]
                  fetchRecords(true)
                  fetchSummaryCounts(true)
                }}
                disabled={isRefreshing}
                title="รีเฟรชข้อมูลล่าสุด"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                <span>รีเฟรช</span>
              </button>

              <button
                type="button"
                className="btnExport"
                onClick={handleExportExcel}
                disabled={filteredRecords.length === 0}
                title="ส่งออกรายการตามเงื่อนไขเป็น Excel (.xlsx)"
              >
                <FileSpreadsheet size={15} />
                <span>ส่งออก Excel</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Chips for Top Subdistricts */}
          {tambonOptions.length > 1 && (
            <div className="quickChipsContainer">
              <span className="quickChipLabel">
                <MapPin size={12} />
                <span>ตำบลในพื้นที่:</span>
              </span>
              <button
                type="button"
                className={`quickChip ${selectedTambon === '' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTambon('')
                  setCurrentPage(1)
                }}
              >
                ทั้งหมด
              </button>
              {tambonOptions.slice(0, 6).map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={`quickChip ${selectedTambon === t.name ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTambon(selectedTambon === t.name ? '' : t.name)
                    setCurrentPage(1)
                  }}
                >
                  <span>ต.{t.name}</span>
                  <span style={{ opacity: 0.75 }}>({t.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. Data Table / Ledger Card */}
        <div className="tableCard">
          <div className="tableHeaderBar">
            <div className="tableTitle">
              {currentCategory.title} —{' '}
              <span style={{ fontWeight: 500, color: 'var(--mok-accent)' }}>
                {selectedCatchment === 'in_catchment' ? 'ในเขตรับผิดชอบ' : 'นอกเขต อ.เถิน'}
              </span>
            </div>
            <div className="tableCount">
              พบ <strong>{filteredRecords.length.toLocaleString()}</strong> รายการ
              {filteredRecords.length !== records.length && (
                <span> (จากทั้งหมด {records.length.toLocaleString()} รายการ)</span>
              )}
            </div>
          </div>

          {loading ? (
            /* Skeleton Loading State (Pass 9) */
            <div className="tableResponsive">
              <table className="mokTable">
                <thead>
                  <tr>
                    <th className="col-center" style={{ width: 48 }}>#</th>
                    <th className="col-center" style={{ width: 155 }}>เลขบัตรประชาชน (CID)</th>
                    <th className="col-center" style={{ width: 95 }}>HN</th>
                    <th className="col-center">ชื่อ - สกุล</th>
                    <th className="col-center" style={{ width: 75 }}>อายุ</th>
                    <th className="col-center">ที่อยู่</th>
                    <th className="col-center" style={{ width: 60 }}>หมู่</th>
                    <th className="col-center" style={{ width: 110 }}>ตำบล</th>
                    <th className="col-center">ข้อมูลเพิ่มเติม</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="skeletonRow">
                      <td colSpan={9}>
                        <div className="skeletonLine" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredRecords.length === 0 ? (
            /* Empty State */
            <div className="stateBox">
              <Users size={36} style={{ color: 'var(--mok-muted)', opacity: 0.5 }} />
              <p className="stateTitle">ไม่พบข้อมูลผู้ป่วยในหมวดหมู่นี้</p>
              <p className="stateText">
                {hasActiveFilters
                  ? 'ไม่มีรายการตรงกับเงื่อนไขการค้นหาหรือตำบลที่เลือก'
                  : 'ยังไม่มีทะเบียนผู้ป่วยในหมวดหมู่นี้ในระบบ'}
              </p>
              {hasActiveFilters && (
                <button type="button" className="btnSecondary" onClick={resetFilters}>
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= 768px) */}
              <div className="tableResponsive">
                <table className="mokTable">
                  <thead>
                    <tr>
                      <th className="col-center" style={{ width: 48 }}>
                        #
                      </th>
                      <th
                        className="sortableTh col-center"
                        style={{ width: 155 }}
                        onClick={() => handleSort('cid')}
                      >
                        <span className="sortThContent">
                          <span>เลขบัตรประชาชน (CID)</span>
                          {renderSortIndicator('cid')}
                        </span>
                      </th>
                      <th
                        className="sortableTh col-center"
                        style={{ width: 95 }}
                        onClick={() => handleSort('hn')}
                      >
                        <span className="sortThContent">
                          <span>HN</span>
                          {renderSortIndicator('hn')}
                        </span>
                      </th>
                      <th
                        className="sortableTh col-center"
                        onClick={() => handleSort('ptname')}
                      >
                        <span className="sortThContent">
                          <span>ชื่อ - สกุล</span>
                          {renderSortIndicator('ptname')}
                        </span>
                      </th>
                      <th
                        className="sortableTh col-center"
                        style={{ width: 75 }}
                        onClick={() => handleSort('age')}
                      >
                        <span className="sortThContent">
                          <span>อายุ</span>
                          {renderSortIndicator('age')}
                        </span>
                      </th>
                      <th className="col-center">ที่อยู่</th>
                      <th
                        className="sortableTh col-center"
                        style={{ width: 60 }}
                        onClick={() => handleSort('moopart')}
                      >
                        <span className="sortThContent">
                          <span>หมู่</span>
                          {renderSortIndicator('moopart')}
                        </span>
                      </th>
                      <th
                        className="sortableTh col-center"
                        style={{ width: 110 }}
                        onClick={() => handleSort('tambon_name')}
                      >
                        <span className="sortThContent">
                          <span>ตำบล</span>
                          {renderSortIndicator('tambon_name')}
                        </span>
                      </th>

                      {/* Dynamic Columns by Category (Centered Headers) */}
                      {selectedCategoryId === 'type_area_mismatch' && (
                        <>
                          <th className="col-center" style={{ width: 110 }}>Type ห้องบัตร</th>
                          <th className="col-center" style={{ width: 110 }}>Type ส่งเสริม</th>
                          <th className="col-center" style={{ width: 120 }}>ปรับปรุงล่าสุด</th>
                          <th className="col-center">สิทธิการรักษา</th>
                        </>
                      )}

                      {selectedCategoryId.startsWith('ckd') && (
                        <>
                          <th className="col-center">อาชีพ</th>
                          <th className="col-center" style={{ width: 105 }}>Stage ไต</th>
                          <th className="col-center">หมายเหตุ</th>
                        </>
                      )}

                      {['asthma', 'copd'].includes(selectedCategoryId) && (
                        <>
                          <th className="col-center">อาชีพ</th>
                          <th className="col-center">ระดับ/หมายเหตุ</th>
                        </>
                      )}

                      {['ca', 'palliative', 'stroke'].includes(selectedCategoryId) && (
                        <>
                          <th className="col-center">สถานพยาบาลที่ส่งต่อ</th>
                          <th className="col-center" style={{ width: 115 }}>วันที่ส่งต่อ</th>
                          <th className="col-center" style={{ width: 110 }}>สถานะสมาชิก</th>
                        </>
                      )}

                      {selectedCategoryId === 'copd_readmit' && (
                        <>
                          <th className="col-center" style={{ width: 90 }}>AN</th>
                          <th
                            className="sortableTh col-center"
                            style={{ width: 115 }}
                            onClick={() => handleSort('regdate')}
                          >
                            <span className="sortThContent">
                              <span>วันที่ Admit</span>
                              {renderSortIndicator('regdate')}
                            </span>
                          </th>
                          <th className="col-center" style={{ width: 115 }}>วันที่จำหน่าย</th>
                          <th
                            className="sortableTh col-center"
                            style={{ width: 110 }}
                            onClick={() => handleSort('lastvisit')}
                          >
                            <span className="sortThContent">
                              <span>วัน Re-admit</span>
                              {renderSortIndicator('lastvisit')}
                            </span>
                          </th>
                          <th className="col-center">การวินิจฉัยหลัก</th>
                        </>
                      )}

                      {['tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(
                        selectedCategoryId
                      ) && (
                        <th
                          className="sortableTh col-center"
                          style={{ width: 120 }}
                          onClick={() => handleSort('vstdate')}
                        >
                          <span className="sortThContent">
                            <span>วันที่ Diag/ตรวจ</span>
                            {renderSortIndicator('vstdate')}
                          </span>
                        </th>
                      )}

                      {selectedCategoryId === 'child_delayed_dev' && (
                        <>
                          <th className="col-center" style={{ width: 110 }}>อายุวันตรวจ</th>
                          <th
                            className="sortableTh col-center"
                            style={{ width: 120 }}
                            onClick={() => handleSort('vstdate')}
                          >
                            <span className="sortThContent">
                              <span>วันที่ตรวจ</span>
                              {renderSortIndicator('vstdate')}
                            </span>
                          </th>
                        </>
                      )}

                      {!['type_area_mismatch', 'copd_readmit'].includes(selectedCategoryId) &&
                        !selectedCategoryId.startsWith('ckd') &&
                        ![
                          'asthma',
                          'copd',
                          'ca',
                          'palliative',
                          'stroke',
                          'child_delayed_dev',
                          'tb',
                          'elderly_bedridden',
                          'disabled_dependent',
                          'pregnant_risk',
                        ].includes(selectedCategoryId) && (
                          <>
                            <th className="col-center">อาชีพ</th>
                            <th className="col-center">หมายเหตุ</th>
                          </>
                        )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((item, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1
                      return (
                        <tr key={`${item.hn}-${idx}`}>
                          <td className="col-center" style={{ color: 'var(--mok-muted)' }}>
                            {rowNum}
                          </td>
                          <td className="col-center">
                            <span className="cidCell">{formatCid(item.cid)}</span>
                          </td>
                          <td className="col-center">
                            <span className="hnBadge">{item.hn}</span>
                          </td>
                          <td className="col-left">
                            <span className="patientName">{item.ptname}</span>
                          </td>
                          <td className="col-center">
                            <span className="ageCell">
                              {item.age != null && item.age !== '' ? `${item.age} ปี` : '—'}
                            </span>
                          </td>
                          <td className="col-left">{item.address || '—'}</td>
                          <td className="col-center">{item.moopart || '—'}</td>
                          <td className="col-center">{item.tambon_name || '—'}</td>

                          {/* Dynamic Cells */}
                          {selectedCategoryId === 'type_area_mismatch' && (
                            <>
                              <td className="col-center">
                                <span className="badgeStatus info">
                                  Type {item.type_area_patient || '—'}
                                </span>
                              </td>
                              <td className="col-center">
                                <span className="badgeStatus warn">
                                  Type {item.type_area_person || '—'}
                                </span>
                              </td>
                              <td className="col-center dateCell">
                                {formatThaiDate(item.last_update)}
                              </td>
                              <td className="col-left">{item.pttypename || '—'}</td>
                            </>
                          )}

                          {selectedCategoryId.startsWith('ckd') && (
                            <>
                              <td className="col-left">{item.occupation_name || '—'}</td>
                              <td className="col-center">
                                {item.cn ? (
                                  <span
                                    className={`badgeStatus ${
                                      ['4', '5'].includes(String(item.cn).trim()) ? 'err' : 'warn'
                                    }`}
                                  >
                                    Stage {item.cn}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="col-left">{item.cn2 || item.note || '—'}</td>
                            </>
                          )}

                          {['asthma', 'copd'].includes(selectedCategoryId) && (
                            <>
                              <td className="col-left">{item.occupation_name || '—'}</td>
                              <td className="col-left">
                                {item.cn && <strong>{item.cn} </strong>}
                                {item.cn2 || item.note || '—'}
                              </td>
                            </>
                          )}

                          {['ca', 'palliative', 'stroke'].includes(selectedCategoryId) && (
                            <>
                              <td className="col-left">{item.send_to_pcu_name || '—'}</td>
                              <td className="col-center dateCell">
                                {formatThaiDate(item.send_to_pcu_date)}
                              </td>
                              <td className="col-center">
                                {item.clinic_member_status_name ? (
                                  <span className="badgeStatus info">
                                    {item.clinic_member_status_name}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </>
                          )}

                          {selectedCategoryId === 'copd_readmit' && (
                            <>
                              <td className="col-center">
                                <span className="badgeStatus neutral">{item.an || '—'}</span>
                              </td>
                              <td className="col-center dateCell">
                                {formatThaiDate(item.regdate)}
                              </td>
                              <td className="col-center dateCell">
                                {formatThaiDate(item.dchdate)}
                              </td>
                              <td className="col-center">
                                <span className="badgeStatus err">{item.lastvisit} วัน</span>
                              </td>
                              <td className="col-left">
                                <strong>{item.pdx}</strong> {item.pdxname}
                              </td>
                            </>
                          )}

                          {['tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(
                            selectedCategoryId
                          ) && (
                            <td className="col-center dateCell">
                              {formatThaiDate(item.vstdate)}
                            </td>
                          )}

                          {selectedCategoryId === 'child_delayed_dev' && (
                            <>
                              <td className="col-center ageCell">
                                {item.age_y ?? 0} ปี {item.age_m ?? 0} ด.
                              </td>
                              <td className="col-center dateCell">
                                {formatThaiDate(item.vstdate)}
                              </td>
                            </>
                          )}

                          {!['type_area_mismatch', 'copd_readmit'].includes(selectedCategoryId) &&
                            !selectedCategoryId.startsWith('ckd') &&
                            ![
                              'asthma',
                              'copd',
                              'ca',
                              'palliative',
                              'stroke',
                              'child_delayed_dev',
                              'tb',
                              'elderly_bedridden',
                              'disabled_dependent',
                              'pregnant_risk',
                            ].includes(selectedCategoryId) && (
                              <>
                                <td className="col-left">{item.occupation_name || '—'}</td>
                                <td className="col-left">{item.cn || item.note || '—'}</td>
                              </>
                            )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 768px Adaptive) */}
              <div className="mokMobileCards">
                {paginatedRecords.map((item, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1
                  return (
                    <div key={`m-${item.hn}-${idx}`} className="patientCard">
                      <div className="patientCardHeader">
                        <div className="patientCardNameGroup">
                          <span className="patientCardIndex">#{rowNum}</span>
                          <span className="patientCardName">{item.ptname}</span>
                          <span className="hnBadge">{item.hn}</span>
                        </div>
                        <span className="ageCell">
                          {item.age != null && item.age !== '' ? `${item.age} ปี` : ''}
                        </span>
                      </div>

                      <div className="patientCardGrid">
                        <div className="cardDataField">
                          <span className="cardDataLabel">เลขบัตรประชาชน (CID)</span>
                          <span className="cidCell">{formatCid(item.cid)}</span>
                        </div>
                        <div className="cardDataField">
                          <span className="cardDataLabel">พื้นที่</span>
                          <span className="cardDataValue">
                            {item.moopart ? `หมู่ ${item.moopart}` : ''}{' '}
                            {item.tambon_name ? `ต.${item.tambon_name}` : '—'}
                          </span>
                        </div>
                        <div className="cardDataField" style={{ gridColumn: 'span 2' }}>
                          <span className="cardDataLabel">ที่อยู่</span>
                          <span className="cardDataValue">{item.address || '—'}</span>
                        </div>

                        {/* Category Specific Info in Card */}
                        {selectedCategoryId.startsWith('ckd') && item.cn && (
                          <div className="cardDataField">
                            <span className="cardDataLabel">Stage ไต</span>
                            <div>
                              <span
                                className={`badgeStatus ${
                                  ['4', '5'].includes(String(item.cn).trim()) ? 'err' : 'warn'
                                }`}
                              >
                                Stage {item.cn}
                              </span>
                            </div>
                          </div>
                        )}

                        {selectedCategoryId === 'copd_readmit' && (
                          <>
                            <div className="cardDataField">
                              <span className="cardDataLabel">วัน Re-admit</span>
                              <div>
                                <span className="badgeStatus err">{item.lastvisit} วัน</span>
                              </div>
                            </div>
                            <div className="cardDataField">
                              <span className="cardDataLabel">AN</span>
                              <span className="cardDataValue">{item.an}</span>
                            </div>
                          </>
                        )}

                        {selectedCategoryId === 'type_area_mismatch' && (
                          <div className="cardDataField" style={{ gridColumn: 'span 2' }}>
                            <span className="cardDataLabel">TypeArea ไม่ตรงกัน</span>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                              <span className="badgeStatus info">
                                ห้องบัตร: Type {item.type_area_patient || '—'}
                              </span>
                              <span className="badgeStatus warn">
                                ส่งเสริม: Type {item.type_area_person || '—'}
                              </span>
                            </div>
                          </div>
                        )}

                        {['ca', 'palliative', 'stroke'].includes(selectedCategoryId) &&
                          item.send_to_pcu_name && (
                            <div className="cardDataField" style={{ gridColumn: 'span 2' }}>
                              <span className="cardDataLabel">
                                <Building2 size={12} style={{ display: 'inline', marginRight: 3 }} />
                                ส่งต่อไปยัง
                              </span>
                              <span className="cardDataValue">
                                {item.send_to_pcu_name}{' '}
                                {item.send_to_pcu_date && (
                                  <span style={{ color: 'var(--mok-muted)', fontSize: '0.75rem' }}>
                                    ({formatThaiDate(item.send_to_pcu_date)})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                        {item.occupation_name && (
                          <div className="cardDataField">
                            <span className="cardDataLabel">อาชีพ</span>
                            <span className="cardDataValue">{item.occupation_name}</span>
                          </div>
                        )}

                        {(item.cn || item.note) &&
                          !selectedCategoryId.startsWith('ckd') &&
                          !['ca', 'palliative', 'stroke', 'copd_readmit'].includes(
                            selectedCategoryId
                          ) && (
                            <div className="cardDataField" style={{ gridColumn: 'span 2' }}>
                              <span className="cardDataLabel">หมายเหตุ</span>
                              <span className="cardDataValue">{item.cn || item.note}</span>
                            </div>
                          )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 6. Pagination Bar */}
              <div className="paginationBar">
                <div className="paginationInfo">
                  แสดง {((currentPage - 1) * pageSize + 1).toLocaleString()} -{' '}
                  {Math.min(currentPage * pageSize, filteredRecords.length).toLocaleString()} จาก{' '}
                  {filteredRecords.length.toLocaleString()} รายการ (หน้า {currentPage} จาก {totalPages})
                </div>

                <div className="paginationButtons">
                  <button
                    type="button"
                    className="pageBtn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {visiblePageNumbers.map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`pageBtn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="pageBtn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="หน้าถัดไป"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
