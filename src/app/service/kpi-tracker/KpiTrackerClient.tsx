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
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'ALL' | 'MY'>('ALL')

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
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
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
  }, [indicators, selectedCategory, selectedFrequency, activeTab, selectedStatus, searchTerm, currentUser])

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
      const url = `/api/kpi/export?topicId=${selectedTopicId}&fiscalYear=${selectedYear}`
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

  return (
    <div className="kpiPage">
      <div className="kpiWrapper">
        {/* Navigation Breadcrumb */}
        <div className="kpiNavRow">
          <Link href="/service" className="kpiBackLink">
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            <span>กลับสู่ระบบงานสารสนเทศภายใน</span>
          </Link>
          <div className="kpiUserBadge">
            <User size={14} />
            <span>
              ผู้ใช้งาน: <strong>{currentUser.name}</strong>{' '}
              ({currentUser.isAdmin ? 'ผู้ดูแลระบบ (Admin)' : isKpiManager ? 'ผู้ดูแลระบบตัวชี้วัด / ศูนย์คุณภาพ' : currentUser.role})
            </span>
          </div>
        </div>

        {/* Hallmark Executive Workbench Header */}
        <header className="kpiHeaderCard">
          <div className="kpiHeaderContent">
            <div className="kpiKickerBadge">
              <Building2 size={13} />
              <span>โรงพยาบาลเถิน • บริหารจัดการและพัฒนาคุณภาพ</span>
            </div>
            <h1>ระบบติดตามตัวชี้วัดโรงพยาบาลเถิน</h1>
            <p>
              กำกับและติดตามผลการดำเนินงานตัวชี้วัดคุณภาพ THIP / HA / ยุทธศาสตร์ โรงพยาบาลเถิน
              เปรียบเทียบผลลัพธ์กับเป้าหมายตามปีงบประมาณและรอบเวลาการประเมิน
            </p>
          </div>
          <div className="kpiHeaderActionsGroup">
            {/* Add Indicator button for Admin / KPI Manager */}
            {isKpiManager && (
              <button 
                className="kpiBtn kpiBtnPrimary"
                onClick={handleOpenCreateIndicator}
              >
                <Plus size={16} />
                <span>เพิ่มตัวชี้วัดใหม่</span>
              </button>
            )}

            {/* Export Excel Report (.xlsx) */}
            {canExport && (
              <button 
                className="kpiBtn kpiBtnExcel"
                onClick={handleExportExcel}
                disabled={exporting || loading || !selectedTopicId}
                title="ส่งออกรายงานตัวชี้วัดทั้งหมดเป็นไฟล์ Excel (.xlsx)"
              >
                <FileSpreadsheet size={16} />
                <span>{exporting ? 'กำลังส่งออก Excel...' : 'ส่งออก Excel (.xlsx)'}</span>
              </button>
            )}

            {isKpiManager && (
              <button 
                className="kpiBtn kpiBtnSecondary"
                onClick={() => setImportModalOpen(true)}
              >
                <FileSpreadsheet size={16} />
                <span>นำเข้า Excel / CSV</span>
              </button>
            )}

            <button 
              className="kpiBtn kpiBtnSecondary"
              onClick={() => fetchIndicatorsAndStats()}
              disabled={loading}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>รีเฟรช</span>
            </button>
          </div>
        </header>

        {/* Stats Summary Cards */}
        <div className="kpiStatsGrid">
          <div className="kpiStatCard">
            <div className="kpiStatIconBox blue">
              <Target size={22} />
            </div>
            <div className="kpiStatInfo">
              <div className="kpiStatLabel">ตัวชี้วัดทั้งหมด</div>
              <div className="kpiStatValue">{stats?.totalIndicators ?? indicators.length}</div>
              <div className="kpiStatSub">
                {selectedTopic 
                  ? `ชุด ${selectedTopic.code}` 
                  : (topics.length > 0 ? 'กรุณาเลือกชุดตัวชี้วัด' : 'ยังไม่มีชุดข้อมูลในระบบ')}
              </div>
            </div>
          </div>

          <div className="kpiStatCard">
            <div className="kpiStatIconBox amber">
              <Clock size={22} />
            </div>
            <div className="kpiStatInfo">
              <div className="kpiStatLabel">บันทึกข้อมูลแล้ว</div>
              <div className="kpiStatValue">
                {stats?.totalAnswered ?? 0}
                <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--kpi-text-muted)' }}>
                  /{stats?.totalIndicators ?? indicators.length}
                </span>
              </div>
              <div className="kpiStatSub">
                {selectedTopic ? `รอการบันทึก ${stats?.totalPending ?? 0} ข้อ` : 'ไม่มีรายการ'}
              </div>
            </div>
          </div>

          <div className="kpiStatCard">
            <div className="kpiStatIconBox green">
              <CheckCircle2 size={22} />
            </div>
            <div className="kpiStatInfo">
              <div className="kpiStatLabel">ผ่านเกณฑ์เป้าหมาย</div>
              <div className="kpiStatValue">{stats?.totalPass ?? 0}</div>
              <div className="kpiStatSub">
                {selectedTopic ? `สำเร็จ ${stats?.passRatePercentage ?? 0}% ของข้อที่ตอบแล้ว` : 'ไม่มีรายการ'}
              </div>
            </div>
          </div>

          <div className="kpiStatCard">
            <div className="kpiStatIconBox rose">
              <XCircle size={22} />
            </div>
            <div className="kpiStatInfo">
              <div className="kpiStatLabel">ไม่ผ่านเกณฑ์ / รอเป้าหมาย</div>
              <div className="kpiStatValue">
                {stats?.totalFail ?? 0}
                <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--kpi-text-muted)' }}>
                  {' '}+ {stats?.totalWaitingTarget ?? 0}
                </span>
              </div>
              <div className="kpiStatSub">
                {selectedTopic 
                  ? `ไม่ผ่าน ${stats?.totalFail ?? 0} | รอตั้งเป้า ${stats?.totalWaitingTarget ?? 0}` 
                  : 'ไม่มีรายการ'}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Control Bar */}
        <div className="kpiControlsCard">
          <div className="kpiSelectorsRow">
            {/* Year Selector */}
            <div className="kpiSelectGroup">
              <label>ปีงบประมาณ:</label>
              <select 
                className="kpiSelectInput"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value)
                  const t = topics.find(item => item.fiscalYear === e.target.value)
                  if (t) setSelectedTopicId(t.id)
                  else setSelectedTopicId(null)
                }}
                disabled={fiscalYears.length === 0}
              >
                {fiscalYears.length === 0 ? (
                  <option value="">ไม่มีข้อมูลปี</option>
                ) : (
                  fiscalYears.map(yr => (
                    <option key={yr} value={yr}>ปี {yr}</option>
                  ))
                )}
              </select>
            </div>

            {/* Topic Selector */}
            <div className="kpiSelectGroup">
              <label>ชุดตัวชี้วัด:</label>
              <select 
                className="kpiSelectInput"
                value={selectedTopicId || ''}
                onChange={(e) => setSelectedTopicId(Number(e.target.value))}
                disabled={topics.length === 0}
              >
                {topics.length === 0 ? (
                  <option value="">ไม่มีชุดตัวชี้วัด</option>
                ) : (
                  topics
                    .filter(t => !selectedYear || t.fiscalYear === selectedYear)
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.code}</option>
                    ))
                )}
              </select>
            </div>

            {/* Category Filter */}
            <div className="kpiSelectGroup">
              <label>หมวด:</label>
              <select 
                className="kpiSelectInput"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">ทุกหมวด ({categories.length})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Frequency Filter */}
            <div className="kpiSelectGroup">
              <label>ความถี่:</label>
              <select 
                className="kpiSelectInput"
                value={selectedFrequency}
                onChange={(e) => setSelectedFrequency(e.target.value)}
              >
                <option value="ALL">ทุกความถี่</option>
                <option value="ราย 6 เดือน">ราย 6 เดือน</option>
                <option value="รายไตรมาส">รายไตรมาส</option>
                <option value="รายเดือน">รายเดือน</option>
                <option value="รายปี">รายปี</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="kpiSelectGroup">
              <label>สถานะ:</label>
              <select 
                className="kpiSelectInput"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">ทุกสถานะ</option>
                <option value="PASS">ผ่านเกณฑ์</option>
                <option value="FAIL">ไม่ผ่านเกณฑ์</option>
                <option value="PENDING">รอการบันทึก</option>
                <option value="WAITING_TARGET">รอระบุเป้าหมาย</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="kpiSearchWrapper">
              <Search size={16} className="kpiSearchIcon" />
              <input 
                type="text"
                placeholder="ค้นหาชื่อตัวชี้วัด, รหัส, ผู้รับผิดชอบ..."
                className="kpiSearchInput"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs: All Indicators vs My Indicators */}
          <div className="kpiTabsRow">
            <div className="kpiTabsGroup">
              <button 
                className={`kpiTabBtn ${activeTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                ตัวชี้วัดทั้งหมด ({indicators.length})
              </button>
              <button 
                className={`kpiTabBtn ${activeTab === 'MY' ? 'active' : ''}`}
                onClick={() => setActiveTab('MY')}
              >
                ตัวชี้วัดที่ฉันรับผิดชอบ
              </button>
            </div>
            <div className="kpiTotalBadge">
              แสดงข้อมูลครบถ้วน {displayedIndicators.length} จากทั้งหมด {indicators.length} ข้อ
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.875rem 1.25rem', borderRadius: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #fca5a5' }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Indicators Table (Full Data Presentation Columns A - N) */}
        <div className="kpiListCard">
          {topics.length === 0 ? (
            <div className="kpiEmptyState" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <FileSpreadsheet size={48} style={{ color: 'var(--kpi-teal-600)', marginBottom: '0.75rem', opacity: 0.8 }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--kpi-neutral-800)', marginBottom: '0.5rem' }}>
                ยังไม่มีชุดตัวชี้วัดในระบบ
              </h3>
              <p style={{ color: 'var(--kpi-neutral-600)', maxWidth: '480px', margin: '0 auto 1.25rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {isKpiManager 
                  ? 'คุณสามารถเริ่มต้นใช้งานโดยการคลิกปุ่ม "นำเข้า Excel / CSV" เพื่ออัปโหลดไฟล์ตัวชี้วัด (.xlsx) หรือคลิก "เพิ่มตัวชี้วัดใหม่"'
                  : 'ยังไม่มีชุดข้อมูลตัวชี้วัดที่เปิดใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบ (Admin) หรือศูนย์คุณภาพเพื่อนำเข้าชุดข้อมูล'}
              </p>
              {isKpiManager && (
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={() => setImportModalOpen(true)}
                  style={{ margin: '0 auto' }}
                >
                  <FileSpreadsheet size={16} />
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
            <div style={{ overflowX: 'auto' }}>
              <table className="kpiTable">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>ลำดับ</th>
                    <th style={{ width: '130px' }}>รหัส / ประเภท</th>
                    <th>ตัวชี้วัด (คำถามหลัก) & คำถามรอง (ตัวตั้ง / ตัวหาร)</th>
                    <th style={{ width: '120px' }}>ความถี่</th>
                    <th style={{ width: '130px' }}>เป้าหมาย</th>
                    <th style={{ width: '140px' }}>ผู้รับผิดชอบ</th>
                    <th style={{ width: '130px' }}>ผลดำเนินการ</th>
                    <th style={{ width: '100px' }}>สถานะ</th>
                    <th style={{ width: '110px' }}>วันที่อัปเดต</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedIndicators.map((ind, idx) => {
                    const entry = ind.currentEntry
                    const periods = getPeriodsForFrequency(ind.frequency)
                    const currentPeriod = periods[0]
                    const windowLock = checkPeriodStatus(ind.frequency, currentPeriod.key, selectedYear)
                    const isLocked = !windowLock.isOpen && !isKpiManager
                    const userCanAnswer = canAnswerIndicator(ind)
                    const userCanEdit = canEditIndicator(ind)
                    const userCanDelete = canDeleteIndicator(ind)

                    return (
                      <tr key={ind.id}>
                        {/* Col A: Sequence */}
                        <td>
                          <span className="kpiSequenceText">
                            {ind.sequence || idx + 1}
                          </span>
                        </td>

                        {/* Col D & E & N: Code, Old Code, Type */}
                        <td>
                          {ind.code ? (
                            <div className="kpiCodeBadge">{ind.code}</div>
                          ) : (
                            <div className="kpiCodeBadge" style={{ color: 'var(--kpi-text-muted)' }}>-</div>
                          )}
                          {ind.oldCode && (
                            <div className="kpiOldCodeText">เดิม: {ind.oldCode}</div>
                          )}
                          {ind.indicatorType && (
                            <span className="kpiTypeTag">{ind.indicatorType}</span>
                          )}
                        </td>

                        {/* Col B, C, G, H, I: Category, Subcategory, Title, Numerator, Denominator */}
                        <td>
                          <div className="kpiCategoryTag">
                            <span>{ind.category}</span>
                            {ind.subcategory && (
                              <span className="kpiSubcatBadge">{ind.subcategory}</span>
                            )}
                          </div>
                          
                          {/* Main Question (Title) */}
                          <div className="kpiTitle">{ind.title}</div>

                          {/* Subquestions (Numerator & Denominator) */}
                          {(ind.numeratorName || ind.denominatorName) && (
                            <div className="kpiSubquestions">
                              {ind.numeratorName && (
                                <div>
                                  <strong style={{ color: 'var(--kpi-teal-700)' }}>ตัวตั้ง:</strong> {ind.numeratorName}
                                </div>
                              )}
                              {ind.denominatorName && (
                                <div>
                                  <strong style={{ color: 'var(--kpi-teal-700)' }}>ตัวหาร:</strong> {ind.denominatorName}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Col F: Frequency */}
                        <td>
                          <span className="kpiFreqBadge">{ind.frequency}</span>
                        </td>

                        {/* Col J: Target */}
                        <td>
                          <div className="kpiTargetBox">
                            <span>
                              {ind.targetValue !== null 
                                ? `${ind.targetOperator || '>='} ${ind.targetValue}${ind.targetUnit || '%'}`
                                : ind.targetRaw || 'รอระบุ'}
                            </span>
                          </div>
                        </td>

                        {/* Col K: Responsible Name */}
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--kpi-text-primary)' }}>
                            {ind.responsibleName || 'ไม่ระบุ'}
                          </span>
                        </td>

                        {/* Col L: Result Value */}
                        <td>
                          {entry && entry.resultValue !== null ? (
                            <div>
                              <strong style={{ fontSize: '1.05rem', color: 'var(--kpi-text-primary)' }}>
                                {entry.resultValue}%
                              </strong>
                              {entry.numeratorValue !== null && entry.denominatorValue !== null && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--kpi-text-muted)' }}>
                                  ({entry.numeratorValue}/{entry.denominatorValue})
                                </div>
                              )}
                            </div>
                          ) : entry?.resultText ? (
                            <span style={{ fontSize: '0.875rem', color: 'var(--kpi-text-primary)', fontWeight: 500 }}>
                              {entry.resultText}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--kpi-text-muted)', fontSize: '0.8125rem' }}>- ยังไม่มีข้อมูล -</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td>
                          {entry?.status === 'PASS' ? (
                            <span className="kpiStatusBadge pass">
                              <CheckCircle2 size={12} /> ผ่าน
                            </span>
                          ) : entry?.status === 'FAIL' ? (
                            <span className="kpiStatusBadge fail">
                              <XCircle size={12} /> ไม่ผ่าน
                            </span>
                          ) : entry?.status === 'WAITING_TARGET' ? (
                            <span className="kpiStatusBadge waiting">
                              รอเป้าหมาย
                            </span>
                          ) : isLocked ? (
                            <span className="kpiStatusBadge locked" title={windowLock.message}>
                              <Lock size={12} /> ยังไม่ถึงรอบ
                            </span>
                          ) : (
                            <span className="kpiStatusBadge pending">
                              <Clock size={12} /> รอผล
                            </span>
                          )}
                        </td>

                        {/* Col M: Updated Date & Author */}
                        <td style={{ fontSize: '0.8125rem', color: 'var(--kpi-text-muted)' }}>
                          {entry?.recordedAt ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--kpi-text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                {formatThaiDate(entry.recordedAt)}
                              </div>
                              {entry.recordedByName && (
                                <div style={{ fontSize: '0.725rem', color: 'var(--kpi-text-muted)', marginTop: '0.15rem', lineHeight: 1.25 }}>
                                  {entry.recordedByName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--kpi-text-muted)' }}>-</span>
                          )}
                        </td>

                        {/* Actions: Answer, Edit, Delete */}
                        <td style={{ textAlign: 'center' }}>
                          <div className="kpiActionsCell">
                            {/* Answer Button: Only shown when user has permission to answer */}
                            {userCanAnswer && (
                              <button 
                                className="kpiBtn kpiBtnPrimary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem' }}
                                title={entry ? 'แก้ไขผลการดำเนินงาน' : 'กรอกผลการดำเนินงาน'}
                                onClick={() => handleOpenAnswer(ind)}
                              >
                                <Calculator size={12} />
                                <span>{entry ? 'แก้ไขผล' : 'ตอบ'}</span>
                              </button>
                            )}

                            {/* Edit Indicator Definition Button: Admin only */}
                            {userCanEdit && (
                              <button 
                                className="kpiBtnIconOnly"
                                title="แก้ไขข้อมูลตัวชี้วัด (คำถามหลัก/ตัวตั้ง/ตัวหาร/เป้าหมาย)"
                                onClick={() => handleOpenEditIndicator(ind)}
                              >
                                <Edit size={14} />
                              </button>
                            )}

                            {/* Delete Indicator Button: Admin only */}
                            {userCanDelete && (
                              <button 
                                className="kpiBtnIconOnly danger"
                                title="ลบตัวชี้วัดนี้"
                                onClick={() => handleDeleteIndicator(ind)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}

                            {/* Show dash if user has no action permissions on this indicator */}
                            {!userCanAnswer && !userCanEdit && !userCanDelete && (
                              <span style={{ color: 'var(--kpi-text-muted)', fontSize: '0.8125rem' }}>-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── MODAL 1: ANSWER ENTRY (Simplified per user request) ── */}
        {answerModalOpen && activeIndicator && (
          <div className="kpiModalOverlay" onClick={() => setAnswerModalOpen(false)}>
            <div className="kpiModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--kpi-teal-700)', fontWeight: 600 }}>
                    {activeIndicator.code ? `${activeIndicator.code} • ` : ''}{activeIndicator.frequency}
                  </span>
                  <h2>ตอบผลการดำเนินงานตัวชี้วัด</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setAnswerModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                <div style={{ background: 'var(--kpi-surface-subtle)', padding: '0.875rem 1rem', borderRadius: 'var(--kpi-radius-md)', border: '1px solid var(--kpi-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--kpi-text-muted)', marginBottom: '0.25rem' }}>
                    {activeIndicator.category} {activeIndicator.subcategory ? `› ${activeIndicator.subcategory}` : ''}
                  </div>
                  {(activeIndicator.numeratorName || activeIndicator.denominatorName) && (
                    <div style={{ fontWeight: 600, color: 'var(--kpi-text-primary)', lineHeight: 1.45, marginBottom: '0.4rem', fontSize: '0.95rem' }}>
                      {activeIndicator.title}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8125rem', color: 'var(--kpi-text-secondary)' }}>
                    <strong>เป้าหมาย:</strong>{' '}
                    {activeIndicator.targetValue !== null 
                      ? `${activeIndicator.targetOperator || '>='} ${activeIndicator.targetValue}${activeIndicator.targetUnit || '%'}`
                      : activeIndicator.targetRaw || 'รอระบุเป้าหมาย'}
                    {' '}• <strong>ผู้รับผิดชอบ:</strong> {activeIndicator.responsibleName || 'ไม่ระบุ'}
                  </div>
                </div>

                {/* Period Selector */}
                <div className="kpiFormGroup">
                  <label style={{ fontWeight: 600 }}>รอบการประเมิน (ตามความถี่ {activeIndicator.frequency}):</label>
                  <select 
                    className="kpiTextInput"
                    value={formPeriodKey}
                    onChange={(e) => handleModalPeriodChange(e.target.value)}
                  >
                    {getPeriodsForFrequency(activeIndicator.frequency).map(p => (
                      <option key={p.key} value={p.key}>{p.label} - {p.description}</option>
                    ))}
                  </select>
                </div>

                {/* If Indicator HAS Numerator and Denominator */}
                {activeIndicator.numeratorName || activeIndicator.denominatorName ? (
                  <>
                    <div className="kpiFormGroup">
                      <label style={{ display: 'block', marginBottom: '0.45rem' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--kpi-teal-700)', background: 'var(--kpi-teal-50)', padding: '0.15rem 0.5rem', borderRadius: '4px', marginBottom: '0.3rem' }}>
                          คำถามตัวตั้ง (คำถามรอง 1)
                        </span>
                        <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--kpi-text-primary)', lineHeight: 1.5 }}>
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
                      <label style={{ display: 'block', marginBottom: '0.45rem' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--kpi-teal-700)', background: 'var(--kpi-teal-50)', padding: '0.15rem 0.5rem', borderRadius: '4px', marginBottom: '0.3rem' }}>
                          คำถามตัวหาร (คำถามรอง 2)
                        </span>
                        <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--kpi-text-primary)', lineHeight: 1.5 }}>
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
                        <div>
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
                    <label style={{ display: 'block', marginBottom: '0.45rem' }}>
                      <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--kpi-teal-700)', background: 'var(--kpi-teal-50)', padding: '0.15rem 0.5rem', borderRadius: '4px', marginBottom: '0.3rem' }}>
                        คำถามตัวชี้วัด (คำถามหลัก)
                      </span>
                      <span style={{ display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--kpi-text-primary)', lineHeight: 1.5 }}>
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
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleSaveAnswer}
                  disabled={saving}
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกผลการดำเนินงาน'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 2: EDIT / CREATE INDICATOR (Columns A - N) ── */}
        {editIndicatorModalOpen && (
          <div className="kpiModalOverlay" onClick={() => setEditIndicatorModalOpen(false)}>
            <div className="kpiModalCard" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
              <div className="kpiModalHeader">
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--kpi-teal-700)', fontWeight: 600 }}>
                    {isCreatingNew ? 'สร้างตัวชี้วัดใหม่' : 'แก้ไขข้อมูลตัวชี้วัด (A - N)'}
                  </span>
                  <h2>{isCreatingNew ? 'เพิ่มตัวชี้วัดลงในชุดข้อมูล' : 'แก้ไขข้อมูลตัวชี้วัด'}</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setEditIndicatorModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                {/* Row 1: Sequence & Code & OldCode */}
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '0.75rem' }}>
                  <div className="kpiFormGroup">
                    <label>ลำดับ (A):</label>
                    <input 
                      type="text"
                      placeholder="เช่น 1, 32"
                      className="kpiTextInput"
                      value={indFormSequence}
                      onChange={(e) => setIndFormSequence(e.target.value)}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>รหัส (D):</label>
                    <input 
                      type="text"
                      placeholder="เช่น HR-GID-0201"
                      className="kpiTextInput"
                      value={indFormCode}
                      onChange={(e) => setIndFormCode(e.target.value)}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>รหัสเดิม (E):</label>
                    <input 
                      type="text"
                      placeholder="เช่น DG0201"
                      className="kpiTextInput"
                      value={indFormOldCode}
                      onChange={(e) => setIndFormOldCode(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 2: Category & Subcategory */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div className="kpiFormGroup">
                    <label>หมวดตัวชี้วัด (B):</label>
                    <input 
                      type="text"
                      placeholder="เช่น หมวดที่ 1: IV-1 ด้านการดูแลสุขภาพ..."
                      className="kpiTextInput"
                      value={indFormCategory}
                      onChange={(e) => setIndFormCategory(e.target.value)}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>ประเด็น / กลุ่มโรค (C):</label>
                    <input 
                      type="text"
                      placeholder="เช่น โรคเรื้อรัง, Fast Track..."
                      className="kpiTextInput"
                      value={indFormSubcategory}
                      onChange={(e) => setIndFormSubcategory(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 3: Frequency & Type & Responsible */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 140px 1fr', gap: '0.75rem' }}>
                  <div className="kpiFormGroup">
                    <label>ความถี่ (F):</label>
                    <select 
                      className="kpiTextInput"
                      value={indFormFrequency}
                      onChange={(e) => setIndFormFrequency(e.target.value)}
                    >
                      <option value="ราย 6 เดือน">ราย 6 เดือน</option>
                      <option value="รายไตรมาส">รายไตรมาส</option>
                      <option value="รายเดือน">รายเดือน</option>
                      <option value="รายปี">รายปี</option>
                    </select>
                  </div>
                  <div className="kpiFormGroup">
                    <label>ประเภท (N):</label>
                    <input 
                      type="text"
                      placeholder="เช่น HA, Zone"
                      className="kpiTextInput"
                      value={indFormType}
                      onChange={(e) => setIndFormType(e.target.value)}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>ผู้รับผิดชอบ (K):</label>
                    <input 
                      type="text"
                      placeholder="ระบุชื่อบุคลากรหรือทีมงาน..."
                      className="kpiTextInput"
                      value={indFormResponsible}
                      onChange={(e) => setIndFormResponsible(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 4: Title / Main Question (G) */}
                <div className="kpiFormGroup">
                  <label>ตัวชี้วัด / คำถามหลัก (G): *</label>
                  <textarea 
                    placeholder="กรอกชื่อตัวชี้วัดหรือคำถามหลัก..."
                    className="kpiTextarea"
                    value={indFormTitle}
                    onChange={(e) => setIndFormTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Row 5: Numerator & Denominator (H & I) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="kpiFormGroup">
                    <label>ตัวตั้ง / คำถามรอง 1 (H):</label>
                    <textarea 
                      placeholder="คำอธิบายตัวตั้ง (ถ้ามี)..."
                      className="kpiTextarea"
                      value={indFormNumeratorName}
                      onChange={(e) => setIndFormNumeratorName(e.target.value)}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>ตัวหาร / คำถามรอง 2 (I):</label>
                    <textarea 
                      placeholder="คำอธิบายตัวหาร (ถ้ามี)..."
                      className="kpiTextarea"
                      value={indFormDenominatorName}
                      onChange={(e) => setIndFormDenominatorName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 6: Target Setting (J) */}
                <div style={{ background: 'var(--kpi-surface-subtle)', padding: '1rem', borderRadius: 'var(--kpi-radius-md)', border: '1px solid var(--kpi-border)' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>
                    เกณฑ์เป้าหมาย (J):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px 1.2fr', gap: '0.5rem' }}>
                    <select 
                      className="kpiTextInput"
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
                    <input 
                      type="number"
                      step="any"
                      placeholder="ตัวเลข เช่น 40, 0"
                      className="kpiTextInput"
                      value={indFormTargetVal}
                      onChange={(e) => setIndFormTargetVal(e.target.value)}
                    />
                    <input 
                      type="text"
                      placeholder="%"
                      className="kpiTextInput"
                      value={indFormTargetUnit}
                      onChange={(e) => setIndFormTargetUnit(e.target.value)}
                    />
                    <input 
                      type="text"
                      placeholder="ข้อความ เช่น ≥ 40%"
                      className="kpiTextInput"
                      value={indFormTargetRaw}
                      onChange={(e) => setIndFormTargetRaw(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="kpiModalFooter">
                <button 
                  className="kpiBtn kpiBtnSecondary" 
                  onClick={() => setEditIndicatorModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleSaveIndicator}
                  disabled={saving}
                >
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--kpi-teal-700)', fontWeight: 600 }}>
                    ผู้ดูแลระบบ (Admin)
                  </span>
                  <h2>นำเข้าชุดตัวชี้วัด (Excel .xlsx / CSV)</h2>
                </div>
                <button className="kpiModalClose" onClick={() => setImportModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="kpiModalBody">
                <div style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="kpiFormGroup">
                    <label>ปีงบประมาณ:</label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importYear}
                      onChange={(e) => setImportYear(e.target.value)}
                      placeholder={`เช่น ${defaultFiscalYear}`}
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>รหัสชุดตัวชี้วัด:</label>
                    <input 
                      type="text"
                      className="kpiTextInput"
                      value={importCode}
                      onChange={(e) => setImportCode(e.target.value)}
                      placeholder="เช่น THIP70final หรือ HA_2570"
                    />
                  </div>
                  <div className="kpiFormGroup">
                    <label>ชื่อชุดตัวชี้วัด:</label>
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
                  ยกเลิก
                </button>
                <button 
                  className="kpiBtn kpiBtnPrimary"
                  onClick={handleExecuteImport}
                  disabled={saving || importIndicators.length === 0}
                >
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
