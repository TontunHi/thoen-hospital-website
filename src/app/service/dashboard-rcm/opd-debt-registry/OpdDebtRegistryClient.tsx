'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Activity,
  Wallet,
  CreditCard,
  ShieldCheck,
  FileText,
  Search,
  X,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ReceiptText,
  BarChart3,
  Table2,
} from 'lucide-react'
import type {
  OpdDebtRegistryResult,
  OpdDebtRegistryItem,
  OpdDebtSummary,
  OpdDebtCardFilter,
  OpdDebtSortField,
  OpdDebtBreakdownType,
  OpdDebtGroupBreakdownRow,
} from '@/lib/clinical/rcmOpdDebtRegistryService'
import type { VnClinicalDetails } from '@/lib/clinical/rcmDashboardService'
import { formatThaiDate } from '@/lib/formatters'
import { exportRcmExcel } from '@/lib/clinical/rcmExcelExport'
import {
  RcmCommandHeader,
  RcmErrorBanner,
  RcmKpiStrip,
  RcmHorizontalRankedChart,
  RcmRankedListCard,
  type RcmKpiTile,
  type HorizontalBarDatum,
  type RankedListItem,
} from '../_components/RcmDashboardPrimitives'
import {
  getAvailableFiscalYears,
  getCurrentFiscalYearCe,
  getFiscalYearDateBounds,
  getMonthDateBounds,
} from '../_components/rcmDateRangeUtils'
import '../_components/dashboard-design.css'
import './page.css'

export interface OpdDebtRegistryClientProps {
  initialData?: OpdDebtRegistryResult | null
  initialRange?: { startDate: string; endDate: string }
  initialError?: string | null
}

const DEFAULT_SUMMARY: OpdDebtSummary = {
  totalCases: 0,
  totalVisits: 0,
  totalIncome: 0,
  totalUcMoney: 0,
  totalDiscountMoney: 0,
  totalPaidMoney: 0,
  totalRcptMoney: 0,
  totalDebit: 0,
  withDebitCount: 0,
  withRcptCount: 0,
  withAuthenCount: 0,
  withoutAuthenCount: 0,
  authenRate: 0,
}

