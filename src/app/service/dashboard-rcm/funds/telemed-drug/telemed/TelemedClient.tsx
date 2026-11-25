'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import type {
  TelemedItem,
  TelemedSummary,
  TelemedSortField,
  AdpMappingCheck,
  TelemedReportResult,
} from '@/lib/clinical/rcmTelemedDrugService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import { useRcmDateRange } from '@/hooks/useRcmDateRange'
import { getErrorMessage } from '@/lib/http/apiResponse'
import './page.css'
import RcmRepTagDashboard from '@/components/rcm/RcmRepTagDashboard'
import { buildRepBreakdownSummary, type RepBreakdownSummary } from '@/lib/clinical/rcmRepTagHelper'

import {
  cleanStatusName,
  type CompensationCard,
  type ClaimCard,
  type ActiveCardsState,
} from './components/telemedHelpers'
import { TelemedKpiCards } from './components/TelemedKpiCards'
import { TelemedDetailDrawer } from './components/TelemedDetailDrawer'
import { TelemedToolbar } from './components/TelemedToolbar'
import {
  TelemedTableSection,
  type TelemedVisibleColumns,
} from './components/TelemedTableSection'

export type { CompensationCard, ClaimCard, ActiveCardsState }

export interface TelemedClientProps {
  initialData?: TelemedReportResult | null
}

