'use client'

import React, { useState, useEffect, useRef } from 'react'
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

export default function TelegramLinkModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [challengeData, setChallengeData] = useState<{ botUrl: string; expiresAt: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Custom Confirmation Modal State (แทน window.confirm)
  const [showConfirmUnlink, setShowConfirmUnlink] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch status on open
  useEffect(() => {
    if (isOpen) {
      loadStatus()
    } else {
      stopPolling()
      setChallengeData(null)
      setError(null)
      setShowConfirmUnlink(false)
    }
  }, [isOpen])

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
      if (json.success) {
        setChallengeData(json.data)
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
          setStatus(data.data)
          setChallengeData(null)
          stopPolling()
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

  const qrCodeUrl = challengeData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(challengeData.botUrl)}`
    : ''

  return (
    <div className="telegramModalOverlay" onClick={onClose}>
      <div className="telegramModalCard compactModal" onClick={(e) => e.stopPropagation()}>
        {/* Header - Compact */}
        <div className="telegramModalHeader compactHeader">
          <div className="telegramModalTitle">
            <div className="telegramIconBadge compactBadge">
              <Send size={18} />
            </div>
            <div>
              <h3>เชื่อมต่อ Telegram</h3>
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

          {loading ? (
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
              <div className="qrWrapper compactQr">
                <img src={qrCodeUrl} alt="Telegram QR" className="qrImage compactQrImg" />
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

              <button
                type="button"
                className="telegramCancelChallengeBtn"
                onClick={() => {
                  stopPolling()
                  setChallengeData(null)
                }}
              >
                ย้อนกลับ
              </button>
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

        {/* ── Custom In-App Unlink Confirmation Modal (แทน window.confirm) ── */}
        {showConfirmUnlink && (
          <div className="customConfirmOverlay" onClick={() => setShowConfirmUnlink(false)}>
            <div className="customConfirmCard" onClick={(e) => e.stopPropagation()}>
              <div className="customConfirmIconBox">
                <ShieldAlert size={28} />
              </div>
              <h4 className="customConfirmTitle">ยืนยันยกเลิกการเชื่อมต่อ?</h4>
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
    </div>
  )
}
