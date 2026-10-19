'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Usb,
  User,
  MapPin,
  Calendar,
  ListFilter,
  Check,
  ExternalLink,
  Info,
  Download,
  Zap,
  Edit3,
  UserPlus,
  X,
} from 'lucide-react'
import {
  SmartCardData,
} from '@/lib/screening/smartCardReader'
import './page.css'

interface OperatorInfo {
  id?: number | null
  name?: string | null
  username?: string | null
  role?: string | null
  department?: string | null
}

interface Props {
  operator: OperatorInfo
}

interface RecentSavedItem {
  id: number
  cid: string
  fullName: string
  savedAt: string
  isManual?: boolean
}

export default function ScreeningScanClient({ operator }: Props) {
  const [stationId, setStationId] = useState<string>('1')
  const [deviceStatus, setDeviceStatus] = useState<string>('พร้อมอ่านบัตรประชาชน (Smart Card Direct Bridge)')
  const [isReading, setIsReading] = useState<boolean>(false)
  const [currentCard, setCurrentCard] = useState<SmartCardData | null>(null)
  const [showRawPayload, setShowRawPayload] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recentSaved, setRecentSaved] = useState<RecentSavedItem[]>([])
  const [sessionCount, setSessionCount] = useState<number>(0)

  // Cloud & Local Bridge States
  const [isBridgeConnected, setIsBridgeConnected] = useState<boolean>(false)
  const [bridgeReaderName, setBridgeReaderName] = useState<string>('')
  const [cardPresent, setCardPresent] = useState<boolean>(false)
  const [lastReadCid, setLastReadCid] = useState<string>('')
  const [lastSavedCid, setLastSavedCid] = useState<string>('')

  // Manual Entry States (กรณีคนไข้ลืมบัตรประชาชน)
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false)
  const [manualCid, setManualCid] = useState<string>('')
  const [manualTitle, setManualTitle] = useState<string>('นาย')
  const [manualFullName, setManualFullName] = useState<string>('')
  const [manualGender, setManualGender] = useState<string>('ชาย')
  const [manualAge, setManualAge] = useState<string>('')
  const [manualAddress, setManualAddress] = useState<string>('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [isManualSaving, setIsManualSaving] = useState<boolean>(false)
  const manualCidInputRef = useRef<HTMLInputElement>(null)

  // Refs for tracking state inside stable SSE handlers without teardown
  const currentCardRef = useRef<SmartCardData | null>(null)
  currentCardRef.current = currentCard

  const isReadingRef = useRef<boolean>(false)
  isReadingRef.current = isReading

  const lastSavedCidRef = useRef<string>('')
  lastSavedCidRef.current = lastSavedCid

  const lastReadCidRef = useRef<string>('')
  lastReadCidRef.current = lastReadCid

  const saveButtonRef = useRef<HTMLButtonElement>(null)

  // Web Audio tone for successful card scan / save
  const playBeep = useCallback((freq = 880, type: OscillatorType = 'sine', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio might be blocked by browser policy until interaction
    }
  }, [])

  // Universal Card Apply Handler (used by Direct Bridge, Paste, Clipboard & SSE)
  const applyCardData = useCallback((cardData: any) => {
    if (!cardData || !cardData.cid || cardData.cid.length < 13) return
    setLastReadCid(cardData.cid)
    setCurrentCard({
      cid: cardData.cid,
      titleTh: cardData.titleTh || '',
      firstNameTh: cardData.firstNameTh || '',
      lastNameTh: cardData.lastNameTh || '',
      fullNameTh: cardData.fullNameTh || '',
      titleEn: cardData.titleEn || '',
      firstNameEn: cardData.firstNameEn || '',
      lastNameEn: cardData.lastNameEn || '',
      fullNameEn: cardData.fullNameEn || '',
      birthDate: cardData.birthDate || '',
      gender: cardData.gender || 'ไม่ระบุ',
      address: cardData.address || '',
      photoBase64: cardData.photo || cardData.photoBase64 || undefined,
      rawPayload: cardData,
    })
    setIsBridgeConnected(true)
    setCardPresent(true)
    setDeviceStatus('อ่านข้อมูลจากบัตรประชาชนสำเร็จ (Smart Card Direct Bridge)')
    playBeep(1046, 'sine', 0.12)
    setTimeout(() => {
      saveButtonRef.current?.focus()
    }, 80)
  }, [playBeep])

  // Direct Browser Bridge: Listen for automatic Card Paste events from Bridge .exe
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text')
      if (!text) return
      try {
        if (text.includes('"thoen_smartcard_bridge"')) {
          e.preventDefault()
          const json = JSON.parse(text)
          if (json.status === 'ready' || json.action === 'status') {
            setIsBridgeConnected(true)
            setBridgeReaderName(json.reader || 'Smart Card Reader')
            setDeviceStatus(`เชื่อมต่อเครื่องอ่านบัตรแล้ว: ${json.reader || 'พร้อมอ่านบัตร'}`)
            playBeep(880, 'sine', 0.1)
            return
          }
          const cardData = json.card || json.data || json
          if (cardData && cardData.cid && cardData.cid.length >= 13) {
            applyCardData(cardData)
          }
        } else if (text.includes('"cid"') && text.includes('"fullNameTh"')) {
          e.preventDefault()
          const json = JSON.parse(text)
          const cardData = json.card || json.data || json
          if (cardData && cardData.cid && cardData.cid.length >= 13) {
            applyCardData(cardData)
          }
        }
      } catch {
        // Not a card JSON payload
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [applyCardData, playBeep])

  // Initial check on mount: Read status or card from clipboard if bridge was already run
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.readText().then((text) => {
        if (text && text.includes('"thoen_smartcard_bridge"')) {
          try {
            const json = JSON.parse(text)
            if (json.status === 'ready') {
              setIsBridgeConnected(true)
              setBridgeReaderName(json.reader || 'Smart Card Reader')
              setDeviceStatus(`เชื่อมต่อเครื่องอ่านบัตรแล้ว: ${json.reader || 'พร้อมอ่านบัตร'}`)
            } else if (json.card && json.card.cid) {
              applyCardData(json.card)
            }
          } catch { }
        }
      }).catch(() => { })
    }
  }, [applyCardData])

  // Optional local fetch helper (works if running localhost or unblocked)
  const lastWorkingBaseUrlRef = useRef<string>('http://localhost:8084')

  const fetchFromBridge = useCallback(async (endpoint: 'status' | 'read') => {
    const primary = lastWorkingBaseUrlRef.current
    const secondary = primary === 'http://localhost:8084' ? 'http://127.0.0.1:8084' : 'http://localhost:8084'
    const targets = [primary, secondary]

    for (const baseUrl of targets) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), endpoint === 'read' ? 6000 : 1200)
        const res = await fetch(`${baseUrl}/${endpoint}`, {
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-store',
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          lastWorkingBaseUrlRef.current = baseUrl
          return await res.json()
        }
      } catch {
        // Target unreachable or blocked, try next
      }
    }

    return null
  }, [])

  // Manual trigger / fallback helper (reads Clipboard first, then local port)
  const readCardFromBridge = useCallback(
    async (isManual = false) => {
      setIsReading(true)
      if (isManual) setErrorMessage(null)

      try {
        // 1. Try reading from Clipboard first (100% works on HTTPS, zero mixed content)
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          try {
            const text = await navigator.clipboard.readText()
            if (text && (text.includes('"thoen_smartcard_bridge"') || (text.includes('"cid"') && text.includes('"fullNameTh"')))) {
              const json = JSON.parse(text)
              const cardData = json.card || json.data || json
              if (cardData && cardData.cid && cardData.cid.length >= 13) {
                applyCardData(cardData)
                return
              }
            }
          } catch {
            // Clipboard read permission might be required or denied
          }
        }

        // 2. Try local fetch (if unblocked / localhost)
        const result = await fetchFromBridge('read')
        const cardData = result?.data || result
        if (result && result.success !== false && cardData && cardData.cid && cardData.cid.length >= 13) {
          applyCardData(cardData)
          return
        }

        if (isManual) {
          setErrorMessage('กรุณาเสียบบัตรประชาชนเข้าเครื่องอ่าน แล้วกดปุ่ม F2 หรือคลิกอ่านข้อมูลจากบัตรอีกครั้ง')
        }
      } catch {
        if (isManual) {
          setErrorMessage('กรุณาเสียบบัตรประชาชนเข้าเครื่องอ่าน แล้วกดปุ่ม F2 หรือคลิกอ่านข้อมูลจากบัตรอีกครั้ง')
        }
      } finally {
        setIsReading(false)
      }
    },
    [fetchFromBridge, applyCardData]
  )

  // Real-time Cloud SSE Bridge Connection (Zero-Config, Works on HTTPS)
  useEffect(() => {
    let eventSource: EventSource | null = null
    let isCancelled = false

    const connectSSE = () => {
      if (isCancelled) return
      if (eventSource) {
        eventSource.close()
      }

      const streamUrl = `/api/service/screening/bridge-stream?station=${encodeURIComponent(stationId)}`
      const es = new EventSource(streamUrl)
      eventSource = es

      es.addEventListener('status', (e: MessageEvent) => {
        if (isCancelled) return
        try {
          const payload = JSON.parse(e.data)
          const online = Boolean(payload.online)
          setIsBridgeConnected(online)
          setBridgeReaderName(payload.reader || '')
          const isPresent = Boolean(payload.cardPresent)
          setCardPresent(isPresent)

          if (online) {
            if (isPresent) {
              setDeviceStatus(`ตรวจพบบัตรประชาชนในเครื่อง (${payload.reader || 'Smart Card Reader'})`)
            } else {
              setDeviceStatus(`Smart Card Bridge ออนไลน์ (โต๊ะ ${stationId}): ${payload.reader || 'พร้อมอ่านบัตร'}`)
            }
          }
        } catch {
          // ignore parse error
        }
      })

      es.addEventListener('card', (e: MessageEvent) => {
        if (isCancelled) return
        try {
          const cardData = JSON.parse(e.data)
          if (cardData && cardData.cid && cardData.cid.length >= 13) {
            if (currentCardRef.current?.cid !== cardData.cid) {
              applyCardData(cardData)
            }
          }
        } catch {
          // ignore parse error
        }
      })

      es.addEventListener('card_removed', () => {
        if (isCancelled) return
        setCardPresent(false)
        setLastSavedCid('')
        setLastReadCid('')
        setDeviceStatus(`นำบัตรออกแล้ว: พร้อมรับบัตรประชาชนคนถัดไป (โต๊ะ ${stationId})`)
      })

      es.onerror = () => {
        if (isCancelled) return
        // EventSource will automatically reconnect in the background
      }
    }

    connectSSE()

    return () => {
      isCancelled = true
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [stationId, applyCardData])

  // Save current card to screening queue
  const handleSaveQueue = async () => {
    if (!currentCard || isSaving) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/service/screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: currentCard.cid,
          title: currentCard.titleTh || null,
          firstName: currentCard.firstNameTh || null,
          lastName: currentCard.lastNameTh || null,
          fullName: currentCard.fullNameTh || null,
          gender: currentCard.gender || null,
          birthDate: currentCard.birthDate || null,
          address: currentCard.address || null,
          photoBase64: currentCard.photoBase64 || null,
          status: 'WAITING',
        }),
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        if (res.status === 404) {
          throw new Error('เซิร์ฟเวอร์ยังไม่อัปเดตระบบคัดกรอง (HTTP 404): กรุณาอัปเดตโค้ดบนเซิร์ฟเวอร์แล้วรัน npm run build')
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`เซสชันสมาชิกหมดอายุ (HTTP ${res.status}) กรุณารีเฟรชหน้าเว็บหรือเข้าสู่ระบบใหม่`)
        }
        if (res.status === 413) {
          throw new Error('ขนาดข้อมูลภาพใหญ่เกินขีดจำกัดของเซิร์ฟเวอร์ (HTTP 413 Payload Too Large)')
        }
        throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${res.status}): ${text.slice(0, 80)}`)
      }

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      const savedData = json.data
      playBeep(1318, 'triangle', 0.2)

      setSuccessBanner(`บันทึก ${savedData.fullName} เข้าระบบคิวเรียบร้อยแล้ว`)
      setSessionCount((prev) => prev + 1)

      const timeStr = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date())

      setRecentSaved((prev) => [
        {
          id: savedData.id,
          cid: savedData.cid,
          fullName: savedData.fullName,
          savedAt: timeStr,
        },
        ...prev.slice(0, 9),
      ])

      setLastSavedCid(currentCard.cid)
      setCurrentCard(null)
      setShowRawPayload(false)

      setTimeout(() => {
        setSuccessBanner((cur) =>
          cur === `บันทึก ${savedData.fullName} เข้าระบบคิวเรียบร้อยแล้ว` ? null : cur
        )
      }, 4000)
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
      playBeep(330, 'sawtooth', 0.25)
    } finally {
      setIsSaving(false)
    }
  }

  // Manual Entry Form Helpers
  const currentThaiYear = new Date().getFullYear() + 543
  const ageNum = parseInt(manualAge.trim(), 10)
  const calculatedBirthYear = !isNaN(ageNum) && ageNum > 0 && ageNum <= 130
    ? currentThaiYear - ageNum
    : null

  /**
   * Normalizes Thai name with title separation.
   * Ensures title prefix is separated from first name by a space,
   * matching physical Smart Card chip output (e.g. "นาย พิสุทธิ์ ยิ้มกุศล").
   */
  const formatThaiNameWithTitle = useCallback((titleInput: string, rawNameInput: string) => {
    const commonTitles = ['นางสาว', 'นาย', 'นาง', 'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'พระภิกษุ', 'พระ']
    let title = (titleInput || '').trim()
    let name = (rawNameInput || '').trim()

    // Detect title from rawName if title dropdown not specified
    if (!title) {
      for (const t of commonTitles) {
        if (name.startsWith(t)) {
          title = t
          break
        }
      }
    }

    // Strip duplicate title from name if user typed it in the text box as well
    if (title) {
      if (name.startsWith(title + ' ')) {
        name = name.slice((title + ' ').length).trim()
      } else if (name.startsWith(title)) {
        name = name.slice(title.length).trim()
      }
    }

    // Split remainder into firstName and lastName
    const parts = name.split(/\s+/).filter(Boolean)
    const firstName = parts[0] || ''
    const lastName = parts.slice(1).join(' ') || ''

    // Always separate title and first name with a space (matches physical smart card reader output)
    const fullName = [title, firstName, lastName].filter(Boolean).join(' ').trim()

    return { title, firstName, lastName, fullName }
  }, [])

  const parsedName = formatThaiNameWithTitle(manualTitle, manualFullName)

  const handleOpenManualModal = useCallback(() => {
    setManualError(null)
    setIsManualModalOpen(true)
    setTimeout(() => {
      manualCidInputRef.current?.focus()
    }, 100)
  }, [])

  const handleCloseManualModal = useCallback(() => {
    if (isManualSaving) return
    setIsManualModalOpen(false)
    setManualError(null)
  }, [isManualSaving])

  const handleTitleChange = (newTitle: string) => {
    setManualTitle(newTitle)
    if (['นาย', 'ด.ช.', 'พระ'].includes(newTitle)) {
      setManualGender('ชาย')
    } else if (['นาง', 'นางสาว', 'ด.ญ.'].includes(newTitle)) {
      setManualGender('หญิง')
    }
  }

  const handleManualCidChange = (val: string) => {
    const digitsOnly = val.replace(/[^0-9]/g, '').slice(0, 13)
    setManualCid(digitsOnly)
    if (manualError && digitsOnly.length === 13) {
      setManualError(null)
    }
  }

  const handleSaveManualEntry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isManualSaving) return

    setManualError(null)

    // 1. Validate CID (Mandatory 13 digits)
    const cleanCid = manualCid.replace(/[^0-9]/g, '')
    if (cleanCid.length !== 13) {
      setManualError('กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก')
      manualCidInputRef.current?.focus()
      playBeep(330, 'sawtooth', 0.25)
      return
    }

    // 2. Validate Full Name (Mandatory)
    const parsed = formatThaiNameWithTitle(manualTitle, manualFullName)
    if (!parsed.firstName) {
      setManualError('กรุณากรอกชื่อ - สกุล ของผู้รับบริการ')
      playBeep(330, 'sawtooth', 0.25)
      return
    }

    // 3. Validate Gender (Mandatory)
    if (!manualGender) {
      setManualError('กรุณาระบุเพศของผู้รับบริการ')
      playBeep(330, 'sawtooth', 0.25)
      return
    }

    // 4. Validate Age (Mandatory 1-130)
    const validAge = parseInt(manualAge.trim(), 10)
    if (isNaN(validAge) || validAge <= 0 || validAge > 130) {
      setManualError('กรุณากรอกอายุที่ถูกต้อง (1 - 130 ปี)')
      playBeep(330, 'sawtooth', 0.25)
      return
    }

    // Estimated birth date in Buddhist calendar year (YYYY-01-01)
    const birthYear = currentThaiYear - validAge
    const birthDateStr = `${birthYear}-01-01`

    setIsManualSaving(true)

    try {
      const res = await fetch('/api/service/screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: cleanCid,
          title: parsed.title || null,
          firstName: parsed.firstName || null,
          lastName: parsed.lastName || null,
          fullName: parsed.fullName,
          gender: manualGender,
          birthDate: birthDateStr,
          address: manualAddress.trim() || null,
          rawPayload: { isManualEntry: true, manualAge: validAge },
          status: 'WAITING',
        }),
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${res.status}): ${text.slice(0, 80)}`)
      }

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      const savedData = json.data
      playBeep(1318, 'triangle', 0.2)

      setSuccessBanner(`บันทึก ${savedData.fullName} (กรอกเอง) เข้าระบบคิวเรียบร้อยแล้ว`)
      setSessionCount((prev) => prev + 1)

      const timeStr = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date())

      setRecentSaved((prev) => [
        {
          id: savedData.id,
          cid: savedData.cid,
          fullName: savedData.fullName,
          savedAt: timeStr,
          isManual: true,
        },
        ...prev.slice(0, 9),
      ])

      // Close modal and reset fields
      setIsManualModalOpen(false)
      setManualCid('')
      setManualFullName('')
      setManualAge('')
      setManualAddress('')
      setManualError(null)

      setTimeout(() => {
        setSuccessBanner((cur) =>
          cur === `บันทึก ${savedData.fullName} (กรอกเอง) เข้าระบบคิวเรียบร้อยแล้ว` ? null : cur
        )
      }, 4000)
    } catch (err: any) {
      setManualError(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
      playBeep(330, 'sawtooth', 0.25)
    } finally {
      setIsManualSaving(false)
    }
  }

  // Keyboard shortcut listener for Enter, Escape, F2, and F4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isManualModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          handleCloseManualModal()
        }
        return
      }

      if (e.key === 'Enter' && currentCard && !isSaving) {
        e.preventDefault()
        handleSaveQueue()
      } else if (e.key === 'Escape' && currentCard) {
        e.preventDefault()
        setCurrentCard(null)
      } else if (e.key === 'F2') {
        e.preventDefault()
        readCardFromBridge(true)
      } else if (e.key === 'F4') {
        e.preventDefault()
        handleOpenManualModal()
      }
    }

    const handleWindowFocus = () => {
      if (!currentCardRef.current && !isReadingRef.current && !isManualModalOpen) {
        readCardFromBridge(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [
    currentCard,
    isSaving,
    readCardFromBridge,
    isManualModalOpen,
    handleCloseManualModal,
    handleOpenManualModal,
  ])

  return (
    <div className="scanPage">
      <div className="scanContainer">
        {/* Top Header Card */}
        <div className="scanHeaderCard">
          <div className="scanTitleWrapper">
            <div className="scanIconBadge">
              <CreditCard size={26} />
            </div>
            <div className="scanTitleSection">
              <h1>
                <span>จุดอ่านบัตรประชาชนตรวจนอกพื้นที่</span>
                <span className="scanBadgeKiosk">Smart Card Kiosk</span>
              </h1>
              <p className="scanSubtitle">
                เสียบบัตรเพื่อนำเข้ารายชื่อผู้รับบริการอย่างต่อเนื่อง (Rapid Batch Flow)
              </p>
            </div>
          </div>

          <div className="scanNavControls">
            <button
              type="button"
              onClick={handleOpenManualModal}
              className="btnHeaderManualEntry"
              title="เปิดฟอร์มกรอกข้อมูลด้วยตัวเอง กรณีผู้รับบริการไม่มีบัตรประชาชน หรือลืมบัตร (กดแป้น F4)"
            >
              <UserPlus size={16} />
              <span>กรอกข้อมูลเอง (F4)</span>
            </button>
            <Link
              href="/service/screening"
              target="_blank"
              className="dashboardQuickLink"
            >
              <ListFilter size={15} />
              <span>เปิดแดชบอร์ดติดตามคิว</span>
              <ExternalLink size={13} style={{ marginLeft: '2px', opacity: 0.8 }} />
            </Link>
            <Link href="/service" className="backServiceBtn">
              กลับหน้าบริการ
            </Link>
          </div>
        </div>

        {/* Smart Card Bridge Guidance & Download Banner */}
        <div className={`bridgeBannerCard ${isBridgeConnected ? 'connected' : ''}`}>
          <div className="bridgeBannerTop">
            <div className="bridgeBannerTitleGroup">
              <div className="bridgeBadgeIcon">
                {isBridgeConnected ? <Zap size={24} /> : <CreditCard size={24} />}
              </div>
              <div>
                <h3>
                  <span>
                    {isBridgeConnected
                      ? `Smart Card Bridge ออนไลน์ (โต๊ะที่ ${stationId})`
                      : `ระบบอ่านบัตรประชาชน Smart Card (โต๊ะที่ ${stationId})`}
                  </span>
                  <span
                    className="bridgeConnectedTag"
                    style={{
                      background: isBridgeConnected ? '#ecfdf5' : '#f0fdf4',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    {isBridgeConnected ? '● ออนไลน์ (เชื่อมต่อแล้ว)' : '● พร้อมรับข้อมูล (Direct Bridge)'}
                  </span>
                </h3>
                <p>
                  {isBridgeConnected
                    ? `ตรวจพบเครื่องอ่าน: ${bridgeReaderName || 'Smart Card Reader'} (เสียบบัตรประชาชนได้เลยทันที ข้อมูลจะส่งเข้าหน้าจอนี้อัตโนมัติ)`
                    : 'เปิดโปรแกรม thoen-smartcard-bridge.exe ไว้ที่เครื่อง เสียบบัตรประชาชนแล้วข้อมูลจะส่งขึ้นหน้าจอนี้ทันที (หรือกดแป้น F2 เพื่อดึงข้อมูล)'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <a
                href="/downloads/thoen-smartcard-bridge.exe"
                download="thoen-smartcard-bridge.exe"
                className="bridgeDownloadBtn"
                title="คลิกเพื่อดาวน์โหลดโปรแกรมตัวเชื่อมต่อเครื่องอ่านบัตร"
              >
                <Download size={18} />
                <span>ดาวน์โหลด Bridge (.exe)</span>
              </a>
            </div>
          </div>

          {/* 3 Step Instructions */}
          <div className="bridgeStepsGrid">
            <div className="bridgeStepItem">
              <div className="stepNumberCircle">1</div>
              <div className="stepContent">
                <h4>เปิดโปรแกรม Bridge</h4>
                <p>เปิดไฟล์ <strong>thoen-smartcard-bridge.exe</strong> ทิ้งไว้ที่เครื่อง หน้าต่างสีดำจะพร้อมอ่านบัตรอัตโนมัติ</p>
              </div>
            </div>

            <div className="bridgeStepItem">
              <div className="stepNumberCircle">2</div>
              <div className="stepContent">
                <h4>เสียบบัตรประชาชน</h4>
                <p>เสียบบัตรประชาชนเข้าเครื่องอ่าน USB ระบบจะอ่านและส่งข้อมูลขึ้นหน้าจอนี้โดยตรง</p>
              </div>
            </div>

            <div className="bridgeStepItem">
              <div className="stepNumberCircle">3</div>
              <div className="stepContent">
                <h4>กดปุ่ม Enter เพื่อบันทึก</h4>
                <p>ตรวจสอบข้อมูลผู้รับบริการ แล้วกดปุ่ม <strong>Enter</strong> บนคีย์บอร์ดเพื่อบันทึกเข้าคิว</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hardware Status & Operator Bar */}
        <div className="hardwareBar">
          <div className="deviceStatusGroup">
            <div className={`usbIconCircle ${isBridgeConnected ? 'connected' : ''}`}>
              <Usb size={20} />
            </div>
            <div className="deviceStatusText">
              <span className="deviceStatusLabel">
                <span>สถานะเครื่องอ่านบัตร</span>
                <span className={`statusLedDot ${isBridgeConnected ? 'active' : ''}`} />
              </span>
              <span className="deviceName">{deviceStatus}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="stationSelectorBadge">
              <span>จุดบริการ: </span>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="stationSelect"
                title="เลือกหมายเลขโต๊ะตรวจ/จุดบริการ"
              >
                <option value="1">โต๊ะที่ 1 (ค่าเริ่มต้น)</option>
                <option value="2">โต๊ะที่ 2</option>
                <option value="3">โต๊ะที่ 3</option>
                <option value="4">โต๊ะที่ 4</option>
                <option value="5">โต๊ะที่ 5</option>
              </select>
            </div>

            <div className="operatorMetaBox">
              <div>
                <span style={{ color: '#94a3b8' }}>ผู้ปฏิบัติงาน: </span>
                <strong style={{ color: '#1e293b' }}>{operator.name || operator.username}</strong>
              </div>
              <div className="sessionCounterBadge">
                บันทึกแล้วในเซสชันนี้: {sessionCount} คน
              </div>
            </div>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="successBannerBox">
            <div className="successBannerContent">
              <CheckCircle size={24} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <p className="successBannerTitle">{successBanner}</p>
                <p className="successBannerDesc">
                  ระบบได้เพิ่มชื่อเข้าคิวแล้ว และรีเซ็ตหน้าจอพร้อมรับบัตรคนถัดไปทันที
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="dismissBtn"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '1rem', borderRadius: '14px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Grid: Card Reader Interface & Recent History */}
        <div className="scanMainGrid">
          {/* Card Reader Area */}
          <div>
            {!currentCard ? (
              /* Waiting Card Slot */
              <div className="emptyCardSlot">
                <div className="cardIconPulseCircle">
                  <CreditCard size={38} />
                </div>
                <h3 className="emptyCardTitle">
                  {cardPresent ? 'ตรวจพบบัตรประชาชนในเครื่อง' : 'พร้อมรับข้อมูลบัตรประชาชน (Smart Card)'}
                </h3>
                <p className="emptyCardDesc">
                  เสียบบัตรประชาชนเข้าเครื่องอ่าน USB ข้อมูลจะปรากฏบนหน้าจอโดยอัตโนมัติ (หรือกดแป้น <strong>F2</strong> / คลิกปุ่มอ่านข้อมูลด้านล่าง)
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => readCardFromBridge(true)}
                    disabled={isReading}
                    className="btnManualReadCard"
                    title="คลิกเพื่อสั่งอ่านข้อมูลจากบัตรประชาชนในเครื่องอ่าน หรือกดแป้น F2"
                  >
                    <CreditCard size={18} />
                    <span>{isReading ? 'กำลังดึงข้อมูล...' : 'อ่านข้อมูลจากบัตรประชาชน (F2)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenManualModal}
                    className="btnManualEntrySlot"
                    title="เปิดฟอร์มกรอกข้อมูลด้วยตัวเอง กรณีผู้รับบริการไม่มีบัตรประชาชน หรือลืมบัตร (กดแป้น F4)"
                  >
                    <Edit3 size={17} />
                    <span>กรอกข้อมูลด้วยตัวเอง (ลืมบัตร/F4)</span>
                  </button>

                  <a
                    href="/downloads/thoen-smartcard-bridge.exe"
                    download="thoen-smartcard-bridge.exe"
                    className="bridgeDownloadBtn"
                    style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', opacity: isBridgeConnected ? 0.75 : 1 }}
                    title="ดาวน์โหลดโปรแกรม Thoen Smart Card Bridge ไปเปิดไว้ที่คอมพิวเตอร์"
                  >
                    <Download size={18} />
                    <span>ดาวน์โหลด Bridge (.exe)</span>
                  </a>
                </div>
              </div>
            ) : (
              /* Card Data Preview & Action Card */
              <div className="idCardMockup">
                <div className="idCardTopHeader">
                  <div className="idCardHeaderTitle">
                    <CreditCard size={22} style={{ color: '#a7f3d0' }} />
                    <div>
                      <h3>ข้อมูลจากบัตรประจำตัวประชาชน</h3>
                      <p>ตรวจสอบความถูกต้องก่อนกดบันทึกเข้าคิว</p>
                    </div>
                  </div>
                  <span className="readSuccessBadge">
                    อ่านสำเร็จ
                  </span>
                </div>

                <div className="idCardBody">
                  {/* Citizen ID Large Display */}
                  <div className="cidDisplayCard">
                    <div>
                      <span className="cidLabel">เลขประจำตัวประชาชน (13 หลัก)</span>
                      <div className="cidNumber">
                        {currentCard.cid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}
                      </div>
                    </div>
                    <div>
                      <span className="genderTag">
                        เพศ: {currentCard.gender || 'ไม่ระบุ'}
                      </span>
                    </div>
                  </div>

                  {/* Photo & Demographics Details Container */}
                  <div className="idCardDetailsContainer">
                    {currentCard.photoBase64 && (
                      <div className="idCardPhotoWrapper" title="รูปถ่ายหน้าตรงจากชิปบัตรประชาชน">
                        <img
                          src={currentCard.photoBase64}
                          alt="รูปถ่ายบัตรประชาชน"
                          className="idCardPhotoImage"
                        />
                      </div>
                    )}
                    <div className="demographicsWrapper">
                      {/* Name and Demographics */}
                      <div className="demographicsGrid">
                        <div className="demographicBox">
                          <span className="boxLabel">
                            <User size={14} />
                            <span>ชื่อ - สกุล (ภาษาไทย)</span>
                          </span>
                          <p className="boxValueLarge">{currentCard.fullNameTh}</p>
                          {currentCard.fullNameEn && (
                            <p className="boxValueSub">{currentCard.fullNameEn}</p>
                          )}
                        </div>

                        <div className="demographicBox">
                          <span className="boxLabel">
                            <Calendar size={14} />
                            <span>วันเดือนปีเกิด</span>
                          </span>
                          <p className="boxValueMedium">{currentCard.birthDate || 'ไม่ระบุ'}</p>
                          <p className="boxValueSub">พ.ศ. ตามฐานข้อมูลบัตร</p>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="demographicBox">
                        <span className="boxLabel">
                          <MapPin size={14} />
                          <span>ที่อยู่ตามทะเบียนบ้าน</span>
                        </span>
                        <p className="boxAddress">{currentCard.address || 'ไม่ระบุที่อยู่'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Raw JSON Payload */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowRawPayload(!showRawPayload)}
                      className="rawPayloadToggleBtn"
                    >
                      <Info size={14} />
                      <span>{showRawPayload ? 'ซ่อนข้อมูลดิบจากบัตร (Raw Payload)' : 'ดูข้อมูลดิบทั้งหมดที่เครื่องอ่านส่งมา (Raw Payload)'}</span>
                    </button>
                    {showRawPayload && (
                      <div className="rawPayloadWrapper">
                        <pre className="rawPayloadBox">
                          {(() => {
                            if (!currentCard.rawPayload) return 'ไม่มีข้อมูลดิบ'
                            if (typeof currentCard.rawPayload === 'object' && currentCard.rawPayload !== null) {
                              const displayPayload: Record<string, unknown> = { ...(currentCard.rawPayload as Record<string, unknown>) }
                              if (typeof displayPayload.photo === 'string' && displayPayload.photo.length > 100) {
                                displayPayload.photo = `[รูปถ่ายขนาด ${displayPayload.photo.length.toLocaleString('th-TH')} ตัวอักษร (JPEG Base64)]`
                              }
                              return JSON.stringify(displayPayload, null, 2)
                            }
                            return String(currentCard.rawPayload)
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Big Primary Action Buttons */}
                  <div className="cardActionButtons">
                    <button
                      ref={saveButtonRef}
                      type="button"
                      onClick={handleSaveQueue}
                      disabled={isSaving}
                      className="btnPrimarySave"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw size={20} className="refreshIconSpin" />
                          <span>กำลังบันทึกข้อมูล...</span>
                        </>
                      ) : (
                        <>
                          <Check size={22} style={{ strokeWidth: 3 }} />
                          <span>เพิ่มเข้าระบบ (กดปุ่ม Enter)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentCard(null)}
                      disabled={isSaving}
                      className="btnSecondaryClear"
                    >
                      ยกเลิก / ล้างหน้าจอ (Esc)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="recentScansBox">
              <div className="recentScansHeader">
                <h4>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  <span>บันทึกล่าสุดในเซสชันนี้</span>
                </h4>
                <span className="recentBadgeCount">
                  {recentSaved.length} รายการ
                </span>
              </div>

              {recentSaved.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  ยังไม่มีรายการที่บันทึกในเซสชันนี้
                </div>
              ) : (
                <div className="recentScansList">
                  {recentSaved.map((item, idx) => (
                    <div key={item.id || idx} className="recentScanItem">
                      <div>
                        <div className="recentItemName">
                          <span>{item.fullName}</span>
                          {item.isManual && (
                            <span className="badgeManualScan" title="บันทึกด้วยการกรอกข้อมูลเอง">
                              กรอกเอง
                            </span>
                          )}
                        </div>
                        <div className="recentItemCid">
                          {item.cid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}
                        </div>
                      </div>
                      <span className="recentItemTime">{item.savedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="guideBox">
              <h5>
                <Info size={16} />
                <span>คำแนะนำการใช้งานจุดอ่านบัตร</span>
              </h5>
              <ul className="guideList">
                <li>เปิดโปรแกรม <strong>thoen-smartcard-bridge.exe</strong> ทิ้งไว้ที่เครื่อง</li>
                <li>เมื่อเสียบบัตรประชาชน ระบบจะดึงข้อมูลพรีวิวขึ้นหน้าจออัตโนมัติทันที</li>
                <li>กรณีผู้รับบริการไม่มีบัตร/ลืมบัตร กดปุ่ม <strong>กรอกข้อมูลเอง (F4)</strong> เพื่อบันทึกเข้าคิวได้</li>
                <li>กดปุ่ม <strong>Enter</strong> บนคีย์บอร์ดเพื่อบันทึกเข้าคิว</li>
                <li>เมื่อบันทึกเสร็จ หน้าจอจะล้างและค้างไว้เพื่อพร้อมรับคนถัดไปทันที</li>
                <li>จุดคัดกรองหรือห้องบัตรสามารถเปิดดูรายชื่อสดได้ที่หน้า <Link href="/service/screening" target="_blank" style={{ color: '#047857', fontWeight: 700, textDecoration: 'underline' }}>แดชบอร์ดคิว</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Entry Modal Dialog (กรณีไม่มีบัตรประชาชน) */}
      {isManualModalOpen && (
        <div
          className="manualModalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isManualSaving) {
              handleCloseManualModal()
            }
          }}
        >
          <div className="manualModalCard" role="dialog" aria-modal="true" aria-labelledby="manualModalTitle">
            {/* Modal Header */}
            <div className="manualModalHeader">
              <div className="manualModalTitleGroup">
                <div className="manualModalIconBadge">
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 id="manualModalTitle">
                    <span>กรอกข้อมูลผู้รับบริการด้วยตัวเอง</span>
                    <span className="manualModalBadgeNoCard">กรณีไม่มีบัตร</span>
                  </h3>
                  <p>บันทึกเข้าคิวตรวจสำหรับผู้รับบริการที่ไม่ได้นำบัตรประชาชนมา</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseManualModal}
                disabled={isManualSaving}
                className="manualModalCloseBtn"
                title="ปิดหน้าต่าง (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveManualEntry} style={{ display: 'contents' }}>
              <div className="manualModalBody">
                {manualError && (
                  <div className="manualErrorBox">
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{manualError}</span>
                  </div>
                )}

                {/* 1. Citizen ID (Mandatory 13 digits) */}
                <div className="manualFormGroup">
                  <label className="manualFormLabel" htmlFor="manualCid">
                    <span className="manualLabelLeft">
                      <span>เลขประจำตัวประชาชน (13 หลัก)</span>
                      <span className="manualRequiredStar">*</span>
                    </span>
                    <span className={`manualCidCounter ${manualCid.length === 13 ? 'complete' : ''}`}>
                      {manualCid.length}/13
                    </span>
                  </label>
                  <input
                    ref={manualCidInputRef}
                    id="manualCid"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={13}
                    placeholder="กรอกตัวเลข 13 หลัก (เช่น 1529900000000)"
                    value={manualCid}
                    onChange={(e) => handleManualCidChange(e.target.value)}
                    className="manualInput manualInputCid"
                    required
                  />
                </div>

                {/* 2. Full Name & Title (Mandatory) */}
                <div className="manualFormGroup">
                  <label className="manualFormLabel" htmlFor="manualFullName">
                    <span className="manualLabelLeft">
                      <User size={15} style={{ color: '#64748b' }} />
                      <span>คำนำหน้า และ ชื่อ - สกุล</span>
                      <span className="manualRequiredStar">*</span>
                    </span>
                  </label>
                  <div className="manualNameRow">
                    <select
                      value={manualTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="manualInput"
                      title="เลือกคำนำหน้าชื่อ"
                    >
                      <option value="นาย">นาย</option>
                      <option value="นาง">นาง</option>
                      <option value="นางสาว">นางสาว</option>
                      <option value="ด.ช.">ด.ช.</option>
                      <option value="ด.ญ.">ด.ญ.</option>
                      <option value="พระ">พระภิกษุ/สามเณร</option>
                      <option value="">อื่นๆ / ไม่ระบุ</option>
                    </select>
                    <input
                      id="manualFullName"
                      type="text"
                      placeholder="เช่น พิสุทธิ์ ยิ้มกุศล"
                      value={manualFullName}
                      onChange={(e) => setManualFullName(e.target.value)}
                      className="manualInput"
                      required
                    />
                  </div>
                  {parsedName.fullName && (
                    <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.35rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>รูปแบบชื่อ:</span>
                      <strong style={{ background: '#ecfdf5', color: '#065f46', padding: '0.15rem 0.55rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                        {parsedName.fullName}
                      </strong>
                    </div>
                  )}
                </div>

                {/* 3. Gender & Age Row (Both Mandatory) */}
                <div className="manualGenderAgeRow">
                  {/* Gender */}
                  <div className="manualFormGroup">
                    <label className="manualFormLabel">
                      <span className="manualLabelLeft">
                        <span>เพศ</span>
                        <span className="manualRequiredStar">*</span>
                      </span>
                    </label>
                    <div className="manualGenderControl">
                      <button
                        type="button"
                        onClick={() => setManualGender('ชาย')}
                        className={`manualGenderBtn ${manualGender === 'ชาย' ? 'activeMale' : ''}`}
                      >
                        <span>👨 ชาย</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualGender('หญิง')}
                        className={`manualGenderBtn ${manualGender === 'หญิง' ? 'activeFemale' : ''}`}
                      >
                        <span>👩 หญิง</span>
                      </button>
                    </div>
                  </div>

                  {/* Age */}
                  <div className="manualFormGroup">
                    <label className="manualFormLabel" htmlFor="manualAge">
                      <span className="manualLabelLeft">
                        <Calendar size={15} style={{ color: '#64748b' }} />
                        <span>อายุ (ปี)</span>
                        <span className="manualRequiredStar">*</span>
                      </span>
                    </label>
                    <input
                      id="manualAge"
                      type="number"
                      min={1}
                      max={130}
                      placeholder="เช่น 45"
                      value={manualAge}
                      onChange={(e) => setManualAge(e.target.value)}
                      className="manualInput"
                      required
                    />
                    {calculatedBirthYear && (
                      <div className="manualAgeHint">
                        <Calendar size={12} />
                        <span>เกิดประมาณ พ.ศ. {calculatedBirthYear}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Address (Optional) */}
                <div className="manualFormGroup">
                  <label className="manualFormLabel" htmlFor="manualAddress">
                    <span className="manualLabelLeft">
                      <MapPin size={15} style={{ color: '#64748b' }} />
                      <span>ที่อยู่ปัจจุบัน</span>
                    </span>
                    <span className="manualOptionalHint">(ไม่บังคับ)</span>
                  </label>
                  <textarea
                    id="manualAddress"
                    rows={2}
                    placeholder="บ้านเลขที่ หมู่ที่ ตำบล อำเภอ จังหวัด (ถ้ามี)"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    className="manualTextarea"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="manualModalFooter">
                <button
                  type="button"
                  onClick={handleCloseManualModal}
                  disabled={isManualSaving}
                  className="btnModalCancel"
                >
                  ยกเลิก (Esc)
                </button>
                <button
                  type="submit"
                  disabled={isManualSaving}
                  className="btnModalSubmit"
                >
                  {isManualSaving ? (
                    <>
                      <RefreshCw size={18} className="refreshIconSpin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} style={{ strokeWidth: 2.5 }} />
                      <span>บันทึกเข้าระบบคิว</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
