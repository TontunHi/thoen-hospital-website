'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import ExcelJS from 'exceljs'
import {
  ArrowLeft,
  Search,
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
} from 'lucide-react'
import {
  MOK_CATEGORIES,
  MokCategoryMeta,
  MokPatientRecord,
  CatchmentType,
} from '@/lib/clinical/mokService'
import './page.css'

interface Props {
  user: {
    username: string
    name?: string | null
    role?: string | null
  }
}

type SortColumn = 'index' | 'cid' | 'hn' | 'ptname' | 'age' | 'moopart' | 'tambon_name' | 'vstdate' | 'regdate' | 'lastvisit'
type SortDirection = 'asc' | 'desc'

export default function MokClient({ user }: Props) {
  // Persistence with localStorage
  const [selectedCatchment, setSelectedCatchment] = useState<CatchmentType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mok_catchment')
      if (saved === 'in_catchment' || saved === 'out_catchment') return saved
    }
    return 'in_catchment'
  })

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('asthma')
  const [records, setRecords] = useState<MokPatientRecord[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTambon, setSelectedTambon] = useState<string>('')
  const [selectedMoo, setSelectedMoo] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(localStorage.getItem('mok_pageSize'))
      if ([25, 50, 100].includes(saved)) return saved
    }
    return 25
  })

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('moopart')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Client-side In-Memory Cache (0ms instant category switching)
  const clientCacheRef = useRef<Record<string, MokPatientRecord[]>>({})

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mok_catchment', selectedCatchment)
    } catch {}
  }, [selectedCatchment])

  useEffect(() => {
    try {
      localStorage.setItem('mok_pageSize', String(pageSize))
    } catch {}
  }, [pageSize])

  // Current category metadata
  const currentCategory = useMemo(() => {
    return MOK_CATEGORIES.find((c) => c.id === selectedCategoryId) || MOK_CATEGORIES[0]
  }, [selectedCategoryId])

  // Fetch summary counts for dropdown
  const fetchSummaryCounts = useCallback(async (manual = false) => {
    try {
      const url = `/api/service/mok?mode=summary&catchment=${selectedCatchment}${manual ? '&refresh=true' : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.counts) {
        setCategoryCounts(json.counts)
      }
    } catch (err) {
      console.error('Failed to fetch MOK summary counts:', err)
    }
  }, [selectedCatchment])

  useEffect(() => {
    fetchSummaryCounts()
  }, [fetchSummaryCounts])

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
    setCurrentPage(1)
    setSearchQuery('')
    setSelectedTambon('')
    setSelectedMoo('')
    fetchRecords()
  }, [fetchRecords])

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
      let valA: any = a[sortColumn as keyof MokPatientRecord]
      let valB: any = b[sortColumn as keyof MokPatientRecord]

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
      { header: 'เลขบัตรประชาชน (CID)', key: 'cid', width: 18 },
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
        { header: 'ปรับปรุงล่าสุด', key: 'last_update', width: 16 },
        { header: 'สิทธิการรักษา', key: 'pttypename', width: 22 }
      )
    } else if (selectedCategoryId.startsWith('ckd')) {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'Stage ไต', key: 'cn', width: 12 },
        { header: 'หมายเหตุ', key: 'cn2', width: 20 }
      )
    } else if (['asthma', 'copd'].includes(selectedCategoryId)) {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'หมายเหตุ (1)', key: 'cn', width: 14 },
        { header: 'หมายเหตุ (2)', key: 'cn2', width: 20 }
      )
    } else if (['ca', 'palliative', 'stroke'].includes(selectedCategoryId)) {
      columnsConfig.push(
        { header: 'อาชีพ', key: 'occupation_name', width: 18 },
        { header: 'ส่งต่อไปยัง', key: 'send_to_pcu_name', width: 24 },
        { header: 'วันที่ส่งต่อ', key: 'send_to_pcu_date', width: 16 },
        { header: 'สถานะสมาชิกคลินิก', key: 'clinic_member_status_name', width: 20 }
      )
    } else if (selectedCategoryId === 'copd_readmit') {
      columnsConfig = [
        { header: 'ลำดับ', key: 'index', width: 8 },
        { header: 'เลขบัตรประชาชน (CID)', key: 'cid', width: 18 },
        { header: 'HN', key: 'hn', width: 12 },
        { header: 'AN', key: 'an', width: 12 },
        { header: 'ชื่อ - นามสกุล', key: 'ptname', width: 26 },
        { header: 'อายุ (ปี)', key: 'age', width: 10 },
        { header: 'วันที่ Admit', key: 'regdate', width: 16 },
        { header: 'วันที่จำหน่าย', key: 'dchdate', width: 16 },
        { header: 'วัน Re-admit (<=28)', key: 'lastvisit', width: 18 },
        { header: 'รหัสโรคหลัก', key: 'pdx', width: 14 },
        { header: 'ชื่อโรคหลัก', key: 'pdxname', width: 30 },
        { header: 'ที่อยู่', key: 'address', width: 35 },
      ]
    } else if (['tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(selectedCategoryId)) {
      columnsConfig.push({ header: 'วันที่ตรวจ/Diag', key: 'vstdate', width: 16 })
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

    // Header styling
    const headerRow = worksheet.getRow(1)
    headerRow.font = { name: 'Sarabun', bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // Data rows
    filteredRecords.forEach((item, idx) => {
      const rowData: any = {
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
        vstdate: item.vstdate || '-',
        regdate: item.regdate || '-',
        dchdate: item.dchdate || '-',
        an: item.an || '-',
        lastvisit: item.lastvisit ?? '-',
        pdx: item.pdx || '-',
        pdxname: item.pdxname || '-',
        send_to_pcu_name: item.send_to_pcu_name || '-',
        send_to_pcu_date: item.send_to_pcu_date || '-',
        clinic_member_status_name: item.clinic_member_status_name || '-',
        type_area_patient: item.type_area_patient || '-',
        type_area_person: item.type_area_person || '-',
        last_update: item.last_update || '-',
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
    a.download = `MOK_${currentCategory.shortTitle}_${catchmentLabel}_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Groups of categories
  const chronicCategories = MOK_CATEGORIES.filter((c) => c.group === 'chronic')
  const specialCategories = MOK_CATEGORIES.filter((c) => c.group === 'special')
  const auditCategories = MOK_CATEGORIES.filter((c) => c.group === 'audit')

  // Helper for option label with count
  const renderOptionLabel = (cat: MokCategoryMeta) => {
    const count = categoryCounts[cat.id]
    if (count != null && count > 0) {
      return `${cat.title} (${count.toLocaleString()} ราย)`
    }
    return cat.title
  }

  return (
    <div className="mokPage">
      <div className="mokContainer">
        {/* Back Link */}
        <div style={{ marginBottom: '0.85rem' }}>
          <Link
            href="/service"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#64748b',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> กลับหน้ารวมบริการ
          </Link>
        </div>

        {/* Top Header Card */}
        <div className="mokHeaderCard">
          <div className="mokHeaderTop">
            <div className="mokTitleWrapper">
              <div className="mokIconBadge">
                <HeartPulse size={28} />
              </div>
              <div className="mokTitleSection">
                <h1>ระบบหมออนามัยครอบครัว (มอค.)</h1>
                <p className="mokSubtitle">
                  ระบบติดตามและดูแลผู้ป่วยกลุ่มเป้าหมายในและนอกเขตรับผิดชอบ โรงพยาบาลเถิน
                </p>
              </div>
            </div>

            {/* Catchment Toggle */}
            <div className="catchmentToggleWrapper">
              <button
                type="button"
                className={`catchmentBtn ${selectedCatchment === 'in_catchment' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCatchment('in_catchment')
                  // Clear client cache on catchment switch
                  clientCacheRef.current = {}
                }}
              >
                <Home size={16} />
                ในเขตรับผิดชอบ (Type 1, 3)
              </button>
              <button
                type="button"
                className={`catchmentBtn ${selectedCatchment === 'out_catchment' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCatchment('out_catchment')
                  // Clear client cache on catchment switch
                  clientCacheRef.current = {}
                }}
              >
                <Globe size={16} />
                นอกเขต อ.เถิน (Type 4)
              </button>
            </div>
          </div>
        </div>

        {/* Category Selector Bar (Dropdown Style) */}
        <div className="mokCategorySelectorBar">
          <div className="categorySelectWrapper">
            <label htmlFor="mokCategorySelect" className="categorySelectLabel">
              <Layers size={18} style={{ color: '#059669' }} />
              <span>เลือกคลินิก / กลุ่มเป้าหมาย:</span>
            </label>
            <div className="categorySelectFieldWrapper">
              <select
                id="mokCategorySelect"
                className="mokCategorySelect"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <optgroup label="🩺 คลินิกโรคเรื้อรังหลัก (9)">
                  {chronicCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {renderOptionLabel(cat)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🛡️ กลุ่มเฝ้าระวังและการดูแลเฉพาะ (7)">
                  {specialCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {renderOptionLabel(cat)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🔍 ตรวจสอบคุณภาพข้อมูล (1)">
                  {auditCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {renderOptionLabel(cat)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div className="categoryMetaBadge">
            <div className="categoryMetaInfo">
              <span className="categoryMetaTitle">{currentCategory.title}</span>
              <span className="categoryMetaDesc">{currentCategory.description}</span>
            </div>
            <div className="categoryMetaCounts">
              <span className="badgeCountTotal">
                {filteredRecords.length.toLocaleString()} ราย
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="mokToolbar">
          <div className="toolbarLeft">
            {/* Search Box */}
            <div className="searchBox">
              <Search size={16} className="searchIcon" />
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
            >
              <option value="25">แสดง 25 รายการ</option>
              <option value="50">แสดง 50 รายการ</option>
              <option value="100">แสดง 100 รายการ</option>
            </select>
          </div>

          <div className="toolbarRight">
            <button
              type="button"
              className="btnSecondary"
              onClick={() => {
                // Clear client cache entry for current category to force fresh fetch
                const cacheKey = `${selectedCategoryId}_${selectedCatchment}`
                delete clientCacheRef.current[cacheKey]
                fetchRecords(true)
                fetchSummaryCounts(true)
              }}
              disabled={isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              รีเฟรช
            </button>

            <button
              type="button"
              className="btnExport"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
            >
              <FileSpreadsheet size={15} />
              ส่งออก Excel
            </button>
          </div>

          {/* Quick Filter Chips for Top Subdistricts */}
          {tambonOptions.length > 1 && (
            <div className="quickChipsContainer">
              <span className="quickChipLabel">
                <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                ตำบลในพื้นที่:
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
                  ต.{t.name} ({t.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Data Table Card */}
        <div className="tableCard">
          <div className="tableHeaderBar">
            <div className="tableTitle">
              {currentCategory.title} —{' '}
              <span style={{ fontWeight: 500, color: '#059669' }}>
                {selectedCatchment === 'in_catchment' ? 'ในเขตรับผิดชอบ' : 'นอกเขต อ.เถิน'}
              </span>
            </div>
            <div className="tableCount">
              พบทั้งหมด <strong>{filteredRecords.length.toLocaleString()}</strong> รายการ
              {filteredRecords.length !== records.length && (
                <span> (จากทั้งหมด {records.length.toLocaleString()} รายการ)</span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="stateBox">
              <div className="spinner" />
              <span>กำลังโหลดข้อมูลจากฐานข้อมูลคลินิก...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="stateBox">
              <Users size={40} style={{ opacity: 0.3 }} />
              <p>ไม่พบข้อมูลผู้ป่วยในหมวดหมู่นี้ หรือไม่มีรายการตรงกับเงื่อนไขการค้นหา</p>
            </div>
          ) : (
            <>
              <div className="tableResponsive">
                <table className="mokTable">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                      <th
                        className="sortableTh"
                        style={{ width: '150px' }}
                        onClick={() => handleSort('cid')}
                      >
                        <span className="sortThContent">
                          เลขบัตรประชาชน (CID) {renderSortIndicator('cid')}
                        </span>
                      </th>
                      <th
                        className="sortableTh"
                        style={{ width: '95px' }}
                        onClick={() => handleSort('hn')}
                      >
                        <span className="sortThContent">
                          HN {renderSortIndicator('hn')}
                        </span>
                      </th>
                      <th
                        className="sortableTh"
                        onClick={() => handleSort('ptname')}
                      >
                        <span className="sortThContent">
                          ชื่อ - สกุล {renderSortIndicator('ptname')}
                        </span>
                      </th>
                      <th
                        className="sortableTh"
                        style={{ width: '70px', textAlign: 'center' }}
                        onClick={() => handleSort('age')}
                      >
                        <span className="sortThContent">
                          อายุ {renderSortIndicator('age')}
                        </span>
                      </th>
                      <th>ที่อยู่</th>
                      <th
                        className="sortableTh"
                        style={{ width: '70px', textAlign: 'center' }}
                        onClick={() => handleSort('moopart')}
                      >
                        <span className="sortThContent">
                          หมู่ {renderSortIndicator('moopart')}
                        </span>
                      </th>
                      <th
                        className="sortableTh"
                        style={{ width: '120px' }}
                        onClick={() => handleSort('tambon_name')}
                      >
                        <span className="sortThContent">
                          ตำบล {renderSortIndicator('tambon_name')}
                        </span>
                      </th>

                      {/* Dynamic Columns by Category */}
                      {selectedCategoryId === 'type_area_mismatch' && (
                        <>
                          <th style={{ width: '90px', textAlign: 'center' }}>Type ห้องบัตร</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Type ส่งเสริม</th>
                          <th>ปรับปรุงล่าสุด</th>
                          <th>สิทธิการรักษา</th>
                        </>
                      )}

                      {selectedCategoryId.startsWith('ckd') && (
                        <>
                          <th>อาชีพ</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Stage ไต</th>
                          <th>หมายเหตุ</th>
                        </>
                      )}

                      {['asthma', 'copd'].includes(selectedCategoryId) && (
                        <>
                          <th>อาชีพ</th>
                          <th>ระดับ/หมายเหตุ</th>
                        </>
                      )}

                      {['ca', 'palliative', 'stroke'].includes(selectedCategoryId) && (
                        <>
                          <th>สถานพยาบาลที่ส่งต่อ</th>
                          <th style={{ width: '110px' }}>วันที่ส่งต่อ</th>
                          <th>สถานะสมาชิก</th>
                        </>
                      )}

                      {selectedCategoryId === 'copd_readmit' && (
                        <>
                          <th style={{ width: '90px' }}>AN</th>
                          <th
                            className="sortableTh"
                            style={{ width: '105px' }}
                            onClick={() => handleSort('regdate')}
                          >
                            <span className="sortThContent">
                              วันที่ Admit {renderSortIndicator('regdate')}
                            </span>
                          </th>
                          <th style={{ width: '105px' }}>วันที่จำหน่าย</th>
                          <th
                            className="sortableTh"
                            style={{ width: '105px', textAlign: 'center' }}
                            onClick={() => handleSort('lastvisit')}
                          >
                            <span className="sortThContent">
                              วัน Re-admit {renderSortIndicator('lastvisit')}
                            </span>
                          </th>
                          <th>การวินิจฉัยหลัก</th>
                        </>
                      )}

                      {['tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(
                        selectedCategoryId
                      ) && (
                        <th
                          className="sortableTh"
                          style={{ width: '115px' }}
                          onClick={() => handleSort('vstdate')}
                        >
                          <span className="sortThContent">
                            วันที่ Diag/ตรวจ {renderSortIndicator('vstdate')}
                          </span>
                        </th>
                      )}

                      {selectedCategoryId === 'child_delayed_dev' && (
                        <>
                          <th style={{ width: '110px', textAlign: 'center' }}>อายุวันตรวจ (ปี/ด.)</th>
                          <th
                            className="sortableTh"
                            style={{ width: '115px' }}
                            onClick={() => handleSort('vstdate')}
                          >
                            <span className="sortThContent">
                              วันที่ตรวจ {renderSortIndicator('vstdate')}
                            </span>
                          </th>
                        </>
                      )}

                      {!['type_area_mismatch', 'copd_readmit'].includes(selectedCategoryId) &&
                        !selectedCategoryId.startsWith('ckd') &&
                        !['asthma', 'copd', 'ca', 'palliative', 'stroke', 'child_delayed_dev', 'tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(selectedCategoryId) && (
                          <>
                            <th>อาชีพ</th>
                            <th>หมายเหตุ</th>
                          </>
                        )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((item, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1
                      return (
                        <tr key={`${item.hn}-${idx}`}>
                          <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                            {rowNum}
                          </td>
                          <td className="cidCell">{item.cid || '-'}</td>
                          <td>
                            <span className="hnBadge">{item.hn}</span>
                          </td>
                          <td className="patientName">{item.ptname}</td>
                          <td style={{ textAlign: 'center' }}>{item.age ?? '-'}</td>
                          <td>{item.address}</td>
                          <td style={{ textAlign: 'center' }}>{item.moopart || '-'}</td>
                          <td>{item.tambon_name || '-'}</td>

                          {/* Dynamic Cells */}
                          {selectedCategoryId === 'type_area_mismatch' && (
                            <>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badgeStage info">Type {item.type_area_patient || '-'}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badgeStage warning">Type {item.type_area_person || '-'}</span>
                              </td>
                              <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {item.last_update || '-'}
                              </td>
                              <td>{item.pttypename || '-'}</td>
                            </>
                          )}

                          {selectedCategoryId.startsWith('ckd') && (
                            <>
                              <td>{item.occupation_name || '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                {item.cn ? (
                                  <span
                                    className={`badgeStage ${
                                      ['4', '5'].includes(item.cn) ? 'danger' : 'warning'
                                    }`}
                                  >
                                    Stage {item.cn}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>{item.cn2 || item.note || '-'}</td>
                            </>
                          )}

                          {['asthma', 'copd'].includes(selectedCategoryId) && (
                            <>
                              <td>{item.occupation_name || '-'}</td>
                              <td>
                                {item.cn && <strong>{item.cn} </strong>}
                                {item.cn2 || item.note || '-'}
                              </td>
                            </>
                          )}

                          {['ca', 'palliative', 'stroke'].includes(selectedCategoryId) && (
                            <>
                              <td>{item.send_to_pcu_name || '-'}</td>
                              <td>{item.send_to_pcu_date || '-'}</td>
                              <td>
                                {item.clinic_member_status_name ? (
                                  <span className="badgeStage info">
                                    {item.clinic_member_status_name}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </>
                          )}

                          {selectedCategoryId === 'copd_readmit' && (
                            <>
                              <td>{item.an}</td>
                              <td>{item.regdate || '-'}</td>
                              <td>{item.dchdate || '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badgeStage danger">{item.lastvisit} วัน</span>
                              </td>
                              <td>
                                <strong>{item.pdx}</strong> {item.pdxname}
                              </td>
                            </>
                          )}

                          {['tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(
                            selectedCategoryId
                          ) && <td>{item.vstdate || '-'}</td>}

                          {selectedCategoryId === 'child_delayed_dev' && (
                            <>
                              <td style={{ textAlign: 'center' }}>
                                {item.age_y ?? 0} ปี {item.age_m ?? 0} ด.
                              </td>
                              <td>{item.vstdate || '-'}</td>
                            </>
                          )}

                          {!['type_area_mismatch', 'copd_readmit'].includes(selectedCategoryId) &&
                            !selectedCategoryId.startsWith('ckd') &&
                            !['asthma', 'copd', 'ca', 'palliative', 'stroke', 'child_delayed_dev', 'tb', 'elderly_bedridden', 'disabled_dependent', 'pregnant_risk'].includes(selectedCategoryId) && (
                              <>
                                <td>{item.occupation_name || '-'}</td>
                                <td>{item.cn || item.note || '-'}</td>
                              </>
                            )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="paginationBar">
                <div className="paginationInfo">
                  แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า (
                  {((currentPage - 1) * pageSize + 1).toLocaleString()} -{' '}
                  {Math.min(currentPage * pageSize, filteredRecords.length).toLocaleString()}{' '}
                  จาก {filteredRecords.length.toLocaleString()} รายการ)
                </div>

                <div className="paginationButtons">
                  <button
                    type="button"
                    className="pageBtn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
