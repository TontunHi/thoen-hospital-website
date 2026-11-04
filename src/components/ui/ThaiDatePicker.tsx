'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { formatThaiDate } from '@/lib/formatters'
import styles from './ThaiDatePicker.module.css'

export interface ThaiDatePickerProps {
  value: string // Format: 'YYYY-MM-DD' or ''
  onChange: (value: string) => void
  placeholder?: string
  minDate?: string // Format: 'YYYY-MM-DD'
  maxDate?: string // Format: 'YYYY-MM-DD'
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  'aria-label'?: string
}

const THAI_MONTH_NAMES_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

const WEEKDAY_NAMES = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

export default function ThaiDatePicker({
  value,
  onChange,
  placeholder = 'วว/ดด/ปปปป',
  minDate,
  maxDate,
  disabled = false,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
}: ThaiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Current view year & month (CE)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return parseInt(value.slice(0, 4), 10)
    }
    return new Date().getFullYear()
  })

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return parseInt(value.slice(5, 7), 10) - 1
    }
    return new Date().getMonth()
  })

  // Display text in input
  const displayText = useMemo(() => {
    if (!value) return ''
    return formatThaiDate(value, '')
  }, [value])

  const [typedText, setTypedText] = useState(displayText)
  const [isEditing, setIsEditing] = useState(false)

  // Sync typedText when value changes from outside
  useEffect(() => {
    if (!isEditing) {
      setTypedText(displayText)
    }
  }, [displayText, isEditing])

  // Sync calendar view month/year when popover opens or value changes
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const y = parseInt(value.slice(0, 4), 10)
      const m = parseInt(value.slice(5, 7), 10) - 1
      setViewYear(y)
      setViewMonth(m)
    }
  }, [value, isOpen])

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsEditing(false)
        setTypedText(displayText)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, displayText])

  // Parse typed text on blur or Enter
  const handleCommitTyped = useCallback(() => {
    setIsEditing(false)
    const trimmed = typedText.trim()
    if (!trimmed) {
      onChange('')
      return
    }

    // Try parsing: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10)
      const m = parseInt(dmyMatch[2], 10)
      let y = parseInt(dmyMatch[3], 10)

      // Buddhist Era to Christian Era
      if (y > 2400) {
        y -= 543
      }

      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const dateObj = new Date(iso)
        if (!isNaN(dateObj.getTime()) && dateObj.getDate() === d) {
          onChange(iso)
          return
        }
      }
    }

    // Try ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const dateObj = new Date(trimmed)
      if (!isNaN(dateObj.getTime())) {
        onChange(trimmed)
        return
      }
    }

    // Revert to current valid value
    setTypedText(displayText)
  }, [typedText, displayText, onChange])

  // Calendar calculations
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate()
  }, [viewYear, viewMonth])

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay()
  }, [viewYear, viewMonth])

  // Generate Year Range options for select (Buddhist Years 2550 - 2580 -> CE 2007 - 2037)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - 15
    const endYear = currentYear + 10
    const list = []
    for (let y = endYear; y >= startYear; y--) {
      list.push(y)
    }
    return list
  }, [])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((prev) => prev - 1)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((prev) => prev + 1)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0')
    const dStr = String(day).padStart(2, '0')
    const selectedIso = `${viewYear}-${mStr}-${dStr}`
    onChange(selectedIso)
    setIsOpen(false)
  }

  const handleSelectToday = () => {
    const today = new Date()
    const yStr = today.getFullYear()
    const mStr = String(today.getMonth() + 1).padStart(2, '0')
    const dStr = String(today.getDate()).padStart(2, '0')
    onChange(`${yStr}-${mStr}-${dStr}`)
    setIsOpen(false)
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onChange('')
    setTypedText('')
    setIsOpen(false)
  }

  const todayIso = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      <div
        className={`${styles.inputWrapper} ${disabled ? styles.disabled : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev)
        }}
      >
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          aria-label={ariaLabel || 'เลือกวัน เดือน ปี'}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          placeholder={placeholder}
          disabled={disabled}
          value={isEditing ? typedText : displayText}
          onFocus={() => {
            setIsEditing(true)
            setTypedText(displayText)
          }}
          onChange={(e) => setTypedText(e.target.value)}
          onBlur={handleCommitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommitTyped()
              setIsOpen(false)
            } else if (e.key === 'Escape') {
              setIsOpen(false)
              setIsEditing(false)
              setTypedText(displayText)
            }
          }}
          className={styles.inputField}
        />

        {value && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            title="ล้างค่าวันที่"
            aria-label="ล้างวันที่"
          >
            <X size={14} />
          </button>
        )}

        <CalendarIcon size={15} className={styles.icon} />
      </div>

      {isOpen && !disabled && (
        <div
          className={styles.popover}
          role="dialog"
          aria-modal="true"
          aria-label="ปฏิทินเลือกวัน เดือน ปี (พ.ศ.)"
        >
          {/* Header Month / Year Select */}
          <div className={styles.popoverHeader}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={handlePrevMonth}
              title="เดือนก่อนหน้า"
              aria-label="เดือนก่อนหน้า"
            >
              ‹
            </button>

            <div className={styles.selectGroup}>
              <select
                className={styles.select}
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="เลือกเดือน"
              >
                {THAI_MONTH_NAMES_FULL.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className={styles.select}
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="เลือกปี พ.ศ."
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y + 543}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={styles.navBtn}
              onClick={handleNextMonth}
              title="เดือนถัดไป"
              aria-label="เดือนถัดไป"
            >
              ›
            </button>
          </div>

          {/* Weekday Names */}
          <div className={styles.weekdaysGrid}>
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} className={styles.weekdayCell}>
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className={styles.daysGrid}>
            {/* Blank leading days */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <span key={`empty-${idx}`} className={styles.emptyCell} />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1
              const mStr = String(viewMonth + 1).padStart(2, '0')
              const dStr = String(day).padStart(2, '0')
              const currentIso = `${viewYear}-${mStr}-${dStr}`

              const isSelected = value === currentIso
              const isToday = currentIso === todayIso

              let isDisabled = false
              if (minDate && currentIso < minDate) isDisabled = true
              if (maxDate && currentIso > maxDate) isDisabled = true

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  disabled={isDisabled}
                  className={`
                    ${styles.dayCell}
                    ${isSelected ? styles.selectedDay : ''}
                    ${isToday ? styles.today : ''}
                    ${isDisabled ? styles.disabledDay : ''}
                  `}
                  title={`วันที่ ${day} ${THAI_MONTH_NAMES_FULL[viewMonth]} พ.ศ. ${viewYear + 543}`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Popover Footer */}
          <div className={styles.popoverFooter}>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={handleSelectToday}
            >
              วันนี้
            </button>

            {value && (
              <button
                type="button"
                className={styles.footerBtn}
                onClick={handleClear}
              >
                ล้าง
              </button>
            )}

            <button
              type="button"
              className={`${styles.footerBtn} ${styles.closeBtn}`}
              onClick={() => setIsOpen(false)}
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
