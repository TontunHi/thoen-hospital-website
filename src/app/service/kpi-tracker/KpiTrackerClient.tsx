'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  User,
  AlertTriangle,
  Building2,
  ShieldCheck,
  ChevronDown,
  UploadCloud,
  AlertCircle,
  Hash,
  Layers,
  FileText,
  Check
} from 'lucide-react'
import readXlsxFile from 'read-excel-file/universal'
import { parseKpiRows, ParsedKpiRow } from '@/lib/kpi/kpiExcelParser'
import { KpiIndicatorItem, KpiTopicItem, KpiDashboardStats } from '@/lib/kpi/kpiService'
import { getPeriodsForFrequency, checkPeriodStatus } from '@/lib/kpi/kpiTimeUtils'
import './kpi-tracker.css'

interface CurrentUser {
  id: number
  username: string
  name: string
  role: string
  department: string | null
  isAdmin: boolean
  permissions?: string[]
}

const formatThaiDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

export function KpiTrackerClient({ currentUser }: { currentUser: CurrentUser }) {
  // Topics & Fiscal Years
  const [fiscalYears, setFiscalYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [topics, setTopics] = useState<KpiTopicItem[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)

  // Indicators Data & Filters
  const [indicators, setIndicators] = useState<KpiIndicatorItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedFrequency, setSelectedFrequency] = useState<string>('ALL')
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'MY'>('ALL')

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
  const [activeIndicator, setActiveIndicator] = useState<KpiIndicatorItem | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false)

  // Answer Form State (Simplified as requested: 1 answer input if no num/den, NO notes field)
  const [formPeriodKey, setFormPeriodKey] = useState<string>('')
  const [formPeriodLabel, setFormPeriodLabel] = useState<string>('')
  const [formNumerator, setFormNumerator] = useState<string>('')
  const [formDenominator, setFormDenominator] = useState<string>('')
  const [formSingleAnswer, setFormSingleAnswer] = useState<string>('')

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
    const periods = getPeriodsForFrequency(ind.frequency)
    const currentPeriod = periods[0]
    const windowLock = checkPeriodStatus(ind.frequency, currentPeriod.key, selectedYear)
    return windowLock.isOpen
  }, [isKpiManager, isUserResponsible, selectedYear])

  // Check if current user is allowed to edit indicator definitions (Admin & Manage KPI)
  const canEditIndicator = useCallback((_ind: KpiIndicatorItem) => {
    return isKpiManager
  }, [isKpiManager])

  // Check if current user is allowed to delete indicator (Admin & Manage KPI)
  const canDeleteIndicator = useCallback((_ind: KpiIndicatorItem) => {
    return isKpiManager
  }, [isKpiManager])

  // Stats Summary per design.md (ทั้งหมด / ไม่มีรายงาน / ยังไม่ระบุสถานะ)
  const statsSummary = useMemo(() => {
    let total = indicators.length
    let noReport = 0
    let unspecified = 0

    indicators.forEach(ind => {
      const entry = ind.currentEntry
      const status = entry?.status || 'PENDING'
      const hasResult = Boolean(entry && (entry.resultValue !== null || (entry.resultText && entry.resultText.trim() !== '')))

      if (!entry || !hasResult || entry.resultText === 'ไม่มีรายงาน' || status === 'PENDING') {
        noReport++
      } else if (status === 'WAITING_TARGET' || ind.targetValue === null || ind.targetValue === undefined) {
        unspecified++
      }
    })

    return {
      total: total || (stats?.totalIndicators ?? 0),
      noReport: total > 0 ? noReport : (stats?.totalPending ?? 0),
      unspecified: total > 0 ? unspecified : (stats?.totalWaitingTarget ?? 0),
    }
  }, [indicators, stats])

  // Filtered Indicators
  const displayedIndicators = useMemo(() => {
    return indicators.filter(ind => {
      if (selectedCategory !== 'ALL' && ind.category !== selectedCategory) {
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
      if (selectedStatus !== 'ALL') {
        const status = ind.currentEntry?.status || 'PENDING'
        if (selectedStatus === 'WAITING_TARGET') {
          if (status !== 'WAITING_TARGET') return false
        } else if (status !== selectedStatus) {
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
  }, [indicators, selectedCategory, selectedFrequency, activeTab, selectedStatus, debouncedSearch, currentUser])

  // Calculation for Answer Modal (if numerator and denominator exist)
  const computedPercentage = useMemo(() => {
    const num = parseFloat(formNumerator)
    const den = parseFloat(formDenominator)
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      return parseFloat(((num / den) * 100).toFixed(2))
    }
    return null
  }, [formNumerator, formDenominator])

  // Target preview evaluation in Answer Modal
  const liveEvaluationStatus = useMemo(() => {
    if (!activeIndicator) return 'PENDING'
    const hasNumDen = Boolean(activeIndicator.numeratorName || activeIndicator.denominatorName)
    const val = hasNumDen ? computedPercentage : (formSingleAnswer ? parseFloat(formSingleAnswer) : null)
    if (val === null || isNaN(val)) return 'PENDING'

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
    if (op === '=') return Math.abs(val - target) < 0.0001 ? 'PASS' : 'FAIL'
    if (op === 'MIN') return val <= target ? 'PASS' : 'FAIL'
    return 'WAITING_TARGET'
  }, [activeIndicator, computedPercentage, formSingleAnswer])

  // Open Answer Modal
  const handleOpenAnswer = (ind: KpiIndicatorItem) => {
    setActiveIndicator(ind)
    const periods = getPeriodsForFrequency(ind.frequency)
    const defaultPeriod = periods[0]
    setFormPeriodKey(defaultPeriod.key)
    setFormPeriodLabel(defaultPeriod.label)

    const entry = ind.entries?.find(e => e.periodKey === defaultPeriod.key) || ind.currentEntry
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

    const entry = activeIndicator.entries?.find(e => e.periodKey === period.key)
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
        numVal = formNumerator ? parseFloat(formNumerator) : null
        denVal = formDenominator ? parseFloat(formDenominator) : null
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
    setIndFormTargetOp(ind.targetOperator || '>=')
    setIndFormTargetVal(ind.targetValue !== null ? String(ind.targetValue) : '')
    setIndFormTargetUnit(ind.targetUnit || '%')
    setIndFormTargetRaw(ind.targetRaw || '')
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

    try {
      setSaving(true)
      const targetNum = indFormTargetVal !== '' ? parseFloat(indFormTargetVal) : null

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
        targetUnit: indFormTargetUnit.trim() || '%',
        targetRaw: indFormTargetRaw.trim() || (targetNum !== null ? `${indFormTargetOp} ${targetNum}${indFormTargetUnit}` : null),
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

  const handleExportExcel = async () => {
    if (!selectedTopicId) {
      alert('กรุณาเลือกชุดตัวชี้วัดที่ต้องการส่งออก')
      return
    }

    try {
      setExporting(true)
      const exportParams = new URLSearchParams({
        topicId: String(selectedTopicId),
        fiscalYear: selectedYear,
      })
      if (selectedCategory && selectedCategory !== 'ALL') {
        exportParams.set('category', selectedCategory)
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
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่งออกไฟล์: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Helper to render clinical status badge per design.md
  const renderStatusBadge = (ind: KpiIndicatorItem, entry: any, isLocked: boolean, windowLock: any) => {
    if (isLocked) {
      return (
        <span className="kpiStatusPill locked" title={windowLock?.message || 'ยังไม่ถึงรอบรายงาน'}>
          <Lock size={12} /> ยังไม่ถึงรอบ
        </span>
      )
    }

    if (!entry || (entry.resultValue === null && !entry.resultText) || entry.resultText === 'ไม่มีรายงาน' || entry.status === 'PENDING') {
      return (
        <span className="kpiStatusPill noReport">
          ไม่มีรายงาน
        </span>
      )
    }

    if (entry.status === 'PASS') {
      return (
        <span className="kpiStatusPill pass">
          <CheckCircle2 size={12} /> ผ่านเกณฑ์
        </span>
      )
    }

    if (entry.status === 'FAIL') {
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
          <div className="kpiUserBadge">
            <User size={14} />
            <span>
              ผู้ใช้งาน: <strong>{currentUser.name}</strong>{' '}
              ({currentUser.isAdmin ? 'ผู้ดูแลระบบ (Admin)' : isKpiManager ? 'ผู้ดูแลระบบตัวชี้วัด / ศูนย์คุณภาพ' : currentUser.role})
            </span>
          </div>
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
              onClick={handleExportExcel}
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
            <div className="kpiStatCardFoot">ตัวชี้วัดที่ติดตามในปีนี้</div>
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
            <div className="kpiCategoryDropdownField">
              <label htmlFor="kpi-category-select" className="kpiCategoryLabel">
                หมวดหมู่ / ยุทธศาสตร์:
              </label>
              <div className="kpiSelectWrapper">
                <select
                  id="kpi-category-select"
                  className="kpiCategorySelect"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="ALL">ทั้งหมด (ทุกหมวดและทุกยุทธศาสตร์)</option>
                  <optgroup label="ยุทธศาสตร์">
                    <option value="ยุทธศาสตร์ที่1">ยุทธศาสตร์ที่1</option>
                    <option value="ยุทธศาสตร์ที่2">ยุทธศาสตร์ที่2</option>
                    <option value="ยุทธศาสตร์ที่3">ยุทธศาสตร์ที่3</option>
                    <option value="ยุทธศาสตร์ที่4">ยุทธศาสตร์ที่4</option>
                    <option value="ยุทธศาสตร์ที่5">ยุทธศาสตร์ที่5</option>
                  </optgroup>
                  <optgroup label="หมวดหมู่คุณภาพ HA">
                    <option value="หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)">หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ (Healthcare Results)</option>
                    <option value="หมวดที่ 2: IV-2 ด้านการมุ่งเน้นผู้ป่วยและผู้รับผลงาน">หมวดที่ 2: IV-2 ด้านการมุ่งเน้นผู้ป่วยและผู้รับผลงาน</option>
                    <option value="หมวดที่ 3: IV-3 ด้านบุคลากร">หมวดที่ 3: IV-3 ด้านบุคลากร</option>
                    <option value="หมวดที่ 4: IV-4 ด้านการนำและการกำกับดูแล">หมวดที่ 4: IV-4 ด้านการนำและการกำกับดูแล</option>
                    <option value="หมวดที่ 5: IV-5 ด้านระบบงานสำคัญ">หมวดที่ 5: IV-5 ด้านระบบงานสำคัญ</option>
                    <option value="หมวดที่ 6: IV-6 ด้านการเงิน">หมวดที่ 6: IV-6 ด้านการเงิน</option>
                  </optgroup>
                  {/* แสดงหมวดหมู่อื่นๆ จากฐานข้อมูลหากมีเพิ่มเติม */}
                  {categories
                    .filter(c => !c.startsWith('ยุทธศาสตร์ที่') && !c.startsWith('หมวดที่'))
                    .map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="kpiSelectArrow" />
              </div>
            </div>

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
                  <div role="columnheader">ลำดับ</div>
                  <div role="columnheader">ตัวชี้วัด</div>
                  <div role="columnheader">ความถี่</div>
                  <div role="columnheader">เป้าหมาย</div>
                  <div role="columnheader">ผู้รับผิดชอบ</div>
                  <div role="columnheader">สถานะ</div>
                  <div role="columnheader">ประเภท</div>
                  <div role="columnheader" style={{ textAlign: 'right' }}>จัดการ</div>
                </div>

                {/* Data rows per design.md Section 5 */}
                {displayedIndicators.map((ind, idx) => {
                  const entry = ind.currentEntry
                  const periods = getPeriodsForFrequency(ind.frequency)
                  const currentPeriod = periods[0]
                  const windowLock = checkPeriodStatus(ind.frequency, currentPeriod?.key || '', selectedYear)
                  const isLocked = !windowLock.isOpen && !isKpiManager
                  const userCanAnswer = canAnswerIndicator(ind)
                  const userCanEdit = canEditIndicator(ind)
                  const userCanDelete = canDeleteIndicator(ind)

                  const targetText = ind.targetValue !== null && ind.targetValue !== undefined
                    ? `${ind.targetOperator || '>='} ${ind.targetValue}${ind.targetUnit || '%'}`
                    : (ind.targetRaw || '-')

                  return (
                    <div className="kpiGridRow" key={ind.id} role="row">
                      {/* Mobile Card Header (< 768px) */}
                      <div className="kpiMobileCardHeader mobileOnly">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="kpiColSeq">#{ind.sequence || idx + 1}</span>
                          <span className="kpiTypeBadge">{ind.indicatorType || 'HA'}</span>
                        </div>
                        <div>{renderStatusBadge(ind, entry, isLocked, windowLock)}</div>
                      </div>

                      {/* Col 1: ลำดับ (56px) */}
                      <div className="kpiColSeq desktopOnly" role="cell">
                        {ind.sequence || idx + 1}
                      </div>

                      {/* Col 2: ตัวชี้วัด (minmax(280px, 1fr)) */}
                      <div className="kpiColTitle" role="cell">
                        <div className="kpiIndicatorTitle">{ind.title}</div>
                        <div className="kpiIndicatorMeta">
                          <span>{ind.category}</span>
                          {ind.subcategory && <span>› {ind.subcategory}</span>}
                          {ind.code && <span style={{ opacity: 0.75 }}>({ind.code})</span>}
                        </div>
                        {(ind.numeratorName || ind.denominatorName) && (
                          <div className="kpiSubquestionsBox">
                            {ind.numeratorName && <div><strong>ตัวตั้ง:</strong> {ind.numeratorName}</div>}
                            {ind.denominatorName && <div><strong>ตัวหาร:</strong> {ind.denominatorName}</div>}
                          </div>
                        )}
                      </div>

                      {/* Mobile Meta Grid (< 768px) */}
                      <div className="kpiMobileMetaGrid mobileOnly">
                        <div className="kpiMobileMetaItem">
                          <label>ความถี่</label>
                          <span>{ind.frequency}</span>
                        </div>
                        <div className="kpiMobileMetaItem">
                          <label>เป้าหมาย</label>
                          <span>{targetText}</span>
                        </div>
                        <div className="kpiMobileMetaItem" style={{ gridColumn: 'span 2' }}>
                          <label>ผู้รับผิดชอบ</label>
                          <span>{ind.responsibleName || '-'}</span>
                        </div>
                      </div>

                      {/* Col 3: ความถี่ (110px) */}
                      <div className="kpiColFreq desktopOnly" role="cell">
                        {ind.frequency}
                      </div>

                      {/* Col 4: เป้าหมาย (110px) */}
                      <div className="kpiColTarget desktopOnly" role="cell">
                        {targetText}
                      </div>

                      {/* Col 5: ผู้รับผิดชอบ (130px) */}
                      <div className="kpiColResp desktopOnly" role="cell">
                        {ind.responsibleName || '-'}
                      </div>

                      {/* Col 6: สถานะ (130px) */}
                      <div className="kpiColStatus desktopOnly" role="cell">
                        {renderStatusBadge(ind, entry, isLocked, windowLock)}
                      </div>

                      {/* Col 7: ประเภท (90px) */}
                      <div className="kpiColType desktopOnly" role="cell">
                        <span className="kpiTypeBadge">{ind.indicatorType || 'HA'}</span>
                      </div>

                      {/* Col 8: ปุ่ม (96px) */}
                      <div className="kpiColAction" role="cell">
                        {userCanAnswer ? (
                          <button
                            type="button"
                            className="kpiRowBtn"
                            onClick={() => handleOpenAnswer(ind)}
                            title={entry ? 'แก้ไขผลการดำเนินงาน' : 'บันทึกผลการดำเนินงาน'}
                          >
                            <span>บันทึก</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="kpiRowBtn"
                            onClick={() => handleOpenAnswer(ind)}
                            style={{ opacity: 0.65 }}
                            title="ดูรายละเอียดการประเมิน"
                          >
                            <span>ดูผล</span>
                          </button>
                        )}

                        {userCanEdit && (
                          <button
                            type="button"
                            className="kpiIconBtn"
                            title="แก้ไขตัวชี้วัด"
                            onClick={() => handleOpenEditIndicator(ind)}
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {userCanDelete && (
                          <button
                            type="button"
                            className="kpiIconBtn danger"
                            title="ลบตัวชี้วัด"
                            onClick={() => handleDeleteIndicator(ind)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
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

        {/* ── MODAL 1: ANSWER ENTRY (Simplified per user request) ── */}
        {answerModalOpen && activeIndicator && (
          <div className="kpiModalOverlay" onClick={() => setAnswerModalOpen(false)}>
            <div className="kpiModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    {activeIndicator.code ? `${activeIndicator.code} • ` : ''}{activeIndicator.frequency}
                  </div>
                  <h2>ตอบผลการดำเนินงานตัวชี้วัด</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setAnswerModalOpen(false)} aria-label="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                <div className="kpiIndicatorSummaryBox">
                  <div className="kpiSummaryCategory">
                    {activeIndicator.category} {activeIndicator.subcategory ? `› ${activeIndicator.subcategory}` : ''}
                  </div>
                  {(activeIndicator.numeratorName || activeIndicator.denominatorName) && (
                    <div className="kpiSummaryTitle">
                      {activeIndicator.title}
                    </div>
                  )}
                  <div className="kpiSummaryMeta">
                    <span>
                      <strong>เป้าหมาย:</strong>{' '}
                      {activeIndicator.targetValue !== null 
                        ? `${activeIndicator.targetOperator || '>='} ${activeIndicator.targetValue}${activeIndicator.targetUnit || '%'}`
                        : activeIndicator.targetRaw || 'รอระบุเป้าหมาย'}
                    </span>
                    <span className="kpiSummaryMetaDivider">•</span>
                    <span><strong>ผู้รับผิดชอบ:</strong> {activeIndicator.responsibleName || 'ไม่ระบุ'}</span>
                  </div>
                </div>

                {/* Period Selector */}
                <div className="kpiFormGroup">
                  <label className="kpiFormLabel">
                    <span>รอบการประเมิน (ตามความถี่ {activeIndicator.frequency}):</span>
                  </label>
                  <div className="kpiSelectWrapper">
                    <select 
                      className="kpiSelectInput"
                      value={formPeriodKey}
                      onChange={(e) => handleModalPeriodChange(e.target.value)}
                    >
                      {getPeriodsForFrequency(activeIndicator.frequency).map(p => (
                        <option key={p.key} value={p.key}>{p.label} - {p.description}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="kpiSelectArrow" />
                  </div>
                </div>

                {/* If Indicator HAS Numerator and Denominator */}
                {activeIndicator.numeratorName || activeIndicator.denominatorName ? (
                  <>
                    <div className="kpiFormGroup">
                      <label className="kpiQuestionCardLabel">
                        <span className="kpiFieldBadge">คำถามตัวตั้ง (คำถามรอง 1)</span>
                        <span className="kpiQuestionText">
                          {activeIndicator.numeratorName || 'ระบุค่าตัวตั้ง'}
                        </span>
                      </label>
                      <input 
                        type="number"
                        step="any"
                        placeholder="กรอกค่าตัวตั้ง..."
                        className="kpiTextInput"
                        value={formNumerator}
                        onChange={(e) => setFormNumerator(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="kpiFormGroup">
                      <label className="kpiQuestionCardLabel">
                        <span className="kpiFieldBadge">คำถามตัวหาร (คำถามรอง 2)</span>
                        <span className="kpiQuestionText">
                          {activeIndicator.denominatorName || 'ระบุค่าตัวหาร'}
                        </span>
                      </label>
                      <input 
                        type="number"
                        step="any"
                        placeholder="กรอกค่าตัวหาร..."
                        className="kpiTextInput"
                        value={formDenominator}
                        onChange={(e) => setFormDenominator(e.target.value)}
                      />
                    </div>

                    {/* Auto-calculation Preview */}
                    <div className="kpiCalcPreview">
                      <div>
                        <strong style={{ display: 'block', marginBottom: '0.2rem' }}>ผลการคำนวณอัตโนมัติ:</strong>
                        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {computedPercentage !== null 
                            ? `${formNumerator} ÷ ${formDenominator} × 100 = ${computedPercentage}%`
                            : 'กรอกตัวตั้งและตัวหารเพื่อคำนวณร้อยละ'}
                        </div>
                      </div>
                      <div>
                        {liveEvaluationStatus === 'PASS' && (
                          <span className="kpiStatusBadge pass">ผ่านเกณฑ์</span>
                        )}
                        {liveEvaluationStatus === 'FAIL' && (
                          <span className="kpiStatusBadge fail">ไม่ผ่านเกณฑ์</span>
                        )}
                        {liveEvaluationStatus === 'WAITING_TARGET' && (
                          <span className="kpiStatusBadge waiting">รอระบุเป้าหมาย</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Single Input Field if NO Numerator/Denominator (per user request) */
                  <div className="kpiFormGroup">
                    <label className="kpiQuestionCardLabel">
                      <span className="kpiFieldBadge">คำถามตัวชี้วัด (คำถามหลัก)</span>
                      <span className="kpiQuestionText">
                        {activeIndicator.title}
                      </span>
                    </label>
                    <input 
                      type="text"
                      placeholder="ระบุตัวเลขผลลัพธ์หรือคำตอบ..."
                      className="kpiTextInput"
                      value={formSingleAnswer}
                      onChange={(e) => setFormSingleAnswer(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => setAnswerModalOpen(false)}
                >
                  <X size={16} />
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleSaveAnswer}
                  disabled={saving}
                >
                  <Check size={16} />
                  {saving ? 'กำลังบันทึก...' : 'บันทึกผลการดำเนินงาน'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 2: EDIT / CREATE INDICATOR (Columns A - N) ── */}
        {editIndicatorModalOpen && (
          <div className="kpiModalOverlay" onClick={() => setEditIndicatorModalOpen(false)}>
            <div className="kpiModalCard kpiModalCardWide" onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    {isCreatingNew ? 'สร้างตัวชี้วัดใหม่' : 'แก้ไขโครงสร้างตัวชี้วัด (Columns A — N)'}
                  </div>
                  <h2>{isCreatingNew ? 'เพิ่มตัวชี้วัดลงในชุดข้อมูล' : 'แก้ไขข้อมูลตัวชี้วัด'}</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setEditIndicatorModalOpen(false)} aria-label="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                {/* Section 1: ข้อมูลลำดับและรหัสอ้างอิง */}
                <div className="kpiFormSection">
                  <div className="kpiSectionHeader">
                    <Hash size={16} />
                    <span>ข้อมูลลำดับและรหัสอ้างอิง</span>
                  </div>
                  <div className="kpiFormGridCustom1">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ลำดับ</span>
                        <span className="kpiColBadge">A</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น 1, 32"
                        className="kpiTextInput"
                        value={indFormSequence}
                        onChange={(e) => setIndFormSequence(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>รหัสตัวชี้วัด</span>
                        <span className="kpiColBadge">D</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น HR-GID-0201"
                        className="kpiTextInput"
                        value={indFormCode}
                        onChange={(e) => setIndFormCode(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>รหัสเดิม</span>
                        <span className="kpiColBadge">E</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น DG0201 (ถ้ามี)"
                        className="kpiTextInput"
                        value={indFormOldCode}
                        onChange={(e) => setIndFormOldCode(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: หมวดหมู่และการจัดกลุ่มข้อมูล */}
                <div className="kpiFormSection">
                  <div className="kpiSectionHeader">
                    <Layers size={16} />
                    <span>หมวดหมู่และการจัดกลุ่มข้อมูล</span>
                  </div>
                  <div className="kpiFormGrid2">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>หมวดตัวชี้วัด</span>
                        <span className="kpiColBadge">B</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ หรือ ยุทธศาสตร์ที่1"
                        className="kpiTextInput"
                        value={indFormCategory}
                        onChange={(e) => setIndFormCategory(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ประเด็น / กลุ่มโรค</span>
                        <span className="kpiColBadge">C</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น โรคเรื้อรัง, Fast Track..."
                        className="kpiTextInput"
                        value={indFormSubcategory}
                        onChange={(e) => setIndFormSubcategory(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="kpiFormGridCustom2">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ความถี่การรายงาน</span>
                        <span className="kpiColBadge">F</span>
                      </label>
                      <div className="kpiSelectWrapper">
                        <select 
                          className="kpiSelectInput"
                          value={indFormFrequency}
                          onChange={(e) => setIndFormFrequency(e.target.value)}
                        >
                          <option value="ราย 6 เดือน">ราย 6 เดือน</option>
                          <option value="รายไตรมาส">รายไตรมาส</option>
                          <option value="รายเดือน">รายเดือน</option>
                          <option value="รายปี">รายปี</option>
                        </select>
                        <ChevronDown size={16} className="kpiSelectArrow" />
                      </div>
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ประเภท</span>
                        <span className="kpiColBadge">N</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="เช่น HA, Zone"
                        className="kpiTextInput"
                        value={indFormType}
                        onChange={(e) => setIndFormType(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ผู้รับผิดชอบ</span>
                        <span className="kpiColBadge">K</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="ระบุชื่อบุคลากรหรือทีมงาน..."
                        className="kpiTextInput"
                        value={indFormResponsible}
                        onChange={(e) => setIndFormResponsible(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: นิยามและคำถามตัวชี้วัด */}
                <div className="kpiFormSection">
                  <div className="kpiSectionHeader">
                    <FileText size={16} />
                    <span>นิยามและคำถามตัวชี้วัด</span>
                  </div>

                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel">
                      <span>ตัวชี้วัด / คำถามหลัก <span className="kpiRequired">*</span></span>
                      <span className="kpiColBadge primary">G</span>
                    </label>
                    <textarea 
                      placeholder="กรอกชื่อตัวชี้วัดหรือคำถามหลักที่ต้องการจัดเก็บผลการดำเนินงาน..."
                      className="kpiTextarea"
                      rows={3}
                      value={indFormTitle}
                      onChange={(e) => setIndFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="kpiFormGrid2">
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ตัวตั้ง / คำถามรอง 1</span>
                        <span className="kpiColBadge">H</span>
                      </label>
                      <textarea 
                        placeholder="คำอธิบายตัวตั้ง (ถ้ามี)..."
                        className="kpiTextarea"
                        rows={2}
                        value={indFormNumeratorName}
                        onChange={(e) => setIndFormNumeratorName(e.target.value)}
                      />
                    </div>
                    <div className="kpiFormGroup">
                      <label className="kpiFormLabel">
                        <span>ตัวหาร / คำถามรอง 2</span>
                        <span className="kpiColBadge">I</span>
                      </label>
                      <textarea 
                        placeholder="คำอธิบายตัวหาร (ถ้ามี)..."
                        className="kpiTextarea"
                        rows={2}
                        value={indFormDenominatorName}
                        onChange={(e) => setIndFormDenominatorName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="kpiFormHint">
                    💡 หากระบุทั้งตัวตั้ง (H) และตัวหาร (I) ระบบจะเปิดโหมดคำนวณร้อยละอัตโนมัติ (ตัวตั้ง ÷ ตัวหาร × 100)
                  </div>
                </div>

                {/* Section 4: เกณฑ์เป้าหมาย (J) */}
                <div className="kpiTargetBox">
                  <div className="kpiSectionHeader">
                    <Target size={16} />
                    <span>เกณฑ์เป้าหมายและการประเมิน (J)</span>
                  </div>

                  <div className="kpiTargetGrid">
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">เครื่องหมาย</label>
                      <div className="kpiSelectWrapper">
                        <select 
                          className="kpiSelectInput"
                          value={indFormTargetOp}
                          onChange={(e) => setIndFormTargetOp(e.target.value)}
                        >
                          <option value=">=">&gt;= (มากกว่าเท่ากับ)</option>
                          <option value="<=">&lt;= (น้อยกว่าเท่ากับ)</option>
                          <option value=">">&gt; (มากกว่า)</option>
                          <option value="<">&lt; (น้อยกว่า)</option>
                          <option value="=">= (เท่ากับ)</option>
                          <option value="MIN">น้อยที่สุด (MIN)</option>
                        </select>
                        <ChevronDown size={16} className="kpiSelectArrow" />
                      </div>
                    </div>
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">ค่าเป้าหมาย (ตัวเลข)</label>
                      <input 
                        type="number"
                        step="any"
                        placeholder="เช่น 40, 0"
                        className="kpiTextInput"
                        value={indFormTargetVal}
                        onChange={(e) => setIndFormTargetVal(e.target.value)}
                      />
                    </div>
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">หน่วย</label>
                      <input 
                        type="text"
                        placeholder="เช่น %"
                        className="kpiTextInput"
                        value={indFormTargetUnit}
                        onChange={(e) => setIndFormTargetUnit(e.target.value)}
                      />
                    </div>
                    <div className="kpiTargetField">
                      <label className="kpiMiniLabel">ข้อความกำกับเต็ม (Raw)</label>
                      <input 
                        type="text"
                        placeholder="ข้อความ เช่น ≥ 40%"
                        className="kpiTextInput"
                        value={indFormTargetRaw}
                        onChange={(e) => setIndFormTargetRaw(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Target Live Preview */}
                  <div className="kpiTargetPreview">
                    <span>ตัวอย่างผลลัพธ์เกณฑ์เป้าหมาย:</span>
                    <span className="kpiTargetPreviewBadge">
                      {indFormTargetOp} {indFormTargetVal || '0'}{indFormTargetUnit || '%'}
                      {indFormTargetRaw ? ` (${indFormTargetRaw})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => setEditIndicatorModalOpen(false)}
                >
                  <X size={16} />
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleSaveIndicator}
                  disabled={saving}
                >
                  <Check size={16} />
                  {saving ? 'กำลังบันทึก...' : (isCreatingNew ? 'เพิ่มตัวชี้วัด' : 'บันทึกการแก้ไข')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 3: IMPORT EXCEL / CSV (ADMIN ONLY) ── */}
        {importModalOpen && (
          <div className="kpiModalOverlay" onClick={() => setImportModalOpen(false)}>
            <div className="kpiModalCard" style={{ maxWidth: '840px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <div className="kpiModalSubBadge">
                    ผู้ดูแลระบบ (Admin)
                  </div>
                  <h2>นำเข้าชุดตัวชี้วัด (Excel .xlsx / CSV)</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setImportModalOpen(false)} aria-label="ปิดหน้าต่าง">
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                <div className="kpiFormGridCustom2" style={{ marginBottom: '0.5rem' }}>
                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel"><span>ปีงบประมาณ</span></label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importYear}
                      onChange={(e) => setImportYear(e.target.value)}
                      placeholder={`เช่น ${defaultFiscalYear}`}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel"><span>รหัสชุดตัวชี้วัด</span></label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importCode}
                      onChange={(e) => setImportCode(e.target.value)}
                      placeholder="เช่น THIP70final หรือ HA_2570"
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label className="kpiFormLabel"><span>ชื่อชุดตัวชี้วัด</span></label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importTitle}
                      onChange={(e) => setImportTitle(e.target.value)}
                      placeholder="เช่น THIP70final หรือ ตัวชี้วัดยุทธศาสตร์"
                    />
                  </div>
                </div>

                {/* Upload or Preview */}
                {importIndicators.length === 0 ? (
                  <div>
                    <input 
                      type="file"
                      id="kpi-file-upload-input"
                      accept=".xlsx, .xls, .csv"
                      style={{ display: 'none' }}
                      onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                      onChange={handleFileInputChange}
                    />
                    <div 
                      className={`kpiDropzone ${dragActive ? 'kpiDropzoneActive' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!importParsing) setDragActive(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                      onDrop={(e) => { if (!importParsing) handleFileDrop(e); }}
                      onClick={() => { if (!importParsing) document.getElementById('kpi-file-upload-input')?.click(); }}
                      style={{ opacity: importParsing ? 0.7 : 1, cursor: importParsing ? 'wait' : 'pointer' }}
                    >
                      {importParsing ? (
                        <RefreshCw size={44} className="kpiDropzoneIcon animate-spin" />
                      ) : (
                        <UploadCloud size={44} className="kpiDropzoneIcon" />
                      )}
                      <div className="kpiDropzoneTitle">
                        {importParsing ? 'กำลังอ่านและแปลงข้อมูลไฟล์...' : 'ลากไฟล์ Excel (.xlsx) มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                      </div>
                      <div className="kpiDropzoneSub">
                        {importParsing 
                          ? 'ระบบกำลังแยกและตรวจสอบคอลัมน์ตัวชี้วัด กรุณารอสักครู่...' 
                          : 'รองรับไฟล์ Microsoft Excel (.xlsx, .xls) หรือ CSV (คอลัมน์ A ถึง N)'}
                      </div>
                      {!importParsing && (
                        <button 
                          type="button" 
                          className="kpiBtn kpiBtnSecondary" 
                          style={{ marginTop: '0.75rem', pointerEvents: 'none' }}
                        >
                          <FileSpreadsheet size={16} />
                          เลือกไฟล์จากคอมพิวเตอร์
                        </button>
                      )}
                    </div>

                    {importError && (
                      <div style={{
                        marginTop: '0.875rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '0.5rem',
                        color: '#991b1b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <AlertCircle size={18} />
                        <span>{importError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="kpiImportPreviewContainer">
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'var(--kpi-teal-50)',
                      border: '1px solid var(--kpi-teal-200)',
                      borderRadius: '0.625rem',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <FileSpreadsheet size={22} style={{ color: 'var(--kpi-teal-700)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--kpi-neutral-900)' }}>
                            {importFileName || 'ไฟล์ข้อมูลที่เลือก'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--kpi-teal-800)' }}>
                            ตรวจพบข้อมูลตัวชี้วัดทั้งหมด <strong>{importIndicators.length}</strong> รายการ
                          </div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="kpiBtn kpiBtnSecondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => {
                          setImportIndicators([])
                          setImportFileName(null)
                          setImportError(null)
                        }}
                      >
                        เปลี่ยนไฟล์
                      </button>
                    </div>

                    <div className="kpiImportTableWrap">
                      <table className="kpiImportTable">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ width: '70px' }}>รหัส</th>
                            <th style={{ width: '130px' }}>หมวด</th>
                            <th>ตัวชี้วัด / คำถาม</th>
                            <th style={{ width: '90px' }}>รูปแบบ</th>
                            <th style={{ width: '80px' }}>เป้าหมาย</th>
                            <th style={{ width: '90px' }}>ความถี่</th>
                            <th style={{ width: '110px' }}>ผู้รับผิดชอบ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importIndicators.slice(0, 6).map((ind, idx) => {
                            const hasFormula = Boolean(ind.numeratorName && ind.denominatorName)
                            return (
                              <tr key={idx}>
                                <td>{ind.sequence || idx + 1}</td>
                                <td><strong style={{ color: 'var(--kpi-teal-800)' }}>{ind.code}</strong></td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--kpi-neutral-600)' }}>{ind.category || '-'}</td>
                                <td>
                                  <div style={{ fontWeight: 500, color: 'var(--kpi-neutral-900)' }}>{ind.title}</div>
                                  {hasFormula && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--kpi-teal-700)', marginTop: '2px' }}>
                                      ตัวตั้ง: {ind.numeratorName?.slice(0, 30)}... / ตัวหาร: {ind.denominatorName?.slice(0, 30)}...
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {hasFormula ? (
                                    <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                                      ตัวตั้ง/ตัวหาร
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: '4px' }}>
                                      ตอบโดยตรง
                                    </span>
                                  )}
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>{ind.targetRaw || '-'}</td>
                                <td style={{ fontSize: '0.75rem' }}>{ind.frequency}</td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--kpi-neutral-700)' }}>{ind.responsibleName || '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {importIndicators.length > 6 && (
                        <div style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--kpi-neutral-600)',
                          background: 'var(--kpi-neutral-50)',
                          borderTop: '1px solid var(--kpi-neutral-200)'
                        }}>
                          ... และอีก {importIndicators.length - 6} รายการพร้อมบันทึกเข้าสู่ระบบ
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => {
                    setImportModalOpen(false)
                    setImportIndicators([])
                    setImportFileName(null)
                    setImportError(null)
                  }}
                >
                  <X size={16} />
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleExecuteImport}
                  disabled={saving || importIndicators.length === 0}
                >
                  <UploadCloud size={16} />
                  {saving 
                    ? 'กำลังนำเข้าสู่ระบบ...' 
                    : importIndicators.length > 0 
                      ? `ยืนยันนำเข้าข้อมูล (${importIndicators.length} ข้อ)` 
                      : 'กรุณาเลือกไฟล์เพื่อนำเข้า'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
