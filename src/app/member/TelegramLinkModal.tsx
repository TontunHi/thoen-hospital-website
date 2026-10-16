'use client'

import React, { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  QrCode,
  RefreshCw,
  X,
  ShieldAlert,
  Loader2
} from 'lucide-react'

interface TelegramStatus {
  isLinked: boolean
  telegramUsername?: string | null
  firstName?: string | null
  linkedAt?: string | null
  telegramChatIdMasked?: string | null
}

interface ChallengeData {
  botUrl: string
  expiresAt: string
  qrCodeUrl?: string
}

interface TelegramLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onLinked?: () => void
  onUnlinked?: () => void
}

export default function TelegramLinkModal({ isOpen, onClose, onLinked, onUnlinked }: TelegramLinkModalProps) {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [justConnected, setJustConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Custom Confirmation Modal State (แทน window.confirm)
  const [showConfirmUnlink, setShowConfirmUnlink] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Generate or load QR Code Data URL locally whenever challengeData changes
  useEffect(() => {
    let isMounted = true
    if (challengeData?.botUrl) {
      if (challengeData.qrCodeUrl) {
        setQrCodeDataUrl(challengeData.qrCodeUrl)
      } else {
        QRCode.toDataURL(challengeData.botUrl, {
          width: 220,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        })
          .then((url) => {
            if (isMounted) setQrCodeDataUrl(url)
          })
          .catch((err) => {
            console.error('Failed to generate Telegram QR code:', err)
          })
      }
    } else {
      setQrCodeDataUrl('')
    }
    return () => {
      isMounted = false
    }
  }, [challengeData])

  // Fetch status on open
  useEffect(() => {
    if (isOpen) {
      setJustConnected(false)
      loadStatus()
    } else {
      stopPolling()
      setChallengeData(null)
      setQrCodeDataUrl('')
      setJustConnected(false)
      setError(null)
      setShowConfirmUnlink(false)
    }
  }, [isOpen])

  // ปิดด้วยปุ่ม Escape ตามหลักการเข้าถึง (a11y)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirmUnlink) {
          setShowConfirmUnlink(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showConfirmUnlink, onClose])

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/member/telegram')
      const data = await res.json()
      if (data.success) {
        setStatus(data.data)
        if (!data.data?.isLinked) {
          // If not linked yet, automatically create challenge & display QR code immediately
          await handleRequestLink()
        }
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูลสถานะได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  // Request linking challenge (QR code + Deep link)
  const handleRequestLink = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/member/telegram', { method: 'POST' })
      const json = await res.json()
      if (json.success && json.data?.botUrl) {
        setChallengeData(json.data)
        if (json.data.qrCodeUrl) {
          setQrCodeDataUrl(json.data.qrCodeUrl)
        }
        startPolling()
      } else {
        setError(json.error || 'ไม่สามารถสร้างลิงก์เชื่อมต่อได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setActionLoading(false)
    }
  }

  // Start polling every 3 seconds to see if user tapped /start in Telegram
  const startPolling = () => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/member/telegram')
        const data = await res.json()
        if (data.success && data.data?.isLinked) {
          stopPolling()
          setStatus(data.data)
          setChallengeData(null)
          setJustConnected(true)
          onLinked?.()
          setTimeout(() => {
            setJustConnected(false)
            onClose()
          }, 1500)
        }
      } catch {
        // Silently retry on polling error
      }
    }, 3000)
  }

  // Execute actual Unlink
  const executeUnlink = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/member/telegram', { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setStatus({ isLinked: false })
        setChallengeData(null)
        setShowConfirmUnlink(false)
        onUnlinked?.()
      } else {
        setError(json.error || 'ไม่สามารถยกเลิกการเชื่อมต่อได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการยกเลิกการเชื่อมต่อ')
    } finally {
      setActionLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="telegramModalOverlay" onClick={onClose}>
      <div
        className="telegramModalCard compactModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Compact */}
        <div className="telegramModalHeader compactHeader">
          <div className="telegramModalTitle">
            <div className="telegramIconBadge compactBadge">
              <Send size={18} />
            </div>
            <div>
              <h3 id="telegram-modal-title">เชื่อมต่อ Telegram</h3>
            </div>
          </div>
          <button className="telegramCloseBtn compactCloseBtn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content Body - Compact */}
        <div className="telegramModalBody compactBody">
          {error && (
            <div className="telegramAlertBox error compactAlert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {justConnected ? (
            <div className="telegramSuccessState" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                color: '#0088cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                เชื่อมต่อ Telegram เสร็จเรียบร้อยแล้ว
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                ระบบบันทึกข้อมูลและเปิดรับการแจ้งเตือนแล้ว
              </p>
            </div>
          ) : loading ? (
            <div className="telegramLoadingState compactLoading">
              <RefreshCw className="animate-spin text-emerald-600" size={22} />
              <span>กำลังตรวจสอบสถานะ...</span>
            </div>
          ) : status?.isLinked ? (
            /* Linked State */
            <div className="telegramLinkedContent compactLinked">
              <div className="telegramStatusBadge connected compactStatus">
                <CheckCircle2 size={16} />
                <span>เชื่อมต่อบัญชีเรียบร้อยแล้ว</span>
              </div>

              <div className="telegramDetailsBox compactBox">
                <div className="telegramDetailRow">
                  <span className="label">ชื่อผู้ใช้:</span>
                  <span className="value">
                    {status.telegramUsername ? `@${status.telegramUsername}` : status.firstName || 'ไม่ระบุชื่อ'}
                  </span>
                </div>
                <div className="telegramDetailRow">
                  <span className="label">Chat ID:</span>
                  <span className="value font-mono">{status.telegramChatIdMasked}</span>
                </div>
                {status.linkedAt && (
                  <div className="telegramDetailRow">
                    <span className="label">วันที่เชื่อมต่อ:</span>
                    <span className="value">
                      {new Date(status.linkedAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="telegramActionArea">
                <button
                  type="button"
                  className="telegramUnlinkBtn compactUnlinkBtn"
                  onClick={() => setShowConfirmUnlink(true)}
                  disabled={actionLoading}
                >
                  <Unlink size={15} />
                  <span>ยกเลิกการเชื่อมต่อ</span>
                </button>
              </div>
            </div>
          ) : challengeData ? (
            /* Active Linking Challenge Screen (QR + Deep Link) - Compact */
            <div className="telegramChallengeContent compactChallenge">
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 2px', lineHeight: 1.4, textAlign: 'center' }}>
                สแกน QR Code ด้วยโทรศัพท์ หรือกดปุ่มเปิด Telegram ทันที
              </p>

              <div className="qrWrapper compactQr">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="สแกนเพื่อเชื่อมต่อ Telegram"
                    className="qrImage compactQrImg"
                    width={160}
                    height={160}
                  />
                ) : (
                  <div
                    style={{
                      width: 160,
                      height: 160,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f8fafc',
                      borderRadius: 8,
                      gap: 8,
                    }}
                  >
                    <Loader2 size={24} className="animate-spin text-sky-600" />
                    <span style={{ fontSize: 11, color: '#64748b' }}>กำลังสร้าง QR Code...</span>
                  </div>
                )}
                <div className="qrExpiryHint">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>รอการกด [START] ในแอป Telegram...</span>
                </div>
              </div>

              <div className="challengeActionRow">
                <a
                  href={challengeData.botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="telegramOpenBotBtn compactBtn"
                >
                  <ExternalLink size={15} />
                  <span>เปิด Telegram ทันที</span>
                </a>

                <button
                  type="button"
                  className="telegramCopyBtn compactBtn"
                  onClick={() => {
                    navigator.clipboard.writeText(challengeData.botUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="telegramCancelChallengeBtn"
                  onClick={handleRequestLink}
                  disabled={actionLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={12} className={actionLoading ? 'animate-spin' : ''} />
                  <span>{actionLoading ? 'กำลังสร้างรหัสใหม่...' : 'สร้าง QR Code ใหม่'}</span>
                </button>
              </div>

              <div className="compactBenefitCard" style={{ marginTop: '2px', textAlign: 'left', width: '100%' }}>
                <div className="compactBenefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>รับแจ้งเตือนงานซ่อมและสถานะปิดงานแบบเรียลไทม์</span>
                </div>
                <div className="compactBenefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>รับแจ้งเตือนเอกสารคำขอและรายการลงนามอนุมัติ</span>
                </div>
              </div>
            </div>
          ) : (
            /* Unlinked Initial Screen - Compact & Informative */
            <div className="telegramUnlinkedContent compactUnlinked">
              <div className="compactBenefitCard">
                <div className="compactBenefitHeader">
                  <span>สิทธิประโยชน์เมื่อเชื่อมต่อระบบ:</span>
                </div>
                <div className="compactBenefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>รับการแจ้งเตือนงานซ่อมและสถานะปิดงานแบบเรียลไทม์</span>
                </div>
                <div className="compactBenefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>รับแจ้งเตือนเอกสาร คำขอ และรายการที่ต้องลงนามอนุมัติ</span>
                </div>
                <div className="compactBenefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>ปลอดภัย ข้อมูลส่วนบุคคลเป็นส่วนตัว ไม่เปิดเผยเบอร์โทรศัพท์</span>
                </div>
              </div>

              <button
                className="telegramConnectBtn compactConnectBtn"
                onClick={handleRequestLink}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังเชื่อมต่อ...</span>
                  </>
                ) : (
                  <>
                    <QrCode size={16} />
                    <span>เชื่อมต่อบัญชี Telegram</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Custom In-App Unlink Confirmation Modal (แทน window.confirm) ── */}
      {showConfirmUnlink && (
        <div className="customConfirmOverlay" onClick={() => setShowConfirmUnlink(false)}>
          <div
            className="customConfirmCard"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-unlink-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customConfirmIconBox">
              <ShieldAlert size={28} />
            </div>
            <h4 id="confirm-unlink-title" className="customConfirmTitle">
              ยืนยันยกเลิกการเชื่อมต่อ?
            </h4>
            <p className="customConfirmDesc">
              หากยกเลิก คุณจะไม่ได้รับการแจ้งเตือนงานซ่อมและเอกสารผ่าน Telegram อีกต่อไป จนกว่าจะเชื่อมต่อใหม่
            </p>
            <div className="customConfirmActions">
              <button
                type="button"
                className="confirmBtnCancel"
                onClick={() => setShowConfirmUnlink(false)}
                disabled={actionLoading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="confirmBtnDanger"
                onClick={executeUnlink}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังยกเลิก...</span>
                  </>
                ) : (
                  <span>ยืนยันยกเลิก</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
