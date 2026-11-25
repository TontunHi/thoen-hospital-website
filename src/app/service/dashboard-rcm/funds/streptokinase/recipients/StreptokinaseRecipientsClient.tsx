'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { RefreshCw, Download, AlertTriangle, Building2, BedDouble } from 'lucide-react'
import type {
  StreptokinaseItem,
  StreptokinaseSummary,
  StreptokinaseCardFilter,
  StreptokinasePatientType,
  StreptokinaseSortField,
  StreptokinaseReportResult,
  AdpMappingCheck,
  AnClinicalDetails,
} from '@/lib/clinical/rcmStreptokinaseService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import { THAI_MONTHS, useRcmDateRange } from '@/hooks/useRcmDateRange'
import { getErrorMessage } from '@/lib/http/apiResponse'
import './page.css'
import RcmRepTagDashboard from '@/components/rcm/RcmRepTagDashboard'
import { buildRepBreakdownSummary, type RepBreakdownSummary } from '@/lib/clinical/rcmRepTagHelper'
import { StreptokinaseKpiGrid } from './components/StreptokinaseKpiGrid'
import { StreptokinaseTableSection } from './components/StreptokinaseTableSection'
import {
  StreptokinaseDetailModal,
  type ModalOrderItem,
} from './components/StreptokinaseDetailModal'

export type { ModalOrderItem }

export interface StreptokinaseRecipientsClientProps {
  initialData?: StreptokinaseReportResult | null
}