export default function TelemedClient({ initialData = null }: TelemedClientProps) {
  const resetPage = useCallback(() => setCurrentPage(1), [])

  const {
    dateMode,
    ds1,
    ds2,
    setDs1,
    setDs2,
    selectedFiscalYear,
    selectedMonth,
    selectedBeYear,
    yearOptions,
    handleModeChange,
    handleFiscalYearChange,
    handleMonthChange,
    handleBeYearChange,
    handlePrevMonth,
    handleNextMonth,
  } = useRcmDateRange({
    initialDs1: initialData?.ds1,
    initialDs2: initialData?.ds2,
    onRangeChange: resetPage,
  })

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
  const [selectedReps, setSelectedReps] = useState<string[]>([])
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

  const [visibleColumns, setVisibleColumns] = useState<TelemedVisibleColumns>({
    vstdate: true,
    ptname: true,
    vn: true,
    pttype: true,
    pdx: true,
    fee: true,
    claimCode: true,
    compensated: true,
    status: true,
    cid: false,
    ovstist: false,
    no: false,
  })

  // Unmasked CIDs state for PDPA compliance
  const [unmaskedCids, setUnmaskedCids] = useState<Record<string, boolean>>({})

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<TelemedSortField>(initialData?.sortBy ?? 'vstdate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialData?.sortOrder ?? 'desc')
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
    initialData?.adpMapping ?? { adpCode: 'TELMED', isMapped: true, mappedCount: 0, items: [] }
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
  const [repBreakdown, setRepBreakdown] = useState<RepBreakdownSummary | null>(
    initialData?.repBreakdown ?? null
  )
  const effectiveRepBreakdown = useMemo(
    () => repBreakdown ?? buildRepBreakdownSummary(items),
    [repBreakdown, items]
  )

  // Drawer Detail states
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

  const abortRef = useRef<AbortController | null>(null)
  const isFirstMount = useRef<boolean>(true)

  useEffect(() => {
    try {
      const savedDensity = localStorage.getItem('rcm_telemed_density') as 'comfortable' | 'compact'
      if (savedDensity) setDensity(savedDensity)
      const savedCols = localStorage.getItem('rcm_telemed_columns')
      if (savedCols) setVisibleColumns((prev) => ({ ...prev, ...JSON.parse(savedCols) }))
    } catch {
      // ignore localStorage read errors in restricted contexts
    }
  }, [])

  const handleDensityChange = (d: 'comfortable' | 'compact') => {
    setDensity(d)
    try {
      localStorage.setItem('rcm_telemed_density', d)
    } catch {
      // ignore localStorage write errors
    }
  }

  const handleToggleColumn = (colKey: keyof TelemedVisibleColumns) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [colKey]: !prev[colKey] }
      try {
        localStorage.setItem('rcm_telemed_columns', JSON.stringify(updated))
      } catch {
        // ignore localStorage write errors
      }
      return updated
    })
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(target)) {
        setIsFilterPopoverOpen(false)
      }
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(target)) {
        setIsColumnDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const cardsQueryParam = useMemo(() => {
    const list: string[] = []
    if (activeCards.compensation) list.push(activeCards.compensation)
    if (activeCards.claim) list.push(activeCards.claim)
    if (activeCards.hasFee) list.push('WITH_PRICE')
    if (activeCards.ucOnly) list.push('UC_ONLY')
    if (activeCards.exportCode5) list.push('EXPORT_CODE_5')
    return list.join(',')
  }, [activeCards])

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
        if (selectedReps.length > 0) queryParams.set('reps', selectedReps.join(','))
        if (filterSex !== 'ALL') queryParams.set('sex', filterSex)
        if (filterOvstist5) queryParams.set('ovstistExportCode', '5')
        if (filterAgeMin) queryParams.set('ageMin', filterAgeMin)
        if (filterAgeMax) queryParams.set('ageMax', filterAgeMax)
        if (filterPdx) queryParams.set('pdx', filterPdx)
        if (refresh) queryParams.set('refresh', 'true')

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
          setRepBreakdown(result.repBreakdown ?? null)
          setAdpMapping(result.adpMapping)
        } else {
          throw new Error(json.error?.message || 'รูปแบบข้อมูลตอบกลับไม่ถูกต้อง')
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการโหลดข้อมูล'))
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
      selectedReps,
      filterSex,
      filterOvstist5,
      filterAgeMin,
      filterAgeMax,
      filterPdx,
      dateMode,
    ]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const fetchVnDetails = useCallback(async (vn: string) => {
    setLoadingVnDetails(true)
    try {
      const res = await fetch(`/api/service/dashboard-rcm/funds/telemed-drug/vn-details?vn=${vn}`)
      const json = await res.json()
      setVnDetails(json.success ? json.data : null)
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

  const handleUnmaskCid = async (vn: string, hn: string, _cid: string) => {
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

  const handleSort = (field: TelemedSortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

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
    setActiveCards((prev) => ({ ...prev, hasFee: !prev.hasFee }))
    setCurrentPage(1)
  }

  const toggleUcCard = () => {
    setActiveCards((prev) => ({ ...prev, ucOnly: !prev.ucOnly }))
    setCurrentPage(1)
  }

  const toggleType5Card = () => {
    setActiveCards((prev) => ({ ...prev, exportCode5: !prev.exportCode5 }))
    setCurrentPage(1)
  }

  const handleClearPopoverFilters = () => {
    setPttypes([])
    setFilterSex('ALL')
    setFilterOvstist5(false)
    setFilterAgeMin('')
    setFilterAgeMax('')
    setFilterPdx('')
    setCurrentPage(1)
  }

  const handleClearAllFilters = () => {
    setActiveCards({})
    setSearch('')
    setDebouncedSearch('')
    setSelectedReps([])
    handleClearPopoverFilters()
  }

  const activePopoverFilterCount = useMemo(() => {
    let count = 0
    if (pttypes.length > 0) count++
    if (filterSex !== 'ALL') count++
    if (filterOvstist5) count++
    if (filterAgeMin || filterAgeMax) count++
    if (filterPdx) count++
    return count
  }, [pttypes, filterSex, filterOvstist5, filterAgeMin, filterAgeMax, filterPdx])

  const hasActiveFilters = useMemo(
    () =>
      Boolean(activeCards.compensation) ||
      Boolean(activeCards.claim) ||
      Boolean(activeCards.hasFee) ||
      Boolean(activeCards.ucOnly) ||
      Boolean(activeCards.exportCode5) ||
      search.trim().length > 0 ||
      selectedReps.length > 0 ||
      activePopoverFilterCount > 0,
    [activeCards, search, selectedReps, activePopoverFilterCount]
  )

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
      if (selectedReps.length > 0) queryParams.set('reps', selectedReps.join(','))
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
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์ Excel'))
      setExportMessage(null)
    } finally {
      setIsExporting(false)
    }
  }

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(jumpPageInput, 10)
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p)
      setJumpPageInput('')
    }
  }

  const showClaimAlert =
    summary.totalVisits > 0 && summary.withoutAuthenCount / summary.totalVisits >= 0.1

  return (
    <div className="telemed-container">
      <div className="telemed-header">
        <div className="telemed-title-area">
          <h1 className="telemed-title">11.53 รายชื่อผู้ได้รับบริการ TelMed</h1>
          <p className="telemed-subtitle">
            บริการการแพทย์ทางไกล รหัส ADP TELMED หรือประเภทการมาบริการสาธารณสุขทางไกล (รหัสส่งออก 5)
          </p>
        </div>
      </div>

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

      <TelemedToolbar
        isRefreshing={isRefreshing}
        loading={loading}
        isExporting={isExporting}
        hasItems={items.length > 0}
        exportMessage={exportMessage}
        showClaimAlert={showClaimAlert}
        withoutAuthenCount={summary.withoutAuthenCount}
        authenRate={summary.authenRate}
        dateMode={dateMode}
        ds1={ds1}
        ds2={ds2}
        selectedMonth={selectedMonth}
        selectedBeYear={selectedBeYear}
        selectedFiscalYear={selectedFiscalYear}
        yearOptions={yearOptions}
        onModeChange={handleModeChange}
        onDs1Change={setDs1}
        onDs2Change={setDs2}
        onMonthChange={handleMonthChange}
        onBeYearChange={handleBeYearChange}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onFiscalYearChange={handleFiscalYearChange}
        onRefresh={() => fetchData(true)}
        onExportExcel={handleExportExcel}
        onFilterNoAuthen={() => {
          setActiveCards((prev) => ({ ...prev, claim: 'NO_AUTHEN' }))
          setCurrentPage(1)
        }}
      />

      <TelemedKpiCards
        summary={summary}
        activeCards={activeCards}
        toggleCompensationCard={toggleCompensationCard}
        toggleClaimCard={toggleClaimCard}
        toggleFeeCard={toggleFeeCard}
        toggleUcCard={toggleUcCard}
        toggleType5Card={toggleType5Card}
      />

      <RcmRepTagDashboard
        repBreakdown={effectiveRepBreakdown}
        selectedReps={selectedReps}
        onSelectGroupReps={(reps) => {
          setSelectedReps(reps)
          setCurrentPage(1)
        }}
        onClearReps={() => {
          setSelectedReps([])
          setCurrentPage(1)
        }}
      />

      <TelemedTableSection
        items={items}
        totalCount={totalCount}
        totalSumPrice={summary.totalSumPrice}
        loading={loading}
        isRefreshing={isRefreshing}
        error={error}
        density={density}
        visibleColumns={visibleColumns}
        isColumnDropdownOpen={isColumnDropdownOpen}
        columnDropdownRef={columnDropdownRef}
        filterPopoverRef={filterPopoverRef}
        isFilterPopoverOpen={isFilterPopoverOpen}
        search={search}
        debouncedSearch={debouncedSearch}
        selectedReps={selectedReps}
        effectiveRepBreakdown={effectiveRepBreakdown}
        pttypes={pttypes}
        filterSex={filterSex}
        filterOvstist5={filterOvstist5}
        filterAgeMin={filterAgeMin}
        filterAgeMax={filterAgeMax}
        filterPdx={filterPdx}
        activePopoverFilterCount={activePopoverFilterCount}
        hasActiveFilters={hasActiveFilters}
        activeCards={activeCards}
        sortBy={sortBy}
        sortOrder={sortOrder}
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        jumpPageInput={jumpPageInput}
        selectedItemIndex={selectedItemIndex}
        unmaskedCids={unmaskedCids}
        onDensityChange={handleDensityChange}
        onToggleColumnDropdown={() => setIsColumnDropdownOpen((prev) => !prev)}
        onToggleColumn={handleToggleColumn}
        onSearchChange={setSearch}
        onSelectedRepsChange={(reps) => {
          setSelectedReps(reps)
          setCurrentPage(1)
        }}
        onToggleFilterPopover={() => setIsFilterPopoverOpen((prev) => !prev)}
        onCloseFilterPopover={() => setIsFilterPopoverOpen(false)}
        onPttypesChange={(codes) => {
          setPttypes(codes)
          setCurrentPage(1)
        }}
        onFilterSexChange={(sex) => {
          setFilterSex(sex)
          setCurrentPage(1)
        }}
        onFilterOvstist5Change={(checked) => {
          setFilterOvstist5(checked)
          setCurrentPage(1)
        }}
        onFilterAgeMinChange={(val) => {
          setFilterAgeMin(val)
          setCurrentPage(1)
        }}
        onFilterAgeMaxChange={(val) => {
          setFilterAgeMax(val)
          setCurrentPage(1)
        }}
        onFilterPdxChange={(val) => {
          setFilterPdx(val)
          setCurrentPage(1)
        }}
        onClearPopoverFilters={handleClearPopoverFilters}
        onClearAllFilters={handleClearAllFilters}
        onToggleCompensationCard={toggleCompensationCard}
        onToggleClaimCard={toggleClaimCard}
        onToggleFeeCard={toggleFeeCard}
        onToggleUcCard={toggleUcCard}
        onToggleType5Card={toggleType5Card}
        onRetry={() => fetchData(true)}
        onSort={handleSort}
        onRowClick={handleRowClick}
        onUnmaskCid={handleUnmaskCid}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setCurrentPage(1)
        }}
        onPageChange={setCurrentPage}
        onJumpPageInputChange={setJumpPageInput}
        onJumpPageSubmit={handleJumpPage}
      />

      <TelemedDetailDrawer
        selectedItem={selectedItem}
        selectedItemIndex={selectedItemIndex}
        totalItemsCount={items.length}
        setSelectedItemIndex={setSelectedItemIndex}
        drawerTab={drawerTab}
        handleDrawerTabChange={handleDrawerTabChange}
        vnDetails={vnDetails}
        setVnDetails={setVnDetails}
        loadingVnDetails={loadingVnDetails}
        copiedField={copiedField}
        handleCopyText={handleCopyText}
        unmaskedCids={unmaskedCids}
        handleUnmaskCid={handleUnmaskCid}
      />
    </div>
  )
}
