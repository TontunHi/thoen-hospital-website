'use client'

import React, { useState, useEffect } from 'react'
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
  Package,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import '../events.css'

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
}: EventDetailClientProps) {
  const [event, setEvent] = useState(initialEvent)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [activeTab, setActiveTab] = useState<'attendances' | 'registrations'>('attendances')

  // Generate QR code data URL on mount
  useEffect(() => {
    if (checkinUrl) {
      QRCode.toDataURL(checkinUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#064e3b',
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
    <div className="eventsPageContainer">
      {/* Navigation & Header */}
      <div className="backNavRow">
        <Link href="/member/events" className="btnBack">
          <ArrowLeft size={16} />
          <span>กลับหน้ารายการกิจกรรม</span>
        </Link>

        <Link
          href="/member/events/leaderboard"
          className="btnTrophy"
          style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
        >
          <Trophy size={15} />
          <span>ดูกระดานคะแนน</span>
        </Link>
      </div>

      {/* Event Main Banner Card */}
      <div className="detailMainCard">
        <div className="detailHeaderBanner">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="eventsPillTag" style={{ margin: 0 }}>
              <Calendar size={12} />
              ปีงบประมาณ {event.fiscalYear}
            </span>

            {isOpen && (
              <span
                className="eventStatusBadge active"
                style={{ background: '#34d399', color: '#064e3b', fontWeight: 700 }}
              >
                ● เปิดรับสแกนเช็คอินอยู่ขณะนี้
              </span>
            )}
            {isEarly && (
              <span
                className="eventStatusBadge"
                style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fef3c7' }}
              >
                <Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                ยังไม่ถึงเวลาเปิดสแกน
              </span>
            )}
            {isLate && (
              <span
                className="eventStatusBadge"
                style={{ background: 'rgba(100, 116, 139, 0.3)', color: '#e2e8f0' }}
              >
                ปิดรับสแกนแล้ว
              </span>
            )}
          </div>

          <h1>{event.title}</h1>

          {event.description && <p>{event.description}</p>}

          {/* Quick Meta */}
          <div className="detailMetaGrid">
            <div className="detailMetaItem">
              <Clock size={16} />
              <div>
                <span className="detailMetaLabel">ช่วงเวลากิจกรรม</span>
                <span>{formatThaiDateTime(event.eventStartDate)}</span>
              </div>
            </div>

            {event.location && (
              <div className="detailMetaItem">
                <MapPin size={16} />
                <div>
                  <span className="detailMetaLabel">สถานที่จัดงาน</span>
                  <span>{event.location}</span>
                </div>
              </div>
            )}

            <div className="detailMetaItem">
              <Users size={16} />
              <div>
                <span className="detailMetaLabel">หัวหน้าผู้รับผิดชอบ</span>
                <span>{event.headOrganizer?.name || 'บุคลากรโรงพยาบาล'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar (Pre-registration toggle) */}
        <div className="detailStatusBar">
          <div className="detailCountsRow">
            <div className="detailCountItem">
              <span className="detailCountItemLabel">ลงทะเบียนแล้ว</span>
              <span className="detailCountItemVal">{event.registrationCount} คน</span>
            </div>
            <div style={{ width: '1px', height: '28px', background: '#e2e8f0' }} />
            <div className="detailCountItem">
              <span className="detailCountItemLabel" style={{ color: '#059669', fontWeight: 600 }}>
                เข้างานจริงแล้ว
              </span>
              <span className="detailCountItemVal highlight">{event.attendanceCount} คน</span>
            </div>
          </div>

          <div>
            {event.hasAttended ? (
              <div className="attendanceConfirmedBadge">
                <CheckCircle2 size={16} />
                <span>คุณได้สแกนเข้าร่วมงานแล้ว (+1 คะแนน)</span>
              </div>
            ) : (
              <button
                onClick={handleToggleRegistration}
                disabled={registering}
                className={`btnRegisterAction ${event.hasRegistered ? 'cancel' : 'register'}`}
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
        <div className="qrCodeSectionCard">
          <div className="qrCodeRow">
            {/* QR Image Frame */}
            <div className="qrFrameBox">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Event Check-in QR Code"
                  className="qrImage"
                />
              ) : (
                <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinnerCircle" />
                </div>
              )}
              <span className="qrSubtext">
                ใช้กล้องมือถือหรือ LINE สแกน (ยืนยันผ่าน ThaID)
              </span>

              {/* QR Action Buttons */}
              <div className="qrActionButtons">
                <button onClick={handleDownloadQr} className="btnQrAction">
                  <Download size={13} />
                  <span>บันทึกรูป</span>
                </button>
                <button onClick={handlePrint} className="btnQrAction">
                  <Printer size={13} />
                  <span>พิมพ์ป้ายตั้งหน้างาน</span>
                </button>
              </div>
            </div>

            {/* QR Instructions and Time Info */}
            <div className="qrDetailsCol">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <QrCode size={18} color="#059669" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    QR Code เช็คอินหน้างาน (Static Check-in QR)
                  </h2>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  ผู้จัดงานสามารถนำ QR Code นี้ฉายขึ้นจอโปรเจกเตอร์ หรือพิมพ์เป็นป้ายตั้งไว้ ณ จุดลงทะเบียนหน้างานได้ทันที
                </p>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#065f46' }}>
                  📸 <strong>วิธีสแกน:</strong> ใช้ <strong>กล้องมือถือทั่วไป (iPhone / Android)</strong> หรือ <strong>แอป LINE</strong> สแกน QR Code นี้ ระบบจะเปิดแอป ThaID เพื่อยืนยันตัวตนให้อัตโนมัติ (ไม่เปิดกล้องจากในแอป ThaID มาสแกนโดยตรง)
                </div>
              </div>

              {/* Time Window Notice */}
              <div className="qrWindowStatusBox">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#334155' }}>เงื่อนไขช่วงเวลาสแกน:</strong>
                  <span className={`eventStatusBadge ${isOpen ? 'active' : ''}`}>
                    {isOpen ? 'เปิดรับสแกน' : isEarly ? 'ยังไม่เปิดรับ' : 'ปิดรับแล้ว'}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0', color: '#475569' }}>
                  • เวลาเปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#475569' }}>
                  • เวลาปิดรับสแกน: {formatThaiDateTime(event.checkinCloseTime)}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#b45309', fontSize: '0.75rem' }}>
                  ⚠️ หากสแกนก่อนเวลาเปิด หรือหลังเวลาปิด ระบบจะปฏิเสธการเช็คอินอัตโนมัติ
                </p>
              </div>

              {/* Link Sharing Box */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  ลิงก์เช็คอินโดยตรง (Direct Check-in URL)
                </label>
                <div className="qrDirectLinkWrap">
                  <input
                    type="text"
                    readOnly
                    value={checkinUrl}
                    className="qrLinkInput"
                  />
                  <button onClick={handleCopyLink} className="btnCopyLink">
                    <Copy size={13} />
                    <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                  </button>
                </div>
              </div>

              {/* How it works note */}
              <div className="qrNoticeBox">
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                  <ShieldCheck size={14} />
                  วิธีการใช้งานสำหรับผู้เข้าร่วม:
                </strong>
                <p style={{ margin: '0.15rem 0' }}>1. ผู้เข้าร่วมเปิดกล้องมือถือ หรือแอป ThaID เพื่อสแกน QR Code</p>
                <p style={{ margin: '0.15rem 0' }}>2. ระบบส่งต่อไปยัง ThaID เพื่อยืนยันตัวตนด้วยเลขบัตรประชาชน (DOPA)</p>
                <p style={{ margin: '0.15rem 0' }}>3. เมื่อยืนยันสำเร็จ ระบบจะบันทึกเช็คอินทันที 1 คน ต่อ 1 ครั้ง และรับ 1 คะแนน</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Linked Material Borrowing Card (If items were borrowed) */}
      {event.borrowRequest && (
        <div className="tableCard" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
              <Package size={16} color="#059669" />
              <span>คำขอยืมวัสดุ/อุปกรณ์สำหรับกิจกรรมนี้ ({event.borrowRequest.requestNo})</span>
            </h3>
            <span className="eventStatusBadge">
              สถานะ: {event.borrowRequest.status}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
            {event.borrowRequest.items?.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 600 }}>• {item.itemName}</span>
                <span style={{ color: '#64748b' }}>จำนวน: {item.quantity} ชิ้น</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Co-organizers List */}
      {event.coOrganizers && event.coOrganizers.length > 0 && (
        <div className="tableCard" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
            <Users size={16} color="#059669" />
            <span>ผู้รับผิดชอบร่วม ({event.coOrganizers.length} ท่าน)</span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {event.coOrganizers.map((co: any) => (
              <span key={co.id} className="eventStatusBadge">
                {co.member?.name} ({co.member?.department || 'ไม่ระบุแผนก'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Attendances vs Registrations */}
      <div className="tableCard">
        <div
          className="eventsTabsGroup"
          style={{ borderRadius: 0, padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
        >
          <button
            onClick={() => setActiveTab('attendances')}
            className={`eventsTabButton ${activeTab === 'attendances' ? 'active' : ''}`}
          >
            ผู้เข้าร่วมงานจริง (เช็คอินผ่าน ThaID) ({event.attendances?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`eventsTabButton ${activeTab === 'registrations' ? 'active' : ''}`}
          >
            ผู้ลงทะเบียนล่วงหน้า ({event.registrations?.length || 0})
          </button>
        </div>

        <div className="tableResponsiveWrap">
          {activeTab === 'attendances' ? (
            <div>
              {!event.attendances || event.attendances.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  ยังไม่มีผู้สแกนเช็คอินเข้าร่วมกิจกรรมในขณะนี้
                </div>
              ) : (
                <table className="styledTable">
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: 'center' }}>ลำดับ</th>
                      <th>ชื่อ-สกุล</th>
                      <th>แผนก/กลุ่มงาน</th>
                      <th>เวลาที่เช็คอิน</th>
                      <th style={{ textAlign: 'center' }}>คะแนน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.attendances.map((att: any, idx: number) => (
                      <tr key={att.id}>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td>
                          <strong>{att.member?.name || 'บุคลากร'}</strong>
                        </td>
                        <td>{att.member?.department || 'ไม่ระบุแผนก'}</td>
                        <td>{formatThaiDateTime(att.checkedInAt)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="pointsPill">
                            +{att.pointsAwarded} คะแนน
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div>
              {!event.registrations || event.registrations.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  ยังไม่มีผู้ลงทะเบียนล่วงหน้า
                </div>
              ) : (
                <table className="styledTable">
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: 'center' }}>ลำดับ</th>
                      <th>ชื่อ-สกุล</th>
                      <th>แผนก/กลุ่มงาน</th>
                      <th>วันที่ลงทะเบียน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.registrations.map((reg: any, idx: number) => (
                      <tr key={reg.id}>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                        <td>
                          <strong>{reg.member?.name || 'บุคลากร'}</strong>
                        </td>
                        <td>{reg.member?.department || 'ไม่ระบุแผนก'}</td>
                        <td>{formatThaiDateTime(reg.registeredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Standee Sheet (Hidden on screen, perfectly centered on A4 print) */}
      <div className="printStandee">
        <div className="printStandeeBorder">
          <h1 className="printHospitalName">
            โรงพยาบาลเถิน
          </h1>
          <div className="printDivider" />
          
          <h2 className="printEventTitle">{event.title}</h2>
          
          <div className="printEventMeta">
            <p><strong>วันและเวลา:</strong> {formatThaiDateTime(event.eventStartDate)}</p>
            {event.location && (
              <p><strong>สถานที่:</strong> {event.location}</p>
            )}
          </div>

          <div className="printQrContainer">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code สำหรับเช็คอิน"
                className="printQrImage"
              />
            )}
          </div>

          <div className="printInstructions">
            <p className="printInstructionTitle">
              สแกนเช็คอินเข้าร่วมกิจกรรม (ยืนยันตัวตนผ่านแอป ThaID)
            </p>
            <p className="printInstructionTimes">
              ช่วงเวลาเปิดรับสแกน: {formatThaiDateTime(event.checkinOpenTime)} ถึง {formatThaiDateTime(event.checkinCloseTime)}
            </p>
            <p className="printInstructionNote">
              📱 ใช้กล้องมือถือทั่วไปหรือแอป LINE สแกนป้ายนี้ • ได้รับ 1 คะแนนสะสม
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
