'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  QrCode,
  Download,
  Printer,
  Copy,
  ArrowLeft,
  Share2,
  Package,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'

interface CurrentUser {
  id: number
  username: string
  name: string
  department: string | null
  position: string | null
  role: string
  isAdmin: boolean
}

interface EventDetailClientProps {
  event: any
  checkinUrl: string
  currentUser: CurrentUser
}

export default function EventDetailClient({
  event: initialEvent,
  checkinUrl,
  currentUser,
}: EventDetailClientProps) {
  const [event, setEvent] = useState(initialEvent)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [activeTab, setActiveTab] = useState<'attendances' | 'registrations'>('attendances')
  const printRef = useRef<HTMLDivElement>(null)

  // Generate QR code data URL on mount
  useEffect(() => {
    if (checkinUrl) {
      QRCode.toDataURL(checkinUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#064e3b', // Emerald-900
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err))
    }
  }, [checkinUrl])

  const formatThaiDateTime = (dateString: string) => {
    try {
      const d = new Date(dateString)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ]
      const day = d.getDate()
      const month = thaiMonths[d.getMonth()]
      const year = d.getFullYear() + 543
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      return `${day} ${month} ${year} เวลา ${time} น.`
    } catch {
      return dateString
    }
  }

  // Determine check-in window status
  const now = new Date()
  const openTime = new Date(event.checkinOpenTime)
  const closeTime = new Date(event.checkinCloseTime)
  const isEarly = now < openTime
  const isLate = now > closeTime
  const isOpen = !isEarly && !isLate

  // Pre-registration toggle handler
  const handleToggleRegistration = async () => {
    setRegistering(true)
    try {
      const method = event.hasRegistered ? 'DELETE' : 'POST'
      const res = await fetch(`/api/member/events/${event.id}/register`, { method })
      const json = await res.json()

      if (json.success) {
        setEvent((prev: any) => ({
          ...prev,
          hasRegistered: !prev.hasRegistered,
          registrationCount: prev.hasRegistered
            ? prev.registrationCount - 1
            : prev.registrationCount + 1,
        }))
      }
    } catch (err) {
      console.error('Error toggling registration:', err)
    } finally {
      setRegistering(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `QRCode-Event-${event.id}.png`
    a.click()
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/member/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>กลับหน้ารายการกิจกรรม</span>
          </Link>

          <Link
            href="/member/events/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200"
          >
            <Trophy size={14} />
            <span>ดูกระดานคะแนน</span>
          </Link>
        </div>

        {/* Event Main Banner Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                <Calendar size={12} />
                ปีงบประมาณ {event.fiscalYear}
              </span>

              {isOpen && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-400 text-emerald-950 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-950" />
                  เปิดรับสแกนเช็คอินอยู่ขณะนี้
                </span>
              )}
              {isEarly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-200 border border-amber-400/30">
                  <Clock size={12} />
                  ยังไม่ถึงเวลาเปิดสแกน
                </span>
              )}
              {isLate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/30 text-slate-300">
                  ปิดรับสแกนแล้ว
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl font-extrabold text-white leading-tight">
              {event.title}
            </h1>

            {event.description && (
              <p className="text-xs sm:text-sm text-slate-200 mt-2 max-w-3xl whitespace-pre-line">
                {event.description}
              </p>
            )}

            {/* Quick Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-emerald-700/50 text-xs text-emerald-100">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-emerald-300 shrink-0" />
                <div>
                  <span className="text-[10px] text-emerald-300 block">ช่วงเวลากิจกรรม</span>
                  <span>{formatThaiDateTime(event.eventStartDate)}</span>
                </div>
              </div>

              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-300 shrink-0" />
                  <div>
                    <span className="text-[10px] text-emerald-300 block">สถานที่จัดงาน</span>
                    <span className="truncate">{event.location}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Users size={16} className="text-emerald-300 shrink-0" />
                <div>
                  <span className="text-[10px] text-emerald-300 block">หัวหน้าผู้รับผิดชอบ</span>
                  <span>{event.headOrganizer?.name || 'บุคลากรโรงพยาบาล'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar (Pre-registration toggle) */}
          <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px]">ลงทะเบียนแล้ว</span>
                <span className="font-bold text-slate-800 text-sm">
                  {event.registrationCount} คน
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-emerald-600 block text-[10px] font-medium">เข้างานจริงแล้ว</span>
                <span className="font-bold text-emerald-800 text-sm">
                  {event.attendanceCount} คน
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {event.hasAttended ? (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>คุณได้สแกนเข้าร่วมงานแล้ว (+1 คะแนน)</span>
                </div>
              ) : (
                <button
                  onClick={handleToggleRegistration}
                  disabled={registering}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                    event.hasRegistered
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {registering
                      ? 'กำลังประมวลผล...'
                      : event.hasRegistered
                      ? 'ยกเลิกการลงทะเบียน'
                      : 'ลงทะเบียนเข้าร่วมกิจกรรม'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* QR Code Section (For Organizers and Display) */}
        {event.canManage && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              {/* QR Image Frame */}
              <div className="flex flex-col items-center shrink-0">
                <div className="p-4 bg-white border-2 border-emerald-600/30 rounded-2xl shadow-sm text-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Event Check-in QR Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                    </div>
                  )}
                  <span className="text-[11px] font-semibold text-emerald-800 mt-2 block">
                    สแกนเช็คอินด้วยแอป ThaID
                  </span>
                </div>

                {/* QR Action Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <Download size={13} />
                    <span>บันทึกรูป</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <Printer size={13} />
                    <span>พิมพ์ป้ายตั้งหน้างาน</span>
                  </button>
                </div>
              </div>

              {/* QR Instructions and Time Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <QrCode size={18} className="text-emerald-600" />
                    <h2 className="text-base font-bold text-slate-900">
                      QR Code เช็คอินหน้างาน (Static Check-in QR)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    ผู้จัดงานสามารถนำ QR Code นี้ฉายขึ้นจอโปรเจกเตอร์ หรือพิมพ์เป็นป้ายตั้งไว้ ณ จุดลงทะเบียนหน้างานได้ทันที
                  </p>
                </div>

                {/* Time Window Notice */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">เงื่อนไขช่วงเวลาสแกน:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded ${
                        isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isOpen ? 'เปิดรับสแกน' : isEarly ? 'ยังไม่เปิดรับ' : 'ปิดรับแล้ว'}
                    </span>
                  </div>
                  <div className="text-slate-600 space-y-1">
                    <p>• เวลาเปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)}</p>
                    <p>• เวลาปิดรับสแกน: {formatThaiDateTime(event.checkinCloseTime)}</p>
                    <p className="text-[11px] text-amber-700">
                      ⚠️ หากสแกนก่อนเวลาเปิด หรือหลังเวลาปิด ระบบจะปฏิเสธการเช็คอินอัตโนมัติ
                    </p>
                  </div>
                </div>

                {/* Link Sharing Box */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ลิงก์เช็คอินโดยตรง (Direct Check-in URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={checkinUrl}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    >
                      <Copy size={13} />
                      <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                    </button>
                  </div>
                </div>

                {/* How it works note */}
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <span className="font-bold block flex items-center gap-1">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    วิธีการใช้งานสำหรับผู้เข้าร่วม:
                  </span>
                  <p>1. ผู้เข้าร่วมเปิดกล้องมือถือ หรือแอป ThaID เพื่อสแกน QR Code</p>
                  <p>2. ระบบส่งต่อไปยัง ThaID เพื่อยืนยันตัวตนด้วยเลขบัตรประชาชน (DOPA)</p>
                  <p>3. เมื่อยืนยันสำเร็จ ระบบจะบันทึกเช็คอินทันที 1 คน ต่อ 1 ครั้ง และรับ 1 คะแนน</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Linked Material Borrowing Card (If items were borrowed) */}
        {event.borrowRequest && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package size={16} className="text-emerald-600" />
                <span>คำขอยืมวัสดุ/อุปกรณ์สำหรับกิจกรรมนี้ ({event.borrowRequest.requestNo})</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                สถานะ: {event.borrowRequest.status}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {event.borrowRequest.items?.map((item: any) => (
                <div key={item.id} className="py-2 flex items-center justify-between">
                  <span className="text-slate-800 font-medium">
                    • {item.itemName}
                  </span>
                  <span className="text-slate-500">
                    จำนวน: {item.quantity} ชิ้น
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Co-organizers List */}
        {event.coOrganizers && event.coOrganizers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Users size={16} className="text-emerald-600" />
              <span>ผู้รับผิดชอบร่วม ({event.coOrganizers.length} ท่าน)</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {event.coOrganizers.map((co: any) => (
                <span
                  key={co.id}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {co.member?.name} ({co.member?.department || 'ไม่ระบุแผนก'})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Attendances vs Registrations */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2">
            <button
              onClick={() => setActiveTab('attendances')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'attendances'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ผู้เข้าร่วมงานจริง (เช็คอินผ่าน ThaID) ({event.attendances?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'registrations'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ผู้ลงทะเบียนล่วงหน้า ({event.registrations?.length || 0})
            </button>
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'attendances' ? (
              <div>
                {!event.attendances || event.attendances.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    ยังไม่มีผู้สแกนเช็คอินเข้าร่วมกิจกรรมในขณะนี้
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3">ลำดับ</th>
                          <th className="p-3">ชื่อ-สกุล</th>
                          <th className="p-3">แผนก/กลุ่มงาน</th>
                          <th className="p-3">เวลาที่เช็คอิน</th>
                          <th className="p-3 text-center">คะแนน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {event.attendances.map((att: any, idx: number) => (
                          <tr key={att.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-800">
                              {att.member?.name || 'บุคลากร'}
                            </td>
                            <td className="p-3 text-slate-600">
                              {att.member?.department || 'ไม่ระบุแผนก'}
                            </td>
                            <td className="p-3 text-slate-500">
                              {formatThaiDateTime(att.checkedInAt)}
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                +{att.pointsAwarded} คะแนน
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!event.registrations || event.registrations.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    ยังไม่มีผู้ลงทะเบียนล่วงหน้า
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3">ลำดับ</th>
                          <th className="p-3">ชื่อ-สกุล</th>
                          <th className="p-3">แผนก/กลุ่มงาน</th>
                          <th className="p-3">วันที่ลงทะเบียน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {event.registrations.map((reg: any, idx: number) => (
                          <tr key={reg.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-800">
                              {reg.member?.name || 'บุคลากร'}
                            </td>
                            <td className="p-3 text-slate-600">
                              {reg.member?.department || 'ไม่ระบุแผนก'}
                            </td>
                            <td className="p-3 text-slate-500">
                              {formatThaiDateTime(reg.registeredAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Printable Standee Sheet (Hidden until print) */}
        <div className="hidden print:block p-8 bg-white text-center font-sans">
          <div className="border-4 border-emerald-800 p-8 rounded-3xl max-w-xl mx-auto space-y-4">
            <h1 className="text-2xl font-extrabold text-emerald-900">
              โรงพยาบาลเถิน
            </h1>
            <div className="h-0.5 bg-emerald-800 w-24 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">{event.title}</h2>
            <p className="text-sm text-slate-600">
              วันและเวลา: {formatThaiDateTime(event.eventStartDate)}
            </p>
            {event.location && (
              <p className="text-sm text-slate-600">สถานที่: {event.location}</p>
            )}

            <div className="p-4 my-4 flex justify-center">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-72 h-72 object-contain"
                />
              )}
            </div>

            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-bold text-sm text-emerald-800">
                สแกนเช็คอินเข้าร่วมกิจกรรมด้วยแอป ThaID
              </p>
              <p>เปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)} ถึง {formatThaiDateTime(event.checkinCloseTime)}</p>
              <p>ผู้เข้าร่วมงานจะได้รับ 1 คะแนนสะสมสำหรับการมีส่วนร่วม</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
