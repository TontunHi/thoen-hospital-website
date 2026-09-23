'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Send, CheckCircle2, AlertCircle, ExternalLink, Unlink, QrCode, RefreshCw, X } from 'lucide-react'

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
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch status on open
  useEffect(() => {
    if (isOpen) {
      loadStatus()
    } else {
      stopPolling()
      setChallengeData(null)
      setError(null)
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

  // Unlink account
  const handleUnlink = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการเชื่อมต่อ Telegram กับระบบโรงพยาบาล?')) {
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/member/telegram', { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setStatus({ isLinked: false })
        setChallengeData(null)
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

  // Generate QR code image URL using standard SVG data uri / Google charts API or external QR generator
  const qrCodeUrl = challengeData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(challengeData.botUrl)}`
    : ''

  return (
    <div className="telegramModalOverlay" onClick={onClose}>
      <div className="telegramModalCard" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="telegramModalHeader">
          <div className="telegramModalTitle">
            <div className="telegramIconBadge">
              <Send size={20} />
            </div>
            <div>
              <h3>เชื่อมระบบ Telegram</h3>
              <p>รับการแจ้งเตือนงานซ่อมและเอกสารส่วนตัวผ่านแอปพลิเคชัน Telegram</p>
            </div>
          </div>
          <button className="telegramCloseBtn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="telegramModalBody">
          {error && (
            <div className="telegramAlertBox error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="telegramLoadingState">
              <RefreshCw className="animate-spin" size={24} />
              <span>กำลังตรวจสอบสถานะการเชื่อมต่อ...</span>
            </div>
          ) : status?.isLinked ? (
            /* Linked State */
            <div className="telegramLinkedContent">
              <div className="telegramStatusBadge connected">
                <CheckCircle2 size={18} />
                <span>เชื่อมต่อบัญชีเรียบร้อยแล้ว</span>
              </div>

              <div className="telegramDetailsBox">
                <div className="telegramDetailRow">
                  <span className="label">ชื่อผู้ใช้ Telegram:</span>
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
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="telegramActionArea">
                <button
                  className="telegramUnlinkBtn"
                  onClick={handleUnlink}
                  disabled={actionLoading}
                >
                  <Unlink size={16} />
                  <span>{actionLoading ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมต่อ'}</span>
                </button>
              </div>
            </div>
          ) : challengeData ? (
            /* Active Linking Challenge Screen (QR + Deep Link) */
            <div className="telegramChallengeContent">
              <div className="telegramInstructions">
                <span className="stepNumber">1</span>
                <span>เปิดแอปพลิเคชัน Telegram บนโทรศัพท์ แล้วสแกน QR Code นี้ หรือกดปุ่มเปิดแอป</span>
              </div>

              <div className="qrWrapper">
                <img src={qrCodeUrl} alt="Telegram Link QR Code" className="qrImage" />
                <div className="qrExpiryHint">
                  <RefreshCw size={13} className="animate-spin" />
                  <span>กำลังรอให้ท่านกดปุ่ม [START] ใน Telegram...</span>
                </div>
              </div>

              <div className="telegramInstructions">
                <span className="stepNumber">2</span>
                <span>เมื่อเปิดหน้าแชทกับบอท ให้กดปุ่ม <strong>[ START ]</strong> ที่ด้านล่าง</span>
              </div>

              <div className="challengeActionRow">
                <a
                  href={challengeData.botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="telegramOpenBotBtn"
                >
                  <ExternalLink size={16} />
                  <span>เปิดในแอป Telegram ทันที</span>
                </a>

                <button
                  type="button"
                  className="telegramCopyBtn"
                  onClick={() => {
                    navigator.clipboard.writeText(challengeData.botUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์'}
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
            /* Unlinked Initial Screen */
            <div className="telegramUnlinkedContent">
              <div className="telegramBenefitList">
                <div className="benefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>รับการแจ้งเตือนทันทีเมื่อมีช่างรับงานซ่อมคอมพิวเตอร์ของคุณ</span>
                </div>
                <div className="benefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>รับสรุปผลและรายงานเมื่อช่างทำการปิดงานซ่อมเรียบร้อย</span>
                </div>
                <div className="benefitItem">
                  <span className="benefitBullet">✓</span>
                  <span>ปลอดภัย ไม่เปิดเผยเบอร์โทรศัพท์ส่วนตัว และยกเลิกการเชื่อมต่อได้ตลอดเวลา</span>
                </div>
              </div>

              <div className="telegramStartLinkingBox">
                <button
                  className="telegramConnectBtn"
                  onClick={handleRequestLink}
                  disabled={actionLoading}
                >
                  <QrCode size={18} />
                  <span>{actionLoading ? 'กำลังสร้างรหัส...' : 'เชื่อมต่อบัญชี Telegram ทันที'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
