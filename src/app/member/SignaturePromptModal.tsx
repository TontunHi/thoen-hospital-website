'use client'

import React, { useState, useEffect } from 'react'
import { PenTool, X, ArrowRight, ShieldCheck, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SignaturePromptModalProps {
  hasSignature: boolean
  memberId: number
  isSubdistrict?: boolean
  isTelegramPromptOpen?: boolean
  featureEnabled?: boolean
}

const HIDE_STORAGE_PREFIX = 'hide_signature_prompt_'

export default function SignaturePromptModal({
  hasSignature,
  memberId,
  isSubdistrict = false,
  isTelegramPromptOpen = false,
  featureEnabled = true,
}: SignaturePromptModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [dontShowToday, setDontShowToday] = useState(false)

  useEffect(() => {
    // 1. ถ้ามีลายเซ็นแล้ว หรือเป็นบัญชี รพ.สต. หรือระบบลายเซ็นถูกปิดการใช้งาน -> ไม่ต้องแสดงผล
    if (hasSignature || isSubdistrict || !featureEnabled) {
      setIsOpen(false)
      return
    }

    // ล้างค่า session_hide เก่าที่อาจค้างอยู่ใน session เพื่อไม่ให้บล็อกการแสดงผลผิดพลาด
    try {
      sessionStorage.removeItem(`session_hide_signature_prompt_${memberId}`)
    } catch {
      // Storage access fallback
    }

    // 2. ตรวจสอบ "วันนี้ไม่แสดงผลอีก" ใน localStorage
    try {
      const storageKey = `${HIDE_STORAGE_PREFIX}${memberId}`
      const hideUntilStr = localStorage.getItem(storageKey)
      if (hideUntilStr) {
        const hideUntil = parseInt(hideUntilStr, 10)
        if (!isNaN(hideUntil) && Date.now() < hideUntil) {
          return
        }
      }
    } catch {
      // Storage access fallback (incognito/security)
    }

    // 3. ถ้า Telegram Prompt หรือโมดอลอื่นกำลังเปิดอยู่ -> ให้รอ ไม่ให้ Popup เด้งซ้อนทับกัน
    if (isTelegramPromptOpen) {
      setIsOpen(false)
      return
    }

    // หน่วงเวลาเปิด Popup ขึ้นมาอย่างนุ่มนวล
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 900)

    return () => clearTimeout(timer)
  }, [hasSignature, memberId, isSubdistrict, isTelegramPromptOpen, featureEnabled])

  // ปิดด้วยปุ่ม Escape ตามหลักการเข้าถึง (a11y)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const saveSnoozeIfChecked = () => {
    try {
      // บันทึกเฉพาะเมื่อผู้ใช้ติ๊ก "วันนี้ไม่แสดงผลอีก" เท่านั้น
      if (dontShowToday) {
        const storageKey = `${HIDE_STORAGE_PREFIX}${memberId}`
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)
        localStorage.setItem(storageKey, endOfDay.getTime().toString())
      }
    } catch {
      // Silently catch storage errors
    }
  }

  const handleClose = () => {
    saveSnoozeIfChecked()
    setIsOpen(false)
  }

  const handleGoToSignature = () => {
    saveSnoozeIfChecked()
    setIsOpen(false)
    router.push('/member/signature')
  }

  if (!isOpen || hasSignature || isSubdistrict || !featureEnabled) return null

  return (
    <div className="signaturePromptOverlay" onClick={handleClose}>
      <div
        className="signaturePromptCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Accent */}
        <div className="signaturePromptGlowStrip" />

        {/* Close Icon Button */}
        <button
          type="button"
          className="signaturePromptCloseBtn"
          onClick={handleClose}
          aria-label="ปิดหน้าต่าง"
        >
          <X size={18} />
        </button>

        {/* Modal Body */}
        <div className="signaturePromptBody">
          <div className="signaturePromptIconBox">
            <PenTool size={24} />
          </div>

          <h3 id="signature-prompt-title" className="signaturePromptTitle">
            ลงทะเบียนลายเซ็นดิจิทัลของคุณ
          </h3>
          <p className="signaturePromptSubtitle">
            คุณยังไม่ได้บันทึกลายเซ็นอิเล็กทรอนิกส์ในระบบ โปรดลงทะเบียนเพื่อใช้ลงนามในระบบกล่องงานและเอกสารอนุมัติ
          </p>

          <div className="signaturePromptBenefits">
            <div className="promptBenefitRow">
              <Check size={15} className="promptBenefitIcon" />
              <span>ใช้ลงนามอนุมัติงานในระบบกล่องงาน (Inbox Tasks) ได้ทันที</span>
            </div>
            <div className="promptBenefitRow">
              <ShieldCheck size={15} className="promptBenefitIcon" />
              <span>ปลอดภัยตามมาตรฐาน พ.ร.บ. ธุรกรรมทางอิเล็กทรอนิกส์</span>
            </div>
            <div className="promptBenefitRow">
              <PenTool size={15} className="promptBenefitIcon" />
              <span>วาดบนหน้าจอหรืออัปโหลดรูปภาพ เพียงครั้งเดียวใช้ได้ทุกระบบงาน</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="signaturePromptActionGroup">
            <button
              type="button"
              className="signaturePromptConnectBtn"
              onClick={handleGoToSignature}
            >
              <span>ลงทะเบียนลายเซ็นตอนนี้</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Footer Controls: Checkbox 'วันนี้ไม่แสดงผลอีก' & Dismiss */}
          <div className="signaturePromptFooter">
            <label className="signaturePromptCheckboxLabel">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="signaturePromptCheckbox"
              />
              <span>วันนี้ไม่แสดงผลอีก</span>
            </label>

            <button
              type="button"
              className="signaturePromptLaterBtn"
              onClick={handleClose}
            >
              ไว้คราวหน้า
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