const formatInt = (n?: number | null) => (n ?? 0).toLocaleString('th-TH')
const formatMoney = (n?: number | null) =>
  (n ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatMoneyOrDash(n?: number | null): string {
  if (n == null || n === 0) return '—'
  return formatMoney(n)
}

interface QueryState {
  ds1: string
  ds2: string
  includeAdmitted: boolean
  cardFilter: OpdDebtCardFilter
  eclaimFilter: string
  accountFilter: string
  pttypeFilter: string
  vstdateFilter: string
  search: string
  sortBy: OpdDebtSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}

/**
 * 2.1.1.3 รายชื่อผู้ป่วยนอก รับบริการ (ทะเบียนตั้งหนี้)
 * Follows OpenDesigner (DESIGN.md + RULES N-01), Unslop, and RCM 5-Pillar Data Flow.
 */
export default function OpdDebtRegistryClient({
  initialData = null,
  initialRange,
  initialError = null,
}: OpdDebtRegistryClientProps) {
  const today = useMemo(() => new Date(), [])
  const defaultFiscalCeYear = useMemo(() => getCurrentFiscalYearCe(today), [today])
  const defaultBounds = useMemo(
    () => initialRange || getFiscalYearDateBounds(defaultFiscalCeYear),
    [initialRange, defaultFiscalCeYear]
  )

  const [dateMode, setDateMode] = useState<'custom' | 'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedBeYear, setSelectedBeYear] = useState<number>(today.getFullYear() + 543)
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(defaultFiscalCeYear)

  const availableYears = useMemo(
    () => getAvailableFiscalYears(defaultFiscalCeYear),
    [defaultFiscalCeYear]
  )

  // Atomic query state — every filter/date/sort change resets page: 1 in one transition
  const [query, setQuery] = useState<QueryState>(() => ({
    ds1: initialData?.ds1 || defaultBounds.startDate,
    ds2: initialData?.ds2 || defaultBounds.endDate,
    includeAdmitted: initialData?.includeAdmitted ?? false,
    cardFilter: initialData?.cardFilter ?? 'ALL',
    eclaimFilter: initialData?.eclaimFilter ?? '',
    accountFilter: initialData?.accountFilter ?? '',
    pttypeFilter: initialData?.pttypeFilter ?? '',
    vstdateFilter: initialData?.vstdateFilter ?? '',
    search: initialData?.search ?? '',
    sortBy: initialData?.sortBy ?? 'vstdate',
    sortOrder: initialData?.sortOrder ?? 'desc',
    page: initialData?.page ?? 1,
    pageSize: initialData?.pageSize ?? 50,
  }))

  const [searchInput, setSearchInput] = useState<string>(initialData?.search ?? '')

  // Data states
  const [data, setData] = useState<OpdDebtRegistryResult | null>(initialData)
  const [loading, setLoading] = useState<boolean>(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(Boolean(initialData))
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(initialError)

  // Analytical Breakdown SubReport state (replaces FoxPro right-click ShowSubReport)
  const [breakdownTab, setBreakdownTab] = useState<OpdDebtBreakdownType>('account')
  const [breakdownView, setBreakdownView] = useState<'chart' | 'table'>('chart')

  // Lazy Detail Modal states
  const [selectedItem, setSelectedItem] = useState<OpdDebtRegistryItem | null>(null)
  const [modalTab, setModalTab] = useState<'finance' | 'clinical'>('finance')
  const [vnDetails, setVnDetails] = useState<VnClinicalDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const detailCacheRef = useRef<Map<string, VnClinicalDetails>>(new Map())
  const isFirstMount = useRef<boolean>(true)

  // Debounce global search (300ms) -> atomic page: 1 reset
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === query.search) return
    const timer = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search: trimmed, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, query.search])

  const buildSearchParams = useCallback((q: QueryState, extra?: { refresh?: boolean; exportAll?: boolean }) => {
    const sp = new URLSearchParams({
      ds1: q.ds1,
      ds2: q.ds2,
      includeAdmitted: String(q.includeAdmitted),
      cardFilter: q.cardFilter,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
      page: String(q.page),
      pageSize: String(q.pageSize),
    })
    if (q.eclaimFilter) sp.set('eclaimFilter', q.eclaimFilter)
    if (q.accountFilter) sp.set('accountFilter', q.accountFilter)
    if (q.pttypeFilter) sp.set('pttypeFilter', q.pttypeFilter)
    if (q.vstdateFilter) sp.set('vstdateFilter', q.vstdateFilter)
    if (q.search) sp.set('search', q.search)
    if (extra?.refresh) sp.set('refresh', 'true')
    if (extra?.exportAll) sp.set('exportAll', 'true')
    return sp
  }, [])

  const fetchData = useCallback(
    async (q: QueryState, forceRefresh = false) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)
      try {
        const sp = buildSearchParams(q, { refresh: forceRefresh })
        const res = await fetch(`/api/service/dashboard-rcm/opd-debt-registry?${sp.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || json.error || 'ไม่สามารถดึงข้อมูลทะเบียนตั้งหนี้ได้')
        }
        setData(json.data as OpdDebtRegistryResult)
        setHasLoadedOnce(true)
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [buildSearchParams]
  )

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (initialData) return
    }
    fetchData(query)
    return () => {
      abortRef.current?.abort()
    }
  }, [query, fetchData, initialData])

  // Date Mode Handlers (Atomic updates)
  const handleSelectMonth = (month: number, beYear = selectedBeYear) => {
    setSelectedMonth(month)
    setSelectedBeYear(beYear)
    const ceYear = beYear - 543
    const bounds = getMonthDateBounds(ceYear, month)
    setQuery((prev) => ({ ...prev, ds1: bounds.startDate, ds2: bounds.endDate, vstdateFilter: '', page: 1 }))
  }

  const handleSelectFiscalYear = (fiscalCeYear: number) => {
    setSelectedFiscalYear(fiscalCeYear)
    const bounds = getFiscalYearDateBounds(fiscalCeYear)
    setQuery((prev) => ({ ...prev, ds1: bounds.startDate, ds2: bounds.endDate, vstdateFilter: '', page: 1 }))
  }

  const handleDateModeChange = (mode: 'custom' | 'month' | 'year') => {
    setDateMode(mode)
    if (mode === 'month') handleSelectMonth(selectedMonth, selectedBeYear)
    else if (mode === 'year') handleSelectFiscalYear(selectedFiscalYear)
  }

  // Modal Lazy Clinical Details Fetch + 50-item Map Cache
  const loadClinicalDetails = useCallback(async (vn: string) => {
    const cached = detailCacheRef.current.get(vn)
    if (cached) {
      setVnDetails(cached)
      setDetailsError(null)
      return
    }

    detailAbortRef.current?.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller

    setLoadingDetails(true)
    setDetailsError(null)
    try {
      const res = await fetch(
        `/api/service/dashboard-rcm/opd-debt-registry/vn-details?vn=${encodeURIComponent(vn)}`,
        { signal: controller.signal }
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ไม่สามารถดึงข้อมูลเวชระเบียนได้')
      }
      const details = json.data as VnClinicalDetails
      if (detailCacheRef.current.size >= 50) {
        const firstKey = detailCacheRef.current.keys().next().value
        if (firstKey) detailCacheRef.current.delete(firstKey)
      }
      detailCacheRef.current.set(vn, details)
      setVnDetails(details)
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setDetailsError(err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลเวชระเบียนได้')
    } finally {
      if (!controller.signal.aborted) {
        setLoadingDetails(false)
      }
    }
  }, [])

  const openModal = (item: OpdDebtRegistryItem) => {
    setSelectedItem(item)
    setModalTab('finance')
    setVnDetails(detailCacheRef.current.get(item.vn) || null)
    setDetailsError(null)
  }

  const closeModal = () => {
    detailAbortRef.current?.abort()
    setSelectedItem(null)
    setVnDetails(null)
    setDetailsError(null)
  }

  useEffect(() => {
    if (!selectedItem) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedItem])

  const handleModalTab = (tab: 'finance' | 'clinical') => {
    setModalTab(tab)
    if (tab === 'clinical' && selectedItem) {
      loadClinicalDetails(selectedItem.vn)
    }
  }

  const copyValue = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    }
  }

  // Export All Excel (.xlsx)
  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const sp = buildSearchParams(query, { exportAll: true })
      const res = await fetch(`/api/service/dashboard-rcm/opd-debt-registry?${sp.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'ส่งออกไฟล์ไม่สำเร็จ')
      }
      const fullResult = json.data as OpdDebtRegistryResult
      const headers = [
        'ลำดับ',
        'VN',
        'AN',
        'HN',
        'เลขบัตรประชาชน (CID)',
        'ชื่อ-สกุล',
        'วันที่รับบริการ',
        'เวลา',
        'ประเภทบริการย่อย',
        'Authen Code',
        'วิธี Authen',
        'รหัส e-Claim',
        'สิทธิการเงิน (e-Claim)',
        'รหัสสิทธิ',
        'HIPDATA',
        'ชื่อสิทธิ',
        'GFMIS',
        'รหัสผังบัญชี',
        'ชื่อผังบัญชี',
        'ห้องตรวจ/แผนก',
        'คลินิก',
        'PDX',
        'ค่ารักษา (Income)',
        'สิทธิเบิก (UC)',
        'ส่วนลด (Discount)',
        'ยอดต้องชำระ (Paid)',
        'ชำระเงินสด (Rcpt)',
        'ตั้งหนี้คงเหลือ (Debit)',
        'เพดานตั้งหนี้ (Max Debt)',
        'เลขที่ใบเสร็จ',
        'วันที่ออกใบเสร็จ',
      ]

      const rows = (fullResult.items || []).map((it, idx) => [
        idx + 1,
        it.vn,
        it.an || '',
        it.hn,
        it.cid,
        it.ptname,
        it.vstdate ? formatThaiDate(it.vstdate) : '',
        it.vsttime || '',
        it.ptsubtype || '',
        it.authencode || '',
        it.authenMethod || '',
        it.pttype_eclaim_id || '',
        it.pttype_eclaim_name || '',
        it.pttype || '',
        it.hipdata_code || '',
        it.pttypename || '',
        it.gfmis || '',
        it.accountcode || '',
        it.accountname || '',
        it.department || '',
        it.clinic || '',
        it.pdx || '',
        it.income ?? 0,
        it.uc_money ?? 0,
        it.discount_money ?? 0,
        it.paid_money ?? 0,
        it.rcpt_money ?? 0,
        it.debit ?? 0,
        it.max_debt_amount ?? '',
        it.rcpno || '',
        it.rcpnodate || '',
      ])

      const sumIncome = fullResult.items.reduce((a, r) => a + (r.income ?? 0), 0)
      const sumUc = fullResult.items.reduce((a, r) => a + (r.uc_money ?? 0), 0)
      const sumDiscount = fullResult.items.reduce((a, r) => a + (r.discount_money ?? 0), 0)
      const sumPaid = fullResult.items.reduce((a, r) => a + (r.paid_money ?? 0), 0)
      const sumRcpt = fullResult.items.reduce((a, r) => a + (r.rcpt_money ?? 0), 0)
      const sumDebit = fullResult.items.reduce((a, r) => a + (r.debit ?? 0), 0)

      await exportRcmExcel({
        filename: `opd_debt_registry_${query.ds1}_to_${query.ds2}.xlsx`,
        title: '2.1.1.3 รายชื่อผู้ป่วยนอก รับบริการ (ทะเบียนตั้งหนี้)',
        subtitle: `ช่วงวันที่ ${formatThaiDate(query.ds1)} ถึง ${formatThaiDate(query.ds2)} | ${query.includeAdmitted ? 'บริการทั้งหมด (รวม Admit)' : 'เฉพาะผู้ป่วยนอก (ไม่รวม Admit)'}`,
        headers,
        rows,
        summaryRows: [
          [
            '',
            '',
            '',
            '',
            '',
            `รวม (${fullResult.items.length.toLocaleString('th-TH')} รายการ)`,
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            sumIncome,
            sumUc,
            sumDiscount,
            sumPaid,
            sumRcpt,
            sumDebit,
            '', '', '',
          ],
        ],
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถส่งออกไฟล์ Excel ได้')
    } finally {
      setIsExporting(false)
    }
  }

  const summary = data?.summary ?? DEFAULT_SUMMARY
  const breakdowns = data?.breakdowns ?? { account: [], eclaim: [], pttype: [], vstdate: [] }
  const items = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const isStale = loading && hasLoadedOnce
  const isInitialSkeleton = loading && !hasLoadedOnce

  // KPI Strip (5 hairline-divided tiles)
  const kpiTiles = useMemo<RcmKpiTile[]>(
    () => [
      {
        id: 'visits',
        label: 'ครั้งรับบริการ (VN)',
        value: formatInt(summary.totalVisits),
        context: `${formatInt(summary.totalCases)} คน (HN)`,
        tooltip: 'จำนวนครั้งที่มารับบริการทั้งหมด — คลิกเพื่อแสดงทุกรายการ',
        icon: <Activity size={15} strokeWidth={1.5} />,
        tone: 'accent',
        interactive: true,
        selected: query.cardFilter === 'ALL',
        onClick: () => setQuery((prev) => ({ ...prev, cardFilter: 'ALL', page: 1 })),
      },
      {
        id: 'income',
        label: 'ค่ารักษาพยาบาลรวม',
        value: `฿${formatMoney(summary.totalIncome)}`,
        context: `สิทธิเบิก ฿${formatMoney(summary.totalUcMoney)}`,
        tooltip: 'ผลรวมค่ารักษาพยาบาลทั้งหมดตาม vn_stat.income',
        icon: <FileText size={15} strokeWidth={1.5} />,
        tone: 'neutral',
      },
      {
        id: 'rcpt',
        label: 'ชำระเอง / ใบเสร็จ',
        value: `฿${formatMoney(summary.totalRcptMoney)}`,
        context: `${formatInt(summary.withRcptCount)} ครั้ง · ส่วนลด ฿${formatMoney(summary.totalDiscountMoney)}`,
        tooltip: 'คลิกเพื่อกรองเฉพาะรายการที่มีการชำระเงินสด/ออกใบเสร็จ',
        icon: <CreditCard size={15} strokeWidth={1.5} />,
        tone: 'money',
        interactive: true,
        selected: query.cardFilter === 'WITH_RCPT',
        onClick: () =>
          setQuery((prev) => ({
            ...prev,
            cardFilter: prev.cardFilter === 'WITH_RCPT' ? 'ALL' : 'WITH_RCPT',
            page: 1,
          })),
      },
      {
        id: 'debit',
        label: 'ยอดตั้งหนี้คงเหลือ (Debit)',
        value: `฿${formatMoney(summary.totalDebit)}`,
        context: `${formatInt(summary.withDebitCount)} ครั้งที่มียอดตั้งหนี้`,
        tooltip: 'คลิกเพื่อกรองเฉพาะรายการที่มียอดตั้งหนี้คงเหลือ (income - discount - rcpt > 0)',
        icon: <Wallet size={15} strokeWidth={1.5} />,
        tone: 'warn',
        isAlert: (summary.totalDebit ?? 0) > 0,
        interactive: true,
        selected: query.cardFilter === 'WITH_DEBIT',
        onClick: () =>
          setQuery((prev) => ({
            ...prev,
            cardFilter: prev.cardFilter === 'WITH_DEBIT' ? 'ALL' : 'WITH_DEBIT',
            page: 1,
          })),
      },
      {
        id: 'authen',
        label: 'ยืนยันตัวตน (Authen)',
        value: `${(summary.authenRate ?? 0).toFixed(1)}%`,
        context: `มี ${formatInt(summary.withAuthenCount)} · ไม่มี ${formatInt(summary.withoutAuthenCount)}`,
        tooltip: 'คลิกเพื่อสลับกรองรายการที่ยังไม่มี Authen Code',
        icon: <ShieldCheck size={15} strokeWidth={1.5} />,
        tone: 'accent',
        interactive: true,
        selected: query.cardFilter === 'WITH_AUTHEN' || query.cardFilter === 'NO_AUTHEN',
        onClick: () =>
          setQuery((prev) => ({
            ...prev,
            cardFilter:
              prev.cardFilter === 'NO_AUTHEN'
                ? 'WITH_AUTHEN'
                : prev.cardFilter === 'WITH_AUTHEN'
                  ? 'ALL'
                  : 'NO_AUTHEN',
            page: 1,
          })),
      },
    ],
    [summary, query.cardFilter]
  )

  // Active Breakdown Data (ShowSubReport parity)
  const activeBreakdownRows: OpdDebtGroupBreakdownRow[] = useMemo(() => {
    if (breakdownTab === 'account') return breakdowns.account
    if (breakdownTab === 'eclaim') return breakdowns.eclaim
    if (breakdownTab === 'pttype') return breakdowns.pttype
    return breakdowns.vstdate
  }, [breakdownTab, breakdowns])

  const selectedBreakdownCode = useMemo(() => {
    if (breakdownTab === 'account') return query.accountFilter || null
    if (breakdownTab === 'eclaim') return query.eclaimFilter || null
    if (breakdownTab === 'pttype') return query.pttypeFilter || null
    return query.vstdateFilter || null
  }, [breakdownTab, query.accountFilter, query.eclaimFilter, query.pttypeFilter, query.vstdateFilter])

  const handleSelectBreakdownCode = useCallback(
    (code: string) => {
      if (!code || code === '__others__') return
      setQuery((prev) => {
        if (breakdownTab === 'account') {
          return { ...prev, accountFilter: prev.accountFilter === code ? '' : code, page: 1 }
        }
        if (breakdownTab === 'eclaim') {
          return { ...prev, eclaimFilter: prev.eclaimFilter === code ? '' : code, page: 1 }
        }
        if (breakdownTab === 'pttype') {
          return { ...prev, pttypeFilter: prev.pttypeFilter === code ? '' : code, page: 1 }
        }
        return { ...prev, vstdateFilter: prev.vstdateFilter === code ? '' : code, page: 1 }
      })
    },
    [breakdownTab]
  )

  const breakdownChartBars = useMemo<HorizontalBarDatum[]>(() => {
    const sorted = [...activeBreakdownRows].sort((a, b) => (b.debit ?? 0) - (a.debit ?? 0))
    const totalDebitBase = sorted.reduce((acc, r) => acc + Math.max(0, r.debit ?? 0), 0)
    const top = sorted.slice(0, 10)
    const rest = sorted.slice(10)

    const mapped: HorizontalBarDatum[] = top.map((r) => {
      const label =
        breakdownTab === 'vstdate'
          ? formatThaiDate(r.code)
          : breakdownTab === 'account'
            ? r.name
            : r.code !== 'NONE'
              ? `${r.code} · ${r.name}`
              : r.name
      return {
        id: r.code,
        label,
        value: Math.max(0, r.debit ?? 0),
        secondaryText: `${formatInt(r.visits)} ครั้ง · ค่ารักษา ฿${formatMoney(r.income)}`,
        sharePct: totalDebitBase > 0 ? (Math.max(0, r.debit ?? 0) / totalDebitBase) * 100 : 0,
      }
    })

    if (rest.length > 0) {
      const restDebit = rest.reduce((acc, r) => acc + Math.max(0, r.debit ?? 0), 0)
      const restVisits = rest.reduce((acc, r) => acc + (r.visits ?? 0), 0)
      mapped.push({
        id: '__others__',
        label: `กลุ่มอื่นๆ (${rest.length})`,
        value: restDebit,
        secondaryText: `${formatInt(restVisits)} ครั้ง`,
        sharePct: totalDebitBase > 0 ? (restDebit / totalDebitBase) * 100 : 0,
      })
    }

    return mapped
  }, [activeBreakdownRows, breakdownTab])

  // Right 5-col Ranked List: Top e-Claim / Account groups by Debit
  const rankedEclaimItems = useMemo<RankedListItem[]>(() => {
    const base = breakdowns.eclaim.reduce((acc, r) => acc + Math.max(0, r.debit ?? 0), 0)
    return breakdowns.eclaim.slice(0, 12).map((r) => ({
      id: r.code,
      name: r.code !== 'NONE' ? `${r.code} · ${r.name}` : r.name,
      value: Math.max(0, r.debit ?? 0),
      valueLabel: `฿${formatMoney(r.debit)}`,
      sharePct: base > 0 ? (Math.max(0, r.debit ?? 0) / base) * 100 : 0,
      tooltip: `${r.name}: ${formatInt(r.cases)} คน / ${formatInt(r.visits)} ครั้ง · ตั้งหนี้ ฿${formatMoney(r.debit)}`,
    }))
  }, [breakdowns.eclaim])

  const hasActiveFilters = Boolean(
    query.cardFilter !== 'ALL' ||
      query.eclaimFilter ||
      query.accountFilter ||
      query.pttypeFilter ||
      query.vstdateFilter ||
      query.search ||
      query.includeAdmitted
  )

  const clearAllFilters = () => {
    setSearchInput('')
    setQuery((prev) => ({
      ...prev,
      includeAdmitted: false,
      cardFilter: 'ALL',
      eclaimFilter: '',
      accountFilter: '',
      pttypeFilter: '',
      vstdateFilter: '',
      search: '',
      page: 1,
    }))
  }

  const handleSort = (field: OpdDebtSortField) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
      page: 1,
    }))
  }

  const renderSortIcon = (field: OpdDebtSortField) => {
    if (query.sortBy !== field) return <ArrowUpDown size={12} style={{ opacity: 0.45 }} />
    return query.sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const beYearOptions = useMemo(() => {
    const curBe = today.getFullYear() + 543
    return Array.from({ length: 6 }, (_, i) => curBe + 1 - i)
  }, [today])

  return (
    <div className="dd-page">
      <RcmCommandHeader
        code="2.1.1.3"
        title="รายชื่อผู้ป่วยนอก รับบริการ (ทะเบียนตั้งหนี้)"
        icon={<ReceiptText size={17} strokeWidth={1.5} />}
        dateMode={dateMode}
        onDateModeChange={handleDateModeChange}
        ds1={query.ds1}
        ds2={query.ds2}
        onDs1Change={(val) =>
          setQuery((prev) => ({ ...prev, ds1: val, vstdateFilter: '', page: 1 }))
        }
        onDs2Change={(val) =>
          setQuery((prev) => ({ ...prev, ds2: val, vstdateFilter: '', page: 1 }))
        }
        selectedMonth={selectedMonth}
        onSelectMonth={(m) => handleSelectMonth(m, selectedBeYear)}
        monthYearBe={selectedBeYear}
        selectedYear={selectedFiscalYear}
        availableYears={availableYears}
        onSelectFiscalYear={handleSelectFiscalYear}
        loading={loading || isExporting}
        exportDisabled={totalCount === 0}
        onRefresh={() => fetchData(query, true)}
        onExport={handleExport}
        extraToolbarSlot={
          <>
            {dateMode === 'month' && (
              <select
                aria-label="เลือกปี พ.ศ."
                value={selectedBeYear}
                onChange={(e) => handleSelectMonth(selectedMonth, Number(e.target.value))}
                className="dd-select dd-tnum"
              >
                {beYearOptions.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            )}
            <label
              className={`odr-toggle-pill ${query.includeAdmitted ? 'is-active' : ''}`}
              title="แสดงรวมผู้ป่วยนอกที่มีการรับไว้เป็นผู้ป่วยใน (Admit)"
            >
              <input
                type="checkbox"
                checked={query.includeAdmitted}
                onChange={(e) =>
                  setQuery((prev) => ({ ...prev, includeAdmitted: e.target.checked, page: 1 }))
                }
              />
              <span>บริการทั้งหมด</span>
            </label>
          </>
        }
      />

      <RcmErrorBanner error={error} onRetry={() => fetchData(query, true)} />

      <div
        className={isStale ? 'dd-stale' : ''}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {/* 1. 5-Tile Hairline KPI Strip */}
        <RcmKpiStrip tiles={kpiTiles} loading={isInitialSkeleton} />

        {/* 2. Analytical 12-Col Split: Sub-report Breakdown (7 cols) + Ranked e-Claim (5 cols) */}
        <div className="dd-main-grid">
          {(() => {
            const breakdownControls = (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                <div className="dd-segmented" role="tablist" aria-label="มุมมองสรุปรายกลุ่ม">
                  {(
                    [
                      { key: 'account', label: 'ผังบัญชี' },
                      { key: 'eclaim', label: 'e-Claim' },
                      { key: 'pttype', label: 'สิทธิ HOSxP' },
                      { key: 'vstdate', label: 'รายวัน' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={breakdownTab === t.key}
                      onClick={() => setBreakdownTab(t.key)}
                      className={`dd-seg-btn ${breakdownTab === t.key ? 'active' : ''}`}
                      style={{ padding: '0.22rem 0.55rem', fontSize: 12 }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="dd-segmented" role="group" aria-label="รูปแบบการแสดงผลสรุป">
                  <button
                    type="button"
                    onClick={() => setBreakdownView('chart')}
                    className={`dd-seg-btn ${breakdownView === 'chart' ? 'active' : ''}`}
                    style={{ padding: '0.22rem 0.5rem', fontSize: 12 }}
                    title="แสดงเป็นกราฟแท่งจัดอันดับ"
                    aria-label="มุมมองกราฟ"
                  >
                    <BarChart3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownView('table')}
                    className={`dd-seg-btn ${breakdownView === 'table' ? 'active' : ''}`}
                    style={{ padding: '0.22rem 0.5rem', fontSize: 12 }}
                    title="แสดงเป็นตารางสรุปแบบละเอียด"
                    aria-label="มุมมองตาราง"
                  >
                    <Table2 size={14} />
                  </button>
                </div>
              </div>
            )

            if (breakdownView === 'chart') {
              return (
                <RcmHorizontalRankedChart
                  kicker={
                    breakdownTab === 'account'
                      ? '10 อันดับสิทธิผังบัญชีตามยอดตั้งหนี้ (คลิกเพื่อกรอง)'
                      : breakdownTab === 'eclaim'
                        ? '10 อันดับสิทธิการเงิน e-Claim ตามยอดตั้งหนี้ (คลิกเพื่อกรอง)'
                        : breakdownTab === 'pttype'
                          ? '10 อันดับสิทธิ HOSxP ตามยอดตั้งหนี้ (คลิกเพื่อกรอง)'
                          : '10 อันดับวันที่ตรวจตามยอดตั้งหนี้ (คลิกเพื่อกรอง)'
                  }
                  headline={`฿${formatMoney(summary.totalDebit)}`}
                  data={breakdownChartBars}
                  hue="money"
                  unit="บาท"
                  loading={isInitialSkeleton}
                  selectedId={selectedBreakdownCode}
                  onSelectBar={handleSelectBreakdownCode}
                  headerAction={breakdownControls}
                />
              )
            }

            return (
              <section className="dd-panel" aria-label="สรุปทะเบียนตั้งหนี้ตามหมวดหมู่">
                <div className="dd-panel-header">
                  <div>
                    <div className="dd-panel-kicker">
                      ตารางสรุปแยกตามหมวดหมู่ ({activeBreakdownRows.length} กลุ่ม · คลิกแถวเพื่อกรอง)
                    </div>
                    <div className="dd-panel-headline">฿{formatMoney(summary.totalDebit)}</div>
                  </div>
                  {breakdownControls}
                </div>

                <div className="odr-subtable-wrap">
                  <table className="dd-table">
                    <thead>
                      <tr>
                        {breakdownTab !== 'account' && <th className="is-left">รหัส</th>}
                        <th className="is-left">
                          {breakdownTab === 'account' ? 'ชื่อผังบัญชี' : 'ชื่อกลุ่ม'}
                        </th>
                        {breakdownTab === 'account' && <th className="is-left">GFMIS</th>}
                        <th>คน (HN)</th>
                        <th>ครั้ง (VN)</th>
                        <th>ค่ารักษา</th>
                        <th>ส่วนลด</th>
                        <th>ชำระเอง</th>
                        <th>ตั้งหนี้</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBreakdownRows.length === 0 ? (
                        <tr>
                          <td colSpan={8}>
                            <div className="dd-empty-box">
                              <p className="dd-empty-title">ไม่มีข้อมูลสรุปในช่วงเวลาที่เลือก</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        activeBreakdownRows.map((row) => {
                          const isSelected = selectedBreakdownCode === row.code
                          return (
                            <tr
                              key={row.code}
                              onClick={() => handleSelectBreakdownCode(row.code)}
                              className={`odr-clickable-row ${isSelected ? 'is-highlighted' : ''}`}
                              title="คลิกเพื่อกรองรายชื่อผู้ป่วยในกลุ่มนี้"
                            >
                              {breakdownTab !== 'account' && (
                                <td className="is-left dd-tnum" style={{ fontWeight: 600 }}>
                                  {breakdownTab === 'vstdate' ? formatThaiDate(row.code) : row.code}
                                </td>
                              )}
                              <td className="is-left">
                                <span className="odr-ellipsis" title={row.name}>
                                  {breakdownTab === 'vstdate' ? formatThaiDate(row.name) : row.name}
                                </span>
                              </td>
                              {breakdownTab === 'account' && (
                                <td className="is-left dd-tnum">{row.gfmis || '—'}</td>
                              )}
                              <td>{formatInt(row.cases)}</td>
                              <td>{formatInt(row.visits)}</td>
                              <td>{formatMoney(row.income)}</td>
                              <td>{formatMoneyOrDash(row.discount_money)}</td>
                              <td>{formatMoneyOrDash(row.rcpt_money)}</td>
                              <td
                                className={
                                  row.debit > 0 ? 'odr-debit-positive' : 'dd-muted-zero'
                                }
                              >
                                {formatMoney(row.debit)}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })()}

          <RcmRankedListCard
            title="สิทธิการเงิน (e-Claim) ยอดตั้งหนี้สูงสุด"
            metricLabel="คลิกแถวเพื่อกรองเฉพาะสิทธิ e-Claim นั้น"
            items={rankedEclaimItems}
            hue="money"
            selectedId={query.eclaimFilter || null}
            onSelect={(code) =>
              setQuery((prev) => ({
                ...prev,
                eclaimFilter: prev.eclaimFilter === code ? '' : code,
                page: 1,
              }))
            }
            initialLimit={7}
          />
        </div>

        {/* 3. Active Filter Chips */}
        {hasActiveFilters && (
          <div className="dd-filter-chips" aria-label="ตัวกรองที่ใช้งานอยู่">
            {query.includeAdmitted && (
              <span className="dd-chip">
                <span>รวมเคส Admit</span>
                <button
                  type="button"
                  className="dd-chip-remove"
                  aria-label="ปิดการรวมเคส Admit"
                  onClick={() => setQuery((p) => ({ ...p, includeAdmitted: false, page: 1 }))}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {query.cardFilter !== 'ALL' && (
              <span className="dd-chip">
                <span>
                  สถานะ:{' '}
                  {query.cardFilter === 'WITH_DEBIT'
                    ? 'มียอดตั้งหนี้'
                    : query.cardFilter === 'WITH_RCPT'
                      ? 'มีใบเสร็จรับเงิน'
                      : query.cardFilter === 'WITH_AUTHEN'
                        ? 'มี Authen Code'
                        : 'ไม่มี Authen Code'}
                </span>
                <button
                  type="button"
                  className="dd-chip-remove"
                  aria-label="ลบตัวกรองสถานะ"
                  onClick={() => setQuery((p) => ({ ...p, cardFilter: 'ALL', page: 1 }))}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {query.eclaimFilter && (
              <span className="dd-chip">
                <span>e-Claim: {query.eclaimFilter}</span>
                <button
                  type="button"
                  className="dd-chip-remove"
                  aria-label="ลบตัวกรอง e-Claim"
                  onClick={() => setQuery((p) => ({ ...p, eclaimFilter: '', page: 1 }))}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {query.accountFilter && (
              <span className="dd-chip">
                <span>
                  ผังบัญชี:{' '}
                  {breakdowns.account.find((g) => g.code === query.accountFilter)?.name ||
                    query.accountFilter}
                </span>
                <button
                  type="button"
                  className="dd-chip-remove"
                  aria-label="ลบตัวกรองผังบัญชี"
                  onClick={() => setQuery((p) => ({ ...p, accountFilter: '', page: 1 }))}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {query.pttypeFilter && (
              <span className="dd-chip">
                <span>สิทธิ HOSxP: {query.pttypeFilter}</span>
                <button
                  type="button"
                  className="dd-chip-remove"
                  aria-label="ลบตัวกรองสิทธิ"
                  onClick={() => setQuery((p) => ({ ...p, pttypeFilter: '', page: 1 }))}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {query.vstdateFilter && (
              <span className="dd-chip">
                <span>วันที่ตรวจ: {formatThaiDate(query.vstdateFilter)}</span>
                <button
                  type="button"
                  className="dd-chip-remove"
                  aria-label="ลบตัวกรองวันที่ตรวจ"
                  onClick={() => setQuery((p) => ({ ...p, vstdateFilter: '', page: 1 }))}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <button type="button" onClick={clearAllFilters} className="dd-chip-clear">
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}

        {/* 4. Main Patient Debt Ledger Table (Bounded 50 rows/page) */}
        <section className="dd-table-card" aria-label="ตารางรายชื่อผู้ป่วยนอก ทะเบียนตั้งหนี้">
          <div className="dd-table-toolbar">
            <div>
              <h2 className="dd-panel-title">
                ทะเบียนตั้งหนี้รายบุคคล ({formatInt(totalCount)} รายการ)
              </h2>
              <div className="dd-panel-kicker">
                คลิกที่แถวเพื่อดูรายละเอียดทางการเงินและข้อมูลคลินิก (OPD Screen / Diag / Orders)
              </div>
            </div>

            <div className="dd-table-controls">
              <select
                aria-label="กรองตามสิทธิ e-Claim"
                value={query.eclaimFilter}
                onChange={(e) =>
                  setQuery((prev) => ({ ...prev, eclaimFilter: e.target.value, page: 1 }))
                }
                className="odr-filter-select"
              >
                <option value="">ทุกสิทธิ e-Claim ({breakdowns.eclaim.length})</option>
                {breakdowns.eclaim.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code !== 'NONE' ? `${g.code} · ${g.name}` : g.name} ({formatInt(g.visits)})
                  </option>
                ))}
              </select>

              <select
                aria-label="กรองตามผังบัญชี"
                value={query.accountFilter}
                onChange={(e) =>
                  setQuery((prev) => ({ ...prev, accountFilter: e.target.value, page: 1 }))
                }
                className="odr-filter-select"
              >
                <option value="">ทุกผังบัญชี ({breakdowns.account.length})</option>
                {breakdowns.account.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.name} ({formatInt(g.visits)})
                  </option>
                ))}
              </select>

              <select
                aria-label="กรองตามสถานะตั้งหนี้และ Authen"
                value={query.cardFilter}
                onChange={(e) =>
                  setQuery((prev) => ({
                    ...prev,
                    cardFilter: e.target.value as OpdDebtCardFilter,
                    page: 1,
                  }))
                }
                className="odr-filter-select"
              >
                <option value="ALL">สถานะ: ทั้งหมด</option>
                <option value="WITH_DEBIT">เฉพาะมียอดตั้งหนี้ (Debit &gt; 0)</option>
                <option value="WITH_RCPT">เฉพาะมีใบเสร็จ (Rcpt &gt; 0)</option>
                <option value="WITH_AUTHEN">มี Authen Code</option>
                <option value="NO_AUTHEN">ไม่มี Authen Code</option>
              </select>

              <div className="dd-search-wrap">
                <Search size={14} className="dd-search-icon" />
                <input
                  type="text"
                  placeholder="ค้นหา HN, VN, CID, ชื่อ, ใบเสร็จ..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="dd-search-input"
                  aria-label="ค้นหารายชื่อผู้ป่วยนอก"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setQuery((prev) => ({ ...prev, search: '', page: 1 }))
                    }}
                    className="dd-search-clear"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="dd-table-scroll">
            <table className="dd-table">
              <thead>
                <tr>
                  <th className="is-center" style={{ width: 50 }}>
                    #
                  </th>
                  <th
                    className="is-left is-sortable"
                    aria-sort={
                      query.sortBy === 'vstdate'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('vstdate')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      วันที่รับบริการ {renderSortIcon('vstdate')}
                    </span>
                  </th>
                  <th
                    className="is-left is-sortable"
                    aria-sort={
                      query.sortBy === 'hn'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('hn')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      HN / VN {renderSortIcon('hn')}
                    </span>
                  </th>
                  <th
                    className="is-left is-sortable"
                    aria-sort={
                      query.sortBy === 'ptname'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('ptname')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ผู้รับบริการ / CID {renderSortIcon('ptname')}
                    </span>
                  </th>
                  <th className="is-left">Authen Code</th>
                  <th
                    className="is-left is-sortable"
                    aria-sort={
                      query.sortBy === 'pttype_eclaim_id'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('pttype_eclaim_id')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      สิทธิ e-Claim / HOSxP {renderSortIcon('pttype_eclaim_id')}
                    </span>
                  </th>
                  <th
                    className="is-left is-sortable"
                    aria-sort={
                      query.sortBy === 'accountcode'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('accountcode')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ผังบัญชี / GFMIS {renderSortIcon('accountcode')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    aria-sort={
                      query.sortBy === 'income'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('income')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ค่ารักษา {renderSortIcon('income')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    aria-sort={
                      query.sortBy === 'uc_money'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('uc_money')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      สิทธิเบิก {renderSortIcon('uc_money')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    aria-sort={
                      query.sortBy === 'discount_money'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('discount_money')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ส่วนลด {renderSortIcon('discount_money')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    aria-sort={
                      query.sortBy === 'rcpt_money'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('rcpt_money')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ชำระเงินสด {renderSortIcon('rcpt_money')}
                    </span>
                  </th>
                  <th
                    className="is-sortable"
                    aria-sort={
                      query.sortBy === 'debit'
                        ? query.sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onClick={() => handleSort('debit')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ตั้งหนี้ (Debit) {renderSortIcon('debit')}
                    </span>
                  </th>
                  <th className="is-left">เลขใบเสร็จ / วันที่</th>
                </tr>
              </thead>

              <tbody>
                {isInitialSkeleton ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={13}>
                        <div className="dd-skeleton" style={{ height: 22, width: '100%' }} />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="dd-empty-box">
                        <AlertCircle size={22} />
                        <p className="dd-empty-title">ไม่พบรายการผู้รับบริการตามเงื่อนไขที่เลือก</p>
                        <p className="dd-empty-desc">
                          ลองขยายช่วงเวลา หรือล้างตัวกรองผังบัญชี / สิทธิ e-Claim
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.vn}
                      tabIndex={0}
                      onClick={() => openModal(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openModal(item)
                        }
                      }}
                      className="odr-clickable-row"
                    >
                      <td className="is-center" style={{ color: 'var(--dd-muted)' }}>
                        {item.no}
                      </td>
                      <td className="is-left">
                        <div className="odr-subcell-primary dd-tnum">
                          {item.vstdate ? formatThaiDate(item.vstdate) : '—'}
                        </div>
                        <div className="odr-subcell-meta dd-tnum">
                          {item.vsttime || '—'}
                          {item.ptsubtype ? ` · ${item.ptsubtype}` : ''}
                        </div>
                      </td>
                      <td className="is-left">
                        <div className="odr-subcell-primary dd-tnum">{item.hn}</div>
                        <div className="odr-subcell-meta dd-tnum">
                          VN: {item.vn}
                          {item.an ? (
                            <span
                              className="odr-badge odr-badge-warn"
                              style={{ marginLeft: 4, fontSize: 10.5 }}
                            >
                              AN: {item.an}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="is-left">
                        <div className="odr-subcell-primary">{item.ptname || '—'}</div>
                        <div className="odr-subcell-meta dd-tnum">
                          {item.cid || '—'}
                          {item.pdx ? ` · Dx: ${item.pdx}` : ''}
                        </div>
                      </td>
                      <td className="is-left">
                        {item.authencode ? (
                          <span className="odr-badge odr-badge-money dd-tnum">
                            {item.authencode}
                          </span>
                        ) : (
                          <span className="odr-badge odr-badge-danger">ไม่มี Authen</span>
                        )}
                      </td>
                      <td className="is-left">
                        <div className="odr-subcell-primary">
                          <span className="odr-ellipsis" title={item.pttype_eclaim_name}>
                            {item.pttype_eclaim_id
                              ? `${item.pttype_eclaim_id} · ${item.pttype_eclaim_name}`
                              : 'ไม่ระบุ e-Claim'}
                          </span>
                        </div>
                        <div className="odr-subcell-meta">
                          <span className="odr-ellipsis" title={item.pttypename}>
                            {item.pttype}
                            {item.hipdata_code ? ` (${item.hipdata_code})` : ''} · {item.pttypename}
                          </span>
                        </div>
                      </td>
                      <td className="is-left">
                        <div className="odr-subcell-primary">
                          <span className="odr-ellipsis" title={item.accountname || item.accountcode}>
                            {item.accountname || '—'}
                          </span>
                        </div>
                        {item.gfmis ? (
                          <div className="odr-subcell-meta dd-tnum">
                            <span className="odr-badge odr-badge-neutral">{item.gfmis}</span>
                          </div>
                        ) : null}
                      </td>
                      <td>{formatMoney(item.income)}</td>
                      <td>{formatMoneyOrDash(item.uc_money)}</td>
                      <td>{formatMoneyOrDash(item.discount_money)}</td>
                      <td>{formatMoneyOrDash(item.rcpt_money)}</td>
                      <td className={(item.debit ?? 0) > 0 ? 'odr-debit-positive' : 'dd-muted-zero'}>
                        {formatMoney(item.debit)}
                      </td>
                      <td className="is-left">
                        {item.rcpno ? (
                          <>
                            <div className="odr-subcell-primary dd-tnum">
                              <span className="odr-ellipsis" title={item.rcpno}>
                                {item.rcpno}
                              </span>
                            </div>
                            <div className="odr-subcell-meta dd-tnum">
                              {item.rcpnodate || '—'}
                            </div>
                          </>
                        ) : (
                          <span className="dd-muted-zero">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {!isInitialSkeleton && items.length > 0 && !hasActiveFilters && (
                <tfoot>
                  <tr className="dd-total-row">
                    <td className="is-center">รวม</td>
                    <td className="is-left" colSpan={6}>
                      ทั้งช่วงเวลา ({formatInt(summary.totalVisits)} ครั้ง ·{' '}
                      {formatInt(summary.totalCases)} คน)
                    </td>
                    <td>{formatMoney(summary.totalIncome)}</td>
                    <td>{formatMoney(summary.totalUcMoney)}</td>
                    <td>{formatMoney(summary.totalDiscountMoney)}</td>
                    <td>{formatMoney(summary.totalRcptMoney)}</td>
                    <td>{formatMoney(summary.totalDebit)}</td>
                    <td className="is-left">—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Server-Side Bounded Pagination */}
          <div className="odr-pagination">
            <div className="dd-tnum">
              แสดง{' '}
              <b>
                {totalCount === 0 ? 0 : (query.page - 1) * query.pageSize + 1}–
                {Math.min(query.page * query.pageSize, totalCount)}
              </b>{' '}
              จากทั้งหมด <b>{formatInt(totalCount)}</b> รายการ (หน้า {query.page} / {totalPages})
            </div>

            <div className="odr-pagination-actions">
              <button
                type="button"
                className="odr-page-btn"
                disabled={loading || query.page <= 1}
                onClick={() => setQuery((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                aria-label="หน้าก่อนหน้า"
              >
                <ChevronLeft size={14} />
                <span>ก่อนหน้า</span>
              </button>
              <button
                type="button"
                className="odr-page-btn"
                disabled={loading || query.page >= totalPages}
                onClick={() =>
                  setQuery((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }))
                }
                aria-label="หน้าถัดไป"
              >
                <span>ถัดไป</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Lazy Detail Modal (0ms Financial Overview + On-Demand Clinical Details) */}
      {selectedItem && (
        <div
          className="odr-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="odr-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="odr-modal">
            <div className="odr-modal-header">
              <div>
                <h3 id="odr-modal-title" className="odr-modal-title">
                  {selectedItem.ptname || 'รายละเอียดผู้รับบริการ'}
                </h3>
                <div className="odr-modal-sub dd-tnum">
                  HN: {selectedItem.hn} · VN: {selectedItem.vn}
                  {selectedItem.an ? ` · AN: ${selectedItem.an}` : ''} ·{' '}
                  {selectedItem.vstdate ? formatThaiDate(selectedItem.vstdate) : '—'}{' '}
                  {selectedItem.vsttime}
                </div>
              </div>
              <button
                type="button"
                className="odr-page-btn"
                onClick={closeModal}
                aria-label="ปิดหน้าต่างรายละเอียด"
              >
                <X size={15} />
              </button>
            </div>

            <div className="odr-modal-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={modalTab === 'finance'}
                onClick={() => handleModalTab('finance')}
                className={`dd-seg-btn ${modalTab === 'finance' ? 'active' : ''}`}
              >
                ทะเบียนตั้งหนี้และใบเสร็จ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modalTab === 'clinical'}
                onClick={() => handleModalTab('clinical')}
                className={`dd-seg-btn ${modalTab === 'clinical' ? 'active' : ''}`}
              >
                ข้อมูลคลินิก (OPD Screen / Diag / Orders)
              </button>
            </div>

            <div className="odr-modal-body">
              {modalTab === 'finance' ? (
                <>
                  <div className="odr-finance-strip">
                    <div className="odr-finance-cell">
                      <div className="odr-finance-cell-label">ค่ารักษาทั้งหมด (Income)</div>
                      <div className="odr-finance-cell-val">
                        ฿{formatMoney(selectedItem.income)}
                      </div>
                    </div>
                    <div className="odr-finance-cell">
                      <div className="odr-finance-cell-label">สิทธิประกัน (UC Money)</div>
                      <div className="odr-finance-cell-val">
                        ฿{formatMoney(selectedItem.uc_money)}
                      </div>
                    </div>
                    <div className="odr-finance-cell">
                      <div className="odr-finance-cell-label">ส่วนลด (Discount)</div>
                      <div className="odr-finance-cell-val">
                        ฿{formatMoney(selectedItem.discount_money)}
                      </div>
                    </div>
                    <div className="odr-finance-cell">
                      <div className="odr-finance-cell-label">ยอดต้องชำระ (Paid Money)</div>
                      <div className="odr-finance-cell-val">
                        ฿{formatMoney(selectedItem.paid_money)}
                      </div>
                    </div>
                    <div className="odr-finance-cell">
                      <div className="odr-finance-cell-label">ชำระเงินสด (Rcpt Money)</div>
                      <div className="odr-finance-cell-val" style={{ color: 'var(--dd-money)' }}>
                        ฿{formatMoney(selectedItem.rcpt_money)}
                      </div>
                    </div>
                    <div className="odr-finance-cell">
                      <div className="odr-finance-cell-label">ตั้งหนี้คงเหลือ (Debit)</div>
                      <div
                        className="odr-finance-cell-val"
                        style={{
                          color: (selectedItem.debit ?? 0) > 0 ? 'var(--dd-down)' : 'var(--dd-ink)',
                        }}
                      >
                        ฿{formatMoney(selectedItem.debit)}
                      </div>
                    </div>
                  </div>

                  <div className="odr-detail-grid">
                    <div className="odr-detail-box">
                      <h4 className="odr-detail-box-title">ข้อมูลผู้ป่วยและการยืนยันตัวตน</h4>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">เลขบัตรประชาชน (CID)</span>
                        <span className="odr-kv-val dd-tnum">
                          {selectedItem.cid || '—'}
                          {selectedItem.cid && (
                            <button
                              type="button"
                              className="odr-copy-btn"
                              onClick={() => copyValue(selectedItem.cid, 'cid')}
                              aria-label="คัดลอกเลขบัตรประชาชน"
                            >
                              {copiedKey === 'cid' ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">Authen Code</span>
                        <span className="odr-kv-val dd-tnum">
                          {selectedItem.authencode || 'ไม่มี Authen'}
                          {selectedItem.authencode && (
                            <button
                              type="button"
                              className="odr-copy-btn"
                              onClick={() => copyValue(selectedItem.authencode!, 'authen')}
                              aria-label="คัดลอก Authen Code"
                            >
                              {copiedKey === 'authen' ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">ประเภทบริการย่อย</span>
                        <span className="odr-kv-val">{selectedItem.ptsubtype || '—'}</span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">ห้องตรวจ / คลินิก</span>
                        <span className="odr-kv-val">
                          {[selectedItem.department, selectedItem.clinic]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">PDX</span>
                        <span className="odr-kv-val dd-tnum">{selectedItem.pdx || '—'}</span>
                      </div>
                    </div>

                    <div className="odr-detail-box">
                      <h4 className="odr-detail-box-title">สิทธิ ผังบัญชี และใบเสร็จรับเงิน</h4>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">สิทธิ e-Claim</span>
                        <span className="odr-kv-val">
                          {selectedItem.pttype_eclaim_id
                            ? `${selectedItem.pttype_eclaim_id} · ${selectedItem.pttype_eclaim_name}`
                            : '—'}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">สิทธิ HOSxP</span>
                        <span className="odr-kv-val">
                          {selectedItem.pttype} · {selectedItem.pttypename || '—'}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">ผังบัญชี / GFMIS</span>
                        <span className="odr-kv-val dd-tnum">
                          {selectedItem.accountcode || '—'}
                          {selectedItem.gfmis ? ` (GFMIS: ${selectedItem.gfmis})` : ''}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">ชื่อบัญชี</span>
                        <span className="odr-kv-val">{selectedItem.accountname || '—'}</span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">เพดานตั้งหนี้ (Max Debt)</span>
                        <span className="odr-kv-val dd-tnum">
                          {selectedItem.max_debt_amount != null
                            ? `฿${formatMoney(selectedItem.max_debt_amount)}`
                            : '—'}
                        </span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">เลขที่ใบเสร็จ</span>
                        <span className="odr-kv-val dd-tnum">{selectedItem.rcpno || '—'}</span>
                      </div>
                      <div className="odr-kv-row">
                        <span className="odr-kv-label">วันที่ออกใบเสร็จ</span>
                        <span className="odr-kv-val dd-tnum">
                          {selectedItem.rcpnodate || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : loadingDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div className="dd-skeleton" style={{ height: 64, width: '100%' }} />
                  <div className="dd-skeleton" style={{ height: 120, width: '100%' }} />
                </div>
              ) : detailsError ? (
                <RcmErrorBanner
                  error={detailsError}
                  onRetry={() => loadClinicalDetails(selectedItem.vn)}
                />
              ) : !vnDetails ? (
                <div className="dd-empty-box">
                  <p className="dd-empty-title">ไม่พบรายละเอียดทางคลินิกเพิ่มเติม</p>
                </div>
              ) : (
                <>
                  {vnDetails.screen && (
                    <div className="odr-detail-box">
                      <h4 className="odr-detail-box-title">OPD Screen & Vital Signs</h4>
                      <div style={{ fontSize: 13, color: 'var(--dd-ink)' }}>
                        <div>
                          <b>อาการสำคัญ (CC):</b> {vnDetails.screen.cc || '—'}
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--dd-ink-2)' }} className="dd-tnum">
                          BP: {vnDetails.screen.bps ?? '—'}/{vnDetails.screen.bpd ?? '—'} · Pulse:{' '}
                          {vnDetails.screen.pulse ?? '—'} · Temp: {vnDetails.screen.temperature ?? '—'} ·
                          BW: {vnDetails.screen.bw ?? '—'} kg
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="odr-detail-box">
                    <h4 className="odr-detail-box-title">
                      การวินิจฉัยโรค ({vnDetails.diagnoses.length})
                    </h4>
                    {vnDetails.diagnoses.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--dd-muted)' }}>ไม่มีข้อมูล ICD-10</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {vnDetails.diagnoses.map((dx, i) => (
                          <div key={`${dx.icd10}-${i}`} className="odr-kv-row">
                            <span className="dd-tnum" style={{ fontWeight: 600 }}>
                              {dx.icd10} · {dx.icd_name}
                            </span>
                            <span className="odr-badge odr-badge-neutral">{dx.diagtype_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="odr-detail-box">
                    <h4 className="odr-detail-box-title">
                      รายการค่าใช้จ่าย / ยา / แล็บ ({vnDetails.orders.items.length} รายการ · รวม ฿
                      {formatMoney(vnDetails.orders.total_price)})
                    </h4>
                    {vnDetails.orders.categories.map((cat) => (
                      <div key={cat.category_group} style={{ marginTop: 4 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--dd-ink-2)',
                            marginBottom: 4,
                          }}
                        >
                          {cat.title} (฿{formatMoney(cat.total_price)})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {cat.items.map((ord, idx) => (
                            <div key={`${ord.icode}-${idx}`} className="odr-kv-row" style={{ fontSize: 12.5 }}>
                              <span>
                                {ord.item_name} × {ord.qty} {ord.units || ''}
                              </span>
                              <span className="dd-tnum">฿{formatMoney(ord.sum_price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
