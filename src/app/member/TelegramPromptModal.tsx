'use client'

import React, { useState, useEffect } from 'react'
import { Send, X, ArrowRight, ShieldCheck, Bell } from 'lucide-react'

interface TelegramPromptModalProps {
  isLinked: boolean
  memberId: number
  onOpenConnectModal: () => void
}

const HIDE_STORAGE_PREFIX = 'hide_telegram_prompt_'

export default function TelegramPromptModal({
  isLinked,
  memberId,
  onOpenConnectModal,
}: TelegramPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    // 1. ถ้าเชื่อมต่อแล้ว ไม่ต้องแสดง popup ใด ๆ
    if (isLinked) {
      setIsOpen(false)
      return
    }

    // 2. ตรวจสอบการตั้งค่า "ไม่แสดงผล 1 วัน" ใน localStorage
    try {
      const storageKey = `${HIDE_STORAGE_PREFIX}${memberId}`
      const hideUntilStr = localStorage.getItem(storageKey)
      if (hideUntilStr) {
        const hideUntil = parseInt(hideUntilStr, 10)
        // ถ้าเวลายังไม่พ้น 1 วัน ไม่ต้องแสดง
        if (!isNaN(hideUntil) && Date.now() < hideUntil) {
          return
        }
      }
    } catch {
      // LocalStorage access fallback (incognito/security)
    }

    // หน่วงเวลาเล็กน้อย (600ms) หลังเข้าสู่ระบบ เพื่อให้ UI หน้าเว็บโหลดเสร็จก่อน Pop ขึ้นมาอย่างนุ่มนวล
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 600)

    return () => clearTimeout(timer)
  }, [isLinked, memberId])

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        const storageKey = `${HIDE_STORAGE_PREFIX}${memberId}`
        // บันทึกเวลาถัดไปอีก 24 ชั่วโมง (86,400,000 ms)
        const hideUntil = Date.now() + 24 * 60 * 60 * 1000
        localStorage.setItem(storageKey, hideUntil.toString())
      } catch {
        // Silently catch storage errors
      }
    }
    setIsOpen(false)
  }

  const handleConnectNow = () => {
    handleClose()
    onOpenConnectModal()
  }

  if (!isOpen) return null

  return (
    <div className="telegramPromptOverlay" onClick={handleClose}>
      <div className="telegramPromptCard" onClick={(e) => e.stopPropagation()}>
        {/* Decorative Top Accent */}
        <div className="telegramPromptGlowStrip" />

        {/* Close Icon Button */}
        <button
          type="button"
          className="telegramPromptCloseBtn"
          onClick={handleClose}
          aria-label="ปิดหน้าต่าง"
        >
          <X size={18} />
        </button>

        {/* Modal Body */}
        <div className="telegramPromptBody">
          <div className="telegramPromptIconBox">
            <Send size={26} />
          </div>

          <h3 className="telegramPromptTitle">คุณยังไม่ได้เชื่อมต่อ Telegram</h3>
          <p className="telegramPromptSubtitle">
            เชื่อมต่อบัญชีเพื่อรับการแจ้งเตือนงานซ่อม เอกสารราชการ และงานอนุมัติแบบส่วนตัวผ่านแอป Telegram ทันที
          </p>

          <div className="telegramPromptBenefits">
            <div className="promptBenefitRow">
              <Bell size={15} className="promptBenefitIcon" />
              <span>แจ้งเตือนส่วนตัว สะดวก รวดเร็ว ตลอด 24 ชม.</span>
            </div>
            <div className="promptBenefitRow">
              <ShieldCheck size={15} className="promptBenefitIcon" />
              <span>ปลอดภัย ไม่ต้องเปิดเผยเบอร์โทรศัพท์ส่วนตัว</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="telegramPromptActionGroup">
            <button
              type="button"
              className="telegramPromptConnectBtn"
              onClick={handleConnectNow}
            >
              <span>เชื่อมต่อ Telegram เลย</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Footer Controls: Checkbox 'ไม่แสดงผล 1 วัน' & Dismiss */}
          <div className="telegramPromptFooter">
            <label className="telegramPromptCheckboxLabel">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="telegramPromptCheckbox"
              />
              <span>ไม่ต้องแสดง 1 วัน</span>
            </label>

            <button
              type="button"
              className="telegramPromptLaterBtn"
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
