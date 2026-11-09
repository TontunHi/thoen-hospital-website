'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RefreshCw,
  Download,
  Calendar,
  HeartPulse,
  Pill,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ReceiptText,
  FileCheck2,
  Send,
  Building2,
  BedDouble,
  Activity,
  Layers,
} from 'lucide-react'
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
import { formatThaiDate } from '@/lib/formatters'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import PttypeMultiSelect from '@/components/rcm/PttypeMultiSelect'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import './page.css'

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

export interface ModalOrderItem {
  id: string
  icode: string
  name: string
  strength: string | null
  units: string | null
  qty: number
  unitprice: number
  sumPrice: number
  paidstName: string
  incomeName: string
  isDrug: boolean
  isTargetDrug: boolean
}

function formatMoney(val?: number | null, fallbackZero: boolean = false): string {
  if (val == null) return fallbackZero ? '0.00' : '—'
  if (val === 0) return fallbackZero ? '0.00' : '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface StreptokinaseRecipientsClientProps {
  initialData?: StreptokinaseReportResult | null
}

export default function StreptokinaseRecipientsClient({
  initialData = null,
}: StreptokinaseRecipientsClientProps) {
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

  // Patient type state: OPD or IPD
  const [patientType, setPatientType] = useState<StreptokinasePatientType>(
    initialData?.patientType ?? 'OPD'
  )

  // Date selection states: 1. กำหนดเอง -> 2. เดือน -> 3. ปีงบประมาณ
  const [dateMode, setDateMode] = useState<'custom' | 'monthly' | 'fiscal'>('custom')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalBeYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(curMonth)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(curBeYear)
  const [ds1, setDs1] = useState<string>(
    initialData?.ds1 ?? `${defaultFiscalCeYear - 1}-10-01`
  )
  const [ds2, setDs2] = useState<string>(
    initialData?.ds2 ?? `${defaultFiscalCeYear}-09-30`
  )

  // Filter & Search states
  const [cardFilter, setCardFilter] = useState<StreptokinaseCardFilter>(
    initialData?.cardFilter ?? 'ALL'
  )
  const [pttypes, setPttypes] = useState<string[]>([])
  const [search, setSearch] = useState<string>(initialData?.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialData?.search ?? '')
  const [sortBy, setSortBy] = useState<StreptokinaseSortField>(
    initialData?.sortBy ?? 'date'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialData?.sortOrder ?? 'desc'
  )
  const [currentPage, setCurrentPage] = useState<number>(initialData?.page ?? 1)
  const [pageSize, setPageSize] = useState<number>(initialData?.pageSize ?? 50)

  // Data fetching states
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
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

  // Modal Detail states (opened by clicking row directly!)
  const [selectedItem, setSelectedItem] = useState<StreptokinaseItem | null>(null)
  const [modalTab, setModalTab] = useState<'overview' | 'orders'>('overview')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [anDetails, setAnDetails] = useState<AnClinicalDetails | null>(null)
  const [loadingModalDetails, setLoadingModalDetails] = useState<boolean>(false)
  const [orderFilter, setOrderFilter] = useState<'all' | 'drug' | 'service'>('all')
  const [orderSearch, setOrderSearch] = useState<string>('')

  // Target thrombolytic detector helper
  const isTargetThrombolytic = useCallback((name: string, targetDrugName?: string) => {
    const lower = name.toLowerCase()
    const targetLower = (targetDrugName || '').toLowerCase()
    if (targetLower && lower.includes(targetLower)) return true
    return /(streptokinase|alteplase|actilyse|tenecteplase|metalyse|stemi)/i.test(lower)
  }, [])

  // Normalized Orders across OPD (vnDetails) and IPD (anDetails)
  const normalizedOrders: ModalOrderItem[] = useMemo(() => {
    if (!selectedItem) return []

    if (selectedItem.patientType === 'OPD' && vnDetails?.orders?.items) {
      return vnDetails.orders.items.map((ord, idx) => {
        const name = ord.item_name || ord.name || ''
        const isDrug =
          ord.category_group === 'DRUG' ||
          Boolean(ord.income_name?.includes('ยา')) ||
          Boolean(ord.icode?.startsWith('1'))
        const isTarget = isTargetThrombolytic(name, selectedItem.drugname)

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
          isTargetDrug: isTarget,
        }
      })
    }

    if (selectedItem.patientType === 'IPD' && anDetails?.orders) {
      return anDetails.orders.map((ord, idx) => {
        const name = ord.itemName || ''
        const isDrug = Boolean(ord.isDrug)
        const isTarget = isTargetThrombolytic(name, selectedItem.drugname)

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
          isTargetDrug: isTarget,
        }
      })
    }

    return []
  }, [selectedItem, vnDetails, anDetails, isTargetThrombolytic])

  // Order Metrics and Target Drug spotlight detection
  const orderMetrics = useMemo(() => {
    const totalCount = normalizedOrders.length
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
      totalCount,
      drugCount,
      serviceCount,
      totalDrugCost,
      totalServiceCost,
      grandTotal,
      targetDrug,
    }
  }, [normalizedOrders])

  // Filtered Orders by Chip Category & Search query
  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase()
    return normalizedOrders.filter((ord) => {
      if (orderFilter === 'drug' && !ord.isDrug) return false
      if (orderFilter === 'service' && ord.isDrug) return false

      if (query) {
        const matchName = ord.name.toLowerCase().includes(query)
        const matchIcode = ord.icode.toLowerCase().includes(query)
        const matchIncome = ord.incomeName.toLowerCase().includes(query)
        const matchPaidst = ord.paidstName.toLowerCase().includes(query)
        if (!matchName && !matchIcode && !matchIncome && !matchPaidst) return false
      }

      return true
    })
  }, [normalizedOrders, orderFilter, orderSearch])

  // AbortController ref for race condition safety
  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce search input
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

  // Synchronize date ranges when mode changes
  const applyDateMode = useCallback(
    (mode: 'custom' | 'monthly' | 'fiscal', fYear = selectedFiscalYear, m = selectedMonth, bYear = selectedBeYear) => {
      if (mode === 'fiscal') {
        const ce = fYear - 543
        setDs1(`${ce - 1}-10-01`)
        setDs2(`${ce}-09-30`)
      } else if (mode === 'monthly') {
        const ce = bYear - 543
        const mm = String(m).padStart(2, '0')
        const lastDay = new Date(ce, m, 0).getDate()
        setDs1(`${ce}-${mm}-01`)
        setDs2(`${ce}-${mm}-${String(lastDay).padStart(2, '0')}`)
      }
    },
    [selectedFiscalYear, selectedMonth, selectedBeYear]
  )

  const handleDateModeChange = (mode: 'custom' | 'monthly' | 'fiscal') => {
    setDateMode(mode)
    applyDateMode(mode)
  }

  const handleFiscalYearChange = (fYear: number) => {
    setSelectedFiscalYear(fYear)
    applyDateMode('fiscal', fYear)
  }

  const handleMonthChange = (m: number) => {
    setSelectedMonth(m)
    applyDateMode('monthly', selectedFiscalYear, m, selectedBeYear)
  }

  const handleMonthYearChange = (bYear: number) => {
    setSelectedBeYear(bYear)
    applyDateMode('monthly', selectedFiscalYear, selectedMonth, bYear)
  }

  // Fetch report data from API
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
        if (data.adpMapping) {
          setAdpMapping(data.adpMapping)
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        setError(err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [patientType, ds1, ds2, cardFilter, pttypes, debouncedSearch, sortBy, sortOrder, currentPage, pageSize]
  )

  // Fetch when filters or patientType change (skip initial mount if initialData is provided)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialData) return
    }
    fetchData()
  }, [fetchData, initialData])

  // Handle Sort column click
  const handleSort = (field: StreptokinaseSortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Handle Card Click (filter toggle)
  const handleCardClick = (filter: StreptokinaseCardFilter) => {
    if (cardFilter === filter) {
      setCardFilter('ALL')
    } else {
      setCardFilter(filter)
    }
    setCurrentPage(1)
  }

  // Handle Row Click to open Detail Modal directly!
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
        if (json.success && json.data) {
          setVnDetails(json.data)
        }
      } else if (item.patientType === 'IPD' && item.an) {
        const res = await fetch(
          `/api/service/dashboard-rcm/funds/streptokinase/an-details?an=${encodeURIComponent(item.an)}`
        )
        const json = await res.json()
        if (json.success && json.data) {
          setAnDetails(json.data)
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingModalDetails(false)
    }
  }

  // Handle Export Excel (.xlsx)
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

      const res = await fetch(
        `/api/service/dashboard-rcm/funds/streptokinase/recipients?${params.toString()}`
      )
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกข้อมูลไม่สำเร็จ')
      }

      const rows: StreptokinaseItem[] = json.data?.items || []
      const isOpd = patientType === 'OPD'

      const headers = isOpd
        ? [
            'ลำดับ',
            'VN',
            'HN',
            'เลขบัตรประชาชน',
            'ชื่อ-สกุล',
            'เพศ',
            'อายุ (ปี)',
            'วันที่รับบริการ',
            'เวลา',
            'สิทธิการรักษา',
            'แผนก/ห้องตรวจ',
            'คลินิก',
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
        : [
            'ลำดับ',
            'AN',
            'HN',
            'เลขบัตรประชาชน',
            'ชื่อ-สกุล',
            'เพศ',
            'อายุ (ปี)',
            'วันรับไว้ (Adm)',
            'วันจำหน่าย (Dch)',
            'สิทธิการรักษา',
            'ตึกผู้ป่วย',
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

      const excelRows = rows.map((r, i) => {
        if (isOpd) {
          return [
            i + 1,
            r.vn || '',
            r.hn,
            r.cid,
            r.ptname,
            r.sex,
            r.age,
            r.vstdate || '',
            r.vsttime || '',
            r.pttypename,
            r.department || '',
            r.clinic || '',
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
          ]
        } else {
          return [
            i + 1,
            r.an || '',
            r.hn,
            r.cid,
            r.ptname,
            r.sex,
            r.age,
            r.admdate || '',
            r.dchdate || '',
            r.pttypename,
            r.ward || '',
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
          ]
        }
      })

      await exportRcmExcel({
        filename: `streptokinase_${patientType.toLowerCase()}_${ds1}_${ds2}.xlsx`,
        title: `รายชื่อรับยา Streptokinase (${patientType})`,
        subtitle: `ช่วงวันที่ ${ds1} ถึง ${ds2} (ทั้งหมด ${rows.length.toLocaleString('th-TH')} รายการ)`,
        headers,
        rows: excelRows,
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel')
    } finally {
      setIsExporting(false)
    }
  }

  // Render Sort Icon helper
  const renderSortIcon = (field: StreptokinaseSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} className="stk-sort-inactive" />
    }
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
  }

  return (
    <div className="stk-page">
      {/* 1. Clean Breadcrumb (No Eyebrow Badges) */}
      <nav className="stk-breadcrumb" aria-label="breadcrumb">
        <Link href="/service/dashboard-rcm">กองทุน RCM</Link>
        <span className="stk-breadcrumb-sep">/</span>
        <Link href="/service/dashboard-rcm/funds/streptokinase">กองทุนยา Streptokinase</Link>
        <span className="stk-breadcrumb-sep">/</span>
        <span className="stk-breadcrumb-current">รายชื่อรับยา Streptokinase</span>
      </nav>

      {/* 2. Header Bar */}
      <header className="stk-header">
        <div className="stk-title-group">
          <h1 className="stk-title">รายชื่อรับยา Streptokinase</h1>
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

      {/* 3. Warning Banner for Unmapped ADP */}
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

      {/* 4. Single-Row Unified Date & Patient Type Selection Bar */}
      <div className="stk-date-card">
        {/* Patient Type Switcher (OPD / IPD) */}
        <div className="stk-type-segmented" role="group" aria-label="ประเภทผู้ป่วย">
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
        </div>

        <div className="stk-date-divider" />

        {/* Date Mode Switcher: กำหนดเอง | เดือน | ปีงบประมาณ (No leading numbers) */}
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
            เดือน
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

        {/* Date Controls */}
        <div className="stk-date-controls">
          {dateMode === 'custom' && (
            <>
              <div className="stk-control-group">
                <span className="stk-control-label">ตั้งแต่:</span>
                <ThaiDatePicker value={ds1} onChange={(val) => setDs1(val)} />
              </div>
              <div className="stk-control-group">
                <span className="stk-control-label">ถึง:</span>
                <ThaiDatePicker value={ds2} onChange={(val) => setDs2(val)} />
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
                    ปีงบประมาณ {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 5. Equal & Balanced KPI Summary Grid (4 x 2) */}
      <div className="stk-kpi-grid">
        {/* Card 1: ผู้รับยาทั้งหมด */}
        <div
          className={`stk-kpi-card ${cardFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('ALL')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">ผู้รับยาทั้งหมด</span>
            <HeartPulse size={18} className="stk-kpi-icon" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value">{summary.totalCases.toLocaleString()}</span>
            <span className="stk-kpi-sub">{summary.uniquePatients.toLocaleString()} คน</span>
          </div>
        </div>

        {/* Card 2: ตรวจสอบ Dx/Op ถูกต้อง */}
        <div
          className={`stk-kpi-card ${cardFilter === 'AUDIT_PASS' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('AUDIT_PASS')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">บันทึก Dx/Op ถูกต้อง</span>
            <CheckCircle2 size={18} className="stk-kpi-icon text-emerald-600" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value text-emerald-700">
              {summary.auditPassCases.toLocaleString()}
            </span>
            <span className="stk-kpi-sub text-emerald-600">{summary.auditPassRate}%</span>
          </div>
        </div>

        {/* Card 3: ตรวจพบข้อผิดพลาด Dx/Op */}
        <div
          className={`stk-kpi-card is-error ${cardFilter === 'AUDIT_ERROR' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('AUDIT_ERROR')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label text-rose-700">พบข้อผิดพลาด Dx/Op</span>
            <AlertTriangle size={18} className="stk-kpi-icon text-rose-600" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value text-rose-600">
              {summary.auditErrorCases.toLocaleString()}
            </span>
            <span className="stk-kpi-sub text-rose-600">{summary.auditErrorRate}%</span>
          </div>
        </div>

        {/* Card 4: ได้รับชดเชยแล้ว */}
        <div
          className={`stk-kpi-card ${cardFilter === 'COMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('COMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">ได้รับชดเชยแล้ว</span>
            <FileCheck2 size={18} className="stk-kpi-icon" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value">{summary.compensatedCases.toLocaleString()}</span>
            <span className="stk-kpi-sub">{formatMoney(summary.totalCompensated, true)} บาท</span>
          </div>
        </div>

        {/* Card 5: รอชดเชย / ยังไม่ชดเชย */}
        <div
          className={`stk-kpi-card ${cardFilter === 'UNCOMPENSATED' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('UNCOMPENSATED')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">รอการชดเชย</span>
            <ReceiptText size={18} className="stk-kpi-icon" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value">{summary.uncompensatedCases.toLocaleString()}</span>
            <span className="stk-kpi-sub">ค้างชำระ {formatMoney(summary.totalDebit, true)} บาท</span>
          </div>
        </div>

        {/* Card 6: ได้รับ Invoice (NHSO) */}
        <div
          className={`stk-kpi-card ${cardFilter === 'WITH_INVOICE' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_INVOICE')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">ได้รับ Invoice (สปสช.)</span>
            <CheckCircle2 size={18} className="stk-kpi-icon text-blue-600" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value">{summary.withInvoiceCases.toLocaleString()}</span>
            <span className="stk-kpi-sub">มี Invoice แล้ว</span>
          </div>
        </div>

        {/* Card 7: ได้รับ Rep แล้ว */}
        <div
          className={`stk-kpi-card ${cardFilter === 'WITH_REP' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('WITH_REP')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">ได้รับ Rep แล้ว</span>
            <ReceiptText size={18} className="stk-kpi-icon text-purple-600" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value">{summary.withRepCases.toLocaleString()}</span>
            <span className="stk-kpi-sub">ตอบรับ Rep</span>
          </div>
        </div>

        {/* Card 8: ยังไม่ส่งเข้าโปรแกรม E-Claim */}
        <div
          className={`stk-kpi-card ${cardFilter === 'NOT_SENT' ? 'is-active' : ''}`}
          onClick={() => handleCardClick('NOT_SENT')}
          role="button"
          tabIndex={0}
        >
          <div className="stk-kpi-card-header">
            <span className="stk-kpi-label">ยังไม่ส่ง E-Claim</span>
            <Send size={18} className="stk-kpi-icon text-amber-600" />
          </div>
          <div className="stk-kpi-value-row">
            <span className="stk-kpi-value text-amber-700">
              {summary.notSentCases.toLocaleString()}
            </span>
            <span className="stk-kpi-sub text-amber-600">รอดำเนินการ</span>
          </div>
        </div>
      </div>

      {/* 6. Toolbar & Unified Global Search (No Field Dropdown) */}
      <div className="stk-toolbar">
        <div className="stk-search-box">
          <Search size={18} className="stk-search-icon" />
          <input
            type="text"
            className="stk-search-input"
            placeholder="ค้นหาด้วย HN, CID, ชื่อผู้ป่วย, VN/AN, รหัสโรค, สิทธิการรักษา, Rep..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="stk-search-clear"
              onClick={() => setSearch('')}
              title="ล้างคำค้นหา"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <PttypeMultiSelect
          selectedCodes={pttypes}
          onChange={(codes) => {
            setPttypes(codes)
            setCurrentPage(1)
            }}
            items={items}
        
          />

        <div className="stk-toolbar-meta">
          <span>
            แสดงผล <strong className="stk-count-badge">{items.length}</strong> จากทั้งหมด{' '}
            <strong className="stk-count-badge">{totalCount.toLocaleString()}</strong> รายการ
          </span>
          {cardFilter !== 'ALL' && (
            <button
              type="button"
              className="stk-badge stk-badge-neutral cursor-pointer hover:bg-slate-200"
              onClick={() => handleCardClick('ALL')}
            >
              <span>ล้างตัวกรองการ์ด</span>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 7. Data Table (Row-Clickable, No Action Button Column) */}
      <div className="stk-table-container">
        <div className="stk-table-scroll">
          <table className="stk-table">
            <thead>
              <tr>
                <th className="col-center" style={{ width: '56px' }}>
                  ลำดับ
                </th>
                <th className="col-center" style={{ width: '130px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => handleSort('date')}
                  >
                    <span className="th-sort-inner">
                      <span>{patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันจำหน่าย'}</span>
                      {renderSortIcon('date')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>{patientType === 'OPD' ? 'VN' : 'AN'}</span>
                </th>
                <th className="col-center" style={{ width: '90px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => handleSort('hn')}
                  >
                    <span className="th-sort-inner">
                      <span>HN</span>
                      {renderSortIcon('hn')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '140px' }}>
                  <span>เลขบัตรประชาชน</span>
                </th>
                <th className="col-center" style={{ minWidth: '170px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => handleSort('ptname')}
                  >
                    <span className="th-sort-inner">
                      <span>ชื่อ-สกุล</span>
                      {renderSortIcon('ptname')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '68px' }}>
                  <span>เพศ</span>
                </th>
                <th className="col-center" style={{ width: '80px' }}>
                  <button
                    type="button"
                    className="stk-th-sort"
                    onClick={() => handleSort('age')}
                  >
                    <span className="th-sort-inner">
                      <span>อายุ</span>
                      {renderSortIcon('age')}
                    </span>
                  </button>
                </th>
                <th style={{ minWidth: '160px' }}>
                  <span>สิทธิการรักษา</span>
                </th>
                <th style={{ minWidth: '150px' }}>
                  <span>{patientType === 'OPD' ? 'ห้องตรวจ/แผนก' : 'ตึกผู้ป่วย'}</span>
                </th>
                <th className="col-center" style={{ width: '120px' }}>
                  <span>ผลตรวจ Dx STEMI</span>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>ผลตรวจ Op 9910</span>
                </th>
                <th className="col-right" style={{ width: '120px' }}>
                  <button
                    type="button"
                    className="stk-th-sort justify-end"
                    onClick={() => handleSort('money_hosxp')}
                  >
                    <span className="th-sort-inner">
                      <span>ค่ายา HOSxP</span>
                      {renderSortIcon('money_hosxp')}
                    </span>
                  </button>
                </th>
                <th className="col-center" style={{ width: '110px' }}>
                  <span>ชดเชย (บาท)</span>
                </th>
                <th className="col-center" style={{ width: '100px' }}>
                  <span>เลขที่ Rep</span>
                </th>
                <th className="col-center" style={{ width: '150px' }}>
                  <span>สถานะ E-Claim</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="stk-empty-state">
                    <RefreshCw size={24} className="stk-empty-icon stk-spin text-emerald-600" />
                    <div className="stk-empty-title">กำลังโหลดข้อมูล...</div>
                    <div className="stk-empty-desc">กรุณารอสักครู่ ระบบกำลังค้นหาข้อมูลจากฐานข้อมูล</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={16} className="stk-empty-state">
                    <HeartPulse size={36} className="stk-empty-icon" />
                    <div className="stk-empty-title">
                      {search ? 'ไม่พบผลการค้นหา' : 'ไม่พบข้อมูลผู้รับยา Streptokinase'}
                    </div>
                    <div className="stk-empty-desc">
                      {search
                        ? `ไม่พบข้อมูลที่ตรงกับ "${search}" ในช่วงเวลาที่เลือก`
                        : 'ไม่มีการบันทึกการใช้ยา Streptokinase ในช่วงเวลาที่เลือก'}
                    </div>
                    {search && (
                      <div className="stk-empty-action">
                        <button
                          type="button"
                          className="stk-btn stk-btn-secondary"
                          onClick={() => {
                            setSearch('')
                            setDebouncedSearch('')
                          }}
                        >
                          <X size={14} />
                          <span>ล้างคำค้นหาทั้งหมด</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isOpd = item.patientType === 'OPD'
                  return (
                    <tr
                      key={item.vn || item.an || `${item.hn}-${item.no}`}
                      className="stk-row-clickable"
                      onClick={() => handleRowClick(item)}
                      title="คลิกเพื่อดูรายละเอียดเวชระเบียนและการตรวจสอบ"
                    >
                      <td className="col-center stk-num">{item.no}</td>
                      <td className="col-center stk-num">
                        {formatThaiDate(isOpd ? item.vstdate : item.dchdate)}
                      </td>
                      <td className="col-center stk-num">
                        {isOpd ? item.vn : item.an}
                      </td>
                      <td className="col-center stk-num font-medium">{item.hn}</td>
                      <td className="col-center stk-cid">{item.cid || '—'}</td>
                      <td className="col-center stk-ptname">
                        {(() => {
                          const parts = (item.ptname || '').trim().split(/\s+/)
                          const firstPart = parts[0] || ''
                          const surnamePart = parts.slice(1).join(' ')
                          return (
                            <>
                              <span className="pt-first-name">{firstPart}</span>
                              {surnamePart && (
                                <>
                                  {' '}
                                  <span className="pt-last-name">{surnamePart}</span>
                                </>
                              )}
                            </>
                          )
                        })()}
                      </td>
                      <td className="col-center">{item.sex}</td>
                      <td className="col-center stk-age-nowrap">{item.age}&nbsp;ปี</td>
                      <td className="truncate max-w-[180px]" title={item.pttypename}>
                        {item.pttypename || '—'}
                      </td>
                      <td className="truncate max-w-[160px]">
                        {isOpd ? item.department || item.clinic || '—' : item.ward || '—'}
                      </td>

                      {/* Dx Check Badge */}
                      <td className="col-center">
                        {item.errorDx ? (
                          <span
                            className="stk-badge stk-badge-danger"
                            title={item.errorDx}
                          >
                            <AlertTriangle size={12} />
                            <span>ไม่พบ Dx</span>
                          </span>
                        ) : (
                          <span
                            className="stk-badge stk-badge-success"
                            title={`รหัสโรค: ${item.dx || ''}`}
                          >
                            <CheckCircle2 size={12} />
                            <span>ถูกต้อง</span>
                          </span>
                        )}
                      </td>

                      {/* Op Check Badge */}
                      <td className="col-center">
                        {item.errorOp ? (
                          <span
                            className="stk-badge stk-badge-danger"
                            title={item.errorOp}
                          >
                            <AlertTriangle size={12} />
                            <span>ไม่พบ Op</span>
                          </span>
                        ) : (
                          <span
                            className="stk-badge stk-badge-success"
                            title={`หัตถการ: ${item.op || ''}`}
                          >
                            <CheckCircle2 size={12} />
                            <span>มี 9910</span>
                          </span>
                        )}
                      </td>

                      {/* HOSxP Cost */}
                      <td className="col-right stk-num font-medium">
                        {formatMoney(item.money_hosxp)}
                      </td>

                      {/* Compensated */}
                      <td className="col-center stk-num font-medium text-emerald-700">
                        {formatMoney(item.compensated)}
                      </td>

                      {/* Rep Number */}
                      <td className="col-center stk-num">
                        {item.rep ? (
                          <span className="stk-badge stk-badge-purple">{item.rep}</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* E-Claim Status */}
                      <td className="col-center">
                        {item.status.includes('Invoice') ? (
                          <span className="stk-badge stk-badge-info">มี Invoice</span>
                        ) : item.status.includes('Rep') ? (
                          <span className="stk-badge stk-badge-success">มี Rep</span>
                        ) : item.status.startsWith('-') ? (
                          <span className="stk-badge stk-badge-warning">ยังไม่ส่ง</span>
                        ) : (
                          <span className="stk-badge stk-badge-neutral">{item.status}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 8. Pagination */}
        {totalPages > 1 && (
          <div className="stk-pagination">
            <div>
              หน้า <strong>{currentPage}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด{' '}
              {totalCount.toLocaleString()} รายการ)
            </div>

            <div className="stk-pagination-btns">
              <button
                type="button"
                className="stk-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || loading}
              >
                «
              </button>
              <button
                type="button"
                className="stk-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                ‹
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let pNum = currentPage - 2 + idx
                if (pNum < 1) pNum = idx + 1
                if (pNum > totalPages) return null
                return (
                  <button
                    key={pNum}
                    type="button"
                    className={`stk-page-btn ${currentPage === pNum ? 'is-active' : ''}`}
                    onClick={() => setCurrentPage(pNum)}
                    disabled={loading}
                  >
                    {pNum}
                  </button>
                )
              })}

              <button
                type="button"
                className="stk-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
              >
                ›
              </button>
              <button
                type="button"
                className="stk-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || loading}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 9. Detail Modal (Opened directly when clicking a row!) */}
      {selectedItem && (
        <div
          className="stk-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null)
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="stk-modal">
            {/* Modal Header */}
            <div className="stk-modal-header">
              <div>
                <h3 className="stk-modal-title">
                  {selectedItem.ptname} ({selectedItem.hn})
                </h3>
                <p className="stk-modal-sub">
                  <span>เลขบัตรประชาชน: {selectedItem.cid || '—'}</span>
                  <span>•</span>
                  <span>เพศ {selectedItem.sex}</span>
                  <span>•</span>
                  <span>อายุ {selectedItem.age} ปี</span>
                  <span>•</span>
                  <span className="stk-badge stk-badge-neutral">
                    {selectedItem.patientType === 'OPD'
                      ? `OPD VN: ${selectedItem.vn}`
                      : `IPD AN: ${selectedItem.an}`}
                  </span>
                </p>
              </div>

              <button
                type="button"
                className="stk-modal-close"
                onClick={() => {
                  setSelectedItem(null)
                  setOrderFilter('all')
                  setOrderSearch('')
                }}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="stk-modal-tabs">
              <button
                type="button"
                className={`stk-modal-tab ${modalTab === 'overview' ? 'is-active' : ''}`}
                onClick={() => setModalTab('overview')}
              >
                สรุปเวชระเบียนและการตรวจสอบ (Overview & Audit)
              </button>
              <button
                type="button"
                className={`stk-modal-tab ${modalTab === 'orders' ? 'is-active' : ''}`}
                onClick={() => setModalTab('orders')}
              >
                รายการยาและค่าบริการรักษา (Orders)
              </button>
            </div>

            {/* Modal Body */}
            <div className="stk-modal-body">
              {modalTab === 'overview' && (
                <>
                  {/* Audit Verification Boxes */}
                  <div className="stk-modal-section">
                    <h4 className="stk-section-title">
                      <ShieldCheck size={16} className="text-emerald-700" />
                      <span>ผลการตรวจสอบเงื่อนไขการเบิกชดเชย (Audit Verification)</span>
                    </h4>

                    {/* Dx STEMI Check */}
                    <div
                      className={`stk-audit-box ${selectedItem.errorDx ? 'is-fail' : 'is-pass'}`}
                    >
                      {selectedItem.errorDx ? (
                        <AlertTriangle size={20} className="stk-audit-icon text-rose-600" />
                      ) : (
                        <CheckCircle2 size={20} className="stk-audit-icon text-emerald-600" />
                      )}
                      <div className="stk-audit-content">
                        <div className="stk-audit-title">
                          {selectedItem.errorDx
                            ? 'ตรวจพบข้อผิดพลาด: ไม่พบรหัสโรค STEMI (I210-I213 หรือ I22x)'
                            : 'ผ่านการตรวจสอบ: พบรหัสโรค STEMI (I210-I213 หรือ I22x)'}
                        </div>
                        <div>
                          รหัสโรคที่บันทึกในระบบ: <code>{selectedItem.dx || 'ไม่มี'}</code>
                        </div>
                      </div>
                    </div>

                    {/* Op 9910 Check */}
                    <div
                      className={`stk-audit-box ${selectedItem.errorOp ? 'is-fail' : 'is-pass'}`}
                    >
                      {selectedItem.errorOp ? (
                        <AlertTriangle size={20} className="stk-audit-icon text-rose-600" />
                      ) : (
                        <CheckCircle2 size={20} className="stk-audit-icon text-emerald-600" />
                      )}
                      <div className="stk-audit-content">
                        <div className="stk-audit-title">
                          {selectedItem.errorOp
                            ? 'ตรวจพบข้อผิดพลาด: ไม่พบหัตถการ Op 9910'
                            : 'ผ่านการตรวจสอบ: มีการบันทึกหัตถการ Op 9910 (Thrombolytic injection)'}
                        </div>
                        <div>
                          รหัสหัตถการที่บันทึกในระบบ: <code>{selectedItem.op || 'ไม่มี'}</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="stk-modal-section">
                    <h4 className="stk-section-title">
                      <ReceiptText size={16} />
                      <span>ข้อมูลค่ารักษาพยาบาลและการชดเชย</span>
                    </h4>

                    <div className="stk-detail-grid">
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">ค่ายา Streptokinase (HOSxP)</div>
                        <div className="stk-detail-value">
                          {formatMoney(selectedItem.money_hosxp)} บาท
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">ยอดชดเชยสุทธิ (Compensated)</div>
                        <div className="stk-detail-value text-emerald-700">
                          {formatMoney(selectedItem.compensated)} บาท
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">เงิน E-Claim</div>
                        <div className="stk-detail-value">
                          {formatMoney(selectedItem.money_eclaim)} บาท
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">เงิน Rep / Invoice</div>
                        <div className="stk-detail-value">
                          {formatMoney(selectedItem.money_invoice || selectedItem.money_rep)} บาท
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">ลูกหนี้ค้างชำระ (Debit)</div>
                        <div className="stk-detail-value">
                          {formatMoney(selectedItem.debit)} บาท
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">สถานะ E-Claim / เลขที่ Rep</div>
                        <div className="stk-detail-value">
                          {selectedItem.status}{' '}
                          {selectedItem.rep ? `(Rep: ${selectedItem.rep})` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Context */}
                  <div className="stk-modal-section">
                    <h4 className="stk-section-title">
                      <Pill size={16} />
                      <span>ข้อมูลการใช้ยาและแผนก</span>
                    </h4>

                    <div className="stk-detail-grid">
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">ยา Streptokinase ที่ได้รับ</div>
                        <div className="stk-detail-value">{selectedItem.drugname}</div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">
                          {selectedItem.patientType === 'OPD' ? 'แผนก/ห้องตรวจ' : 'ตึกผู้ป่วย'}
                        </div>
                        <div className="stk-detail-value">
                          {selectedItem.patientType === 'OPD'
                            ? selectedItem.department || selectedItem.clinic || '—'
                            : selectedItem.ward || '—'}
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">
                          {selectedItem.patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันรับไว้รักษา'}
                        </div>
                        <div className="stk-detail-value">
                          {formatThaiDate(selectedItem.vstdate || selectedItem.admdate)}{' '}
                          {selectedItem.vsttime || ''}
                        </div>
                      </div>
                      <div className="stk-detail-card">
                        <div className="stk-detail-label">สิทธิการรักษา</div>
                        <div className="stk-detail-value">{selectedItem.pttypename}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'orders' && (
                <div className="stk-orders-container">
                  {loadingModalDetails ? (
                    <div className="stk-empty-state">
                      <RefreshCw size={24} className="stk-empty-icon stk-spin text-emerald-600" />
                      <div className="stk-empty-title">กำลังดึงรายการคำสั่งการรักษา...</div>
                    </div>
                  ) : (
                    <>
                      {/* 1. Target Thrombolytic Clinical Spotlight Card */}
                      <div className="stk-order-target-card">
                        <div className="stk-order-target-header">
                          <div className="stk-order-target-badge">
                            <HeartPulse size={15} />
                            <span>ยาเป้าหมายตามโครงการ (STEMI Thrombolytic Therapy)</span>
                          </div>
                          <div className="stk-order-target-status">
                            สิทธิการชำระ:{' '}
                            <span className="font-semibold text-emerald-900">
                              {orderMetrics.targetDrug?.paidstName || selectedItem.pttypename}
                            </span>
                          </div>
                        </div>
                        <div className="stk-order-target-body">
                          <div className="stk-order-target-main">
                            <div className="stk-order-target-name">
                              {orderMetrics.targetDrug?.name || selectedItem.drugname}
                              {orderMetrics.targetDrug?.strength && (
                                <span className="stk-order-target-strength">
                                  ({orderMetrics.targetDrug.strength})
                                </span>
                              )}
                            </div>
                            <div className="stk-order-target-sub">
                              รหัสยา:{' '}
                              <span className="stk-num">{orderMetrics.targetDrug?.icode || '—'}</span> &bull; หมวดรายได้:{' '}
                              <span>{orderMetrics.targetDrug?.incomeName || 'ค่ายาและสารอาหาร'}</span>
                            </div>
                          </div>
                          <div className="stk-order-target-stats">
                            <div className="stk-order-stat-pill">
                              <span className="stk-order-stat-pill-label">จำนวนสั่งใช้</span>
                              <span className="stk-order-stat-pill-val stk-num">
                                {orderMetrics.targetDrug
                                  ? `${orderMetrics.targetDrug.qty} ${orderMetrics.targetDrug.units || 'หน่วย'}`
                                  : '1 ครั้ง'}
                              </span>
                            </div>
                            <div className="stk-order-stat-pill">
                              <span className="stk-order-stat-pill-label">ราคา/หน่วย</span>
                              <span className="stk-order-stat-pill-val stk-num">
                                {formatMoney(orderMetrics.targetDrug?.unitprice ?? selectedItem.money_hosxp)} ฿
                              </span>
                            </div>
                            <div className="stk-order-stat-pill stk-order-stat-pill-highlight">
                              <span className="stk-order-stat-pill-label">รวมค่ายาเป้าหมาย</span>
                              <span className="stk-order-stat-pill-val stk-num text-emerald-800 font-bold">
                                {formatMoney(orderMetrics.targetDrug?.sumPrice ?? selectedItem.money_hosxp)} ฿
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Symmetrical 4-Card Summary Strip */}
                      <div className="stk-order-summary-grid">
                        <div className="stk-order-summary-card">
                          <div className="stk-order-summary-title">คำสั่งการรักษาทั้งหมด</div>
                          <div className="stk-order-summary-num stk-num">
                            {orderMetrics.totalCount} <span className="stk-order-summary-unit">รายการ</span>
                          </div>
                          <div className="stk-order-summary-sub stk-num">
                            รวม {formatMoney(orderMetrics.grandTotal, true)} ฿
                          </div>
                        </div>
                        <div className="stk-order-summary-card">
                          <div className="stk-order-summary-title">รายการยาและเวชภัณฑ์</div>
                          <div className="stk-order-summary-num stk-num text-emerald-700">
                            {orderMetrics.drugCount} <span className="stk-order-summary-unit">รายการ</span>
                          </div>
                          <div className="stk-order-summary-sub stk-num">
                            รวม {formatMoney(orderMetrics.totalDrugCost, true)} ฿
                          </div>
                        </div>
                        <div className="stk-order-summary-card">
                          <div className="stk-order-summary-title">ค่าบริการและหัตถการ</div>
                          <div className="stk-order-summary-num stk-num text-blue-700">
                            {orderMetrics.serviceCount} <span className="stk-order-summary-unit">รายการ</span>
                          </div>
                          <div className="stk-order-summary-sub stk-num">
                            รวม {formatMoney(orderMetrics.totalServiceCost, true)} ฿
                          </div>
                        </div>
                        <div className="stk-order-summary-card stk-order-summary-card-total">
                          <div className="stk-order-summary-title text-emerald-800">
                            ยอดรวมค่ารักษา (HOSxP)
                          </div>
                          <div className="stk-order-summary-num stk-num text-emerald-800">
                            {formatMoney(orderMetrics.grandTotal || selectedItem.money_hosxp, true)}{' '}
                            <span className="stk-order-summary-unit">บาท</span>
                          </div>
                          <div className="stk-order-summary-sub text-slate-500">
                            บันทึกเรียกเก็บ:{' '}
                            {formatMoney(
                              selectedItem.money_eclaim || selectedItem.money_rep || selectedItem.money_hosxp,
                              true
                            )}{' '}
                            ฿
                          </div>
                        </div>
                      </div>

                      {/* 3. Filter Chips & Search Toolbar */}
                      <div className="stk-order-toolbar">
                        <div className="stk-order-chips" role="group" aria-label="กรองประเภทคำสั่งการรักษา">
                          <button
                            type="button"
                            className={`stk-order-chip ${orderFilter === 'all' ? 'is-active' : ''}`}
                            onClick={() => setOrderFilter('all')}
                          >
                            <span>ทั้งหมด</span>
                            <span className="stk-order-chip-count stk-num">{orderMetrics.totalCount}</span>
                          </button>
                          <button
                            type="button"
                            className={`stk-order-chip ${orderFilter === 'drug' ? 'is-active' : ''}`}
                            onClick={() => setOrderFilter('drug')}
                          >
                            <Pill size={13} />
                            <span>รายการยา</span>
                            <span className="stk-order-chip-count stk-num">{orderMetrics.drugCount}</span>
                          </button>
                          <button
                            type="button"
                            className={`stk-order-chip ${orderFilter === 'service' ? 'is-active' : ''}`}
                            onClick={() => setOrderFilter('service')}
                          >
                            <Activity size={13} />
                            <span>ค่าบริการ/หัตถการ</span>
                            <span className="stk-order-chip-count stk-num">{orderMetrics.serviceCount}</span>
                          </button>
                        </div>

                        <div className="stk-order-search-box">
                          <Search size={14} className="stk-order-search-icon" />
                          <input
                            type="text"
                            className="stk-order-search-input"
                            placeholder="ค้นหาชื่อยา, รหัส, หมวดรายได้..."
                            value={orderSearch}
                            onChange={(e) => setOrderSearch(e.target.value)}
                          />
                          {orderSearch && (
                            <button
                              type="button"
                              className="stk-order-search-clear"
                              onClick={() => setOrderSearch('')}
                              aria-label="ล้างคำค้นหา"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 4. High-Craft Orders Table */}
                      <div className="stk-order-table-container">
                        <div className="stk-order-table-scroll">
                          <table className="stk-order-table">
                            <thead>
                              <tr>
                                <th className="col-center" style={{ width: '44px' }}>#</th>
                                <th className="col-center" style={{ width: '80px' }}>ประเภท</th>
                                <th className="col-left" style={{ width: '90px' }}>รหัส</th>
                                <th className="col-left">รายการยาและค่าบริการรักษา</th>
                                <th className="col-left" style={{ width: '150px' }}>หมวดรายได้</th>
                                <th className="col-center" style={{ width: '90px' }}>จำนวน</th>
                                <th className="col-right" style={{ width: '100px' }}>ราคา/หน่วย</th>
                                <th className="col-right" style={{ width: '110px' }}>รวมเงิน (บาท)</th>
                                <th className="col-center" style={{ width: '100px' }}>สิทธิชำระ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOrders.length > 0 ? (
                                filteredOrders.map((ord, idx) => (
                                  <tr
                                    key={ord.id}
                                    className={ord.isTargetDrug ? 'stk-order-row-target' : ''}
                                  >
                                    <td className="col-center stk-num text-slate-500">{idx + 1}</td>
                                    <td className="col-center">
                                      {ord.isDrug ? (
                                        <span className="stk-order-badge stk-order-badge-drug">ยา</span>
                                      ) : (
                                        <span className="stk-order-badge stk-order-badge-service">บริการ</span>
                                      )}
                                    </td>
                                    <td className="col-left stk-num stk-order-code">{ord.icode || '—'}</td>
                                    <td className="col-left stk-order-item-col">
                                      <div className="stk-order-item-name">
                                        <span>{ord.name}</span>
                                        {ord.strength && (
                                          <span className="stk-order-strength">({ord.strength})</span>
                                        )}
                                        {ord.isTargetDrug && (
                                          <span className="stk-target-pill">ยาเป้าหมาย STEMI</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="col-left stk-order-income text-slate-500">
                                      {ord.incomeName}
                                    </td>
                                    <td className="col-center stk-num">
                                      <span className="font-semibold text-slate-800">{ord.qty}</span>{' '}
                                      <span className="text-slate-500 text-xs">{ord.units || ''}</span>
                                    </td>
                                    <td className="col-right stk-num text-slate-600">
                                      {formatMoney(ord.unitprice)}
                                    </td>
                                    <td className="col-right stk-num font-semibold text-slate-900">
                                      {formatMoney(ord.sumPrice)}
                                    </td>
                                    <td className="col-center">
                                      <span className="stk-order-paidst">{ord.paidstName}</span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={9} className="p-8 text-center text-slate-500">
                                    <div className="stk-empty-search-order">
                                      {normalizedOrders.length === 0 ? (
                                        <>
                                          <Pill size={28} className="text-slate-300 mx-auto mb-2" />
                                          <p className="font-medium text-slate-700">
                                            ไม่พบรายละเอียดรายการคำสั่งการรักษาแบบแยกบรรทัดในระบบ HOSxP
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            แต่มีบันทึกค่ายาเป้าหมายรวม: {selectedItem.drugname} จำนวนเงิน{' '}
                                            {formatMoney(selectedItem.money_hosxp)} บาท
                                          </p>
                                        </>
                                      ) : (
                                        <>
                                          <p className="font-medium text-slate-700">
                                            ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง
                                          </p>
                                          <button
                                            type="button"
                                            className="stk-btn stk-btn-secondary mt-2 text-xs"
                                            onClick={() => {
                                              setOrderSearch('')
                                              setOrderFilter('all')
                                            }}
                                          >
                                            ล้างตัวกรองและคำค้นหา
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            {filteredOrders.length > 0 && (
                              <tfoot>
                                <tr>
                                  <td colSpan={5} className="stk-order-tfoot-label">
                                    รวมผลการแสดงผล: {filteredOrders.length} รายการ (จากทั้งหมด{' '}
                                    {orderMetrics.totalCount} รายการ)
                                  </td>
                                  <td className="col-center stk-num font-semibold">
                                    {filteredOrders.reduce((acc, curr) => acc + curr.qty, 0)}
                                  </td>
                                  <td className="col-right text-slate-500 text-xs">รวมเงิน</td>
                                  <td className="col-right stk-num font-bold text-emerald-800 text-sm">
                                    {formatMoney(
                                      filteredOrders.reduce((acc, curr) => acc + curr.sumPrice, 0),
                                      true
                                    )}
                                  </td>
                                  <td />
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="stk-modal-footer">
              <button
                type="button"
                className="stk-btn stk-btn-secondary"
                onClick={() => {
                  setSelectedItem(null)
                  setOrderFilter('all')
                  setOrderSearch('')
                }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