export default function StreptokinaseRecipientsClient({
  initialData = null,
}: StreptokinaseRecipientsClientProps) {
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
    handleModeChange: handleDateModeChange,
    handleFiscalYearChange,
    handleMonthChange,
    handleBeYearChange: handleMonthYearChange,
  } = useRcmDateRange({
    initialDs1: initialData?.ds1,
    initialDs2: initialData?.ds2,
    onRangeChange: resetPage,
  })

  // Patient type state: IPD first by default, switchable with OPD
  const [patientType, setPatientType] = useState<StreptokinasePatientType>(
    initialData?.patientType ?? 'IPD'
  )

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<StreptokinaseCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<StreptokinaseSortField>(initialData?.sortBy ?? 'date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialData?.sortOrder ?? 'desc')
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [_error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<StreptokinaseItem[]>(initialData?.items ?? [])
  const [totalCount, setTotalCount] = useState<number>(initialData?.totalCount ?? 0)
  const [totalPages, setTotalPages] = useState<number>(initialData?.totalPages ?? 1)
  const [adpMapping, setAdpMapping] = useState<AdpMappingCheck>(
    initialData?.adpMapping ?? { adpCode: 'STEMI', isMapped: true, mappedCount: 1, items: [] }
  )
  const [summary, setSummary] = useState<StreptokinaseSummary>(
    initialData?.summary ?? {
      totalCases: 0,
      uniquePatients: 0,
      auditPassCases: 0,
      auditPassRate: 0,
      auditErrorCases: 0,
      auditErrorRate: 0,
      compensatedCases: 0,
      uncompensatedCases: 0,
      compensationRate: 0,
      totalCompensated: 0,
      totalHosxp: 0,
      totalDebit: 0,
      withInvoiceCases: 0,
      withRepCases: 0,
      notSentCases: 0,
    }
  )

  // Modal Detail states
  const [selectedItem, setSelectedItem] = useState<StreptokinaseItem | null>(null)
  const [modalTab, setModalTab] = useState<'overview' | 'orders'>('overview')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [anDetails, setAnDetails] = useState<AnClinicalDetails | null>(null)
  const [loadingModalDetails, setLoadingModalDetails] = useState<boolean>(false)
  const [orderFilter, setOrderFilter] = useState<'all' | 'drug' | 'service'>('all')
  const [orderSearch, setOrderSearch] = useState<string>('')

  const isTargetThrombolytic = useCallback((name: string, targetDrugName?: string) => {
    const lower = name.toLowerCase()
    const targetLower = (targetDrugName || '').toLowerCase()
    if (targetLower && lower.includes(targetLower)) return true
    return /(streptokinase|alteplase|actilyse|tenecteplase|metalyse|stemi)/i.test(lower)
  }, [])

  const normalizedOrders: ModalOrderItem[] = useMemo(() => {
    if (!selectedItem) return []

    if (selectedItem.patientType === 'OPD' && vnDetails?.orders?.items) {
      return vnDetails.orders.items.map((ord, idx) => {
        const name = ord.item_name || ord.name || ''
        const isDrug =
          ord.category_group === 'DRUG' ||
          Boolean(ord.income_name?.includes('ยา')) ||
          Boolean(ord.icode?.startsWith('1'))
        return {
          id: `opd-${ord.icode || idx}-${idx}`,
          icode: ord.icode || '',
          name,
          strength: ord.strength || null,
          units: ord.units || null,
          qty: ord.qty || 0,
          unitprice: ord.unitprice || 0,
          sumPrice: ord.sum_price || 0,
          paidstName: ord.paidst_name || '—',
          incomeName: ord.income_name || (isDrug ? 'ค่ายาและสารอาหาร' : 'ค่าบริการทางการแพทย์'),
          isDrug,
          isTargetDrug: isTargetThrombolytic(name, selectedItem.drugname),
        }
      })
    }

    if (selectedItem.patientType === 'IPD' && anDetails?.orders) {
      return anDetails.orders.map((ord, idx) => {
        const name = ord.itemName || ''
        const isDrug = Boolean(ord.isDrug)
        return {
          id: `ipd-${ord.icode || idx}-${idx}`,
          icode: ord.icode || '',
          name,
          strength: ord.strength || null,
          units: ord.units || null,
          qty: ord.qty || 0,
          unitprice: ord.unitprice || 0,
          sumPrice: ord.sumPrice || 0,
          paidstName: ord.paidstName || '—',
          incomeName: ord.incomeName || (isDrug ? 'ค่ายาและสารอาหาร' : 'ค่าบริการทางการแพทย์'),
          isDrug,
          isTargetDrug: isTargetThrombolytic(name, selectedItem.drugname),
        }
      })
    }

    return []
  }, [selectedItem, vnDetails, anDetails, isTargetThrombolytic])

  const orderMetrics = useMemo(() => {
    let drugCount = 0
    let serviceCount = 0
    let totalDrugCost = 0
    let totalServiceCost = 0
    let grandTotal = 0
    let targetDrug: ModalOrderItem | null = null

    for (const ord of normalizedOrders) {
      grandTotal += ord.sumPrice
      if (ord.isDrug) {
        drugCount += 1
        totalDrugCost += ord.sumPrice
      } else {
        serviceCount += 1
        totalServiceCost += ord.sumPrice
      }
      if (ord.isTargetDrug && !targetDrug) {
        targetDrug = ord
      }
    }

    return {
      totalCount: normalizedOrders.length,
      drugCount,
      serviceCount,
      totalDrugCost,
      totalServiceCost,
      grandTotal,
      targetDrug,
    }
  }, [normalizedOrders])

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase()
    return normalizedOrders.filter((ord) => {
      if (orderFilter === 'drug' && !ord.isDrug) return false
      if (orderFilter === 'service' && ord.isDrug) return false
      if (query) {
        const match =
          ord.name.toLowerCase().includes(query) ||
          ord.icode.toLowerCase().includes(query) ||
          ord.incomeName.toLowerCase().includes(query) ||
          ord.paidstName.toLowerCase().includes(query)
        if (!match) return false
      }
      return true
    })
  }, [normalizedOrders, orderFilter, orderSearch])

  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCurrentPage(1)
    }, 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search])

  const [selectedReps, setSelectedReps] = useState<string[]>([])
  const [repBreakdown, setRepBreakdown] = useState<RepBreakdownSummary | null>(
    initialData?.repBreakdown ?? null
  )
  const effectiveRepBreakdown = useMemo(
    () => repBreakdown ?? buildRepBreakdownSummary(items),
    [repBreakdown, items]
  )

  const fetchData = useCallback(
    async (refresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (refresh) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          patientType,
          ds1,
          ds2,
          cardFilter,
          search: debouncedSearch,
          sortBy,
          sortOrder,
          page: String(currentPage),
          pageSize: String(pageSize),
        })
        if (pttypes.length > 0) params.set('pttypes', pttypes.join(','))
        if (selectedReps.length > 0) params.set('reps', selectedReps.join(','))
        if (refresh) params.set('refresh', 'true')

        const res = await fetch(
          `/api/service/dashboard-rcm/funds/streptokinase/recipients?${params.toString()}`,
          { signal: controller.signal }
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        }

        const data: StreptokinaseReportResult = json.data
        setItems(data.items || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
        setSummary(data.summary)
        if (data.adpMapping) setAdpMapping(data.adpMapping)
        if (data.repBreakdown !== undefined) setRepBreakdown(data.repBreakdown ?? null)
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setError(getErrorMessage(err, 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้'))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [patientType, ds1, ds2, cardFilter, pttypes, selectedReps, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  const handleSort = (field: StreptokinaseSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const handleCardClick = (filter: StreptokinaseCardFilter) => {
    setCardFilter(cardFilter === filter ? 'ALL' : filter)
    setCurrentPage(1)
  }

  const handleRowClick = async (item: StreptokinaseItem) => {
    setSelectedItem(item)
    setModalTab('overview')
    setOrderFilter('all')
    setOrderSearch('')
    setVnDetails(null)
    setAnDetails(null)
    setLoadingModalDetails(true)

    try {
      if (item.patientType === 'OPD' && item.vn) {
        const res = await fetch(
          `/api/service/dashboard-rcm/funds/streptokinase/vn-details?vn=${encodeURIComponent(item.vn)}`
        )
        const json = await res.json()
        if (json.success && json.data) setVnDetails(json.data)
      } else if (item.patientType === 'IPD' && item.an) {
        const res = await fetch(
          `/api/service/dashboard-rcm/funds/streptokinase/an-details?an=${encodeURIComponent(item.an)}`
        )
        const json = await res.json()
        if (json.success && json.data) setAnDetails(json.data)
      }
    } catch {
      // Graceful fallback when clinical order detail fetch fails
    } finally {
      setLoadingModalDetails(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        patientType,
        ds1,
        ds2,
        cardFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exportAll: 'true',
      })
      if (pttypes.length > 0) params.set('pttypes', pttypes.join(','))
      if (selectedReps.length > 0) params.set('reps', selectedReps.join(','))

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/streptokinase/recipients?${params.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')
      }

      const rows: StreptokinaseItem[] = json.data?.items || []
      const isOpd = patientType === 'OPD'
      const headers = [
        'ลำดับ',
        isOpd ? 'VN' : 'AN',
        'HN',
        'เลขบัตรประชาชน',
        'ชื่อ-สกุล',
        'เพศ',
        'อายุ (ปี)',
        ...(isOpd ? ['วันที่รับบริการ', 'เวลา'] : ['วันรับไว้ (Adm)', 'วันจำหน่าย (Dch)']),
        'สิทธิการรักษา',
        ...(isOpd ? ['แผนก/ห้องตรวจ', 'คลินิก'] : ['ตึกผู้ป่วย']),
        'รายการยา Streptokinase',
        'ค่ายา HOSxP (บาท)',
        'ส่วนลด',
        'ชำระแล้ว',
        'ลูกหนี้ค้างชำระ',
        'เลขที่ใบเสร็จ',
        'รหัสโรค (Dx)',
        'หัตถการ (Op)',
        'ข้อผิดพลาด Dx',
        'ข้อผิดพลาด Op',
        'เงิน E-Claim (บาท)',
        'เงิน Rep (บาท)',
        'เงิน Invoice (บาท)',
        'เลขที่ Rep',
        'สถานะ E-Claim',
      ]

      const excelRows = rows.map((r, i) => [
        i + 1,
        (isOpd ? r.vn : r.an) || '',
        r.hn,
        r.cid,
        r.ptname,
        r.sex,
        r.age,
        ...(isOpd ? [r.vstdate || '', r.vsttime || ''] : [r.admdate || '', r.dchdate || '']),
        r.pttypename,
        ...(isOpd ? [r.department || '', r.clinic || ''] : [r.ward || '']),
        r.drugname,
        r.money_hosxp,
        r.discount_money,
        r.rcpt_money,
        r.debit,
        r.rcpno,
        r.dx || '',
        r.op || '',
        r.errorDx || 'ผ่าน',
        r.errorOp || 'ผ่าน',
        r.money_eclaim,
        r.money_rep,
        r.money_invoice,
        r.rep || '',
        r.status,
      ])

      await exportRcmExcel({
        filename: `streptokinase_${patientType.toLowerCase()}_${ds1}_${ds2}.xlsx`,
        title: `รายชื่อรับยา Stroke และSTEMI (${patientType})`,
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${rows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows: excelRows,
      })
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="stk-page">
      <nav className="stk-breadcrumb" aria-label="breadcrumb">
        <Link href="/service/dashboard-rcm">กองทุน RCM</Link>
        <span className="stk-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds/streptokinase">กองทุนยา Streptokinase</Link>
        <span className="stk-breadcrumb-sep">/</span>
        <span className="stk-breadcrumb-current">รายชื่อรับยา Stroke และSTEMI</span>
      </nav>

      <header className="stk-header">
        <div className="stk-title-group">
          <h1 className="stk-title">รายชื่อรับยา Stroke และSTEMI</h1>
          <p className="stk-subtitle">
            <span>ตรวจสอบการบันทึกการใช้ยา Streptokinase และการวินิจฉัย STEMI</span>
          </p>
        </div>

        <div className="stk-actions">
          <button
            type="button"
            className="stk-btn stk-btn-secondary"
            onClick={handleExportExcel}
            disabled={isExporting || loading || items.length === 0}
            title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
          >
            <Download size={16} />
            <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
          </button>

          <button
            type="button"
            className="stk-btn stk-btn-secondary"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || loading}
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw size={16} className={isRefreshing ? 'stk-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
        </div>
      </header>

      {!adpMapping.isMapped && (
        <div className="stk-warning-banner" role="alert">
          <AlertTriangle size={20} className="stk-warning-icon" />
          <div className="stk-warning-text">
            <strong>คำเตือน: ยังไม่ได้ Map ADP Code สำหรับยากลุ่ม STEMI / Streptokinase</strong>
            <div>
              ไม่พบรายการยาในตาราง <code>s_drugitems</code> ที่ระบุรหัส <code>nhso_adp_code</code> ที่ตรงกับคำว่า <code>STEMI</code> กรุณาตรวจสอบการตั้งค่ารายการยาในระบบ HOSxP
            </div>
          </div>
        </div>
      )}

      <div className="stk-date-card">
        <div className="stk-type-segmented" role="group" aria-label="ประเภทผู้ป่วย">
          <button
            type="button"
            className={`stk-type-btn ${patientType === 'IPD' ? 'is-active' : ''}`}
            onClick={() => {
              if (patientType !== 'IPD') {
                setPatientType('IPD')
                setCurrentPage(1)
              }
            }}
          >
            <BedDouble size={15} />
            <span>ผู้ป่วยใน (IPD)</span>
          </button>
          <button
            type="button"
            className={`stk-type-btn ${patientType === 'OPD' ? 'is-active' : ''}`}
            onClick={() => {
              if (patientType !== 'OPD') {
                setPatientType('OPD')
                setCurrentPage(1)
              }
            }}
          >
            <Building2 size={15} />
            <span>ผู้ป่วยนอก (OPD)</span>
          </button>
        </div>

        <div className="stk-date-divider" />

        <div className="stk-date-segmented" role="group" aria-label="ช่วงเวลา">
          <button
            type="button"
            className={`stk-segmented-btn ${dateMode === 'custom' ? 'is-active' : ''}`}
            onClick={() => handleDateModeChange('custom')}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            className={`stk-segmented-btn ${dateMode === 'monthly' ? 'is-active' : ''}`}
            onClick={() => handleDateModeChange('monthly')}
          >
            รายเดือน
          </button>
          <button
            type="button"
            className={`stk-segmented-btn ${dateMode === 'fiscal' ? 'is-active' : ''}`}
            onClick={() => handleDateModeChange('fiscal')}
          >
            ปีงบประมาณ
          </button>
        </div>

        <div className="stk-date-divider" />

        <div className="stk-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="stk-control-group">
                <span className="stk-control-label">ตั้งแต่:</span>
                <ThaiDatePicker value={ds1} onChange={setDs1} />
              </div>
              <div className="stk-control-group">
                <span className="stk-control-label">ถึง:</span>
                <ThaiDatePicker value={ds2} onChange={setDs2} />
              </div>
            </>
          )}

          {dateMode === 'monthly' && (
            <>
              <div className="stk-control-group">
                <span className="stk-control-label">เดือน:</span>
                <select
                  className="stk-select"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                >
                  {THAI_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stk-control-group">
                <span className="stk-control-label">ปี:</span>
                <select
                  className="stk-select"
                  value={selectedBeYear}
                  onChange={(e) => handleMonthYearChange(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {dateMode === 'fiscal' && (
            <div className="stk-control-group">
              <span className="stk-control-label">ปีงบประมาณ:</span>
              <select
                className="stk-select"
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    ปีงบ {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <StreptokinaseKpiGrid
        summary={summary}
        cardFilter={cardFilter}
        onCardClick={handleCardClick}
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

      <StreptokinaseTableSection
        patientType={patientType}
        items={items}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        loading={loading}
        isRefreshing={isRefreshing}
        search={search}
        pttypes={pttypes}
        selectedReps={selectedReps}
        effectiveRepBreakdown={effectiveRepBreakdown}
        cardFilter={cardFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSearchChange={setSearch}
        onClearSearch={() => {
          setSearch('')
          setDebouncedSearch('')
        }}
        onPttypesChange={(codes) => {
          setPttypes(codes)
          setCurrentPage(1)
        }}
        onSelectedRepsChange={(reps) => {
          setSelectedReps(reps)
          setCurrentPage(1)
        }}
        onClearCardFilter={() => handleCardClick('ALL')}
        onSort={handleSort}
        onRowClick={handleRowClick}
        onPageChange={setCurrentPage}
      />

      <StreptokinaseDetailModal
        selectedItem={selectedItem}
        modalTab={modalTab}
        loadingModalDetails={loadingModalDetails}
        orderFilter={orderFilter}
        orderSearch={orderSearch}
        normalizedOrders={normalizedOrders}
        filteredOrders={filteredOrders}
        orderMetrics={orderMetrics}
        onClose={() => {
          setSelectedItem(null)
          setOrderFilter('all')
          setOrderSearch('')
        }}
        onTabChange={setModalTab}
        onOrderFilterChange={setOrderFilter}
        onOrderSearchChange={setOrderSearch}
        onClearOrderFilters={() => {
          setOrderSearch('')
          setOrderFilter('all')
        }}
      />
    </div>
  )
}
