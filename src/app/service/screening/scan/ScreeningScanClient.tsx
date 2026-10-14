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
  Sparkles,
  ListFilter,
  Check,
  ExternalLink,
  Info,
  Download,
  Terminal,
  Zap,
} from 'lucide-react'
import {
  SmartCardData,
  generateMockCardData,
  decodeTis620,
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
}

export default function ScreeningScanClient({ operator }: Props) {
  const [isWebHidSupported, setIsWebHidSupported] = useState<boolean>(true)
  const [hidDevice, setHidDevice] = useState<any>(null)
  const [deviceStatus, setDeviceStatus] = useState<string>('กำลังตรวจสอบตัวเชื่อมต่อ...')
  const [isReading, setIsReading] = useState<boolean>(false)
  const [currentCard, setCurrentCard] = useState<SmartCardData | null>(null)
  const [showRawPayload, setShowRawPayload] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recentSaved, setRecentSaved] = useState<RecentSavedItem[]>([])
  const [sessionCount, setSessionCount] = useState<number>(0)

  // Local Bridge States
  const [isBridgeConnected, setIsBridgeConnected] = useState<boolean>(false)
  const [bridgeReaderName, setBridgeReaderName] = useState<string>('')
  const [cardPresent, setCardPresent] = useState<boolean>(false)
  const [lastReadCid, setLastReadCid] = useState<string>('')
  const [lastSavedCid, setLastSavedCid] = useState<string>('')

  // Refs for tracking state inside stable polling intervals without teardown
  const currentCardRef = useRef<SmartCardData | null>(null)
  currentCardRef.current = currentCard

  const isReadingRef = useRef<boolean>(false)
  isReadingRef.current = isReading

  const lastSavedCidRef = useRef<string>('')
  lastSavedCidRef.current = lastSavedCid

  const lastReadCidRef = useRef<string>('')
  lastReadCidRef.current = lastReadCid

  const saveButtonRef = useRef<HTMLButtonElement>(null)

  // Check WebHID support in current browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'hid' in navigator
      setIsWebHidSupported(supported)
    }
  }, [])

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

  // Robust Bridge fetch helper:
  // 1. Tries Next.js same-origin proxy first (bypasses Chrome Private Network Access & Mixed-Content)
  // 2. Falls back to direct 127.0.0.1:8084
  const fetchFromBridge = useCallback(async (endpoint: 'status' | 'read') => {
    // Attempt 1: Next.js same-origin proxy
    try {
      const res = await fetch(`/api/service/screening/bridge?endpoint=${endpoint}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          return json.data
        }
      }
    } catch {
      // Proxy failed or unavailable, try direct
    }

    // Attempt 2: Direct local bridge daemon
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(`http://127.0.0.1:8084/${endpoint}`, {
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-store',
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Direct bridge call failed
    }

    return null
  }, [])

  // Read card data from bridge
  const readCardFromBridge = useCallback(
    async (isManual = false) => {
      setIsReading(true)
      if (isManual) setErrorMessage(null)

      try {
        const result = await fetchFromBridge('read')
        const cardData = result?.data || result
        if (result && result.success !== false && cardData && cardData.cid && cardData.cid.length >= 13) {
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
            photoBase64: cardData.photo || undefined,
            rawPayload: cardData,
          })
          playBeep(1046, 'sine', 0.12)
          setTimeout(() => {
            saveButtonRef.current?.focus()
          }, 80)
        } else if (isManual) {
          setErrorMessage(result?.message || 'อ่านข้อมูลจากบัตรไม่สำเร็จ หรือข้อมูลไม่สมบูรณ์')
        }
      } catch (err: any) {
        if (isManual) {
          setErrorMessage(`ไม่สามารถติดต่อ Smart Card Bridge ได้: ${err.message || 'กรุณาตรวจสอบว่าเปิดโปรแกรมอยู่'}`)
        }
      } finally {
        setIsReading(false)
      }
    },
    [fetchFromBridge, playBeep]
  )

  // Auto-poll Local Smart Card Bridge every 1.5s
  useEffect(() => {
    let isCancelled = false

    const checkBridge = async () => {
      try {
        const status = await fetchFromBridge('status')
        if (isCancelled) return

        if (status && status.online) {
          setIsBridgeConnected(true)
          setBridgeReaderName(status.reader || 'Generic PC/SC Smart Card Reader')
          const isPresent = Boolean(status.cardPresent)
          setCardPresent(isPresent)

          if (isPresent) {
            setDeviceStatus(`ตรวจพบบัตรประชาชนในเครื่อง (${status.reader || 'PC/SC Reader'})`)
            // If card is present, and user hasn't saved this card yet and not viewing it now
            if (
              !currentCardRef.current &&
              !isReadingRef.current &&
              (!lastSavedCidRef.current || lastSavedCidRef.current !== lastReadCidRef.current)
            ) {
              readCardFromBridge(false)
            }
          } else {
            setDeviceStatus(`Smart Card Bridge ออนไลน์: ${status.reader || 'พร้อมอ่านบัตร'}`)
            // Card removed from reader, allow next scan of same or new card
            setLastSavedCid('')
            setLastReadCid('')
          }
        } else {
          if (!isCancelled) {
            setIsBridgeConnected(false)
            setBridgeReaderName('')
            setCardPresent(false)
            setDeviceStatus('ยังไม่ได้เปิดโปรแกรม Smart Card Bridge')
          }
        }
      } catch {
        if (!isCancelled) {
          setIsBridgeConnected(false)
          setBridgeReaderName('')
          setCardPresent(false)
          setDeviceStatus('ยังไม่ได้เปิดโปรแกรม Smart Card Bridge')
        }
      }
    }

    const interval = setInterval(checkBridge, 1500)
    checkBridge()

    return () => {
      isCancelled = true
      clearInterval(interval)
    }
  }, [fetchFromBridge, readCardFromBridge])

  // Connect physical Smart Card reader via WebHID fallback
  const handleConnectHid = async () => {
    setErrorMessage(null)
    if (!('hid' in navigator)) {
      setErrorMessage('เบราว์เซอร์นี้ไม่รองรับ WebHID กรุณาใช้ Google Chrome หรือ Microsoft Edge')
      return
    }

    try {
      const devices = await (navigator as any).hid.requestDevice({
        filters: [],
      })

      if (devices && devices.length > 0) {
        const device = devices[0]
        if (!device.opened) {
          await device.open()
        }
        setHidDevice(device)
        setDeviceStatus(`เชื่อมต่อแล้ว: ${device.productName || 'USB Smart Card Reader'}`)
        playBeep(659, 'sine', 0.1)

        device.oninputreport = (event: any) => {
          const { data } = event
          if (!data || data.byteLength === 0) return
          try {
            const rawBytes = new Uint8Array(data.buffer)
            const decoded = decodeTis620(rawBytes)
            if (decoded && decoded.length > 5) {
              setDeviceStatus(`ตรวจพบบัตร: กำลังประมวลผล...`)
            }
          } catch {
            // raw bytes
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(`ไม่สามารถเชื่อมต่อเครื่องอ่านได้: ${err.message}`)
      }
    }
  }

  // Simulate reading mock card (for testing and offline demo)
  const handleMockScan = () => {
    setErrorMessage(null)
    setIsReading(true)
    setTimeout(() => {
      const mock = generateMockCardData()
      setCurrentCard(mock)
      setIsReading(false)
      playBeep(1046, 'sine', 0.12)
      setTimeout(() => {
        saveButtonRef.current?.focus()
      }, 50)
    }, 250)
  }

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
          title: currentCard.titleTh,
          firstName: currentCard.firstNameTh,
          lastName: currentCard.lastNameTh,
          fullName: currentCard.fullNameTh,
          gender: currentCard.gender,
          birthDate: currentCard.birthDate,
          address: currentCard.address,
          photoBase64: currentCard.photoBase64 || null,
          rawPayload: currentCard.rawPayload,
          status: 'WAITING',
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'บันทึกข้อมูลไม่สำเร็จ')
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

  // Keyboard shortcut listener for Enter and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && currentCard && !isSaving) {
        e.preventDefault()
        handleSaveQueue()
      } else if (e.key === 'Escape' && currentCard) {
        e.preventDefault()
        setCurrentCard(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentCard, isSaving])

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
                {isBridgeConnected ? <Zap size={24} /> : <Download size={24} />}
              </div>
              <div>
                <h3>
                  <span>{isBridgeConnected ? 'Smart Card Bridge เชื่อมต่อพร้อมใช้งาน' : 'โปรแกรมเชื่อมต่อเครื่องอ่านบัตร (Smart Card Bridge)'}</span>
                  {isBridgeConnected ? (
                    <span className="bridgeConnectedTag">เชื่อมต่อแล้ว (Online)</span>
                  ) : (
                    <span className="bridgeReqTag">จำเป็นต้องเปิดก่อนใช้งาน</span>
                  )}
                </h3>
                <p>
                  {isBridgeConnected
                    ? `ตรวจพบเครื่องอ่าน: ${bridgeReaderName || 'Generic PC/SC USB Smart Card Reader'} (เสียบบัตรประชาชนได้เลยทันที)`
                    : 'เนื่องจากระบบความปลอดภัยของเบราว์เซอร์ จำเป็นต้องเปิดโปรแกรมตัวเชื่อมต่อขนาดเล็ก (14 KB) เพื่อให้อ่านข้อมูลจากเครื่องอ่านบัตรประชาชน PC/SC ได้'}
                </p>
              </div>
            </div>

            <div>
              <a
                href="/downloads/thoen-smartcard-bridge.exe"
                download="thoen-smartcard-bridge.exe"
                className="bridgeDownloadBtn"
                title="คลิกเพื่อดาวน์โหลดโปรแกรมตัวเชื่อมต่อเครื่องอ่านบัตร"
              >
                <Download size={18} />
                <span>{isBridgeConnected ? 'ดาวน์โหลดสำรอง (.exe)' : 'ดาวน์โหลดโปรแกรม Bridge (14 KB)'}</span>
              </a>
            </div>
          </div>

          {/* 3 Step Instructions */}
          <div className="bridgeStepsGrid">
            <div className="bridgeStepItem">
              <div className="stepNumberCircle">1</div>
              <div className="stepContent">
                <h4>ดาวน์โหลดไฟล์</h4>
                <p>กดปุ่มดาวน์โหลดไฟล์ <strong style={{ color: '#0284c7' }}>thoen-smartcard-bridge.exe</strong> ด้านบน</p>
              </div>
            </div>

            <div className="bridgeStepItem">
              <div className="stepNumberCircle">2</div>
              <div className="stepContent">
                <h4>ดับเบิ้ลคลิกเปิดโปรแกรม</h4>
                <p>เปิดโปรแกรมทิ้งไว้ที่เครื่อง (ไฟล์ขนาดเล็ก 14 KB ไม่ต้องติดตั้ง)</p>
              </div>
            </div>

            <div className="bridgeStepItem">
              <div className="stepNumberCircle">3</div>
              <div className="stepContent">
                <h4>เสียบบัตรใช้งานทันที</h4>
                <p>เมื่อโปรแกรมเปิดอยู่ เสียบบัตรประชาชนแล้วข้อมูลจะเด้งขึ้นหน้าจอทันที</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hardware Status & Operator Bar */}
        <div className="hardwareBar">
          <div className="deviceStatusGroup">
            <div className={`usbIconCircle ${isBridgeConnected || hidDevice ? 'connected' : ''}`}>
              <Usb size={20} />
            </div>
            <div className="deviceStatusText">
              <span className="deviceStatusLabel">
                <span>สถานะเครื่องอ่านบัตร</span>
                <span className={`statusLedDot ${isBridgeConnected || hidDevice ? 'active' : ''}`} />
              </span>
              <span className="deviceName">{deviceStatus}</span>
            </div>
          </div>

          <div className="hardwareActions">
            {isBridgeConnected && (
              <button
                type="button"
                onClick={() => readCardFromBridge(true)}
                disabled={isReading}
                className="btnBridgeRead"
                title="สั่งอ่านข้อมูลจากเครื่องอ่านบัตรประชาชนทันที"
              >
                <CreditCard size={16} />
                <span>{isReading ? 'กำลังอ่านบัตร...' : 'อ่านข้อมูลจากบัตรทันที'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleMockScan}
              disabled={isReading}
              className="btnMockScan"
              title="จำลองการเสียบบัตรประชาชนเพื่อทดสอบระบบ"
            >
              <Sparkles size={16} />
              <span>{isReading ? 'กำลังอ่านบัตร...' : 'จำลองอ่านบัตรตัวอย่าง (Mock Scan)'}</span>
            </button>

            {isWebHidSupported && (
              <button
                type="button"
                onClick={handleConnectHid}
                className="btnConnectWebHid"
                title="เชื่อมต่อผ่าน WebHID สำรอง"
              >
                <Usb size={16} />
                <span>{hidDevice ? 'เปลี่ยนอุปกรณ์ WebHID' : 'เชื่อมต่อ WebHID สำรอง'}</span>
              </button>
            )}
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
                  {isBridgeConnected ? (cardPresent ? 'ตรวจพบบัตรประชาชนในเครื่อง' : 'พร้อมรับบัตรประชาชนใบถัดไป') : 'เสียบบัตรประชาชนเข้าเครื่องอ่าน'}
                </h3>
                <p className="emptyCardDesc">
                  {isBridgeConnected
                    ? (cardPresent 
                        ? 'กำลังดึงข้อมูล หรือกดปุ่ม "อ่านข้อมูลจากบัตรประชาชน" เพื่ออ่านข้อมูลทันที'
                        : 'เครื่องอ่านพร้อมทำงานแล้ว เสียบบัตรประชาชนเข้าเครื่อง ข้อมูลจะดึงขึ้นหน้าจอโดยอัตโนมัติทันที')
                    : 'เปิดโปรแกรม Thoen Smart Card Bridge ทิ้งไว้ที่เครื่อง หรือกดปุ่ม "จำลองอ่านบัตรตัวอย่าง" เพื่อทดสอบระบบได้ทันที'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {isBridgeConnected && (
                    <button
                      type="button"
                      onClick={() => readCardFromBridge(true)}
                      disabled={isReading}
                      className="btnPrimarySave"
                      style={{ padding: '0.65rem 1.75rem', fontSize: '0.95rem', margin: 0 }}
                      title="คลิกเพื่อสั่งอ่านข้อมูลจากบัตรประชาชนในเครื่องอ่านทันที"
                    >
                      <CreditCard size={18} />
                      <span>{isReading ? 'กำลังดึงข้อมูลจากบัตร...' : 'อ่านข้อมูลจากบัตรประชาชน'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleMockScan}
                    disabled={isReading}
                    className="btnMockScan"
                    style={{ padding: '0.65rem 1.5rem', fontSize: '0.95rem' }}
                  >
                    <Sparkles size={18} />
                    <span>{isReading ? 'กำลังดึงข้อมูล...' : 'จำลองอ่านบัตรตัวอย่าง (Mock Data)'}</span>
                  </button>

                  {!isBridgeConnected && (
                    <a
                      href="/downloads/thoen-smartcard-bridge.exe"
                      download="thoen-smartcard-bridge.exe"
                      className="bridgeDownloadBtn"
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
                    >
                      <Download size={18} />
                      <span>ดาวน์โหลด Bridge (14 KB)</span>
                    </a>
                  )}
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
                      <pre className="rawPayloadBox">
                        {JSON.stringify(currentCard.rawPayload, null, 2)}
                      </pre>
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
                        <div className="recentItemName">{item.fullName}</div>
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
                <li>กดปุ่ม <strong>Enter</strong> บนคีย์บอร์ดเพื่อบันทึกเข้าคิว</li>
                <li>เมื่อบันทึกเสร็จ หน้าจอจะล้างและค้างไว้เพื่อพร้อมรับคนถัดไปทันที</li>
                <li>จุดคัดกรองหรือห้องบัตรสามารถเปิดดูรายชื่อสดได้ที่หน้า <Link href="/service/screening" target="_blank" style={{ color: '#047857', fontWeight: 700, textDecoration: 'underline' }}>แดชบอร์ดคิว</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
