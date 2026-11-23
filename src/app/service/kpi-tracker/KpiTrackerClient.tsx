'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Lock,
  Search,
  FileSpreadsheet,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  X,
  Calculator,
  AlertTriangle,
  Building2,
  ShieldCheck,
  ChevronDown,
  UploadCloud,
  AlertCircle,
  Hash,
  Layers,
  FileText,
  Check,
  History
} from 'lucide-react'
import readXlsxFile from 'read-excel-file/universal'
import { parseKpiRows, ParsedKpiRow } from '@/lib/kpi/kpiExcelParser'
import { KpiIndicatorItem, KpiTopicItem, KpiDashboardStats } from '@/lib/kpi/kpiService'
import type { KpiAiAuditItem } from '@/lib/kpi/kpiAuditService'
import { getPeriodsForFrequency, checkPeriodStatus, checkIndicatorDueStatus, IndicatorDueStatus, isIndicatorAnsweredForPeriod, matchesPeriodKey, isPercentageIndicator, isRateIndicator, calculateIndicatorResult, formatKpiResultValue, formatKpiDecimal, formatKpiNumber, shouldDisplayPerThousandDays, IndicatorMetricMeta } from '@/lib/kpi/kpiTimeUtils'
import './kpi-tracker.css'

import {
  type CurrentUser,
  formatThaiDate,
  formatThaiDateTime,
  formatAnswerDisplay,
  formatAiAuditNumbers,
  getAiAuditStatusLabel,
  evaluateTargetClient,
} from './kpiTrackerHelpers'
import { KpiAnswerAndHistoryModals } from './components/KpiAnswerAndHistoryModals'
import { KpiManageAndExportModals } from './components/KpiManageAndExportModals'
import { KpiCategoryFilter, KpiIndicatorRow } from './components/KpiCategoryFilterAndRow'
export function KpiTrackerClient({ currentUser }: { currentUser: CurrentUser }) {
  // Topics & Fiscal Years
  const [fiscalYears, setFiscalYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [topics, setTopics] = useState<KpiTopicItem[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)

  // Indicators Data & Filters
  const [indicators, setIndicators] = useState<KpiIndicatorItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categoryMultiSelectOpen, setCategoryMultiSelectOpen] = useState<boolean>(false)
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('')
  const categoryMultiSelectRef = useRef<HTMLDivElement>(null)
  const [selectedFrequency, setSelectedFrequency] = useState<string>('ALL')
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [selectedFilledStatus, setSelectedFilledStatus] = useState<'ALL' | 'FILLED' | 'UNFILLED'>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'MY' | 'DUE' | 'AI_MISMATCH'>('ALL')
  const [sortField, setSortField] = useState<'sequence' | 'title' | 'frequency' | 'status'>('sequence')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 250)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Stats & State
  const [stats, setStats] = useState<KpiDashboardStats | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [exporting, setExporting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modals
  const [answerModalOpen, setAnswerModalOpen] = useState<boolean>(false)
  const [editIndicatorModalOpen, setEditIndicatorModalOpen] = useState<boolean>(false)
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false)
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)
  const [exportScope, setExportScope] = useState<'ALL' | 'DUE'>('ALL')
  const [exportTopicId, setExportTopicId] = useState<number | null>(null)
  const [exportCategory, setExportCategory] = useState<string>('ALL')
  const [exportPeriodKey, setExportPeriodKey] = useState<string>('ALL')
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false)
  const [historyIndicator, setHistoryIndicator] = useState<KpiIndicatorItem | null>(null)
  const [activeIndicator, setActiveIndicator] = useState<KpiIndicatorItem | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false)

  // Answer Form State (Simplified as requested: 1 answer input if no num/den, NO notes field)
  const [formPeriodKey, setFormPeriodKey] = useState<string>('')
  const [formPeriodLabel, setFormPeriodLabel] = useState<string>('')
  const [formNumerator, setFormNumerator] = useState<string>('')
  const [formDenominator, setFormDenominator] = useState<string>('')
  const [formSingleAnswer, setFormSingleAnswer] = useState<string>('')
  const [formCalcMode, setFormCalcMode] = useState<'percentage' | 'ratio'>('percentage')

  // Edit / Create Indicator Form State (Full Columns A - N)
  const [indFormSequence, setIndFormSequence] = useState<string>('')
  const [indFormCategory, setIndFormCategory] = useState<string>('หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)')
  const [indFormSubcategory, setIndFormSubcategory] = useState<string>('')
  const [indFormCode, setIndFormCode] = useState<string>('')
  const [indFormOldCode, setIndFormOldCode] = useState<string>('')
  const [indFormFrequency, setIndFormFrequency] = useState<string>('ราย 6 เดือน')
  const [indFormTitle, setIndFormTitle] = useState<string>('')
  const [indFormNumeratorName, setIndFormNumeratorName] = useState<string>('')
  const [indFormDenominatorName, setIndFormDenominatorName] = useState<string>('')
  const [indFormTargetOp, setIndFormTargetOp] = useState<string>('>=')
  const [indFormTargetVal, setIndFormTargetVal] = useState<string>('')
  const [indFormTargetUnit, setIndFormTargetUnit] = useState<string>('%')
  const [indFormTargetRaw, setIndFormTargetRaw] = useState<string>('')
  const [indFormTargetRawDirty, setIndFormTargetRawDirty] = useState<boolean>(false)
  const [indFormResponsible, setIndFormResponsible] = useState<string>('')
  const [indFormType, setIndFormType] = useState<string>('HA')

  // Dynamic current Thai fiscal year (Starts 1 Oct)
  const defaultFiscalYear = useMemo(() => {
    const now = new Date()
    const beYear = now.getFullYear() + 543
    return String(now.getMonth() + 1 >= 10 ? beYear + 1 : beYear)
  }, [])

  // Import Form State (Dynamically populated, no hardcoded topic codes)
  const [importYear, setImportYear] = useState<string>(() => {
    const now = new Date()
    const beYear = now.getFullYear() + 543
    return String(now.getMonth() + 1 >= 10 ? beYear + 1 : beYear)
  })
  const [importCode, setImportCode] = useState<string>('')
  const [importTitle, setImportTitle] = useState<string>('')
  const [importDesc, setImportDesc] = useState<string>('')
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importIndicators, setImportIndicators] = useState<ParsedKpiRow[]>([])
  const [importParsing, setImportParsing] = useState<boolean>(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState<boolean>(false)

  // 1. Fetch Topics & Years
  const fetchTopics = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/kpi/topics')
      const json = await res.json()
      if (json.success) {
        const fyList = json.data.fiscalYears || []
        const topicList = json.data.topics || []
        setFiscalYears(fyList)
        setTopics(topicList)

        if (fyList.length > 0) {
          if (!selectedYear || !fyList.includes(selectedYear)) {
            const firstYear = fyList[0]
            setSelectedYear(firstYear)
            const firstTopic = topicList.find((t: KpiTopicItem) => t.fiscalYear === firstYear)
            if (firstTopic) setSelectedTopicId(firstTopic.id)
            else setSelectedTopicId(null)
          }
        } else {
          setSelectedYear('')
          setSelectedTopicId(null)
          setIndicators([])
          setStats(null)
        }
      }
    } catch (err: any) {
      setErrorMsg('ไม่สามารถโหลดข้อมูลชุดตัวชี้วัดได้: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  // 2. Fetch Indicators & Stats
  const fetchIndicatorsAndStats = useCallback(async () => {
    if (!selectedTopicId) return
    try {
      setLoading(true)
      setErrorMsg(null)

      const queryParams = new URLSearchParams({
        topicId: String(selectedTopicId),
      })
      if (selectedYear) queryParams.set('fiscalYear', selectedYear)
      if (selectedPeriodKey !== 'ALL') queryParams.set('periodKey', selectedPeriodKey)

      const [indRes, statsRes] = await Promise.all([
        fetch(`/api/kpi/indicators?${queryParams.toString()}`),
        fetch(`/api/kpi/stats?topicId=${selectedTopicId}${selectedPeriodKey !== 'ALL' ? `&periodKey=${selectedPeriodKey}` : ''}`)
      ])

      const indJson = await indRes.json()
      const statsJson = await statsRes.json()

      if (indJson.success) {
        setIndicators(indJson.data.indicators)
        setCategories(indJson.data.categories)
      }
      if (statsJson.success) {
        setStats(statsJson.data)
      }
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูลตัวชี้วัด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedTopicId, selectedYear, selectedPeriodKey])

  useEffect(() => {
    fetchIndicatorsAndStats()
  }, [fetchIndicatorsAndStats])

  // Helper: check if current user is the responsible person for an indicator
  const isUserResponsible = useCallback((ind: KpiIndicatorItem) => {
    const userName = (currentUser.name || currentUser.username || '').trim()
    const resp = (ind.responsibleName || '').trim()
    if (!userName || !resp) return false
    return (
      resp.includes(userName) || 
      userName.includes(resp) ||
      resp.split(/[,/&+\s]+/).some(part => part && (userName.includes(part) || part.includes(userName)))
    )
  }, [currentUser])

  const isKpiManager = useMemo(() => {
    return Boolean(
      currentUser.isAdmin || 
      currentUser.permissions?.includes('manage_kpi')
    )
  }, [currentUser])

  // Check if current user has permission to answer this indicator
  const canAnswerIndicator = useCallback((ind: KpiIndicatorItem) => {
    // 1. Admin or KPI Manager can always answer
    if (isKpiManager) return true

    // 2. Non-admin must be the responsible person
    if (!isUserResponsible(ind)) return false

    // 3. Must be within unlocked reporting window
    const dueStatus = checkIndicatorDueStatus(ind.frequency, selectedYear)
    return dueStatus.isDueNow
  }, [isKpiManager, isUserResponsible, selectedYear])

  // Check if current user is allowed to edit indicator definitions (Admin & Manage KPI)
  const canEditIndicator = useCallback((_ind: KpiIndicatorItem) => {
    return isKpiManager
  }, [isKpiManager])

  // Check if current user is allowed to delete indicator (Admin & Manage KPI)
  const canDeleteIndicator = useCallback((_ind: KpiIndicatorItem) => {
    return isKpiManager
  }, [isKpiManager])

  // Get active entry for current tracking period (only shows answer of current round, does not show old round answer)
  const getActivePeriodEntry = useCallback((ind: KpiIndicatorItem): any => {
    if (selectedPeriodKey !== 'ALL') {
      const match = ind.entries?.find(e => matchesPeriodKey(e.periodKey, selectedPeriodKey))
      if (match) return match
    }
    return ind.currentEntry || null
  }, [selectedPeriodKey])

  // Helper to determine indicator evaluated status consistently across badges, filters, and stats summary
  const getIndicatorStatus = useCallback((ind: KpiIndicatorItem): 'PASS' | 'FAIL' | 'PENDING' | 'WAITING_TARGET' => {
    const entry = getActivePeriodEntry(ind)
    const hasNumDen = Boolean(
      entry &&
      entry.numeratorValue !== null &&
      entry.denominatorValue !== null &&
      entry.numeratorValue !== undefined &&
      entry.denominatorValue !== undefined
    )
    const hasResult = Boolean(
      entry && (
        entry.resultValue !== null ||
        (entry.resultText && entry.resultText.trim() !== '' && entry.resultText !== 'ไม่มีรายงาน') ||
        hasNumDen
      )
    )

    if (!entry || !hasResult || entry.resultText === 'ไม่มีรายงาน') {
      return 'PENDING'
    }

    // 0/0 is treated as PASS (no cases / target not violated)
    if (hasNumDen && entry.numeratorValue === 0 && entry.denominatorValue === 0) {
      return 'PASS'
    }

    if (entry.status === 'PASS') {
      return 'PASS'
    }
    if (entry.status === 'FAIL') {
      return 'FAIL'
    }
    if (entry.status === 'WAITING_TARGET') {
      return 'WAITING_TARGET'
    }

    if (entry.status === 'PENDING' && !hasNumDen) {
      return 'PENDING'
    }

    const isPct = isPercentageIndicator(ind)
    const val = entry.resultValue !== null && entry.resultValue !== undefined
      ? entry.resultValue
      : (hasNumDen && entry.denominatorValue > 0 ? calculateIndicatorResult(entry.numeratorValue, entry.denominatorValue, isPct) : null)

    if (val === null || val === undefined) {
      return 'PENDING'
    }

    return evaluateTargetClient(val, ind.targetOperator, ind.targetValue)
  }, [getActivePeriodEntry])


  // Count of indicators due now or within 5 days
  const dueIndicatorsCount = useMemo(() => {
    return indicators.filter(ind => {
      const dueStatus = checkIndicatorDueStatus(ind.frequency, selectedYear)
      return dueStatus.isDue
    }).length
  }, [indicators, selectedYear])

  // Multi-Select Category Logic: Close on outside click or Escape
  useEffect(() => {
    if (!categoryMultiSelectOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryMultiSelectRef.current && !categoryMultiSelectRef.current.contains(e.target as Node)) {
        setCategoryMultiSelectOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCategoryMultiSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [categoryMultiSelectOpen])

  // Count indicators per category
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    indicators.forEach(ind => {
      if (ind.category) {
        map.set(ind.category, (map.get(ind.category) || 0) + 1)
      }
    })
    return map
  }, [indicators])

  // Group categories into Strategic Issues, HA Quality Categories, and Other
  const categoryGroups = useMemo(() => {
    const defaultStrategies = [
      'ยุทธศาสตร์ที่1',
      'ยุทธศาสตร์ที่2',
      'ยุทธศาสตร์ที่3',
      'ยุทธศาสตร์ที่4',
      'ยุทธศาสตร์ที่5'
    ]
    const defaultHa = [
      'หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)',
      'หมวดที่ 2: IV-2 ด้านการมุ่งเน้นผู้ป่วยและผู้รับผลงาน',
      'หมวดที่ 3: IV-3 ด้านบุคลากร',
      'หมวดที่ 4: IV-4 ด้านการนำและการกำกับดูแล',
      'หมวดที่ 5: IV-5 ด้านระบบงานสำคัญ',
      'หมวดที่ 6: IV-6 ด้านการเงิน'
    ]

    const uniqueCats = new Set<string>()
    categories.forEach(c => c && uniqueCats.add(c))
    indicators.forEach(i => i.category && uniqueCats.add(i.category))

    const strategySet = new Set<string>()
    defaultStrategies.forEach(s => strategySet.add(s))
    uniqueCats.forEach(c => {
      if (c.includes('ยุทธศาสตร์')) {
        strategySet.add(c)
      }
    })

    const haSet = new Set<string>()
    defaultHa.forEach(h => haSet.add(h))
    uniqueCats.forEach(c => {
      if (c.startsWith('หมวดที่') || c.startsWith('หมวด ') || c.startsWith('หมวด')) {
        haSet.add(c)
      }
    })

    const otherSet = new Set<string>()
    uniqueCats.forEach(c => {
      if (!strategySet.has(c) && !haSet.has(c)) {
        otherSet.add(c)
      }
    })

    const strategyList = Array.from(strategySet)
    const haList = Array.from(haSet)
    const otherList = Array.from(otherSet)
    const allList = Array.from(new Set([...strategyList, ...haList, ...otherList]))

    return {
      strategy: strategyList,
      ha: haList,
      other: otherList,
      all: allList
    }
  }, [categories, indicators])

  // Filtered categories based on search input inside popover
  const filteredCategoryGroups = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase()
    if (!q) {
      return categoryGroups
    }
    return {
      strategy: categoryGroups.strategy.filter(c => c.toLowerCase().includes(q)),
      ha: categoryGroups.ha.filter(c => c.toLowerCase().includes(q)),
      other: categoryGroups.other.filter(c => c.toLowerCase().includes(q)),
      all: categoryGroups.all.filter(c => c.toLowerCase().includes(q))
    }
  }, [categoryGroups, categorySearchQuery])

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat)
      } else {
        return [...prev, cat]
      }
    })
  }, [])

  const selectAllCategories = useCallback(() => {
    setSelectedCategories(categoryGroups.all)
  }, [categoryGroups.all])

  const clearAllCategories = useCallback(() => {
    setSelectedCategories([])
  }, [])

  const toggleGroupCategories = useCallback((groupItems: string[]) => {
    setSelectedCategories(prev => {
      const allSelected = groupItems.length > 0 && groupItems.every(item => prev.includes(item))
      if (allSelected) {
        return prev.filter(c => !groupItems.includes(c))
      } else {
        const set = new Set([...prev, ...groupItems])
        return Array.from(set)
      }
    })
  }, [])

  // Filtered & Sorted Indicators (Default sorted by sequence number)
  const displayedIndicators = useMemo(() => {
    const filtered = indicators.filter(ind => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(ind.category)) {
        return false
      }
      if (selectedFrequency !== 'ALL' && ind.frequency !== selectedFrequency) {
        return false
      }
      if (activeTab === 'MY') {
        const userName = currentUser.name || currentUser.username
        const resp = ind.responsibleName || ''
        if (!resp.includes(userName) && !userName.includes(resp)) {
          return false
        }
      }
      if (activeTab === 'DUE') {
        const dueStatus = checkIndicatorDueStatus(ind.frequency, selectedYear)
        if (!dueStatus.isDue) {
          return false
        }
      }
      if (activeTab === 'AI_MISMATCH') {
        const audit = ind.aiAudit
        if (!audit || audit.status !== 'MISMATCH') {
          return false
        }
      }
      if (selectedStatus !== 'ALL') {
        const indStatus = getIndicatorStatus(ind)
        if (indStatus !== selectedStatus) {
          return false
        }
      }
      if (selectedFilledStatus !== 'ALL') {
        const dueStatus = checkIndicatorDueStatus(ind.frequency, selectedYear)
        const isAnswered = isIndicatorAnsweredForPeriod(ind, dueStatus.relevantPeriod.key)
        if (selectedFilledStatus === 'FILLED' && !isAnswered) {
          return false
        }
        if (selectedFilledStatus === 'UNFILLED' && isAnswered) {
          return false
        }
      }
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.toLowerCase()
        const matchesTitle = ind.title.toLowerCase().includes(term)
        const matchesCode = (ind.code || '').toLowerCase().includes(term)
        const matchesSubcat = (ind.subcategory || '').toLowerCase().includes(term)
        const matchesResp = (ind.responsibleName || '').toLowerCase().includes(term)
        if (!matchesTitle && !matchesCode && !matchesSubcat && !matchesResp) {
          return false
        }
      }
      return true
    })

    return filtered.sort((a, b) => {
      if (sortField === 'sequence') {
        const seqA = (a.sequence || '').trim()
        const seqB = (b.sequence || '').trim()
        if (!seqA && !seqB) {
          return (a.displayOrder - b.displayOrder || a.id - b.id) * (sortOrder === 'asc' ? 1 : -1)
        }
        if (!seqA) return 1
        if (!seqB) return -1
        const cmp = seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' })
        if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp
        return (a.displayOrder - b.displayOrder || a.id - b.id) * (sortOrder === 'asc' ? 1 : -1)
      }
      if (sortField === 'title') {
        const cmp = a.title.localeCompare(b.title, 'th')
        return sortOrder === 'asc' ? cmp : -cmp
      }
      if (sortField === 'frequency') {
        const cmp = a.frequency.localeCompare(b.frequency, 'th')
        return sortOrder === 'asc' ? cmp : -cmp
      }
      if (sortField === 'status') {
        const stA = getIndicatorStatus(a)
        const stB = getIndicatorStatus(b)
        const cmp = stA.localeCompare(stB)
        return sortOrder === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [indicators, selectedCategories, selectedFrequency, activeTab, selectedStatus, selectedFilledStatus, selectedYear, debouncedSearch, currentUser, sortField, sortOrder, getIndicatorStatus])

  // Check if any filter is currently applied
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      selectedCategories.length > 0 ||
      selectedFrequency !== 'ALL' ||
      selectedStatus !== 'ALL' ||
      selectedFilledStatus !== 'ALL' ||
      debouncedSearch.trim() ||
      activeTab !== 'ALL'
    )
  }, [selectedCategories.length, selectedFrequency, selectedStatus, selectedFilledStatus, debouncedSearch, activeTab])

  // Stats Summary per design.md (ทั้งหมด / ไม่มีรายงาน / ยังไม่ระบุสถานะ) - dynamically calculates based on active filters
  const statsSummary = useMemo(() => {
    if (loading && indicators.length === 0 && stats) {
      return {
        total: stats.totalIndicators ?? 0,
        noReport: stats.totalPending ?? 0,
        unspecified: stats.totalWaitingTarget ?? 0,
      }
    }

    let noReport = 0
    let unspecified = 0

    displayedIndicators.forEach(ind => {
      const indStatus = getIndicatorStatus(ind)
      if (indStatus === 'PENDING') {
        noReport++
      } else if (indStatus === 'WAITING_TARGET') {
        unspecified++
      }
    })

    return {
      total: displayedIndicators.length,
      noReport,
      unspecified,
    }
  }, [displayedIndicators, loading, indicators.length, stats, getIndicatorStatus])

  // Calculation for Answer Modal (if numerator and denominator exist)
  const computedPercentage = useMemo(() => {
    const numStr = formNumerator.trim()
    const denStr = formDenominator.trim()
    if (numStr === '' || denStr === '') return null

    const num = parseFloat(numStr)
    const den = parseFloat(denStr)
    if (isNaN(num) || isNaN(den)) return null

    return calculateIndicatorResult(num, den, formCalcMode === 'percentage')
  }, [formNumerator, formDenominator, formCalcMode])

  // Target preview evaluation in Answer Modal
  const liveEvaluationStatus = useMemo(() => {
    if (!activeIndicator) return 'PENDING'
    const hasNumDen = Boolean(activeIndicator.numeratorName || activeIndicator.denominatorName)
    const val = hasNumDen ? computedPercentage : (formSingleAnswer ? parseFloat(formSingleAnswer) : null)
    if (val === null || isNaN(val)) return 'PENDING'

    if (hasNumDen) {
      const num = parseFloat(formNumerator.trim())
      const den = parseFloat(formDenominator.trim())
      if (num === 0 && den === 0) {
        return 'PASS'
      }
    }

    const op = activeIndicator.targetOperator || '>='
    const target = activeIndicator.targetValue

    if (target === null || target === undefined) {
      if (op === 'MIN') return val === 0 ? 'PASS' : 'WAITING_TARGET'
      return 'WAITING_TARGET'
    }

    if (op === '>=') return val >= target ? 'PASS' : 'FAIL'
    if (op === '<=') return val <= target ? 'PASS' : 'FAIL'
    if (op === '>') return val > target ? 'PASS' : 'FAIL'
    if (op === '<') return val < target ? 'PASS' : 'FAIL'
    if (op === '=') return Math.abs(val - target) < 1e-6 ? 'PASS' : 'FAIL'
    if (op === 'MIN') return val <= target ? 'PASS' : 'FAIL'
    return 'WAITING_TARGET'
  }, [activeIndicator, computedPercentage, formSingleAnswer, formNumerator, formDenominator])

  // Open Answer Modal
  const handleOpenAnswer = (ind: KpiIndicatorItem) => {
    setActiveIndicator(ind)
    const isPct = isPercentageIndicator(ind)
    setFormCalcMode(isPct ? 'percentage' : 'ratio')
    const dueStatus = checkIndicatorDueStatus(ind.frequency, selectedYear)
    const defaultPeriod = dueStatus.relevantPeriod
    setFormPeriodKey(defaultPeriod.key)
    setFormPeriodLabel(defaultPeriod.label)

    const entry = ind.entries?.find(e => matchesPeriodKey(e.periodKey, defaultPeriod.key)) || (ind.currentEntry && matchesPeriodKey(ind.currentEntry.periodKey, defaultPeriod.key) ? ind.currentEntry : null)
    if (entry) {
      setFormNumerator(entry.numeratorValue !== null ? String(entry.numeratorValue) : '')
      setFormDenominator(entry.denominatorValue !== null ? String(entry.denominatorValue) : '')
      setFormSingleAnswer(entry.resultValue !== null ? String(entry.resultValue) : (entry.resultText || ''))
    } else {
      setFormNumerator('')
      setFormDenominator('')
      setFormSingleAnswer('')
    }

    setAnswerModalOpen(true)
  }

  // Change Period in Answer Modal
  const handleModalPeriodChange = (periodKey: string) => {
    if (!activeIndicator) return
    const periods = getPeriodsForFrequency(activeIndicator.frequency)
    const period = periods.find(p => p.key === periodKey) || periods[0]
    setFormPeriodKey(period.key)
    setFormPeriodLabel(period.label)

    const entry = activeIndicator.entries?.find(e => matchesPeriodKey(e.periodKey, period.key)) || (activeIndicator.currentEntry && matchesPeriodKey(activeIndicator.currentEntry.periodKey, period.key) ? activeIndicator.currentEntry : null)
    if (entry) {
      setFormNumerator(entry.numeratorValue !== null ? String(entry.numeratorValue) : '')
      setFormDenominator(entry.denominatorValue !== null ? String(entry.denominatorValue) : '')
      setFormSingleAnswer(entry.resultValue !== null ? String(entry.resultValue) : (entry.resultText || ''))
    } else {
      setFormNumerator('')
      setFormDenominator('')
      setFormSingleAnswer('')
    }
  }

  // Open Round History Modal
  const handleOpenHistoryModal = (ind: KpiIndicatorItem) => {
    setHistoryIndicator(ind)
    setHistoryModalOpen(true)
  }

  // Switch to editing a specific round from History Modal
  const handleEditRoundFromHistory = (ind: KpiIndicatorItem, periodKey: string, periodLabel: string) => {
    setHistoryModalOpen(false)
    setActiveIndicator(ind)
    const isPct = isPercentageIndicator(ind)
    setFormCalcMode(isPct ? 'percentage' : 'ratio')
    setFormPeriodKey(periodKey)
    setFormPeriodLabel(periodLabel)

    const entry = ind.entries?.find(e => matchesPeriodKey(e.periodKey, periodKey)) ||
      (ind.currentEntry && matchesPeriodKey(ind.currentEntry.periodKey, periodKey) ? ind.currentEntry : null)

    if (entry) {
      setFormNumerator(entry.numeratorValue !== null ? String(entry.numeratorValue) : '')
      setFormDenominator(entry.denominatorValue !== null ? String(entry.denominatorValue) : '')
      setFormSingleAnswer(entry.resultValue !== null ? String(entry.resultValue) : (entry.resultText || ''))
    } else {
      setFormNumerator('')
      setFormDenominator('')
      setFormSingleAnswer('')
    }

    setAnswerModalOpen(true)
  }

  // Save Answer
  const handleSaveAnswer = async () => {
    if (!activeIndicator) return
    try {
      setSaving(true)
      const hasNumDen = Boolean(activeIndicator.numeratorName || activeIndicator.denominatorName)

      let numVal: number | null = null
      let denVal: number | null = null
      let resVal: number | null = null
      let resText: string | null = null

      if (hasNumDen) {
        const numTrim = formNumerator.trim()
        const denTrim = formDenominator.trim()

        if (numTrim !== '' && denTrim === '0' && parseFloat(numTrim) > 0) {
          alert('ตัวหารไม่สามารถเป็น 0 ได้หากตัวตั้งมากกว่า 0')
          setSaving(false)
          return
        }

        numVal = numTrim !== '' ? parseFloat(numTrim) : null
        denVal = denTrim !== '' ? parseFloat(denTrim) : null
        resVal = computedPercentage
      } else {
        const parsedNum = parseFloat(formSingleAnswer)
        if (!isNaN(parsedNum) && formSingleAnswer.trim() === String(parsedNum)) {
          resVal = parsedNum
        } else {
          resText = formSingleAnswer.trim() || null
        }
      }

      const payload = {
        indicatorId: activeIndicator.id,
        fiscalYear: selectedYear,
        periodKey: formPeriodKey,
        periodLabel: formPeriodLabel,
        numeratorValue: numVal,
        denominatorValue: denVal,
        resultValue: resVal,
        resultText: resText,
      }

      const res = await fetch('/api/kpi/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!json.success) {
        alert(json.error?.message || 'บันทึกข้อมูลไม่สำเร็จ')
        return
      }

      setAnswerModalOpen(false)
      await fetchIndicatorsAndStats()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const syncTargetRawIfClean = (nextOp: string, nextVal: string, nextUnit: string) => {
    if (indFormTargetRawDirty) return
    const valTrim = nextVal.trim()
    const unitTrim = nextUnit.trim()
    if (valTrim !== '') {
      setIndFormTargetRaw(`${nextOp} ${valTrim}${unitTrim}`)
    } else if (nextOp === 'MIN') {
      setIndFormTargetRaw('MIN')
    } else {
      setIndFormTargetRaw('')
    }
  }

  // Open Create Indicator Modal
  const handleOpenCreateIndicator = () => {
    if (!isKpiManager) {
      alert('เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถเพิ่มตัวชี้วัดได้')
      return
    }
    setIsCreatingNew(true)
    setActiveIndicator(null)
    setIndFormSequence('')
    setIndFormCategory(categories[0] || 'หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)')
    setIndFormSubcategory('')
    setIndFormCode('')
    setIndFormOldCode('')
    setIndFormFrequency('ราย 6 เดือน')
    setIndFormTitle('')
    setIndFormNumeratorName('')
    setIndFormDenominatorName('')
    setIndFormTargetOp('>=')
    setIndFormTargetVal('')
    setIndFormTargetUnit('%')
    setIndFormTargetRaw('')
    setIndFormTargetRawDirty(false)
    setIndFormResponsible(currentUser.name || '')
    setIndFormType('HA')
    setEditIndicatorModalOpen(true)
  }

  // Open Edit Indicator Modal
  const handleOpenEditIndicator = (ind: KpiIndicatorItem) => {
    if (!isKpiManager) {
      alert('เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถแก้ไขข้อมูลตัวชี้วัดได้')
      return
    }
    const opMap: Record<string, string> = { GTE: '>=', LTE: '<=', GT: '>', LT: '<', EQ: '=' }
    const normalizedOp = ind.targetOperator ? (opMap[ind.targetOperator] || ind.targetOperator) : '>='
    const defaultUnit = isPercentageIndicator(ind) ? '%' : ''

    setIsCreatingNew(false)
    setActiveIndicator(ind)
    setIndFormSequence(ind.sequence || '')
    setIndFormCategory(ind.category)
    setIndFormSubcategory(ind.subcategory || '')
    setIndFormCode(ind.code || '')
    setIndFormOldCode(ind.oldCode || '')
    setIndFormFrequency(ind.frequency)
    setIndFormTitle(ind.title)
    setIndFormNumeratorName(ind.numeratorName || '')
    setIndFormDenominatorName(ind.denominatorName || '')
    setIndFormTargetOp(normalizedOp)
    setIndFormTargetVal(ind.targetValue !== null && ind.targetValue !== undefined ? String(ind.targetValue) : '')
    setIndFormTargetUnit(ind.targetUnit !== null && ind.targetUnit !== undefined ? ind.targetUnit : defaultUnit)
    setIndFormTargetRaw(ind.targetRaw || '')
    setIndFormTargetRawDirty(false)
    setIndFormResponsible(ind.responsibleName || '')
    setIndFormType(ind.indicatorType || 'HA')
    setEditIndicatorModalOpen(true)
  }

  // Save Indicator (Create or Update)
  const handleSaveIndicator = async () => {
    if (!indFormTitle.trim()) {
      alert('กรุณากรอกชื่อตัวชี้วัด / คำถามหลัก')
      return
    }
    if (!selectedTopicId) {
      alert('กรุณาเลือกชุดตัวชี้วัดก่อน')
      return
    }

    const rawTargetVal = indFormTargetVal.trim()
    const targetNum = rawTargetVal !== '' ? parseFloat(rawTargetVal) : null
    if (rawTargetVal !== '' && (targetNum === null || isNaN(targetNum))) {
      alert('ค่าเป้าหมายต้องเป็นตัวเลขที่ถูกต้อง')
      return
    }

    try {
      setSaving(true)
      const cleanUnit = indFormTargetUnit.trim()
      const resolvedTargetRaw = indFormTargetRaw.trim() ||
        (targetNum !== null
          ? `${indFormTargetOp} ${targetNum}${cleanUnit}`
          : (indFormTargetOp === 'MIN' ? 'MIN' : null))

      const payload: any = {
        topicId: selectedTopicId,
        sequence: indFormSequence.trim() || null,
        category: indFormCategory.trim(),
        subcategory: indFormSubcategory.trim() || null,
        code: indFormCode.trim() || null,
        oldCode: indFormOldCode.trim() || null,
        frequency: indFormFrequency,
        title: indFormTitle.trim(),
        numeratorName: indFormNumeratorName.trim() || null,
        denominatorName: indFormDenominatorName.trim() || null,
        targetOperator: indFormTargetOp,
        targetValue: targetNum,
        targetUnit: cleanUnit || null,
        targetRaw: resolvedTargetRaw,
        responsibleName: indFormResponsible.trim() || null,
        indicatorType: indFormType.trim() || null,
      }

      let res
      if (isCreatingNew) {
        res = await fetch('/api/kpi/indicators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        payload.id = activeIndicator?.id
        res = await fetch('/api/kpi/indicators', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      const json = await res.json()
      if (!json.success) {
        alert(json.error?.message || 'บันทึกตัวชี้วัดไม่สำเร็จ')
        return
      }

      setEditIndicatorModalOpen(false)
      await fetchIndicatorsAndStats()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Delete Indicator
  const handleDeleteIndicator = async (ind: KpiIndicatorItem) => {
    if (!isKpiManager) {
      alert('เฉพาะผู้ดูแลระบบหรือศูนย์คุณภาพเท่านั้นที่สามารถลบตัวชี้วัดได้')
      return
    }

    const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบตัวชี้วัดข้อ ${ind.sequence || ''} "${ind.title.substring(0, 50)}..."?`)
    if (!confirmDelete) return

    try {
      setSaving(true)
      const res = await fetch(`/api/kpi/indicators?id=${ind.id}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      if (!json.success) {
        alert(json.error?.message || 'ลบตัวชี้วัดไม่สำเร็จ')
        return
      }
      await fetchIndicatorsAndStats()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Process file upload (.xlsx, .xls, .csv)
  const handleProcessFile = async (file: File) => {
    try {
      setImportParsing(true)
      setImportError(null)
      setImportFileName(file.name)

      let rows: any[][] = []
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'xlsx' || ext === 'xls') {
        const arrayBuffer = await file.arrayBuffer()
        
        // Timeout guard: 10s maximum to prevent infinite UI freeze
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('การอ่านไฟล์ Excel ใช้เวลานานเกินไป กรุณาตรวจสอบว่าไฟล์ไม่เสียหาย')), 10000)
        )
        const parsePromise = readXlsxFile(arrayBuffer)
        const result: any = await Promise.race([parsePromise, timeoutPromise])

        if (Array.isArray(result) && result.length > 0 && 'data' in result[0]) {
          rows = result[0].data as any[][]
        } else {
          rows = result as any[][]
        }
      } else if (ext === 'csv') {
        const arrayBuf = await file.arrayBuffer()
        let text = ''
        try {
          // Attempt strict UTF-8 decoding
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
          text = utf8Decoder.decode(arrayBuf)
        } catch {
          // Fallback to Thai Windows-874 / TIS-620 if UTF-8 fails (e.g. from Thai Excel export)
          try {
            const thaiDecoder = new TextDecoder('windows-874')
            text = thaiDecoder.decode(arrayBuf)
          } catch {
            text = await file.text()
          }
        }
        rows = text.split(/\r\n|\n|\r/).map(line => {
          const cells: string[] = []
          let cur = ''
          let inQ = false
          for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') inQ = !inQ
            else if (ch === ',' && !inQ) {
              cells.push(cur.trim())
              cur = ''
            } else {
              cur += ch
            }
          }
          cells.push(cur.trim())
          return cells
        })
      } else {
        throw new Error('รองรับเฉพาะไฟล์ Excel (.xlsx, .xls) หรือ .csv เท่านั้น')
      }

      if (!rows || rows.length === 0) {
        throw new Error('ไม่พบข้อมูลในไฟล์ที่เลือก')
      }

      const parseRes = parseKpiRows(rows)
      if (parseRes.indicators.length === 0) {
        throw new Error('ไม่พบข้อมูลตัวชี้วัดในไฟล์ กรุณาตรวจสอบหัวตารางและเนื้อหา')
      }

      setImportIndicators(parseRes.indicators)

      // Auto-set code and title from filename
      const baseName = file.name.replace(/\.[^/.]+$/, '').trim()
      const codeMatch = baseName.match(/([a-zA-Z0-9_\-]+(?:final)?)/i)
      const inferredCode = codeMatch ? codeMatch[1] : baseName

      setImportCode(prev => prev.trim() ? prev : inferredCode)
      setImportTitle(prev => prev.trim() ? prev : baseName)
      setImportDesc(prev => prev.trim() ? prev : `${baseName} (ปีงบประมาณ ${importYear || defaultFiscalYear})`)
    } catch (err: any) {
      console.error('KPI file processing error:', err)
      setImportError(err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์')
      setImportIndicators([])
    } finally {
      setImportParsing(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0])
    }
  }

  // Import Indicators (Admin)
  const handleExecuteImport = async () => {
    if (importIndicators.length === 0) {
      alert('กรุณาเลือกไฟล์ Excel (.xlsx) ที่มีข้อมูลตัวชี้วัด')
      return
    }
    if (!importYear.trim() || !importCode.trim()) {
      alert('กรุณาระบุปีงบประมาณและรหัสชุดตัวชี้วัด')
      return
    }

    try {
      setSaving(true)
      const payload = {
        fiscalYear: importYear.trim(),
        code: importCode.trim(),
        title: importTitle.trim() || importCode.trim(),
        description: importDesc.trim() || null,
        indicators: importIndicators,
      }

      const res = await fetch('/api/kpi/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!json.success) {
        alert(json.error?.message || 'นำเข้าข้อมูลไม่สำเร็จ')
        return
      }

      alert(`นำเข้าตัวชี้วัดสำเร็จจำนวน ${json.data.inserted} รายการ`)
      setImportModalOpen(false)
      setImportIndicators([])
      setImportFileName(null)
      await fetchTopics()
      await fetchIndicatorsAndStats()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการนำเข้า: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedTopic = topics.find(t => t.id === selectedTopicId)

  const canExport = Boolean(
    isKpiManager ||
    currentUser.permissions?.includes('view_all_kpi')
  )

  const handleOpenExportModal = () => {
    setExportTopicId(selectedTopicId)
    setExportCategory(selectedCategories.length === 1 ? selectedCategories[0] : 'ALL')
    setExportPeriodKey(selectedPeriodKey !== 'ALL' ? selectedPeriodKey : 'ALL')
    setExportScope(activeTab === 'DUE' ? 'DUE' : 'ALL')
    setExportModalOpen(true)
  }

  const handleExportExcel = async (scope: 'ALL' | 'DUE' = exportScope) => {
    const targetTopicId = exportTopicId || selectedTopicId
    if (!targetTopicId) {
      alert('กรุณาเลือกชุดตัวชี้วัดที่ต้องการส่งออก')
      return
    }

    try {
      setExporting(true)
      const exportParams = new URLSearchParams({
        topicId: String(targetTopicId),
        fiscalYear: selectedYear,
      })
      if (scope === 'DUE') {
        exportParams.set('onlyDue', 'true')
      }
      if (exportCategory && exportCategory !== 'ALL') {
        exportParams.set('category', exportCategory)
      } else if (selectedCategories.length === 1 && (!exportCategory || exportCategory === 'ALL')) {
        exportParams.set('category', selectedCategories[0])
      }
      if (exportPeriodKey && exportPeriodKey !== 'ALL') {
        exportParams.set('periodKey', exportPeriodKey)
      }
      const url = `/api/kpi/export?${exportParams.toString()}`
      const res = await fetch(url)

      if (!res.ok) {
        let errJson: any = {}
        try {
          errJson = await res.json()
        } catch {}
        throw new Error(errJson.error?.message || 'ไม่สามารถส่งออกไฟล์ Excel ได้')
      }

      const disposition = res.headers.get('Content-Disposition')
      let filename = `KPI_Report_${selectedYear}.xlsx`
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
        if (match && match[1]) {
          filename = decodeURIComponent(match[1])
        }
      }

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setExportModalOpen(false)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่งออกไฟล์: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Helper to render clinical status badge per design.md
  const renderStatusBadge = (ind: KpiIndicatorItem, entry: any, isLocked: boolean, dueStatus: IndicatorDueStatus) => {
    if (isLocked) {
      if (dueStatus.isDueSoon) {
        return (
          <span className="kpiStatusPill dueSoon" title={dueStatus.message}>
            <Clock size={12} /> อีก {dueStatus.daysUntil} วันถึงรอบ
          </span>
        )
      }
      return (
        <span className="kpiStatusPill locked" title={dueStatus.message}>
          <Lock size={12} /> ยังไม่ถึงรอบ
        </span>
      )
    }

    const evaluatedStatus = getIndicatorStatus(ind)

    if (evaluatedStatus === 'PENDING') {
      return (
        <span className="kpiStatusPill noReport">
          ไม่มีรายงาน
        </span>
      )
    }

    if (evaluatedStatus === 'PASS') {
      return (
        <span className="kpiStatusPill pass">
          <CheckCircle2 size={12} /> ผ่านเกณฑ์
        </span>
      )
    }

    if (evaluatedStatus === 'FAIL') {
      return (
        <span className="kpiStatusPill fail">
          <XCircle size={12} /> ไม่ผ่านเกณฑ์
        </span>
      )
    }

    return (
      <span className="kpiStatusPill unspecified">
        ยังไม่ระบุสถานะ
      </span>
    )
  }

  const handleSort = (field: 'sequence' | 'title' | 'frequency' | 'status') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="kpiPage">
      <div className="kpiWrapper">
        {/* Navigation Breadcrumb */}
        <div className="kpiTopBar">
          <nav className="kpiBreadcrumb" aria-label="Breadcrumb">
            <Link href="/service">
              <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
              <span>ระบบงานสารสนเทศภายใน</span>
            </Link>
            <span className="kpiBreadcrumbSeparator">/</span>
            <span className="kpiBreadcrumbCurrent">ติดตามตัวชี้วัด</span>
          </nav>

        </div>

        {/* 1. Header per design.md */}
        <header className="kpiHeader">
          <div className="kpiHeaderTitleBlock">
            <h1>ติดตามตัวชี้วัด ปี {selectedYear || '2570'}</h1>
            <div className="kpiHeaderSubtitle">
              <span>กำกับและติดตามตัวชี้วัดคุณภาพ THIP / HA / ยุทธศาสตร์ โรงพยาบาลเถิน</span>
            </div>
          </div>
          <div className="kpiHeaderActions">
            {/* Export Excel Button per design.md */}
            <button 
              type="button"
              className="kpiBtn kpiBtnSecondary"
              onClick={handleOpenExportModal}
              disabled={exporting || loading || !selectedTopicId}
              title="ส่งออกรายงานตัวชี้วัดเป็นไฟล์ Excel (.xlsx)"
            >
              <FileSpreadsheet size={16} />
              <span>{exporting ? 'กำลังส่งออก Excel...' : 'ส่งออก Excel'}</span>
            </button>

            {/* Add Indicator Button per design.md */}
            {isKpiManager && (
              <button 
                type="button"
                className="kpiBtn kpiBtnPrimary"
                onClick={handleOpenCreateIndicator}
              >
                <Plus size={16} />
                <span>+ เพิ่มตัวชี้วัด</span>
              </button>
            )}

            {/* Admin Import tool */}
            {isKpiManager && (
              <button 
                type="button"
                className="kpiBtn kpiBtnSecondary"
                onClick={() => setImportModalOpen(true)}
                title="นำเข้าตัวชี้วัดจากไฟล์ Excel"
              >
                <UploadCloud size={16} />
                <span>นำเข้า Excel</span>
              </button>
            )}

            {/* Refresh Button */}
            <button 
              type="button"
              className="kpiIconBtn"
              onClick={() => fetchIndicatorsAndStats()}
              disabled={loading}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* 2. Stat Cards (3 ใบ per design.md: ทั้งหมด / ไม่มีรายงาน / ยังไม่ระบุสถานะ) */}
        <section className="kpiStatCardsRow" aria-label="สรุปสถิติตัวชี้วัด">
          <div className="kpiStatCard">
            <div className="kpiStatCardLabel">ทั้งหมด</div>
            <div className="kpiStatCardValue">{statsSummary.total}</div>
            <div className="kpiStatCardFoot">
              {hasActiveFilters ? 'ตัวชี้วัดตามตัวกรองที่เลือก' : 'ตัวชี้วัดที่ติดตามในปีนี้'}
            </div>
          </div>
          <div className="kpiStatCard">
            <div className="kpiStatCardLabel">ไม่มีรายงาน</div>
            <div className="kpiStatCardValue warn">{statsSummary.noReport}</div>
            <div className="kpiStatCardFoot">รอผู้รับผิดชอบรายงานผล</div>
          </div>
          <div className="kpiStatCard">
            <div className="kpiStatCardLabel">ยังไม่ระบุสถานะ</div>
            <div className="kpiStatCardValue">{statsSummary.unspecified}</div>
            <div className="kpiStatCardFoot">รอตั้งเป้าหมาย / เกณฑ์ประเมิน</div>
          </div>
        </section>

        {/* 3. Toolbar (ปุ่มกรองตามหมวด + ช่องค้นหา) per design.md */}
        <section className="kpiToolbar" aria-label="แถบตัวกรองและค้นหา">
          <div className="kpiToolbarPrimary">
            <KpiCategoryFilter
              categoryMultiSelectRef={categoryMultiSelectRef}
              selectedCategories={selectedCategories}
              categoryMultiSelectOpen={categoryMultiSelectOpen}
              setCategoryMultiSelectOpen={setCategoryMultiSelectOpen}
              categorySearchQuery={categorySearchQuery}
              setCategorySearchQuery={setCategorySearchQuery}
              categoryGroups={categoryGroups}
              filteredCategoryGroups={filteredCategoryGroups}
              categoryCounts={categoryCounts}
              toggleCategory={toggleCategory}
              selectAllCategories={selectAllCategories}
              clearAllCategories={clearAllCategories}
              toggleGroupCategories={toggleGroupCategories}
            />

            <div className="kpiSearchField">
              <label htmlFor="kpi-search-input" className="sr-only">
                ค้นหาชื่อตัวชี้วัด
              </label>
              <Search size={16} className="kpiSearchIcon" />
              <input
                id="kpi-search-input"
                type="text"
                placeholder="ค้นหาชื่อตัวชี้วัด..."
                className="kpiSearchInput"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Active Category Filter Chips (Pills) */}
          {selectedCategories.length > 0 && (
            <div className="kpiActiveFilterChips" aria-label="หมวดหมู่ที่เลือกกรอง">
              <span className="kpiActiveFilterLabel">กรองเฉพาะ ({selectedCategories.length}):</span>
              <div className="kpiActiveChipsList">
                {selectedCategories.map(cat => (
                  <span key={cat} className="kpiActiveChip">
                    <span className="kpiActiveChipText" title={cat}>
                      {cat.length > 36 ? cat.substring(0, 36) + '...' : cat}
                    </span>
                    <button
                      type="button"
                      className="kpiActiveChipRemove"
                      onClick={() => toggleCategory(cat)}
                      aria-label={`ลบตัวกรอง ${cat}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="kpiClearAllChipsBtn"
                  onClick={clearAllCategories}
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            </div>
          )}

          {/* Secondary Filter Row */}
          <div className="kpiToolbarSecondary">
            <div className="kpiSecondaryFilters">
              {fiscalYears.length > 0 && (
                <div className="kpiInlineFilter">
                  <span>ปีงบประมาณ:</span>
                  <select
                    className="kpiMiniSelect"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value)
                      const t = topics.find(item => item.fiscalYear === e.target.value)
                      if (t) setSelectedTopicId(t.id)
                      else setSelectedTopicId(null)
                    }}
                  >
                    {fiscalYears.map(yr => (
                      <option key={yr} value={yr}>ปี {yr}</option>
                    ))}
                  </select>
                </div>
              )}

              {topics.length > 1 && (
                <div className="kpiInlineFilter">
                  <span>ชุด:</span>
                  <select
                    className="kpiMiniSelect"
                    value={selectedTopicId || ''}
                    onChange={(e) => setSelectedTopicId(Number(e.target.value))}
                  >
                    {topics
                      .filter(t => !selectedYear || t.fiscalYear === selectedYear)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.code}</option>
                      ))}
                  </select>
                </div>
              )}

              <div className="kpiInlineFilter">
                <span>ความถี่:</span>
                <select
                  className="kpiMiniSelect"
                  value={selectedFrequency}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                >
                  <option value="ALL">ทุกความถี่</option>
                  <option value="รายเดือน">รายเดือน</option>
                  <option value="รายไตรมาส">รายไตรมาส</option>
                  <option value="ราย 6 เดือน">ราย 6 เดือน</option>
                  <option value="รายปี">รายปี</option>
                </select>
              </div>

              <div className="kpiInlineFilter">
                <span>สถานะ:</span>
                <select
                  className="kpiMiniSelect"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="ALL">ทุกสถานะ</option>
                  <option value="PASS">ผ่านเกณฑ์</option>
                  <option value="FAIL">ไม่ผ่านเกณฑ์</option>
                  <option value="PENDING">ไม่มีรายงาน</option>
                  <option value="WAITING_TARGET">ยังไม่ระบุสถานะ</option>
                </select>
              </div>

              <div className="kpiInlineFilter">
                <span>การกรอกผล:</span>
                <select
                  className="kpiMiniSelect"
                  value={selectedFilledStatus}
                  onChange={(e) => setSelectedFilledStatus(e.target.value as 'ALL' | 'FILLED' | 'UNFILLED')}
                >
                  <option value="ALL">ทั้งหมด</option>
                  <option value="FILLED">กรอกแล้ว</option>
                  <option value="UNFILLED">ยังไม่กรอก</option>
                </select>
              </div>
            </div>

            <div className="kpiTabPills">
              <button
                type="button"
                className={`kpiTabPill ${activeTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                ตัวชี้วัดทั้งหมด ({indicators.length})
              </button>
              <button
                type="button"
                className={`kpiTabPill ${activeTab === 'MY' ? 'active' : ''}`}
                onClick={() => setActiveTab('MY')}
              >
                ที่ฉันรับผิดชอบ
              </button>
              <button
                type="button"
                className={`kpiTabPill ${activeTab === 'DUE' ? 'active' : ''}`}
                onClick={() => setActiveTab('DUE')}
              >
                ตัวที่ถึงเวลา ({dueIndicatorsCount})
              </button>
              {indicators.some(ind => ind.aiAudit) && (
                <button
                  type="button"
                  className={`kpiTabPill kpiTabPillAudit ${activeTab === 'AI_MISMATCH' ? 'active' : ''}`}
                  onClick={() => setActiveTab('AI_MISMATCH')}
                >
                  AI พบคลาดเคลื่อน ({indicators.filter(ind => ind.aiAudit?.status === 'MISMATCH').length})
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{ background: 'var(--fail-bg)', color: 'var(--fail-ink)', padding: '12px 16px', borderRadius: 'var(--radius-btn)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fca5a5' }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 4 & 5. ตาราง (CSS Grid 1040px) & Mobile Card (< 768px) per design.md */}
        <div className="kpiTableCard">
          {topics.length === 0 ? (
            <div className="kpiEmptyState">
              <FileSpreadsheet size={48} />
              <h3>ยังไม่มีชุดตัวชี้วัดในระบบ</h3>
              <p>
                {isKpiManager 
                  ? 'คุณสามารถเริ่มต้นใช้งานโดยคลิกปุ่ม "นำเข้า Excel" เพื่ออัปโหลดไฟล์ตัวชี้วัด (.xlsx) หรือคลิก "+ เพิ่มตัวชี้วัด"'
                  : 'ยังไม่มีชุดข้อมูลตัวชี้วัดที่เปิดใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบ (Admin) หรือศูนย์คุณภาพ'}
              </p>
              {isKpiManager && (
                <button 
                  type="button"
                  className="kpiBtn kpiBtnPrimary"
                  onClick={() => setImportModalOpen(true)}
                >
                  <UploadCloud size={16} />
                  <span>นำเข้าชุดตัวชี้วัดจากไฟล์ Excel</span>
                </button>
              )}
            </div>
          ) : displayedIndicators.length === 0 ? (
            <div className="kpiEmptyState">
              <HelpCircle size={44} />
              <p>ไม่พบรายการตัวชี้วัดตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="kpiTableScroller">
              <div className="kpiGridTable" role="table" aria-label="ตารางติดตามตัวชี้วัด">
                {/* Header row per design.md Section 5 */}
                <div className="kpiGridHead" role="row">
                  <div
                    role="columnheader"
                    aria-sort={sortField === 'sequence' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('sequence')}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="คลิกเพื่อเรียงลำดับตามเลขลำดับ (น้อยไปมาก / มากไปน้อย)"
                  >
                    ลำดับ
                    <span style={{ fontSize: '11px', opacity: sortField === 'sequence' ? 1 : 0.4 }}>
                      {sortField === 'sequence' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                  <div
                    role="columnheader"
                    aria-sort={sortField === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('title')}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="คลิกเพื่อเรียงลำดับตามชื่อตัวชี้วัด"
                  >
                    ตัวชี้วัด
                    <span style={{ fontSize: '11px', opacity: sortField === 'title' ? 1 : 0.4 }}>
                      {sortField === 'title' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </div>
                  <div
                    role="columnheader"
                    aria-sort={sortField === 'frequency' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('frequency')}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="คลิกเพื่อเรียงลำดับตามความถี่"
                  >
                    ความถี่
                    <span style={{ fontSize: '11px', opacity: sortField === 'frequency' ? 1 : 0.4 }}>
                      {sortField === 'frequency' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </div>
                  <div role="columnheader">เป้าหมาย</div>
                  <div role="columnheader">ผลงาน</div>
                  <div role="columnheader">ผู้รับผิดชอบ</div>
                  <div
                    role="columnheader"
                    aria-sort={sortField === 'status' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleSort('status')}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="คลิกเพื่อเรียงลำดับตามสถานะ"
                  >
                    สถานะ
                    <span style={{ fontSize: '11px', opacity: sortField === 'status' ? 1 : 0.4 }}>
                      {sortField === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </div>
                  <div role="columnheader">ประเภท</div>
                  <div role="columnheader" style={{ textAlign: 'right' }}>จัดการ</div>
                </div>

                {/* Data rows per design.md Section 5 */}
                {displayedIndicators.map((ind, idx) => (
                  <KpiIndicatorRow
                    key={ind.id}
                    ind={ind}
                    idx={idx}
                    selectedYear={selectedYear}
                    isKpiManager={isKpiManager}
                    getActivePeriodEntry={getActivePeriodEntry}
                    canAnswerIndicator={canAnswerIndicator}
                    canEditIndicator={canEditIndicator}
                    canDeleteIndicator={canDeleteIndicator}
                    renderStatusBadge={renderStatusBadge}
                    handleOpenHistoryModal={handleOpenHistoryModal}
                    handleOpenAnswer={handleOpenAnswer}
                    handleOpenEditIndicator={handleOpenEditIndicator}
                    handleDeleteIndicator={handleDeleteIndicator}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 5. Footer ตาราง per design.md */}
          <footer className="kpiTableFooter">
            <div className="kpiTableNote">
              หมายเหตุ: ข้อมูลตัวชี้วัดปีงบประมาณ {selectedYear || '2570'} การบันทึกผลดำเนินการต้องอยู่ในรอบเวลาที่กำหนด
            </div>
            <div className="kpiTableCount">
              แสดง {displayedIndicators.length} จาก {indicators.length} รายการ
            </div>
          </footer>
        </div>

        <KpiAnswerAndHistoryModals
          answerModalOpen={answerModalOpen}
          setAnswerModalOpen={setAnswerModalOpen}
          activeIndicator={activeIndicator}
          formPeriodKey={formPeriodKey}
          handleModalPeriodChange={handleModalPeriodChange}
          formNumerator={formNumerator}
          setFormNumerator={setFormNumerator}
          formDenominator={formDenominator}
          setFormDenominator={setFormDenominator}
          formCalcMode={formCalcMode}
          setFormCalcMode={setFormCalcMode}
          computedPercentage={computedPercentage}
          liveEvaluationStatus={liveEvaluationStatus}
          formSingleAnswer={formSingleAnswer}
          setFormSingleAnswer={setFormSingleAnswer}
          handleOpenHistoryModal={handleOpenHistoryModal}
          handleSaveAnswer={handleSaveAnswer}
          saving={saving}
          historyModalOpen={historyModalOpen}
          setHistoryModalOpen={setHistoryModalOpen}
          historyIndicator={historyIndicator}
          selectedYear={selectedYear}
          canAnswerIndicator={canAnswerIndicator}
          handleEditRoundFromHistory={handleEditRoundFromHistory}
          handleOpenAnswer={handleOpenAnswer}
        />

        <KpiManageAndExportModals
          editIndicatorModalOpen={editIndicatorModalOpen}
          setEditIndicatorModalOpen={setEditIndicatorModalOpen}
          isCreatingNew={isCreatingNew}
          indFormSequence={indFormSequence}
          setIndFormSequence={setIndFormSequence}
          indFormCode={indFormCode}
          setIndFormCode={setIndFormCode}
          indFormOldCode={indFormOldCode}
          setIndFormOldCode={setIndFormOldCode}
          indFormCategory={indFormCategory}
          setIndFormCategory={setIndFormCategory}
          indFormSubcategory={indFormSubcategory}
          setIndFormSubcategory={setIndFormSubcategory}
          indFormFrequency={indFormFrequency}
          setIndFormFrequency={setIndFormFrequency}
          indFormType={indFormType}
          setIndFormType={setIndFormType}
          indFormResponsible={indFormResponsible}
          setIndFormResponsible={setIndFormResponsible}
          indFormTitle={indFormTitle}
          setIndFormTitle={setIndFormTitle}
          indFormNumeratorName={indFormNumeratorName}
          setIndFormNumeratorName={setIndFormNumeratorName}
          indFormDenominatorName={indFormDenominatorName}
          setIndFormDenominatorName={setIndFormDenominatorName}
          indFormTargetOp={indFormTargetOp}
          setIndFormTargetOp={setIndFormTargetOp}
          indFormTargetVal={indFormTargetVal}
          setIndFormTargetVal={setIndFormTargetVal}
          indFormTargetUnit={indFormTargetUnit}
          setIndFormTargetUnit={setIndFormTargetUnit}
          indFormTargetRaw={indFormTargetRaw}
          setIndFormTargetRaw={setIndFormTargetRaw}
          setIndFormTargetRawDirty={setIndFormTargetRawDirty}
          syncTargetRawIfClean={syncTargetRawIfClean}
          handleSaveIndicator={handleSaveIndicator}
          saving={saving}
          exportModalOpen={exportModalOpen}
          setExportModalOpen={setExportModalOpen}
          exporting={exporting}
          selectedYear={selectedYear}
          exportTopicId={exportTopicId}
          setExportTopicId={setExportTopicId}
          selectedTopicId={selectedTopicId}
          topics={topics}
          exportCategory={exportCategory}
          setExportCategory={setExportCategory}
          categories={categories}
          exportPeriodKey={exportPeriodKey}
          setExportPeriodKey={setExportPeriodKey}
          exportScope={exportScope}
          setExportScope={setExportScope}
          indicators={indicators}
          dueIndicatorsCount={dueIndicatorsCount}
          handleExportExcel={handleExportExcel}
          importModalOpen={importModalOpen}
          setImportModalOpen={setImportModalOpen}
          importYear={importYear}
          setImportYear={setImportYear}
          defaultFiscalYear={defaultFiscalYear}
          importCode={importCode}
          setImportCode={setImportCode}
          importTitle={importTitle}
          setImportTitle={setImportTitle}
          importIndicators={importIndicators}
          setImportIndicators={setImportIndicators}
          handleFileInputChange={handleFileInputChange}
          dragActive={dragActive}
          setDragActive={setDragActive}
          importParsing={importParsing}
          handleFileDrop={handleFileDrop}
          importError={importError}
          setImportError={setImportError}
          importFileName={importFileName}
          setImportFileName={setImportFileName}
          handleExecuteImport={handleExecuteImport}
        />
      </div>
    </div>
  )
}
