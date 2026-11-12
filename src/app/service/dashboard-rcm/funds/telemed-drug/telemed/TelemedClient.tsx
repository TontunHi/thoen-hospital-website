'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RefreshCw,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Columns,
  Copy,
  Check,
  Eye,
} from 'lucide-react'
import type {
  TelemedItem,
  TelemedSummary,
  TelemedSortField,
  AdpMappingCheck,
  TelemedReportResult,
} from '@/lib/clinical/rcmTelemedDrugService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { PttypeMultiSelect } from '@/components/rcm/PttypeMultiSelect'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'
import { RcmSeamlessSubAmount, RcmSeamlessRepBadges, RcmSeamlessModalSection } from '@/components/rcm/RcmSeamlessRepDisplay'

const THAI_MONTHS = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
]

function formatMoney(val?: number | null): string {
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function maskCid(cid?: string | null): string {
  if (!cid) return '—'
  const clean = cid.replace(/\D/g, '')
  if (clean.length === 13) {
    return `${clean[0]}-${clean.slice(1, 5)}-xxxxx-${clean.slice(10, 12)}-${clean[12]}`
  }
  return cid
}

function cleanStatusName(status?: string | null, isCompensated?: boolean): string {
  if (!status) return isCompensated ? 'ชดเชยแล้ว' : 'รอชดเชย / ยังไม่ส่ง'
  let clean = status.replace(/^[-\s:]+/, '').trim()
  if (clean.toLowerCase().includes('rep') || isCompensated) return 'ชดเชยแล้ว'
  if (clean.includes('ยังไม่ได้ส่ง') || clean.includes('ยังไม่ส่ง')) return 'รอชดเชย / ยังไม่ส่ง'
  return clean || (isCompensated ? 'ชดเชยแล้ว' : 'รอชดเชย / ยังไม่ส่ง')
}

// Consolidation helper for duplicate clinical drug lines
interface ConsolidatedDrug {
  item_code: string
  item_name: string
  units: string
  qty: number
  sum_price: number
}

function consolidateDrugs(items?: any[]): ConsolidatedDrug[] {
  if (!items || !Array.isArray(items)) return []
  const map = new Map<string, ConsolidatedDrug>()
  for (const item of items) {
    const key = (item.item_code || item.item_name || '').trim()
    const qty = Number(item.qty) || 0
    const price = Number(item.sum_price) || 0
    const existing = map.get(key)
    if (existing) {
      existing.qty += qty
      existing.sum_price += price
    } else {
      map.set(key, {
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        units: item.units || 'หน่วย',
        qty,
        sum_price: price,
      })
    }
  }
  return Array.from(map.values())
}

// Card Groups for multi-group filtering (Section 6.3)
export type CompensationCard = 'COMPENSATED' | 'UNCOMPENSATED'
export type ClaimCard = 'WITH_AUTHEN' | 'NO_AUTHEN'

export interface ActiveCardsState {
  compensation?: CompensationCard
  claim?: ClaimCard
  hasFee?: boolean
  ucOnly?: boolean
  exportCode5?: boolean
}

export interface TelemedClientProps {
  initialData?: TelemedReportResult | null
}

export default function TelemedClient({ initialData = null }: TelemedClientProps) {
  const today = useMemo(() => new Date(), [])
  const curCalYear = today.getFullYear()
  const curBeYear = curCalYear + 543
  const curMonth = today.getMonth() + 1
  const defaultFiscalCeYear = curMonth >= 10 ? curCalYear + 1 : curCalYear
  const defaultFiscalBeYear = defaultFiscalCeYear + 543

  const yearOptions = useMemo(() => {
    const list: number[] = []
    for (let y = defaultFiscalBeYear + 1; y >= defaultFiscalBeYear - 6; y--) {
      list.push(y)
    }
    return list
  }, [defaultFiscalBeYear])

  // Date selection states: Standard Order: 1. กำหนดเอง -> 2. รายเดือน -> 3. ปีงบประมาณ
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(
    defaultFiscalBeYear === 2570 ? 2570 : 2569
  )
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(
    initialData?.ds1 ?? `${defaultFiscalCeYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialData?.ds2 ?? `${defaultFiscalCeYear}-09-30`
  )

  // Card filter multi-group state
  const [activeCards, setActiveCards] = useState<ActiveCardsState>(() => {
    const rawFilter = initialData?.cardFilter
    const state: ActiveCardsState = {}
    if (rawFilter === 'COMPENSATED') state.compensation = 'COMPENSATED'
    if (rawFilter === 'UNCOMPENSATED') state.compensation = 'UNCOMPENSATED'
    if (rawFilter === 'WITH_AUTHEN') state.claim = 'WITH_AUTHEN'
    if (rawFilter === 'NO_AUTHEN') state.claim = 'NO_AUTHEN'
    if (rawFilter === 'WITH_PRICE') state.hasFee = true
    if (rawFilter === 'UC_ONLY' || initialData?.ucOnly) state.ucOnly = true
    if (rawFilter === 'EXPORT_CODE_5') state.exportCode5 = true
    return state
  })

  // Search & Additional Filters Popover states
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [pttypes, setPttypes] = useState<string[]>([])
  const [filterSex, setFilterSex] = useState<string>('ALL')
  const [filterOvstist5, setFilterOvstist5] = useState<boolean>(false)
  const [filterAgeMin, setFilterAgeMin] = useState<string>('')
  const [filterAgeMax, setFilterAgeMax] = useState<string>('')
  const [filterPdx, setFilterPdx] = useState<string>('')
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState<boolean>(false)
  const filterPopoverRef = useRef<HTMLDivElement | null>(null)

  // Table options (Density & Column Visibility)
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState<boolean>(false)
  const columnDropdownRef = useRef<HTMLDivElement | null>(null)

  // Visible columns state
  const [visibleColumns, setVisibleColumns] = useState<{
    vstdate: boolean
    ptname: boolean
    pttype: boolean
    pdx: boolean
    fee: boolean
    claimCode: boolean
    compensated: boolean
    status: boolean
    cid: boolean
    ovstist: boolean
    no: boolean
  }>({
    vstdate: true,
    ptname: true,
    pttype: true,
    pdx: true,
    fee: true,
    claimCode: true,
    compensated: true,
    status: true,
    cid: false, // Optional by default per plan section 8.1
    ovstist: false,
    no: false,
  })

  // Unmasked CIDs state for PDPA compliance
  const [unmaskedCids, setUnmaskedCids] = useState<Record<string, boolean>>({})

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<TelemedSortField>(
    initialData?.sortBy ?? 'vstdate'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialData?.sortOrder ?? 'desc'
  )
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)
  const [jumpPageInput, setJumpPageInput] = useState<string>('')

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TelemedItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<AdpMappingCheck>(
    initialData?.adpMapping ?? {
      adpCode: 'TELMED',
      isMapped: true,
      mappedCount: 0,
      items: [],
    }
  )
  const [summary, setSummary] = useState<TelemedSummary>(
    initialData?.summary ?? {
      totalVisits: 0,
      uniquePatients: 0,
      compensatedVisits: 0,
      uncompensatedVisits: 0,
      compensationRate: 0,
      totalCompensated: 0,
      averageCompensated: 0,
      withAuthenCount: 0,
      withoutAuthenCount: 0,
      authenRate: 0,
      ucCount: 0,
      ucRate: 0,
      withPriceCount: 0,
      withPriceRate: 0,
      exportCode5Count: 0,
      exportCode5Rate: 0,
      totalSumPrice: 0,
      totalIncome: 0,
    }
  )

  // Drawer Detail states (replaces modal, Section 9)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [drawerTab, setDrawerTab] = useState<'summary' | 'clinical'>('summary')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingVnDetails, setLoadingVnDetails] = useState<boolean>(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const selectedItem = useMemo(() => {
    if (selectedItemIndex == null || selectedItemIndex < 0 || selectedItemIndex >= items.length) {
      return null
    }
    return items[selectedItemIndex]
  }, [selectedItemIndex, items])

  // AbortController ref for race defense
  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef<boolean>(true)

  // Load density and column visibility from localStorage on mount
  useEffect(() => {
    try {
      const savedDensity = localStorage.getItem('rcm_telemed_density') as 'comfortable' | 'compact'
      if (savedDensity) setDensity(savedDensity)
      const savedCols = localStorage.getItem('rcm_telemed_columns')
      if (savedCols) setVisibleColumns(JSON.parse(savedCols))
    } catch {
      // ignore
    }
  }, [])

  // Persist density
  const handleDensityChange = (d: 'comfortable' | 'compact') => {
    setDensity(d)
    try {
      localStorage.setItem('rcm_telemed_density', d)
    } catch {
      // ignore
    }
  }

  // Persist columns
  const handleToggleColumn = (colKey: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [colKey]: !prev[colKey] }
      try {
        localStorage.setItem('rcm_telemed_columns', JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(target)
      ) {
        setIsFilterPopoverOpen(false)
      }
      if (
        columnDropdownRef.current &&
        !columnDropdownRef.current.contains(target)
      ) {
        setIsColumnDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation for table and drawer (Esc to close, Up/Down to move rows)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedItemIndex != null) {
        if (e.key === 'Escape') {
          setSelectedItemIndex(null)
        } else if (e.key === 'ArrowLeft' && selectedItemIndex > 0) {
          setSelectedItemIndex(selectedItemIndex - 1)
        } else if (e.key === 'ArrowRight' && selectedItemIndex < items.length - 1) {
          setSelectedItemIndex(selectedItemIndex + 1)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItemIndex, items.length])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Convert active cards state to comma-separated cards query param
  const cardsQueryParam = useMemo(() => {
    const list: string[] = []
    if (activeCards.compensation) list.push(activeCards.compensation)
    if (activeCards.claim) list.push(activeCards.claim)
    if (activeCards.hasFee) list.push('WITH_PRICE')
    if (activeCards.ucOnly) list.push('UC_ONLY')
    if (activeCards.exportCode5) list.push('EXPORT_CODE_5')
    return list.join(',')
  }, [activeCards])

  // Fetch report data
  const fetchData = useCallback(
    async (refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (refresh) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const queryParams = new URLSearchParams({
          ds1,
          ds2,
          cardFilter: cardsQueryParam || 'ALL',
          searchField: 'ALL',
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })

        if (cardsQueryParam) queryParams.set('cards', cardsQueryParam)
        if (activeCards.ucOnly) queryParams.set('ucOnly', 'true')
        if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
        if (filterSex !== 'ALL') queryParams.set('sex', filterSex)
        if (filterOvstist5) queryParams.set('ovstistExportCode', '5')
        if (filterAgeMin) queryParams.set('ageMin', filterAgeMin)
        if (filterAgeMax) queryParams.set('ageMax', filterAgeMax)
        if (filterPdx) queryParams.set('pdx', filterPdx)
        if (refresh) queryParams.set('refresh', 'true')

        // Update URL query parameters for sharing/bookmarking
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          url.searchParams.set('mode', dateMode)
          url.searchParams.set('from', ds1)
          url.searchParams.set('to', ds2)
          if (cardsQueryParam) url.searchParams.set('cards', cardsQueryParam)
          else url.searchParams.delete('cards')
          if (debouncedSearch) url.searchParams.set('q', debouncedSearch)
          else url.searchParams.delete('q')
          url.searchParams.set('page', String(currentPage))
          window.history.replaceState({}, '', url.toString())
        }

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/telemed-drug/telemed?${queryParams.toString()}`,
          { signal: controller.signal }
        )

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson.error?.message || `HTTP ${res.status}: ไม่สามารถดึงข้อมูลรายงานได้`)
        }

        const json = await res.json()
        if (json.success && json.data) {
          const result: TelemedReportResult = json.data
          setItems(result.items)
          setTotalCount(result.totalCount)
          setTotalPages(result.totalPages)
          setSummary(result.summary)
          setAdpMapping(result.adpMapping)
        } else {
          throw new Error(json.error?.message || 'รูปแบบข้อมูลตอบกลับไม่ถูกต้อง')
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [
      ds1,
      ds2,
      cardsQueryParam,
      activeCards.ucOnly,
      debouncedSearch,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
      pttypes,
      filterSex,
      filterOvstist5,
      filterAgeMin,
      filterAgeMax,
      filterPdx,
      dateMode,
    ]
  )

  // Trigger fetch on filter change (skipping first mount if initialData is provided)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Fetch clinical VN details when drawer switches to clinical tab
  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/telemed-drug/vn-details?vn=${vn}`)
      const json = await res.json()
      if (json.success) {
        setVnDetails(json.data)
      } else {
        setVnDetails(null)
      }
    } catch {
      setVnDetails(null)
    } finally {
      setLoadingVnDetails(false)
    }
  }, [])

  const handleRowClick = (index: number) => {
    setSelectedItemIndex(index)
    setDrawerTab('summary')
    setVnDetails(null)
  }

  const handleDrawerTabChange = (tab: 'summary' | 'clinical') => {
    setDrawerTab(tab)
    if (tab === 'clinical' && selectedItem && !vnDetails && !loadingVnDetails) {
      fetchVnDetails(selectedItem.vn)
    }
  }

  const handleCopyText = (text: string, fieldId: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 1500)
    }
  }

  // Unmask CID and record audit log
  const handleUnmaskCid = async (vn: string, hn: string, cid: string) => {
    setUnmaskedCids((prev) => ({ ...prev, [vn]: true }))
    try {
      await fetch('/api/log-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'READ',
          targetTable: 'rcm_telemed_cid_unmask',
          actionDetails: `Unmask CID for HN ${hn} VN ${vn}`,
        }),
      })
    } catch {
      // audit log error ignored defensively
    }
  }

  // Handle Date Mode Changes
  const handleModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    setCurrentPage(1)

    if (mode === 'custom') {
      // Keep current ds1, ds2
    } else if (mode === 'monthly') {
      const ceYear = selectedBeYear - 543
      const mm = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
      setDs1(`${ceYear}-${mm}-01`)
      setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    } else if (mode === 'fiscal') {
      const ceFiscal = selectedFiscalYear - 543
      setDs1(`${ceFiscal - 1}-10-01`)
      setDs2(`${ceFiscal}-09-30`)
    }
  }

  const handleFiscalYearChange = (beYear: number) => {
    setSelectedFiscalYear(beYear)
    const ceFiscal = beYear - 543
    setDs1(`${ceFiscal - 1}-10-01`)
    setDs2(`${ceFiscal}-09-30`)
    setCurrentPage(1)
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    const ceYear = selectedBeYear - 543
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(ceYear, month, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleBeYearChange = (beYear: number) => {
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const mm = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, selectedMonth, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handlePrevMonth = () => {
    let nextMonth = selectedMonth - 1
    let nextBeYear = selectedBeYear
    if (nextMonth < 1) {
      nextMonth = 12
      nextBeYear -= 1
    }
    setSelectedMonth(nextMonth)
    setSelectedBeYear(nextBeYear)
    const ceYear = nextBeYear - 543
    const mm = String(nextMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, nextMonth, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  const handleNextMonth = () => {
    let nextMonth = selectedMonth + 1
    let nextBeYear = selectedBeYear
    if (nextMonth > 12) {
      nextMonth = 1
      nextBeYear += 1
    }
    setSelectedMonth(nextMonth)
    setSelectedBeYear(nextBeYear)
    const ceYear = nextBeYear - 543
    const mm = String(nextMonth).padStart(2, '0')
    const lastDay = new Date(ceYear, nextMonth, 0).getDate()
    setDs1(`${ceYear}-${mm}-01`)
    setDs2(`${ceYear}-${mm}-${String(lastDay).padStart(2, '0')}`)
    setCurrentPage(1)
  }

  // Sorting
  const handleSort = (field: TelemedSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: TelemedSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.35, flexShrink: 0 }} />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
    )
  }

  // Card filter selection (Section 6.3)
  const toggleCompensationCard = (type?: CompensationCard) => {
    setActiveCards((prev) => ({
      ...prev,
      compensation: prev.compensation === type ? undefined : type,
    }))
    setCurrentPage(1)
  }

  const toggleClaimCard = (type: ClaimCard) => {
    setActiveCards((prev) => ({
      ...prev,
      claim: prev.claim === type ? undefined : type,
    }))
    setCurrentPage(1)
  }

  const toggleFeeCard = () => {
    setActiveCards((prev) => ({
      ...prev,
      hasFee: !prev.hasFee,
    }))
    setCurrentPage(1)
  }

  const toggleUcCard = () => {
    setActiveCards((prev) => ({
      ...prev,
      ucOnly: !prev.ucOnly,
    }))
    setCurrentPage(1)
  }

  const toggleType5Card = () => {
    setActiveCards((prev) => ({
      ...prev,
      exportCode5: !prev.exportCode5,
    }))
    setCurrentPage(1)
  }

  // Clear all filters except date range
  const handleClearAllFilters = () => {
    setActiveCards({})
    setSearch('')
    setDebouncedSearch('')
    setPttypes([])
    setFilterSex('ALL')
    setFilterOvstist5(false)
    setFilterAgeMin('')
    setFilterAgeMax('')
    setFilterPdx('')
    setCurrentPage(1)
  }

  // Popover active filter count
  const activePopoverFilterCount = useMemo(() => {
    let count = 0
    if (pttypes.length > 0) count++
    if (filterSex !== 'ALL') count++
    if (filterOvstist5) count++
    if (filterAgeMin || filterAgeMax) count++
    if (filterPdx) count++
    return count
  }, [pttypes, filterSex, filterOvstist5, filterAgeMin, filterAgeMax, filterPdx])

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(activeCards.compensation) ||
      Boolean(activeCards.claim) ||
      Boolean(activeCards.hasFee) ||
      Boolean(activeCards.ucOnly) ||
      Boolean(activeCards.exportCode5) ||
      search.trim().length > 0 ||
      activePopoverFilterCount > 0
    )
  }, [activeCards, search, activePopoverFilterCount])

  // Export Excel (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true)
    setExportMessage('กำลังเตรียมไฟล์ Excel...')
    try {
      const queryParams = new URLSearchParams({
        ds1,
        ds2,
        cardFilter: cardsQueryParam || 'ALL',
        searchField: 'ALL',
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (cardsQueryParam) queryParams.set('cards', cardsQueryParam)
      if (activeCards.ucOnly) queryParams.set('ucOnly', 'true')
      if (pttypes.length > 0) queryParams.set('pttypes', pttypes.join(','))
      if (filterSex !== 'ALL') queryParams.set('sex', filterSex)
      if (filterOvstist5) queryParams.set('ovstistExportCode', '5')
      if (filterAgeMin) queryParams.set('ageMin', filterAgeMin)
      if (filterAgeMax) queryParams.set('ageMax', filterAgeMax)
      if (filterPdx) queryParams.set('pdx', filterPdx)

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/telemed-drug/telemed?${queryParams.toString()}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.items) {
        throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      }

      const exportRows: TelemedItem[] = json.data.items
      const headers = [
        'ลำดับ',
        'VN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        'วันที่รับบริการ',
        'เวลา',
        'ประเภทการมา (ovstist)',
        'ClaimCode',
        'สิทธิการรักษา',
        'กลุ่มสิทธิ',
        'รพ.หลัก',
        'รพ.รอง',
        'แผนก',
        'คลินิก',
        'วินิจฉัยหลัก (PDX)',
        'ค่าบริการรวม (บาท)',
        'ค่า TelMed (บาท)',
        'สถานะการส่ง',
        'เลขที่ใบตอบรับ (REP)',
        'ยอดชดเชย (บาท)',
        'กองทุน (Fund)',
        'กองทุนย่อย (Subfund)',
      ]

      const rows = exportRows.map((r) => [
        r.no,
        r.vn,
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        r.age,
        r.vstdate,
        r.vsttime,
        r.ovstist,
        r.authencode || '',
        r.pttypename,
        r.maininscl,
        r.hospmain || '',
        r.hospsub || '',
        r.department || '',
        r.clinic || '',
        r.pdx || '',
        r.income,
        r.sum_price,
        cleanStatusName(r.status, r.isCompensated),
        r.rep || '',
        r.compensated,
        r.fund || '',
        r.subfund || '',
      ])

      await exportRcmExcel({
        filename: `telemed_report_11_53_${ds1}_to_${ds2}.xlsx`,
        title: '11.53 รายชื่อผู้ได้รับบริการ TelMed',
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${exportRows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows,
      })

      setExportMessage(`ส่งออกแล้ว ${exportRows.length.toLocaleString('th-TH')} รายการ`)
      setTimeout(() => setExportMessage(null), 3000)
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Excel')
      setExportMessage(null)
    } finally {
      setIsExporting(false)
    }
  }

  // Jump to page handler
  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(jumpPageInput, 10)
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p)
      setJumpPageInput('')
    }
  }

  // ClaimCode alert condition (≥ 10% unauthen)
  const showClaimAlert =
    summary.totalVisits > 0 &&
    summary.withoutAuthenCount / summary.totalVisits >= 0.1

  return (
    <div className="telemed-container">
      {/* ── 1. Header (Single Layer Breadcrumb is handled by Shell) ── */}
      <div className="telemed-header">
        <div className="telemed-title-area">
          <h1 className="telemed-title">11.53 รายชื่อผู้ได้รับบริการ TelMed</h1>
          <p className="telemed-subtitle">
            บริการการแพทย์ทางไกล รหัส ADP TELMED หรือประเภทการมาบริการสาธารณสุขทางไกล (รหัสส่งออก 5)
          </p>
        </div>
      </div>

      {/* ── 2. Warnings (ADP Map Check) ── */}
      {!adpMapping.isMapped && (
        <div className="telemed-alert-banner" role="alert">
          <div className="telemed-alert-message">
            <AlertTriangle size={18} />
            <span>
              <strong>ยังไม่ได้ Map รหัส ADP Code &apos;TELMED&apos; ในระบบ:</strong>{' '}
              ไม่พบการผูกรหัสค่าบริการทางการแพทย์กับ ADP Code &apos;TELMED&apos; ในตาราง s_drugitems
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Toolbar (Locked button names: กำหนดเอง, รายเดือน, ปีงบประมาณ, รีเฟรช, ส่งออก Excel) ── */}
      <div className="telemed-toolbar">
        {isRefreshing && <div className="telemed-loading-line" />}
        <div className="telemed-toolbar-left">
          <div className="telemed-segmented-group" role="tablist" aria-label="โหมดช่วงเวลา">
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'custom'}
              className={`telemed-segment-btn ${dateMode === 'custom' ? 'active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              กำหนดเอง
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'monthly'}
              className={`telemed-segment-btn ${dateMode === 'monthly' ? 'active' : ''}`}
              onClick={() => handleModeChange('monthly')}
            >
              รายเดือน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dateMode === 'fiscal'}
              className={`telemed-segment-btn ${dateMode === 'fiscal' ? 'active' : ''}`}
              onClick={() => handleModeChange('fiscal')}
            >
              ปีงบประมาณ
            </button>
          </div>

          <div className="telemed-date-inputs">
            {dateMode === 'custom' && (
              <>
                <ThaiDatePicker
                  value={ds1}
                  onChange={(val) => {
                    setDs1(val)
                    setCurrentPage(1)
                  }}
                  placeholder="ตั้งแต่วันที่"
                  aria-label="ตั้งแต่วันที่"
                />
                <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>ถึง</span>
                <ThaiDatePicker
                  value={ds2}
                  onChange={(val) => {
                    setDs2(val)
                    setCurrentPage(1)
                  }}
                  placeholder="ถึงวันที่"
                  aria-label="ถึงวันที่"
                />
              </>
            )}

            {dateMode === 'monthly' && (
              <div className="telemed-month-stepper">
                <button
                  type="button"
                  className="telemed-stepper-btn"
                  onClick={handlePrevMonth}
                  title="เดือนก่อนหน้า"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>
                <select
                  className="telemed-select"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  aria-label="เลือกเดือน"
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="telemed-select"
                  value={selectedBeYear}
                  onChange={(e) => handleBeYearChange(Number(e.target.value))}
                  aria-label="เลือกปี พ.ศ."
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="telemed-stepper-btn"
                  onClick={handleNextMonth}
                  title="เดือนถัดไป"
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {dateMode === 'fiscal' && (
              <select
                className="telemed-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
                aria-label="เลือกปีงบประมาณ"
              >
                {[2569, 2570].map((y) => (
                  <option key={y} value={y}>
                    ปีงบ {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="telemed-toolbar-right">
          <button
            type="button"
            className="telemed-btn"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            title="รีเฟรชข้อมูลล่าสุดด้วยตัวกรองเดิม"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            className="telemed-btn telemed-btn-primary"
            onClick={handleExportExcel}
            disabled={isExporting || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={15} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>
        </div>
      </div>

      {/* Export status toast if any */}
      {exportMessage && (
        <div className="telemed-alert-banner" style={{ backgroundColor: 'var(--brand-tint)', color: 'var(--brand)', borderColor: '#CDE5D8' }}>
          <span>{exportMessage}</span>
        </div>
      )}

      {/* ── 4. ClaimCode Warning Banner (Section 6.4) ── */}
      {showClaimAlert && (
        <div className="telemed-alert-banner" role="alert">
          <div className="telemed-alert-message">
            <AlertTriangle size={18} />
            <span>
              {summary.withoutAuthenCount.toLocaleString('th-TH')} รายการ (
              {(100 - (summary.authenRate || 0)).toFixed(1)}%) ยังไม่มี ClaimCode และอาจเบิกชดเชยไม่ได้
            </span>
          </div>
          <button
            type="button"
            className="telemed-alert-action-btn"
            onClick={() => {
              setActiveCards((prev) => ({ ...prev, claim: 'NO_AUTHEN' }))
              setCurrentPage(1)
            }}
          >
            ดูเฉพาะรายการนี้
          </button>
        </div>
      )}

      {/* ── 5. KPI Summary Cards (Section 6: 3 Main + 5 Sub, Filterable, No decorative icons) ── */}
      <div className="telemed-kpi-main-grid">
        {/* Card 1: ผู้รับบริการทั้งหมด (Neutral) */}
        <button
          type="button"
          className={`telemed-kpi-card ${!activeCards.compensation ? 'active' : ''}`}
          onClick={() => toggleCompensationCard(undefined)}
          aria-pressed={!activeCards.compensation}
          title="คลิกเพื่อล้างตัวกรองสถานะชดเชย"
        >
          <span className="telemed-kpi-label">ผู้รับบริการทั้งหมด</span>
          <div className="telemed-kpi-main-val">
            {summary.totalVisits.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.uniquePatients.toLocaleString('th-TH')} คน • รายได้ {formatMoney(summary.totalIncome)} บ.
          </div>
        </button>

        {/* Card 2: ชดเชยแล้ว (Success) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-success ${
            activeCards.compensation === 'COMPENSATED' ? 'active' : ''
          }`}
          onClick={() => toggleCompensationCard('COMPENSATED')}
          aria-pressed={activeCards.compensation === 'COMPENSATED'}
          disabled={summary.compensatedVisits === 0}
          title={summary.compensatedVisits === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะรายการที่ชดเชยแล้ว'}
        >
          <span className="telemed-kpi-label">ชดเชยแล้ว</span>
          <div className="telemed-kpi-main-val">
            {summary.compensatedVisits.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.compensationRate.toFixed(1)}% • ชดเชย {formatMoney(summary.totalCompensated)} บ.
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-success"
              style={{ width: `${Math.min(100, Math.max(0, summary.compensationRate))}%` }}
            />
          </div>
        </button>

        {/* Card 3: รอชดเชย / ยังไม่ส่ง (Warning) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-warning ${
            activeCards.compensation === 'UNCOMPENSATED' ? 'active' : ''
          }`}
          onClick={() => toggleCompensationCard('UNCOMPENSATED')}
          aria-pressed={activeCards.compensation === 'UNCOMPENSATED'}
          disabled={summary.uncompensatedVisits === 0}
          title={summary.uncompensatedVisits === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะรายการที่รอชดเชย / ยังไม่ส่ง'}
        >
          <span className="telemed-kpi-label">รอชดเชย / ยังไม่ส่ง</span>
          <div className="telemed-kpi-main-val">
            {summary.uncompensatedVisits.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.totalVisits > 0
              ? ((summary.uncompensatedVisits / summary.totalVisits) * 100).toFixed(1)
              : '0.0'}
            % ของทั้งหมด
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-warning"
              style={{
                width: `${
                  summary.totalVisits > 0
                    ? Math.min(100, (summary.uncompensatedVisits / summary.totalVisits) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </button>
      </div>

      <div className="telemed-kpi-sub-grid">
        {/* Card 4: มี ClaimCode (Success) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-success ${
            activeCards.claim === 'WITH_AUTHEN' ? 'active' : ''
          }`}
          onClick={() => toggleClaimCard('WITH_AUTHEN')}
          aria-pressed={activeCards.claim === 'WITH_AUTHEN'}
          disabled={summary.withAuthenCount === 0}
          title={summary.withAuthenCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะที่มี ClaimCode'}
        >
          <span className="telemed-kpi-label">มี ClaimCode</span>
          <div className="telemed-kpi-sub-val">
            {summary.withAuthenCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.authenRate.toFixed(1)}% ยืนยันตัวตนแล้ว
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-success"
              style={{ width: `${Math.min(100, Math.max(0, summary.authenRate))}%` }}
            />
          </div>
        </button>

        {/* Card 5: ไม่มี ClaimCode (Danger) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-danger ${
            activeCards.claim === 'NO_AUTHEN' ? 'active' : ''
          }`}
          onClick={() => toggleClaimCard('NO_AUTHEN')}
          aria-pressed={activeCards.claim === 'NO_AUTHEN'}
          disabled={summary.withoutAuthenCount === 0}
          title={summary.withoutAuthenCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะที่ไม่มี ClaimCode'}
        >
          <span className="telemed-kpi-label">ไม่มี ClaimCode</span>
          <div className="telemed-kpi-sub-val">
            {summary.withoutAuthenCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.totalVisits > 0
              ? ((summary.withoutAuthenCount / summary.totalVisits) * 100).toFixed(1)
              : '0.0'}
            % เสี่ยงเบิกชดเชยไม่ได้
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-danger"
              style={{
                width: `${
                  summary.totalVisits > 0
                    ? Math.min(100, (summary.withoutAuthenCount / summary.totalVisits) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </button>

        {/* Card 6: มีค่าบริการ TelMed (Info) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-info ${
            activeCards.hasFee ? 'active' : ''
          }`}
          onClick={toggleFeeCard}
          aria-pressed={activeCards.hasFee}
          disabled={summary.withPriceCount === 0}
          title={summary.withPriceCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะที่มีค่าบริการ TelMed'}
        >
          <span className="telemed-kpi-label">มีค่าบริการ TelMed</span>
          <div className="telemed-kpi-sub-val">
            {summary.withPriceCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            ค่า TelMed {formatMoney(summary.totalSumPrice)} บ.
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-info"
              style={{ width: `${Math.min(100, Math.max(0, summary.withPriceRate))}%` }}
            />
          </div>
        </button>

        {/* Card 7: สิทธิบัตรทอง (UC) (Info) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-info ${
            activeCards.ucOnly ? 'active' : ''
          }`}
          onClick={toggleUcCard}
          aria-pressed={activeCards.ucOnly}
          disabled={summary.ucCount === 0}
          title={summary.ucCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UC)'}
        >
          <span className="telemed-kpi-label">สิทธิบัตรทอง (UC)</span>
          <div className="telemed-kpi-sub-val">
            {summary.ucCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.ucRate.toFixed(1)}% ของทั้งหมด
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-info"
              style={{ width: `${Math.min(100, Math.max(0, summary.ucRate))}%` }}
            />
          </div>
        </button>

        {/* Card 8: ประเภทมา รพ. ทางไกล (รหัส 5) (Info) */}
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-info ${
            activeCards.exportCode5 ? 'active' : ''
          }`}
          onClick={toggleType5Card}
          aria-pressed={activeCards.exportCode5}
          disabled={summary.exportCode5Count === 0}
          title={summary.exportCode5Count === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะประเภทมารหัส 5'}
        >
          <span className="telemed-kpi-label">ประเภทมา รพ. ทางไกล (รหัส 5)</span>
          <div className="telemed-kpi-sub-val">
            {summary.exportCode5Count.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.exportCode5Rate.toFixed(1)}% ของทั้งหมด
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-info"
              style={{ width: `${Math.min(100, Math.max(0, summary.exportCode5Rate))}%` }}
            />
          </div>
        </button>
      </div>

      {/* ── 6. Data Section (Section 7 & 8) ── */}
      <div className="telemed-data-section">
        {/* Section Header */}
        <div className="telemed-section-header">
          <div className="telemed-section-title-wrap">
            <h2 className="telemed-section-title">รายการผู้ได้รับบริการ</h2>
            <span className="telemed-item-count-badge" aria-live="polite">
              พบ {totalCount.toLocaleString('th-TH')} รายการ
            </span>
          </div>

          <div className="telemed-table-controls">
            {/* Density toggle */}
            <div className="telemed-density-toggle" role="group" aria-label="ความหนาแน่นตาราง">
              <button
                type="button"
                className={`telemed-density-btn ${density === 'comfortable' ? 'active' : ''}`}
                onClick={() => handleDensityChange('comfortable')}
                title="ความหนาแน่นแถวแบบสบายตา (56px)"
              >
                สบายตา
              </button>
              <button
                type="button"
                className={`telemed-density-btn ${density === 'compact' ? 'active' : ''}`}
                onClick={() => handleDensityChange('compact')}
                title="ความหนาแน่นแถวแบบกระชับ (40px)"
              >
                กระชับ
              </button>
            </div>

            {/* Column Selector */}
            <div className="telemed-popover-container" ref={columnDropdownRef}>
              <button
                type="button"
                className="telemed-btn"
                style={{ height: 32, padding: '0 10px', fontSize: '0.8125rem' }}
                onClick={() => setIsColumnDropdownOpen((prev) => !prev)}
                aria-expanded={isColumnDropdownOpen}
                aria-label="เลือกคอลัมน์ที่จะแสดง"
              >
                <Columns size={14} />
                <span>คอลัมน์</span>
              </button>

              {isColumnDropdownOpen && (
                <div className="telemed-column-dropdown">
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)', paddingBottom: 4 }}>
                    คอลัมน์ที่แสดง
                  </div>
                  <label className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns.cid}
                      onChange={() => handleToggleColumn('cid')}
                    />
                    <span>เลขบัตรประชาชน</span>
                  </label>
                  <label className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns.ovstist}
                      onChange={() => handleToggleColumn('ovstist')}
                    />
                    <span>ประเภทการมา</span>
                  </label>
                  <label className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns.no}
                      onChange={() => handleToggleColumn('no')}
                    />
                    <span>ลำดับ</span>
                  </label>
                  <label className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns.pttype}
                      onChange={() => handleToggleColumn('pttype')}
                    />
                    <span>สิทธิการรักษา</span>
                  </label>
                  <label className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns.pdx}
                      onChange={() => handleToggleColumn('pdx')}
                    />
                    <span>PDX</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search & Popover Filters Row */}
        <div className="telemed-search-row">
          <div className="telemed-search-box">
            <Search size={16} className="telemed-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="telemed-search-input"
              placeholder="ค้นหา HN, เลขบัตรประชาชน, ชื่อ-สกุล, VN, PDX, สิทธิ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ค้นหารายการผู้รับบริการ"
            />
            {search && (
              <button
                type="button"
                className="telemed-search-clear"
                onClick={() => setSearch('')}
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Additional filters popover */}
          <div className="telemed-popover-container" ref={filterPopoverRef}>
            <button
              type="button"
              className={`telemed-filter-btn ${activePopoverFilterCount > 0 ? 'active' : ''}`}
              onClick={() => setIsFilterPopoverOpen((prev) => !prev)}
              aria-expanded={isFilterPopoverOpen}
              aria-label="เปิดตัวกรองเพิ่มเติม"
            >
              <Filter size={15} />
              <span>ตัวกรองเพิ่มเติม</span>
              {activePopoverFilterCount > 0 && (
                <span className="telemed-filter-badge">{activePopoverFilterCount}</span>
              )}
            </button>

            {isFilterPopoverOpen && (
              <div className="telemed-popover-panel">
                <h3 className="telemed-popover-title">ตัวกรองเฉพาะหน้า</h3>

                {/* Filter 1: Pttype */}
                <div className="telemed-popover-field">
                  <label className="telemed-popover-label">สิทธิการรักษา</label>
                  <PttypeMultiSelect
                    selectedCodes={pttypes}
                    onChange={(codes) => {
                      setPttypes(codes)
                      setCurrentPage(1)
                    }}
                    items={items}
                  />
                </div>

                {/* Filter 2: Sex */}
                <div className="telemed-popover-field">
                  <label className="telemed-popover-label">เพศ</label>
                  <div className="telemed-segmented-group" style={{ width: '100%' }}>
                    <button
                      type="button"
                      className={`telemed-segment-btn ${filterSex === 'ALL' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => {
                        setFilterSex('ALL')
                        setCurrentPage(1)
                      }}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      type="button"
                      className={`telemed-segment-btn ${filterSex === 'M' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => {
                        setFilterSex('M')
                        setCurrentPage(1)
                      }}
                    >
                      ชาย
                    </button>
                    <button
                      type="button"
                      className={`telemed-segment-btn ${filterSex === 'F' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => {
                        setFilterSex('F')
                        setCurrentPage(1)
                      }}
                    >
                      หญิง
                    </button>
                  </div>
                </div>

                {/* Filter 3: Visit type code 5 */}
                <div className="telemed-popover-field">
                  <label className="telemed-column-checkbox-item">
                    <input
                      type="checkbox"
                      checked={filterOvstist5}
                      onChange={(e) => {
                        setFilterOvstist5(e.target.checked)
                        setCurrentPage(1)
                      }}
                    />
                    <span>เฉพาะประเภทมารหัส 5 (สาธารณสุขทางไกล)</span>
                  </label>
                </div>

                {/* Filter 4: Age Range */}
                <div className="telemed-popover-field">
                  <label className="telemed-popover-label">ช่วงอายุ (ปี)</label>
                  <div className="telemed-popover-row">
                    <input
                      type="number"
                      placeholder="จาก"
                      className="telemed-select"
                      style={{ flex: 1, height: 34 }}
                      value={filterAgeMin}
                      onChange={(e) => {
                        setFilterAgeMin(e.target.value)
                        setCurrentPage(1)
                      }}
                    />
                    <span style={{ color: 'var(--muted)' }}>–</span>
                    <input
                      type="number"
                      placeholder="ถึง"
                      className="telemed-select"
                      style={{ flex: 1, height: 34 }}
                      value={filterAgeMax}
                      onChange={(e) => {
                        setFilterAgeMax(e.target.value)
                        setCurrentPage(1)
                      }}
                    />
                  </div>
                </div>

                {/* Filter 5: PDX */}
                <div className="telemed-popover-field">
                  <label className="telemed-popover-label">วินิจฉัยโรคหลัก (PDX / ICD-10)</label>
                  <input
                    type="text"
                    placeholder="เช่น I10, E119"
                    className="telemed-select"
                    style={{ height: 34 }}
                    value={filterPdx}
                    onChange={(e) => {
                      setFilterPdx(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>

                <div className="telemed-popover-actions">
                  <button
                    type="button"
                    className="telemed-btn"
                    style={{ height: 32, fontSize: '0.8125rem' }}
                    onClick={() => {
                      setPttypes([])
                      setFilterSex('ALL')
                      setFilterOvstist5(false)
                      setFilterAgeMin('')
                      setFilterAgeMax('')
                      setFilterPdx('')
                      setCurrentPage(1)
                    }}
                  >
                    ล้างตัวกรองเฉพาะ
                  </button>
                  <button
                    type="button"
                    className="telemed-btn telemed-btn-primary"
                    style={{ height: 32, fontSize: '0.8125rem' }}
                    onClick={() => setIsFilterPopoverOpen(false)}
                  >
                    เสร็จสิ้น
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Chips Row ── */}
        {hasActiveFilters && (
          <div className="telemed-chips-row">
            {debouncedSearch && (
              <span className="telemed-chip">
                <span>ค้นหา: &ldquo;{debouncedSearch}&rdquo;</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => setSearch('')}
                  aria-label="ล้างคำค้น"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {activeCards.compensation && (
              <span className="telemed-chip">
                <span>สถานะ: {activeCards.compensation === 'COMPENSATED' ? 'ชดเชยแล้ว' : 'รอชดเชย / ยังไม่ส่ง'}</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => toggleCompensationCard(undefined)}
                  aria-label="ลบตัวกรองสถานะ"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {activeCards.claim && (
              <span className="telemed-chip">
                <span>ClaimCode: {activeCards.claim === 'WITH_AUTHEN' ? 'มี ClaimCode' : 'ไม่มี ClaimCode'}</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => toggleClaimCard(activeCards.claim!)}
                  aria-label="ลบตัวกรอง ClaimCode"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {activeCards.hasFee && (
              <span className="telemed-chip">
                <span>มีค่าบริการ TelMed</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={toggleFeeCard}
                  aria-label="ลบตัวกรองค่าบริการ"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {activeCards.ucOnly && (
              <span className="telemed-chip">
                <span>สิทธิบัตรทอง (UC)</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={toggleUcCard}
                  aria-label="ลบตัวกรอง UC"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {activeCards.exportCode5 && (
              <span className="telemed-chip">
                <span>ประเภทมารหัส 5</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={toggleType5Card}
                  aria-label="ลบตัวกรองประเภทมารหัส 5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {filterSex !== 'ALL' && (
              <span className="telemed-chip">
                <span>เพศ: {filterSex === 'M' ? 'ชาย' : 'หญิง'}</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => setFilterSex('ALL')}
                  aria-label="ลบตัวกรองเพศ"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {filterOvstist5 && (
              <span className="telemed-chip">
                <span>ประเภทมาสาธารณสุขทางไกล (รหัส 5)</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => setFilterOvstist5(false)}
                  aria-label="ลบตัวกรองรหัส 5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {(filterAgeMin || filterAgeMax) && (
              <span className="telemed-chip">
                <span>อายุ: {filterAgeMin || '0'} – {filterAgeMax || '∞'} ปี</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => {
                    setFilterAgeMin('')
                    setFilterAgeMax('')
                  }}
                  aria-label="ลบตัวกรองอายุ"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {filterPdx && (
              <span className="telemed-chip">
                <span>PDX: {filterPdx}</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => setFilterPdx('')}
                  aria-label="ลบตัวกรอง PDX"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {pttypes.length > 0 && (
              <span className="telemed-chip">
                <span>สิทธิ: {pttypes.join(', ')}</span>
                <button
                  type="button"
                  className="telemed-chip-remove"
                  onClick={() => setPttypes([])}
                  aria-label="ลบตัวกรองสิทธิ"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              className="telemed-clear-all-link"
              onClick={handleClearAllFilters}
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="telemed-alert-banner" role="alert">
            <div className="telemed-alert-message">
              <AlertTriangle size={18} />
              <span>โหลดข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ ({error})</span>
            </div>
            <button
              type="button"
              className="telemed-alert-action-btn"
              onClick={() => fetchData(true)}
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* ── Table (Sticky headers, left pinned columns, clean chips) ── */}
        <div className="telemed-table-wrapper">
          <table className={`telemed-table density-${density}`}>
            <thead>
              <tr>
                {visibleColumns.no && (
                  <th scope="col" className="cell-center" style={{ width: 50 }}>
                    ลำดับ
                  </th>
                )}
                {visibleColumns.vstdate && (
                  <th scope="col" className="col-sticky-1 cell-center" style={{ width: 140 }}>
                    <button
                      type="button"
                      className="telemed-th-btn"
                      onClick={() => handleSort('vstdate')}
                      aria-sort={sortBy === 'vstdate' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span>วันที่รับบริการ</span>
                      {renderSortIcon('vstdate')}
                    </button>
                  </th>
                )}
                {visibleColumns.ptname && (
                  <th scope="col" className="col-sticky-2 cell-center" style={{ minWidth: 200 }}>
                    <button
                      type="button"
                      className="telemed-th-btn"
                      onClick={() => handleSort('ptname')}
                      aria-sort={sortBy === 'ptname' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span>ผู้ป่วย</span>
                      {renderSortIcon('ptname')}
                    </button>
                  </th>
                )}
                {visibleColumns.cid && (
                  <th scope="col" className="cell-center" style={{ width: 160 }}>
                    เลขบัตรประชาชน
                  </th>
                )}
                {visibleColumns.pttype && (
                  <th scope="col" className="cell-center" style={{ minWidth: 160 }}>
                    สิทธิการรักษา
                  </th>
                )}
                {visibleColumns.ovstist && (
                  <th scope="col" className="cell-center" style={{ width: 130 }}>
                    ประเภทการมา
                  </th>
                )}
                {visibleColumns.pdx && (
                  <th scope="col" className="cell-center" style={{ width: 85 }}>
                    <button
                      type="button"
                      className="telemed-th-btn"
                      onClick={() => handleSort('pdx')}
                      aria-sort={sortBy === 'pdx' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span>PDX</span>
                      {renderSortIcon('pdx')}
                    </button>
                  </th>
                )}
                {visibleColumns.fee && (
                  <th scope="col" className="cell-center" style={{ width: 110 }}>
                    <button
                      type="button"
                      className="telemed-th-btn"
                      onClick={() => handleSort('sum_price')}
                      aria-sort={sortBy === 'sum_price' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span>ค่า TelMed</span>
                      {renderSortIcon('sum_price')}
                    </button>
                  </th>
                )}
                {visibleColumns.claimCode && (
                  <th scope="col" className="cell-center" style={{ width: 120 }}>
                    <button
                      type="button"
                      className="telemed-th-btn"
                      onClick={() => handleSort('authencode')}
                      aria-sort={sortBy === 'authencode' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span>ClaimCode</span>
                      {renderSortIcon('authencode')}
                    </button>
                  </th>
                )}
                {visibleColumns.compensated && (
                  <th scope="col" className="cell-center" style={{ width: 110 }}>
                    <button
                      type="button"
                      className="telemed-th-btn"
                      onClick={() => handleSort('compensated')}
                      aria-sort={sortBy === 'compensated' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <span>ชดเชย (บ.)</span>
                      {renderSortIcon('compensated')}
                    </button>
                  </th>
                )}
                {visibleColumns.status && (
                  <th scope="col" className="col-sticky-right cell-center" style={{ width: 140 }}>
                    สถานะ / ใบตอบรับ
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading || isRefreshing ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="rcm-skeleton-row" aria-busy="true">
                    {Object.entries(visibleColumns)
                      .filter(([, visible]) => visible)
                      .map(([colKey]) => (
                        <td key={colKey} className="cell-center">
                          <div className="rcm-skeleton-bar" />
                        </td>
                      ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                        ไม่พบรายการตามตัวกรองนี้
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="telemed-btn"
                          style={{ height: 32, fontSize: '0.8125rem', marginTop: 4 }}
                          onClick={handleClearAllFilters}
                        >
                          ล้างตัวกรอง
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const isSelected = selectedItemIndex === idx
                  const unmasked = unmaskedCids[item.vn]
                  const statusLabel = cleanStatusName(item.status, item.isCompensated)

                  // Truncate pttype code & short name
                  const pttypeCode = item.pttypename.split(':')[0] || ''
                  const pttypeTitle = item.pttypename.split(':').slice(1).join(':').trim() || item.pttypename

                  return (
                    <tr
                      key={item.vn}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => handleRowClick(idx)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRowClick(idx)
                      }}
                      title="คลิกเพื่อดูรายละเอียดใน Drawer ด้านขวา"
                    >
                      {visibleColumns.no && (
                        <td className="cell-center" style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
                          {item.no}
                        </td>
                      )}
                      {visibleColumns.vstdate && (
                        <td className="col-sticky-1 cell-center">
                          <div style={{ fontWeight: 500 }}>{formatThaiDate(item.vstdate)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {item.vsttime ? item.vsttime.slice(0, 5) : '—'}
                          </div>
                        </td>
                      )}
                      {visibleColumns.ptname && (
                        <td className="col-sticky-2 cell-center">
                          <div className="telemed-ptname-bold">{item.ptname}</div>
                          <div className="telemed-ptmeta-sub" style={{ justifyContent: 'center' }}>
                            <span>HN {item.hn}</span>
                            <span>
                              {item.sex} {item.age} ปี
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.cid && (
                        <td className="cell-center">
                          <div className="telemed-cid-wrap">
                            <span>{unmasked ? item.cid : maskCid(item.cid)}</span>
                            {!unmasked && item.cid && (
                              <button
                                type="button"
                                className="telemed-cid-reveal-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUnmaskCid(item.vn, item.hn, item.cid)
                                }}
                                title="ดูเลขบัตรประชาชนเต็ม (บันทึกลง Audit Logs)"
                              >
                                ดูเต็ม
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.pttype && (
                        <td className="cell-center">
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            {pttypeCode && (
                              <span className="telemed-code-badge neutral">{pttypeCode}</span>
                            )}
                            <span
                              title={item.pttypename}
                              style={{
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}
                            >
                              {pttypeTitle}
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.ovstist && (
                        <td className="cell-center">
                          <span
                            className={`telemed-code-badge ${
                              item.ovstist_export_code === '5' ? 'info' : 'neutral'
                            }`}
                            title={item.ovstist}
                          >
                            รหัส {item.ovstist_export_code || '—'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.pdx && (
                        <td className="cell-center">
                          <span className="telemed-code-badge brand" title={`PDX: ${item.pdx || '—'}`}>
                            {item.pdx || '—'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.fee && (
                        <td className="cell-center" style={{ fontWeight: item.sum_price > 0 ? 600 : 400 }}>
                          {item.sum_price > 0
                            ? item.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                            : '0.00'}
                        </td>
                      )}
                      {visibleColumns.claimCode && (
                        <td className="cell-center">
                          {item.authencode ? (
                            <span className="telemed-code-badge info">{item.authencode}</span>
                          ) : (
                            <span className="telemed-code-badge danger">ไม่มี</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.compensated && (
                        <td className="cell-center" style={{ fontWeight: item.compensated > 0 ? 600 : 400 }}>
                          {item.compensated > 0 ? formatMoney(item.compensated) : '–'}
                          <RcmSeamlessSubAmount row={item} />
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="col-sticky-right cell-center">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                            <span
                              className={`telemed-code-badge ${
                                item.isCompensated ? 'success' : 'warning'
                              }`}
                            >
                              {statusLabel}
                            </span>
                            {item.rep && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--muted)', textAlign: 'center' }}>
                                REP: {item.rep}
                              </span>
                            )}
                          </div>
                          <RcmSeamlessRepBadges row={item} />
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer: Range count, Sum of Fee, Page size & Navigation ── */}
        <div className="telemed-footer">
          <div className="telemed-footer-stats">
            <span>
              แสดง {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString('th-TH')} รายการ
            </span>
            <span>•</span>
            <span className="telemed-footer-sum">
              ผลรวมค่า TelMed: {formatMoney(summary.totalSumPrice)} บ.
            </span>
            <select
              className="telemed-select"
              style={{ height: 32, padding: '0 8px', fontSize: '0.8125rem' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              aria-label="จำนวนแถวต่อหน้า"
            >
              <option value={25}>25 แถว/หน้า</option>
              <option value={50}>50 แถว/หน้า</option>
              <option value={100}>100 แถว/หน้า</option>
            </select>
          </div>

          <div className="telemed-pagination-controls">
            <div className="telemed-page-nav-btns">
              <button
                type="button"
                className="telemed-page-num-btn"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="หน้าก่อนหน้า"
                aria-label="หน้าก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1
                if (totalPages > 5) {
                  if (currentPage > 3) p = currentPage - 2 + i
                  if (p > totalPages) p = totalPages - 4 + i
                }
                if (p < 1 || p > totalPages) return null

                return (
                  <button
                    key={p}
                    type="button"
                    className={`telemed-page-num-btn ${currentPage === p ? 'active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                )
              })}

              <button
                type="button"
                className="telemed-page-num-btn"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="หน้าถัดไป"
                aria-label="หน้าถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Jump to page */}
            <form onSubmit={handleJumpPage} className="telemed-jump-page-wrap">
              <span>ไปหน้า</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={String(currentPage)}
                className="telemed-jump-input"
                aria-label="กรอกหน้าที่ต้องการข้ามไป"
              />
            </form>
          </div>
        </div>
      </div>

      {/* ── 7. Service Details Right Drawer (Section 9: replaces modal) ── */}
      {selectedItem && (
        <div
          className="telemed-drawer-backdrop"
          onClick={() => setSelectedItemIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="telemed-drawer-title-id"
        >
          <div
            className="telemed-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="telemed-drawer-header">
              <div className="telemed-drawer-header-left">
                <h3 id="telemed-drawer-title-id" className="telemed-drawer-title">
                  รายละเอียดการรับบริการ TelMed
                </h3>
                <p className="telemed-drawer-subtitle">
                  VN {selectedItem.vn} • HN {selectedItem.hn} • {formatThaiDate(selectedItem.vstdate)}
                </p>
              </div>

              <div className="telemed-drawer-header-actions">
                <button
                  type="button"
                  className="telemed-drawer-nav-btn"
                  disabled={selectedItemIndex == null || selectedItemIndex <= 0}
                  onClick={() => {
                    if (selectedItemIndex != null && selectedItemIndex > 0) {
                      setSelectedItemIndex(selectedItemIndex - 1)
                      setVnDetails(null)
                    }
                  }}
                  title="รายการก่อนหน้า (ลูกศรซ้าย)"
                >
                  <ChevronLeft size={14} />
                  <span>ก่อนหน้า</span>
                </button>
                <button
                  type="button"
                  className="telemed-drawer-nav-btn"
                  disabled={selectedItemIndex == null || selectedItemIndex >= items.length - 1}
                  onClick={() => {
                    if (selectedItemIndex != null && selectedItemIndex < items.length - 1) {
                      setSelectedItemIndex(selectedItemIndex + 1)
                      setVnDetails(null)
                    }
                  }}
                  title="รายการถัดไป (ลูกศรขวา)"
                >
                  <span>ถัดไป</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  className="telemed-drawer-close-btn"
                  onClick={() => setSelectedItemIndex(null)}
                  title="ปิดหน้าต่าง (Esc)"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="telemed-drawer-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'summary'}
                className={`telemed-drawer-tab-btn ${drawerTab === 'summary' ? 'active' : ''}`}
                onClick={() => handleDrawerTabChange('summary')}
              >
                สรุปข้อมูลการรับบริการ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'clinical'}
                className={`telemed-drawer-tab-btn ${drawerTab === 'clinical' ? 'active' : ''}`}
                onClick={() => handleDrawerTabChange('clinical')}
              >
                ข้อมูลทางคลินิก (เวชระเบียน)
              </button>
            </div>

            {/* Drawer Body */}
            <div className="telemed-drawer-body">
              {drawerTab === 'summary' ? (
                <>
                  <div className="telemed-drawer-grid">
                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">ชื่อ-สกุลผู้ป่วย</span>
                      <div className="telemed-drawer-card-val">
                        <strong>{selectedItem.ptname}</strong>
                        <button
                          type="button"
                          className="telemed-copy-btn"
                          onClick={() => handleCopyText(selectedItem.ptname, 'ptname')}
                          title="คัดลอกชื่อ"
                        >
                          {copiedField === 'ptname' ? <Check size={14} color="var(--brand)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">เลขประจำตัวประชาชน (CID)</span>
                      <div className="telemed-drawer-card-val">
                        <span>
                          {unmaskedCids[selectedItem.vn]
                            ? selectedItem.cid
                            : maskCid(selectedItem.cid)}
                        </span>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          {!unmaskedCids[selectedItem.vn] && selectedItem.cid && (
                            <button
                              type="button"
                              className="telemed-cid-reveal-btn"
                              onClick={() =>
                                handleUnmaskCid(selectedItem.vn, selectedItem.hn, selectedItem.cid)
                              }
                              title="ดูเลขบัตรประชาชนเต็ม (บันทึกลง Audit Logs)"
                            >
                              <Eye size={12} style={{ display: 'inline', marginRight: 2 }} />
                              ดูเต็ม
                            </button>
                          )}
                          {selectedItem.cid && (
                            <button
                              type="button"
                              className="telemed-copy-btn"
                              onClick={() => handleCopyText(selectedItem.cid, 'cid')}
                              title="คัดลอกเลขบัตร"
                            >
                              {copiedField === 'cid' ? <Check size={14} color="var(--brand)" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">เพศ / อายุ</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.sex} • {selectedItem.age} ปี
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">วันที่และเวลา</span>
                      <div className="telemed-drawer-card-val">
                        {formatThaiDate(selectedItem.vstdate)} {selectedItem.vsttime ? selectedItem.vsttime.slice(0, 5) : ''}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">ประเภทการมา (ovstist)</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.ovstist || '—'}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">ClaimCode</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.authencode ? (
                          <span className="telemed-code-badge info">{selectedItem.authencode}</span>
                        ) : (
                          <span className="telemed-code-badge danger">ไม่มี ClaimCode</span>
                        )}
                      </div>
                    </div>

                    <div className="telemed-drawer-card full-width">
                      <span className="telemed-drawer-card-label">สิทธิการรักษา</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.pttypename}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">แผนก / คลินิก</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.department || '—'} / {selectedItem.clinic || '—'}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">รพ.หลัก / รพ.รอง</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.hospmain || '—'} / {selectedItem.hospsub || '—'}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">การวินิจฉัยหลัก (PDX)</span>
                      <div className="telemed-drawer-card-val" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                        {selectedItem.pdx || '—'}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">ค่าบริการ TelMed</span>
                      <div className="telemed-drawer-card-val" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                        {selectedItem.sum_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">สถานะการชดเชย / REP</span>
                      <div className="telemed-drawer-card-val">
                        <span
                          className={`telemed-code-badge ${
                            selectedItem.isCompensated ? 'success' : 'warning'
                          }`}
                        >
                          {cleanStatusName(selectedItem.status, selectedItem.isCompensated)}
                        </span>
                        {selectedItem.rep && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            REP: {selectedItem.rep}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="telemed-drawer-card">
                      <span className="telemed-drawer-card-label">ยอดชดเชยที่ได้รับ</span>
                      <div className="telemed-drawer-card-val" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {selectedItem.compensated > 0 ? `${formatMoney(selectedItem.compensated)} บ.` : '–'}
                      </div>
                    </div>
                  </div>

                  {selectedItem.listname && (
                    <div className="telemed-drawer-card full-width" style={{ marginTop: 4 }}>
                      <span className="telemed-drawer-card-label">รายการค่าบริการ Telemedicine ที่ผูก ADP</span>
                      <div className="telemed-drawer-card-val">
                        {selectedItem.listname}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Tab 2: Clinical Data */
                <div>
                  {loadingVnDetails ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <p>กำลังโหลดข้อมูลเวชระเบียน...</p>
                    </div>
                  ) : vnDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Vital signs: 3 boxes */}
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                          สัญญาณชีพ (Vital Signs)
                        </div>
                        <div className="telemed-vitals-row">
                          <div className="telemed-vital-box">
                            <span className="telemed-vital-label">ความดันโลหิต</span>
                            <span className="telemed-vital-val">
                              {vnDetails.screen?.bps || '—'}/{vnDetails.screen?.bpd || '—'}
                              <span style={{ fontSize: '0.6875rem', fontWeight: 400, marginLeft: 2 }}>mmHg</span>
                            </span>
                          </div>
                          <div className="telemed-vital-box">
                            <span className="telemed-vital-label">ชีพจร</span>
                            <span className="telemed-vital-val">
                              {vnDetails.screen?.pulse || '—'}
                              <span style={{ fontSize: '0.6875rem', fontWeight: 400, marginLeft: 2 }}>/min</span>
                            </span>
                          </div>
                          <div className="telemed-vital-box">
                            <span className="telemed-vital-label">น้ำหนัก</span>
                            <span className="telemed-vital-val">
                              {vnDetails.screen?.bw || '—'}
                              <span style={{ fontSize: '0.6875rem', fontWeight: 400, marginLeft: 2 }}>กก.</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Chief Complaint */}
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                          อาการสำคัญ (Chief Complaint)
                        </div>
                        <div className="telemed-clinical-box">
                          {vnDetails.screen?.cc || '—'}
                        </div>
                      </div>

                      {/* Diagnoses */}
                      {vnDetails.diagnoses && vnDetails.diagnoses.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                            การวินิจฉัยโรค (Diagnoses)
                          </div>
                          <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                            {vnDetails.diagnoses.map((d, i) => (
                              <div key={i} className="telemed-diag-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="telemed-code-badge brand">{d.icd10}</span>
                                  <span>{d.icd_name}</span>
                                </div>
                                <span className="telemed-code-badge neutral">
                                  {d.diagtype_name?.toLowerCase().includes('principal') || i === 0
                                    ? 'โรคหลัก'
                                    : 'อื่น ๆ'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Drug Items: Consolidated duplicate lines (Section 9) */}
                      {vnDetails.orders?.items && vnDetails.orders.items.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                            รายการยาและเวชภัณฑ์ (รวมรายการซ้ำ)
                          </div>
                          <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                            <table className="telemed-sub-table">
                              <thead>
                                <tr>
                                  <th>รายการ</th>
                                  <th style={{ textAlign: 'center', width: 90 }}>จำนวน</th>
                                  <th style={{ textAlign: 'right', width: 90 }}>ราคา (บ.)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {consolidateDrugs(vnDetails.orders.items).map((m, i) => (
                                  <tr key={i}>
                                    <td>{m.item_name}</td>
                                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                      {m.qty} {m.units}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      {formatMoney(m.sum_price)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Summary total */}
                      <div className="telemed-drawer-summary-card">
                        <div className="telemed-summary-row">
                          <span>ยาและเวชภัณฑ์</span>
                          <span>{formatMoney(vnDetails.orders?.total_price || 0)} บ.</span>
                        </div>
                        <div className="telemed-summary-row">
                          <span>ค่าบริการ TelMed</span>
                          <span>{formatMoney(selectedItem.sum_price)} บ.</span>
                        </div>
                        <div className="telemed-summary-row total">
                          <span>รวมทั้งสิ้น</span>
                          <span>
                            {formatMoney((vnDetails.orders?.total_price || 0) + selectedItem.sum_price)} บ.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                      ไม่พบข้อมูลคลินิกเพิ่มเติมสำหรับ VN นี้
                    </div>
                  )}
                </div>
              )}
              <RcmSeamlessModalSection item={selectedItem} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
