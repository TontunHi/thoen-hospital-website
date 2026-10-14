'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Usb,
  ArrowRight,
  User,
  MapPin,
  Calendar,
  Sparkles,
  ListFilter,
  Check,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react'
import {
  SmartCardData,
  generateMockCardData,
  decodeTis620,
} from '@/lib/screening/smartCardReader'

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
  const [deviceStatus, setDeviceStatus] = useState<string>('ไม่ได้เชื่อมต่อเครื่องอ่าน')
  const [isReading, setIsReading] = useState<boolean>(false)
  const [currentCard, setCurrentCard] = useState<SmartCardData | null>(null)
  const [showRawPayload, setShowRawPayload] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recentSaved, setRecentSaved] = useState<RecentSavedItem[]>([])
  const [sessionCount, setSessionCount] = useState<number>(0)

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

  // Connect physical Smart Card reader via WebHID
  const handleConnectHid = async () => {
    setErrorMessage(null)
    if (!('hid' in navigator)) {
      setErrorMessage('เบราว์เซอร์นี้ไม่รองรับ WebHID กรุณาใช้ Google Chrome หรือ Microsoft Edge')
      return
    }

    try {
      const devices = await (navigator as any).hid.requestDevice({
        filters: [], // Allow user to select any USB HID / CCID reader
      })

      if (devices && devices.length > 0) {
        const device = devices[0]
        if (!device.opened) {
          await device.open()
        }
        setHidDevice(device)
        setDeviceStatus(`เชื่อมต่อแล้ว: ${device.productName || 'USB Smart Card Reader'}`)
        playBeep(659, 'sine', 0.1)

        // Listen to HID input reports
        device.oninputreport = (event: any) => {
          const { data } = event
          if (!data || data.byteLength === 0) return
          // When card insertion or report is detected
          try {
            const rawBytes = new Uint8Array(data.buffer)
            const decoded = decodeTis620(rawBytes)
            if (decoded && decoded.length > 5) {
              setDeviceStatus(`ตรวจพบบัตร: กำลังประมวลผล...`)
            }
          } catch {
            // handle raw byte stream
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
      playBeep(1046, 'sine', 0.12) // High crisp beep on card read
      // Focus the save button for instant Enter confirmation
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
      playBeep(1318, 'triangle', 0.2) // Success double chime tone

      // Flash success banner
      setSuccessBanner(`บันทึก ${savedData.fullName} เข้าระบบคิวเรียบร้อยแล้ว`)
      setSessionCount((prev) => prev + 1)

      // Add to recent list
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

      // Clear card immediately to be ready for next patient
      setCurrentCard(null)
      setShowRawPayload(false)

      // Auto dismiss success banner after 4 seconds
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
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Navigation Bar */}
      <div className="bg-emerald-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-lg">
              <CreditCard className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  จุดอ่านบัตรประชาชนตรวจนอกพื้นที่
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-600/80 rounded-full text-emerald-100 border border-emerald-500/50">
                  Smart Card Kiosk
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                เสียบบัตรเพื่อนำเข้ารายชื่อผู้รับบริการอย่างต่อเนื่อง (Rapid Batch Flow)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/service/screening"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors shadow-sm"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>เปิดแดชบอร์ดติดตามคิว</span>
              <ExternalLink className="w-3 h-3 text-emerald-300" />
            </Link>
            <Link
              href="/service"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-900/50 hover:bg-emerald-900 text-emerald-100 transition-colors"
            >
              กลับหน้าบริการ
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Hardware Status & Operator Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                hidDevice ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">สถานะเครื่องอ่าน</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    hidDevice ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>
              <p className="text-sm font-medium text-slate-800">{deviceStatus}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isWebHidSupported ? (
              <button
                type="button"
                onClick={handleConnectHid}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              >
                <Usb className="w-4 h-4 text-slate-600" />
                <span>{hidDevice ? 'เปลี่ยนเครื่องอ่าน' : 'เชื่อมต่อเครื่องอ่านบัตร (WebHID)'}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>เบราว์เซอร์ไม่รองรับ WebHID (แนะนำ Chrome / Edge)</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleMockScan}
              disabled={isReading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-sm"
              title="จำลองการเสียบบัตรประชาชนเพื่อทดสอบระบบ"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{isReading ? 'กำลังอ่านบัตร...' : 'จำลองอ่านบัตรตัวอย่าง (Mock Scan)'}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-4 pt-2 sm:pt-0 w-full sm:w-auto">
            <div>
              <span className="text-slate-400">ผู้ปฏิบัติงาน: </span>
              <span className="font-semibold text-slate-700">{operator.name || operator.username}</span>
            </div>
            <div className="bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-md border border-emerald-200">
              บันทึกแล้วในเซสชันนี้: {sessionCount} คน
            </div>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-emerald-900 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm sm:text-base">{successBanner}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  ระบบได้เพิ่มชื่อเข้าคิวแล้ว และรีเซ็ตหน้าจอพร้อมรับบัตรคนถัดไปทันที
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-3 text-rose-900 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Main Grid: Card Reader Interface & Recent History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Card Reader Area */}
          <div className="lg:col-span-8 space-y-4">
            {!currentCard ? (
              /* Waiting Card Slot */
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 sm:p-14 text-center shadow-sm">
                <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-pulse">
                  <CreditCard className="w-10 h-10" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                  พร้อมรับบัตรประชาชนใบถัดไป
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                  เสียบบัตรประชาชนเข้าเครื่องอ่าน Smart Card ที่ต่ออยู่กับเครื่อง
                  หรือกดปุ่ม{' '}
                  <span className="font-semibold text-emerald-700">"จำลองอ่านบัตรตัวอย่าง"</span>{' '}
                  เพื่อทดสอบระบบได้ทันที
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleMockScan}
                    disabled={isReading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors shadow"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isReading ? 'กำลังดึงข้อมูล...' : 'จำลองอ่านบัตรตัวอย่าง (Mock Data)'}</span>
                  </button>
                  {isWebHidSupported && !hidDevice && (
                    <button
                      type="button"
                      onClick={handleConnectHid}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors border border-slate-300"
                    >
                      <Usb className="w-4 h-4" />
                      <span>เชื่อมต่อเครื่องอ่าน USB</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Card Data Preview & Action Card */
              <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
                {/* Header banner of the card */}
                <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-5 h-5 text-emerald-200" />
                    <div>
                      <h3 className="font-bold text-sm sm:text-base">ข้อมูลจากบัตรประจำตัวประชาชน</h3>
                      <p className="text-xs text-emerald-200">ตรวจสอบความถูกต้องก่อนกดบันทึกเข้าคิว</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-600/90 rounded-md border border-emerald-400/40">
                    อ่านสำเร็จ
                  </span>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Citizen ID (Large Display) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        เลขประจำตัวประชาชน (13 หลัก)
                      </span>
                      <div className="text-xl sm:text-2xl font-mono font-bold text-slate-900 tracking-wider mt-0.5">
                        {currentCard.cid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">
                        เพศ: {currentCard.gender || 'ไม่ระบุ'}
                      </span>
                    </div>
                  </div>

                  {/* Name and Demographics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span>ชื่อ - สกุล (ภาษาไทย)</span>
                      </div>
                      <p className="text-lg font-bold text-slate-800">
                        {currentCard.fullNameTh}
                      </p>
                      {currentCard.fullNameEn && (
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {currentCard.fullNameEn}
                        </p>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>วันเดือนปีเกิด</span>
                      </div>
                      <p className="text-base font-semibold text-slate-800">
                        {currentCard.birthDate || 'ไม่ระบุ'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">พ.ศ. ตามฐานข้อมูลบัตร</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>ที่อยู่ตามทะเบียนบ้าน</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 leading-relaxed">
                      {currentCard.address || 'ไม่ระบุที่อยู่'}
                    </p>
                  </div>

                  {/* Toggle Raw JSON Payload */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRawPayload(!showRawPayload)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>{showRawPayload ? 'ซ่อนข้อมูลดิบจากบัตร (Raw Payload)' : 'ดูข้อมูลดิบทั้งหมดที่เครื่องอ่านส่งมา (Raw Payload)'}</span>
                    </button>
                    {showRawPayload && (
                      <pre className="mt-2.5 p-3.5 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-56 leading-relaxed">
                        {JSON.stringify(currentCard.rawPayload, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Big Primary Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      ref={saveButtonRef}
                      type="button"
                      onClick={handleSaveQueue}
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl transition-all shadow-lg hover:shadow-emerald-600/30 active:scale-[0.99] disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>กำลังบันทึกข้อมูล...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5 stroke-[2.5]" />
                          <span>เพิ่มเข้าระบบ (กดปุ่ม Enter)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentCard(null)}
                      disabled={isSaving}
                      className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-300"
                    >
                      ยกเลิก / ล้างหน้าจอ (Esc)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Recent Scans in this session & Fast Tips */}
          <div className="lg:col-span-4 space-y-5">
            {/* Recent Scans Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-sm text-slate-800">
                    บันทึกล่าสุดในเซสชันนี้
                  </h4>
                </div>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {recentSaved.length} รายการ
                </span>
              </div>

              {recentSaved.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  ยังไม่มีรายการที่บันทึกในเซสชันนี้
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {recentSaved.map((item, idx) => (
                    <div key={item.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 truncate max-w-[170px]">
                          {item.fullName}
                        </p>
                        <p className="text-slate-400 font-mono text-[11px]">
                          {item.cid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}
                        </p>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] shrink-0">
                        {item.savedAt}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Operator Quick Guide */}
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-5 text-xs text-slate-600 space-y-2.5">
              <h5 className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-700" />
                <span>คำแนะนำการใช้งานจุดอ่านบัตร</span>
              </h5>
              <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                <li>เมื่อเสียบบัตร ระบบจะดึงข้อมูลพรีวิวขึ้นหน้าจอโดยอัตโนมัติ</li>
                <li>สามารถกดปุ่ม <span className="font-semibold text-slate-800">Enter</span> บนคีย์บอร์ดเพื่อบันทึกได้ทันที</li>
                <li>เมื่อบันทึกเสร็จ หน้าจอจะล้างและค้างไว้เพื่อพร้อมรับคนถัดไปทันที</li>
                <li>จุดคัดกรองหรือห้องบัตรสามารถเปิดดูรายชื่อสดได้ที่หน้า <Link href="/service/screening" target="_blank" className="text-emerald-700 underline font-semibold">แดชบอร์ดคิว</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
