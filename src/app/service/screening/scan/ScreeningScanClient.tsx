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
}

export default function ScreeningScanClient({ operator }: Props) {
  const [stationId, setStationId] = useState<string>('1')
  const [deviceStatus, setDeviceStatus] = useState<string>('กำลังเชื่อมต่อระบบ Cloud Bridge...')
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

  // Manual trigger / fallback helper
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
            photoBase64: cardData.photo || cardData.photoBase64 || undefined,
            rawPayload: cardData,
          })
          playBeep(1046, 'sine', 0.12)
          setTimeout(() => {
            saveButtonRef.current?.focus()
          }, 80)
        } else if (isManual) {
          if (isBridgeConnected) {
            setErrorMessage('กรุณาดึงบัตรออกแล้วเสียบใหม่อีกครั้ง โปรแกรม Bridge จะอ่านและส่งข้อมูลขึ้นระบบอัตโนมัติ')
          } else {
            setErrorMessage('กรุณาเปิดโปรแกรม thoen-smartcard-bridge.exe ที่เครื่องก่อนอ่านบัตร')
          }
        }
      } catch {
        if (isManual) {
          if (isBridgeConnected) {
            setErrorMessage('กรุณาดึงบัตรออกแล้วเสียบใหม่อีกครั้ง โปรแกรม Bridge จะอ่านและส่งข้อมูลขึ้นระบบอัตโนมัติ')
          } else {
            setErrorMessage('กรุณาเปิดโปรแกรม thoen-smartcard-bridge.exe ที่เครื่องก่อนอ่านบัตร')
          }
        }
      } finally {
        setIsReading(false)
      }
    },
    [fetchFromBridge, isBridgeConnected, playBeep]
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
          } else {
            setDeviceStatus('รอเปิดโปรแกรม Thoen Smart Card Bridge ที่เครื่อง')
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
            // Only update if not already viewing this card
            if (currentCardRef.current?.cid !== cardData.cid) {
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
              playBeep(1046, 'sine', 0.12)
              setTimeout(() => {
                saveButtonRef.current?.focus()
              }, 80)
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
  }, [stationId, playBeep])


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
                  <span>
                    {isBridgeConnected
                      ? `Smart Card Bridge ออนไลน์พร้อมใช้งาน (โต๊ะที่ ${stationId})`
                      : 'โปรแกรมเชื่อมต่อเครื่องอ่านบัตร (Smart Card Bridge v2.0)'}
                  </span>
                  {isBridgeConnected ? (
                    <span className="bridgeConnectedTag">เชื่อมต่อแล้ว (Cloud Realtime)</span>
                  ) : (
                    <span className="bridgeReqTag">รอเปิดโปรแกรมที่เครื่อง</span>
                  )}
                </h3>
                <p>
                  {isBridgeConnected
                    ? `ตรวจพบเครื่องอ่าน: ${bridgeReaderName || 'Generic PC/SC USB Smart Card Reader'} (เสียบบัตรประชาชนได้เลยทันที ข้อมูลจะส่งขึ้นระบบอัตโนมัติ)`
                    : 'ดาวน์โหลดและเปิดโปรแกรม thoen-smartcard-bridge.exe ที่เครื่อง ระบบจะเชื่อมต่อกับหน้านี้ผ่าน HTTPS อัตโนมัติ (ไม่ต้องตั้งค่าเบราว์เซอร์)'}
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
                <p>เปิดไฟล์ <strong>thoen-smartcard-bridge.exe</strong> หน้าต่างคอนโซลสีดำจะเชื่อมต่อไปยังระบบคลาวด์</p>
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
                <span>สถานะเครื่องอ่านบัตร (Cloud Stream)</span>
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
                  {isBridgeConnected ? (cardPresent ? 'ตรวจพบบัตรประชาชนในเครื่อง' : 'พร้อมรับบัตรประชาชนใบถัดไป') : 'เสียบบัตรประชาชนเข้าเครื่องอ่าน'}
                </h3>
                <p className="emptyCardDesc">
                  {isBridgeConnected
                    ? (cardPresent 
                        ? 'กำลังดึงข้อมูล หรือกดปุ่ม "อ่านข้อมูลจากบัตรประชาชน" เพื่ออ่านข้อมูลทันที'
                        : 'เครื่องอ่านพร้อมทำงานแล้ว เสียบบัตรประชาชนเข้าเครื่อง ข้อมูลจะดึงขึ้นหน้าจอโดยอัตโนมัติทันที')
                    : 'เปิดโปรแกรม Thoen Smart Card Bridge ทิ้งไว้ที่เครื่อง แล้วเสียบบัตรประชาชนเพื่ออ่านข้อมูลเข้าระบบ'}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {isBridgeConnected && (
                    <button
                      type="button"
                      onClick={() => readCardFromBridge(true)}
                      disabled={isReading}
                      className="btnManualReadCard"
                      title="คลิกเพื่อสั่งอ่านข้อมูลจากบัตรประชาชนในเครื่องอ่านทันที"
                    >
                      <CreditCard size={16} />
                      <span>{isReading ? 'กำลังดึงข้อมูล...' : 'อ่านข้อมูลจากบัตรประชาชน'}</span>
                    </button>
                  )}

                  {!isBridgeConnected && (
                    <a
                      href="/downloads/thoen-smartcard-bridge.exe"
                      download="thoen-smartcard-bridge.exe"
                      className="bridgeDownloadBtn"
                      style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
                    >
                      <Download size={18} />
                      <span>ดาวน์โหลด Bridge (.exe)</span>
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
