'use client'

import React, { useState, useEffect } from 'react'
import { Send, X, ArrowRight, ShieldCheck, Bell, Wrench } from 'lucide-react'

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
  const [dontShowToday, setDontShowToday] = useState(false)

  useEffect(() => {
    // 1. ถ้าเชื่อมต่อแล้ว ไม่ต้องแสดง popup ใด ๆ
    if (isLinked) {
      setIsOpen(false)
      return
    }

    // 2. ตรวจสอบการตั้งค่า "วันนี้ไม่แสดงผลอีก" ใน localStorage
    try {
      const storageKey = `${HIDE_STORAGE_PREFIX}${memberId}`
      const hideUntilStr = localStorage.getItem(storageKey)
      if (hideUntilStr) {
        const hideUntil = parseInt(hideUntilStr, 10)
        // ถ้าเวลายังไม่พ้นกำหนด (สิ้นสุดวันนี้) ไม่ต้องแสดง
        if (!isNaN(hideUntil) && Date.now() < hideUntil) {
          return
        }
      }
    } catch {
      // LocalStorage access fallback (incognito/security)
    }

    // หน่วงเวลาเล็กน้อย (800ms) หลังเข้าสู่ระบบ เพื่อให้ UI หน้าเว็บโหลดเสร็จก่อน Pop ขึ้นมาอย่างนุ่มนวล
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 800)

    return () => clearTimeout(timer)
  }, [isLinked, memberId])

  const saveSnoozeIfChecked = () => {
    if (dontShowToday) {
      try {
        const storageKey = `${HIDE_STORAGE_PREFIX}${memberId}`
        // ตั้งเวลาหมดอายุที่สิ้นสุดของวันปัจจุบัน (23:59:59.999)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)
        localStorage.setItem(storageKey, endOfDay.getTime().toString())
      } catch {
        // Silently catch storage errors
      }
    }
  }

  const handleClose = () => {
    saveSnoozeIfChecked()
    setIsOpen(false)
  }

  const handleConnectNow = () => {
    saveSnoozeIfChecked()
    setIsOpen(false)
    onOpenConnectModal()
  }

  if (!isOpen || isLinked) return null

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
            <Send size={24} />
          </div>

          <h3 className="telegramPromptTitle">เชื่อมต่อ Telegram เพื่อรับการแจ้งเตือน</h3>
          <p className="telegramPromptSubtitle">
            รับการแจ้งเตือนงานซ่อมบำรุง เอกสารคำขอ และงานลงนามอนุมัติแบบเรียลไทม์ผ่านแอป Telegram ทันที
          </p>

          <div className="telegramPromptBenefits">
            <div className="promptBenefitRow">
              <Bell size={15} className="promptBenefitIcon" />
              <span>แจ้งเตือนคำขอและเอกสารที่ต้องดำเนินการ</span>
            </div>
            <div className="promptBenefitRow">
              <Wrench size={15} className="promptBenefitIcon" />
              <span>ติดตามสถานะงานแจ้งซ่อมบำรุงแบบเรียลไทม์</span>
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

          {/* Footer Controls: Checkbox 'วันนี้ไม่แสดงผลอีก' & Dismiss */}
          <div className="telegramPromptFooter">
            <label className="telegramPromptCheckboxLabel">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="telegramPromptCheckbox"
              />
              <span>วันนี้ไม่แสดงผลอีก</span>
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
